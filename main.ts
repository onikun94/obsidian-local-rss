import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, normalizePath, requestUrl, sanitizeHTMLToDom, TFile, TFolder } from 'obsidian';
import * as xml2js from 'xml2js';
import { t } from './localization';


interface LocalRssSettings {
	feeds: Feed[];
	folderPath: string;
	template: string;
	fileNameTemplate: string;
	updateInterval: number;
	lastUpdateTime: number;
	includeImages: boolean;
	fetchImageFromLink: boolean;
	dateFormat: string;
	imageWidth: string;
	autoDeleteEnabled: boolean;
	autoDeleteDays: number;
	autoDeleteTimeUnit: string;
	autoDeleteBasedOn: string;
}

interface RssFeedItem {
	title?: string;
	description?: string;
	'content:encoded'?: string;
	link?: string;
	pubDate?: string;
	published?: string;
	author?: string;
	'dc:creator'?: string;
	category?: string | string[];
	'media:content'?: { $: { url: string } };
	'media:thumbnail'?: { $: { url: string } };
	enclosure?: { $: { type: string; url: string } };
}

interface AtomFeedItem {
	title?: string;
	summary?: string;
	content?: string;
	link?: { href: string };
	published?: string;
	updated?: string;
	author?: { name: string };
	category?: AtomCategory | AtomCategory[];
}

interface AtomCategory {
	term?: string;
}

interface AtomFeed {
	title?: string;
	entry?: AtomFeedItem | AtomFeedItem[];
}

interface Feed {
	url: string;
	name: string;
	folder: string;
	enabled: boolean;
}

interface RssItem {
	title: string;
	description: string;
	content: string;
	link: string;
	pubDate: string;
	author: string;
	categories: string[];
	imageUrl: string;
	savedDate: string;
}

const DEFAULT_SETTINGS: LocalRssSettings = {
	feeds: [],
	folderPath: 'RSS',
	template: '---\ntitle: {{title}}\nlink: {{link}}\nauthor: {{author}}\npublish_date: {{publishedTime}}\nsaved_date: {{savedTime}}\nimage: {{image}}\ntags: {{#tags}}\n---\n\n![image]({{image}})\n\n{{content}}',
	fileNameTemplate: '{{title}}',
	updateInterval: 60,
	lastUpdateTime: 0,
	includeImages: true,
	fetchImageFromLink: false,
	dateFormat: 'YYYY-MM-DD HH:mm:ss',
	imageWidth: '50%',
	autoDeleteEnabled: false,
	autoDeleteDays: 30,
	autoDeleteTimeUnit: 'days',
	autoDeleteBasedOn: 'saved'
}

const YAML_SPECIAL_CHARS = /[[\]{}:>|*&!%@,]/;

export default class LocalRssPlugin extends Plugin {
	settings: LocalRssSettings;
	updateIntervalId: number | null = null;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('rss', t('updateRssFeeds'), (evt: MouseEvent) => {
			this.updateFeeds();
		});

		this.addSettingTab(new LocalRssSettingTab(this.app, this));

		this.addCommand({
			id: 'update-rss-feeds',
			name: t('updateRssFeeds'),
			callback: () => {
				this.updateFeeds();
			}
		});

		this.addCommand({
			id: 'add-rss-feed',
			name: t('addRssFeed'),
			callback: () => {
				new AddFeedModal(this.app, this).open();
			}
		});

		this.startUpdateInterval();
	}

	onunload() {
		if (this.updateIntervalId) {
			window.clearInterval(this.updateIntervalId);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	startUpdateInterval() {
		if (this.updateIntervalId) {
			window.clearInterval(this.updateIntervalId);
		}

		if (this.settings.updateInterval > 0) {
			this.updateIntervalId = window.setInterval(() => {
				this.updateFeeds();
			}, this.settings.updateInterval * 60 * 1000);
		}
	}

	async updateFeeds() {
		new Notice(t('updatingRssFeeds'));

		const folderPath = this.settings.folderPath;
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await this.app.vault.createFolder(folderPath);
		}

		for (const feed of this.settings.feeds.filter(f => f.enabled)) {
			try {
				const response = await requestUrl(feed.url);
				if (response.status !== 200) {
					new Notice(t('failedToFetchFeed', feed.name));
					continue;
				}

				const parser = new xml2js.Parser({ explicitArray: false });
				const result = await parser.parseStringPromise(response.text);

				const feedFolderPath = `${folderPath}/${feed.folder || feed.name}`;
				const feedFolder = this.app.vault.getAbstractFileByPath(feedFolderPath);
				if (!feedFolder) {
					await this.app.vault.createFolder(feedFolderPath);
				}

				const channel = result.rss?.channel;
				if (!channel) {
					const feed = result.feed;
					if (feed && feed.entry) {
						const items = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
						for (const item of items) {
							await this.processAtomItem(item, feed, feedFolderPath);
						}
					} else {
						new Notice(t('unsupportedFeedFormat', feed.name));
					}
					continue;
				}

				const items = Array.isArray(channel.item) ? channel.item : [channel.item];

				for (const item of items) {
					await this.processRssItem(item, feed, feedFolderPath);
				}

				if (this.settings.autoDeleteEnabled) {
					await this.deleteOldFiles(feedFolderPath);
				}

				new Notice(t('updatedFeed', feed.name));
			} catch (error) {
				console.error(`Error updating feed ${feed.name}:`, error);
				new Notice(t('errorUpdatingFeed', feed.name));
			}
		}

		this.settings.lastUpdateTime = Date.now();
		await this.saveSettings();

		new Notice(t('rssFeedUpdateCompleted'));
	}

	async processRssItem(item: RssFeedItem, feed: Feed, folderPath: string) {
		const rssItem: RssItem = {
			title: item.title || 'Untitled',
			description: item.description || '',
			content: item['content:encoded'] || item.description || '',
			link: item.link || '',
			pubDate: item.pubDate || item.published || new Date().toISOString(),
			author: item.author || item['dc:creator'] || feed.name,
			categories: [],
			imageUrl: '',
			savedDate: new Date().toISOString()
		};

		rssItem.categories = this.normalizeCategories(item.category);

		if (this.settings.includeImages) {
			rssItem.imageUrl = this.extractImageUrl(item);

			// RSSフィードに画像がない場合、リンク先から取得
			if (!rssItem.imageUrl && this.settings.fetchImageFromLink && rssItem.link) {
				rssItem.imageUrl = await this.fetchImageFromUrl(rssItem.link);
			}
		}

		let fileName = this.settings.fileNameTemplate
			.replace(/{{title}}/g, rssItem.title)
			.replace(/{{published}}/g, this.formatDateTime(new Date(rssItem.pubDate)));

		fileName = fileName.replace(/[\\/:*?"<>|]/g, '-');
		fileName = normalizePath(`${folderPath}/${fileName}.md`);

		const existingFile = this.app.vault.getAbstractFileByPath(fileName);
		if (existingFile) {
			return;
		}

		const pubDate = new Date(rssItem.pubDate);
		const fullDateTime = this.formatDateTime(pubDate);

		const savedDate = new Date(rssItem.savedDate);
		const fullSavedDateTime = this.formatDateTime(savedDate);

		const escapedTitle = this.escapeYamlValue(rssItem.title);
		const escapedAuthor = this.escapeYamlValue(rssItem.author);

		// descriptionの最初の50文字を取得（改行を除去）
		const descriptionCleaned = rssItem.description.replace(/\r?\n/g, ' ').trim();
		const descriptionShort = descriptionCleaned.substring(0, 50) + (descriptionCleaned.length > 50 ? '...' : '');
		const escapedDescription = this.escapeYamlValue(descriptionCleaned);
		const escapedDescriptionShort = this.escapeYamlValue(descriptionShort);

		let processedContent = rssItem.content;
		if (this.settings.imageWidth && this.settings.imageWidth !== '100%') {
			processedContent = this.resizeImagesInContent(processedContent);
		}

		const template = this.prepareTemplate(this.settings.template, rssItem);

		const content = template
			.replace(/{{title}}/g, escapedTitle)
			.replace(/{{link}}/g, rssItem.link)
			.replace(/{{author}}/g, escapedAuthor)
			.replace(/{{publishedTime}}/g, fullDateTime)
			.replace(/{{savedTime}}/g, fullSavedDateTime)
			.replace(/{{image}}/g, rssItem.imageUrl)
			.replace(/{{description}}/g, escapedDescription)
			.replace(/{{descriptionShort}}/g, escapedDescriptionShort)
			.replace(/{{#tags}}/g, rssItem.categories.map(c => `#${c}`).join(' '))
			.replace(/{{content}}/g, processedContent);

		await this.app.vault.create(fileName, content);
	}

	async processAtomItem(item: AtomFeedItem, feed: AtomFeed, folderPath: string) {
		const rssItem: RssItem = {
			title: item.title || 'Untitled',
			description: item.summary || '',
			content: item.content || item.summary || '',
			link: item.link?.href || '',
			pubDate: item.published || item.updated || new Date().toISOString(),
			author: item.author?.name || feed.title || '',
			categories: [],
			imageUrl: '',
			savedDate: new Date().toISOString()
		};

		rssItem.categories = this.normalizeCategories(item.category);

		if (this.settings.includeImages) {
			rssItem.imageUrl = this.extractImageUrl(item);

			// RSSフィードに画像がない場合、リンク先から取得
			if (!rssItem.imageUrl && this.settings.fetchImageFromLink && rssItem.link) {
				rssItem.imageUrl = await this.fetchImageFromUrl(rssItem.link);
			}
		}

		let fileName = this.settings.fileNameTemplate
			.replace(/{{title}}/g, rssItem.title)
			.replace(/{{published}}/g, this.formatDateTime(new Date(rssItem.pubDate)));

		fileName = fileName.replace(/[\\/:*?"<>|]/g, '-');
		fileName = normalizePath(`${folderPath}/${fileName}.md`);

		const existingFile = this.app.vault.getAbstractFileByPath(fileName);
		if (existingFile) {
			return;
		}

		const pubDate = new Date(rssItem.pubDate);
		const fullDateTime = this.formatDateTime(pubDate);

		const savedDate = new Date(rssItem.savedDate);
		const fullSavedDateTime = this.formatDateTime(savedDate);

		const escapedTitle = this.escapeYamlValue(rssItem.title);
		const escapedAuthor = this.escapeYamlValue(rssItem.author);

		// descriptionの最初の50文字を取得（改行を除去）
		const descriptionCleaned = rssItem.description.replace(/\r?\n/g, ' ').trim();
		const descriptionShort = descriptionCleaned.substring(0, 50) + (descriptionCleaned.length > 50 ? '...' : '');
		const escapedDescription = this.escapeYamlValue(descriptionCleaned);
		const escapedDescriptionShort = this.escapeYamlValue(descriptionShort);

		let processedContent = rssItem.content;
		if (this.settings.imageWidth && this.settings.imageWidth !== '100%') {
			processedContent = this.resizeImagesInContent(processedContent);
		}

		const template = this.prepareTemplate(this.settings.template, rssItem);

		const content = template
			.replace(/{{title}}/g, escapedTitle)
			.replace(/{{link}}/g, rssItem.link)
			.replace(/{{author}}/g, escapedAuthor)
			.replace(/{{publishedTime}}/g, fullDateTime)
			.replace(/{{savedTime}}/g, fullSavedDateTime)
			.replace(/{{image}}/g, rssItem.imageUrl)
			.replace(/{{description}}/g, escapedDescription)
			.replace(/{{descriptionShort}}/g, escapedDescriptionShort)
			.replace(/{{#tags}}/g, rssItem.categories.map(c => `#${c}`).join(' '))
			.replace(/{{content}}/g, processedContent);

		await this.app.vault.create(fileName, content);
	}

	resizeImagesInContent(content: string): string {
		// Since we're dealing with RSS content that will be saved as markdown,
		// we'll use regex to add width attributes to img tags
		// This avoids using innerHTML while still processing the content

		// Regular expression to match img tags without width attribute
		const imgRegex = /<img\s+(?![^>]*\swidth=)(?![^>]*\sstyle=)([^>]*?)>/gi;

		// Replace img tags to add width attribute
		return content.replace(imgRegex, (match, attributes) => {
			return `<img ${attributes} width="${this.settings.imageWidth}">`;
		});
	}

	private normalizeCategories(categoryField: any): string[] {
		if (!categoryField) {
			return [];
		}

		const categories = Array.isArray(categoryField) ? categoryField : [categoryField];
		return categories
			.map((category: any) => this.extractCategoryText(category))
			.filter((category: string): category is string => category.length > 0);
	}

	private extractCategoryText(category: any): string {
		if (category == null) {
			return '';
		}

		if (typeof category === 'string') {
			return category.trim();
		}

		if (typeof category === 'object') {
			const categoryRecord = category as Record<string, unknown>;

			if (typeof categoryRecord['_'] === 'string') {
				return (categoryRecord['_'] as string).trim();
			}

			if (typeof categoryRecord['term'] === 'string') {
				return (categoryRecord['term'] as string).trim();
			}
		}

		return '';
	}

	private prepareTemplate(template: string, rssItem: RssItem): string {
		let preparedTemplate = template;

		if (!rssItem.imageUrl) {
			preparedTemplate = preparedTemplate.replace(/^.*{{image}}.*\n?/gm, '');
		}

		return preparedTemplate;
	}

	escapeYamlValue(value: string): string {
		// 改行文字を空白に置き換える
		const valueWithoutNewlines = value.replace(/\r?\n/g, ' ').trim();

		if (YAML_SPECIAL_CHARS.test(valueWithoutNewlines)) {
			const escapedValue = valueWithoutNewlines.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
			return `"${escapedValue}"`;
		}
		return valueWithoutNewlines;
	}

	formatDate(date: Date): string {
		return date.toISOString().split('T')[0];
	}

	formatDateTime(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');

		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	}

	extractImageUrl(item: RssFeedItem | AtomFeedItem): string {
		if ('media:content' in item || 'media:thumbnail' in item || 'enclosure' in item) {
			const rssItem = item as RssFeedItem;

			if (rssItem['media:content'] && rssItem['media:content'].$.url) {
				return rssItem['media:content'].$.url;
			}

			if (rssItem['media:thumbnail'] && rssItem['media:thumbnail'].$.url) {
				return rssItem['media:thumbnail'].$.url;
			}

			// enclosureタグからURLを取得（typeに関係なく）
			// ZennなどのフィードではOGP画像がenclosureで提供されている
			if (rssItem.enclosure && rssItem.enclosure.$.url) {
				const enclosureUrl = rssItem.enclosure.$.url;
				// URLが画像っぽい拡張子を持っているか、画像配信サービスのURLかチェック
				if (enclosureUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) ||
				    enclosureUrl.includes('cloudinary.com') ||
				    enclosureUrl.includes('imgur.com') ||
				    enclosureUrl.includes('googleusercontent.com')) {
					return enclosureUrl;
				}
				// typeがimage/で始まる場合も取得
				if (rssItem.enclosure.$.type && rssItem.enclosure.$.type.startsWith('image/')) {
					return enclosureUrl;
				}
			}
		}

		let content = '';
		if ('content:encoded' in item) {
			content = (item as RssFeedItem)['content:encoded'] || (item as RssFeedItem).description || '';
		} else if ('content' in item) {
			content = (item as AtomFeedItem).content || (item as AtomFeedItem).summary || '';
		}

		if (content) {
			const match = /<img.*?src=["'](.*?)["']/.exec(content);
			if (match && match[1]) {
				return match[1];
			}
		}

		return '';
	}

	async fetchImageFromUrl(url: string): Promise<string> {
		try {
			const response = await requestUrl(url);
			if (response.status !== 200) {
				return '';
			}

			const html = response.text;

			// OGP画像を抽出
			// <meta property="og:image" content="..." />
			const ogImageMatch1 = /<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i.exec(html);
			if (ogImageMatch1 && ogImageMatch1[1]) {
				return ogImageMatch1[1];
			}

			// <meta content="..." property="og:image" />
			const ogImageMatch2 = /<meta\s+content=["'](.*?)["']\s+property=["']og:image["']/i.exec(html);
			if (ogImageMatch2 && ogImageMatch2[1]) {
				return ogImageMatch2[1];
			}

			// twitter:image も試す
			const twitterImageMatch1 = /<meta\s+name=["']twitter:image["']\s+content=["'](.*?)["']/i.exec(html);
			if (twitterImageMatch1 && twitterImageMatch1[1]) {
				return twitterImageMatch1[1];
			}

			const twitterImageMatch2 = /<meta\s+content=["'](.*?)["']\s+name=["']twitter:image["']/i.exec(html);
			if (twitterImageMatch2 && twitterImageMatch2[1]) {
				return twitterImageMatch2[1];
			}

			return '';
		} catch (error) {
			console.error(`Error fetching image from ${url}:`, error);
			return '';
		}
	}


	async deleteOldFiles(folderPath: string) {
		try {
			const folder = this.app.vault.getAbstractFileByPath(folderPath) as TFolder;
			if (!folder || !(folder instanceof TFolder)) {
				return;
			}
			const files = folder.children.filter(file => file instanceof TFile && file.extension === 'md') as TFile[];

			let cutoffDate: number;
			if (this.settings.autoDeleteTimeUnit === 'minutes') {
				cutoffDate = Date.now() - (this.settings.autoDeleteDays * 60 * 1000);
			} else {
				cutoffDate = Date.now() - (this.settings.autoDeleteDays * 24 * 60 * 60 * 1000);
			}

			for (const file of files) {
				try {
					const fileContent = await this.app.vault.read(file);

					if (this.settings.autoDeleteBasedOn === 'publish_date') {
						const publishedMatch = fileContent.match(/publish_date: (.*?)$/m);

						if (publishedMatch && publishedMatch[1]) {
							const publishedTime = new Date(publishedMatch[1]).getTime();
							if (publishedTime && publishedTime < cutoffDate) {
								await this.app.vault.delete(file);
							}
						}
					} else {
						const savedMatch = fileContent.match(/saved: (.*?)$/m);

						if (savedMatch && savedMatch[1]) {
							const savedTime = new Date(savedMatch[1]).getTime();
							if (savedTime && savedTime < cutoffDate) {
								await this.app.vault.delete(file);
							}
						} else {
							if (file.stat.ctime < cutoffDate) {
								await this.app.vault.delete(file);
							}
						}
					}
				} catch (e) {
					console.error(`Error processing file: ${file.path}`, e);
				}
			}
		} catch (error) {
			console.error('Error deleting old files:', error);
		}
	}
}

class AddFeedModal extends Modal {
	plugin: LocalRssPlugin;
	nameInput: HTMLInputElement;
	urlInput: HTMLInputElement;
	folderInput: HTMLInputElement;

	constructor(app: App, plugin: LocalRssPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;

		new Setting(contentEl)
			.setName(t('feedName'))
			.addText(text => {
				this.nameInput = text.inputEl;
				text.setPlaceholder('My Feed');
			});

		new Setting(contentEl)
			.setName(t('feedUrl'))
			.addText(text => {
				this.urlInput = text.inputEl;
				text.setPlaceholder('https://example.com/feed.xml');
			});

		new Setting(contentEl)
			.setName(t('customFolderName'))
			.setDesc(t('customFolderNameDesc'))
			.addText(text => {
				this.folderInput = text.inputEl;
				text.setPlaceholder(t('customFolderPlaceholder'));
			});

		new Setting(contentEl)
			.addButton(button => {
				button.setButtonText(t('addFeed'))
					.setCta()
					.onClick(async () => {
						const name = this.nameInput.value.trim();
						const url = this.urlInput.value.trim();
						const folder = this.folderInput.value.trim();

						if (!name) {
							new Notice(t('feedNameRequired'));
							return;
						}

						if (!url) {
							new Notice(t('feedUrlRequired'));
							return;
						}

						this.plugin.settings.feeds.push({
							name,
							url,
							folder,
							enabled: true
						});

						await this.plugin.saveSettings();
						new Notice(t('addedFeed', name));
						this.close();
					});
			})
			.addButton(button => {
				button.setButtonText(t('cancel'))
					.onClick(() => {
						this.close();
					});
			});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class LocalRssSettingTab extends PluginSettingTab {
	plugin: LocalRssPlugin;

	constructor(app: App, plugin: LocalRssPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('local-rss-settings');

		new Setting(containerEl)
			.setName(t('rssFolder'))
			.setDesc(t('rssFolderDesc'))
			.addText(text => text
				.setPlaceholder('RSS')
				.setValue(this.plugin.settings.folderPath)
				.onChange(async (value) => {
					this.plugin.settings.folderPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('fileNameTemplate'))
			.setDesc(t('fileNameTemplateDesc'))
			.addText(text => text
				.setPlaceholder('{{title}}')
				.setValue(this.plugin.settings.fileNameTemplate)
				.onChange(async (value) => {
					this.plugin.settings.fileNameTemplate = value;
					await this.plugin.saveSettings();
				}));

		const templateSetting = new Setting(containerEl)
			.setName(t('contentTemplate'))
			.setDesc(t('contentTemplateDesc'))
			.addTextArea(text => {
				text.setPlaceholder('---\ntitle: {{title}}\n---\n\n{{content}}')
					.setValue(this.plugin.settings.template)
					.onChange(async (value) => {
						this.plugin.settings.template = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.addClass('local-rss-template-textarea');
				return text;
			});
		templateSetting.settingEl.addClass('local-rss-template-setting');

		// Add available variables list to the control element
		const variablesEl = templateSetting.controlEl.createDiv('local-rss-variables');
		variablesEl.createEl('div', { text: t('availableVariables'), cls: 'local-rss-variables-title' });
		const variablesList = variablesEl.createEl('div', { cls: 'local-rss-variables-list' });
		const variables = [
			{ var: '{{title}}', desc: t('varTitle') },
			{ var: '{{link}}', desc: t('varLink') },
			{ var: '{{author}}', desc: t('varAuthor') },
			{ var: '{{publishedTime}}', desc: t('varPublishedTime') },
			{ var: '{{savedTime}}', desc: t('varSavedTime') },
			{ var: '{{image}}', desc: t('varImage') },
			{ var: '{{description}}', desc: t('varDescription') },
			{ var: '{{descriptionShort}}', desc: t('varDescriptionShort') },
			{ var: '{{content}}', desc: t('varContent') },
			{ var: '{{#tags}}', desc: t('varTags') }
		];
		variables.forEach(v => {
			const item = variablesList.createEl('div', { cls: 'local-rss-variable-item' });
			item.createEl('code', { text: v.var });
			item.createEl('span', { text: ` - ${v.desc}`, cls: 'local-rss-variable-desc' });
		});

		new Setting(containerEl)
			.setName(t('updateInterval'))
			.setDesc(t('updateIntervalDesc'))
			.addText(text => text
				.setPlaceholder('60')
				.setValue(String(this.plugin.settings.updateInterval))
				.onChange(async (value) => {
					const interval = parseInt(value);
					if (!isNaN(interval) && interval >= 0) {
						this.plugin.settings.updateInterval = interval;
						await this.plugin.saveSettings();
						this.plugin.startUpdateInterval();
					}
				}));

		new Setting(containerEl)
			.setName(t('includeImages'))
			.setDesc(t('includeImagesDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeImages)
				.onChange(async (value) => {
					this.plugin.settings.includeImages = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('fetchImageFromLink'))
			.setDesc(t('fetchImageFromLinkDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.fetchImageFromLink)
				.onChange(async (value) => {
					this.plugin.settings.fetchImageFromLink = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('imageWidth'))
			.setDesc(t('imageWidthDesc'))
			.addText(text => text
				.setPlaceholder('50%')
				.setValue(this.plugin.settings.imageWidth)
				.onChange(async (value) => {
					this.plugin.settings.imageWidth = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('autoDeleteOldArticles'))
			.setDesc(t('autoDeleteOldArticlesDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoDeleteEnabled)
				.onChange(async (value) => {
					this.plugin.settings.autoDeleteEnabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('periodBeforeDeletion'))
			.setDesc(t('periodBeforeDeletionDesc'))
			.addText(text => text
				.setPlaceholder('30')
				.setValue(String(this.plugin.settings.autoDeleteDays))
				.onChange(async (value) => {
					const days = parseInt(value);
					if (!isNaN(days) && days > 0) {
						this.plugin.settings.autoDeleteDays = days;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName(t('timeUnit'))
			.setDesc(t('timeUnitDesc'))
			.addDropdown(dropdown => dropdown
				.addOption('days', t('days'))
				.addOption('minutes', t('minutes'))
				.setValue(this.plugin.settings.autoDeleteTimeUnit)
				.onChange(async (value) => {
					this.plugin.settings.autoDeleteTimeUnit = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('deletionCriteria'))
			.setDesc(t('deletionCriteriaDesc'))
			.addDropdown(dropdown => dropdown
				.addOption('publish_date', t('publishedDate'))
				.addOption('saved', t('savedDate'))
				.setValue(this.plugin.settings.autoDeleteBasedOn)
				.onChange(async (value) => {
					this.plugin.settings.autoDeleteBasedOn = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('updateRssFeeds'))
			.setHeading();

		this.plugin.settings.feeds.forEach((feed, index) => {
			const setting = new Setting(containerEl)
				.setName(feed.name)
				.setDesc(feed.url);

			setting.addToggle(toggle => toggle
				.setValue(feed.enabled)
				.onChange(async (value) => {
					this.plugin.settings.feeds[index].enabled = value;
					await this.plugin.saveSettings();
				}));

			setting.addButton(button => button
				.setIcon('trash')
				.setTooltip(t('cancel'))
				.onClick(async () => {
					this.plugin.settings.feeds.splice(index, 1);
					await this.plugin.saveSettings();
					this.display();
				}));
		});

		new Setting(containerEl)
			.setName(t('addNewFeed'))
			.setDesc(t('addNewFeedDesc'))
			.addButton(button => button
				.setButtonText(t('addFeed'))
				.setCta()
				.onClick(() => {
					new AddFeedModal(this.app, this.plugin).open();
				}));

		new Setting(containerEl)
			.setName(t('updateFeedsNow'))
			.setDesc(t('updateFeedsNowDesc'))
			.addButton(button => button
				.setButtonText(t('updateNow'))
				.setCta()
				.onClick(() => {
					this.plugin.updateFeeds();
				}));
	}
}
