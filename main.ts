import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, normalizePath, sanitizeHTMLToDom, TFile, TFolder } from 'obsidian';
import * as xml2js from 'xml2js';
import { t } from './localization';
import { stripHtml, htmlToMarkdown } from './src/utils/htmlProcessor';
import { escapeYamlValue } from './src/utils/yamlFormatter';
import { prepareTemplate, renderTemplate } from './src/utils/templateEngine';
import { XmlNormalizer } from './src/adapters/parsers/XmlNormalizer';
import { FeedFetcher } from './src/adapters/http/FeedFetcher';
import { ImageExtractor } from './src/services/ImageExtractor';
import {
	Feed,
	LocalRssSettings,
	DEFAULT_SETTINGS,
	RssFeedItem,
	AtomFeedItem,
	AtomCategory,
	AtomFeed,
	RssItem
} from './src/types';

export default class LocalRssPlugin extends Plugin {
	settings: LocalRssSettings;
	updateIntervalId: number | null = null;
	private feedFetcher: FeedFetcher;
	private imageExtractor: ImageExtractor;

	async onload() {
		await this.loadSettings();

		// アダプターとサービスの初期化
		this.feedFetcher = new FeedFetcher();
		this.imageExtractor = new ImageExtractor(this.feedFetcher);

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
				const xml = await this.feedFetcher.fetch(feed.url);

				const parser = new xml2js.Parser({ explicitArray: false });
				const result = await parser.parseStringPromise(xml);

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
			description: stripHtml(item.description || '', 200),
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
			rssItem.imageUrl = this.imageExtractor.extractFromItem(item);

			// RSSフィードに画像がない場合、リンク先から取得
			if (!rssItem.imageUrl && this.settings.fetchImageFromLink && rssItem.link) {
				rssItem.imageUrl = await this.imageExtractor.fetchFromUrl(rssItem.link);
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

		const escapedTitle = escapeYamlValue(XmlNormalizer.normalizeValue(rssItem.title));
		const escapedAuthor = escapeYamlValue(XmlNormalizer.normalizeValue(rssItem.author));

		// descriptionの最初の50文字を取得（改行を除去）
		const descriptionCleaned = rssItem.description.replace(/\r?\n/g, ' ').trim();
		const descriptionShort = descriptionCleaned.substring(0, 50) + (descriptionCleaned.length > 50 ? '...' : '');
		const escapedDescription = escapeYamlValue(descriptionCleaned);
		const escapedDescriptionShort = escapeYamlValue(descriptionShort);

		let processedContent = rssItem.content;
		if (this.settings.imageWidth && this.settings.imageWidth !== '100%') {
			processedContent = this.resizeImagesInContent(processedContent);
		}
		// Convert HTML to Markdown
		processedContent = htmlToMarkdown(processedContent);

		const template = prepareTemplate(this.settings.template, rssItem);

		const fileContent = renderTemplate(template, {
			title: escapedTitle,
			link: rssItem.link,
			author: escapedAuthor,
			publishedTime: fullDateTime,
			savedTime: fullSavedDateTime,
			image: rssItem.imageUrl,
			description: escapedDescription,
			descriptionShort: escapedDescriptionShort,
			tags: rssItem.categories.map(c => `#${c}`).join(' '),
			content: processedContent
		});

		await this.app.vault.create(fileName, fileContent);
	}

	async processAtomItem(item: AtomFeedItem, feed: AtomFeed, folderPath: string) {
		const title = XmlNormalizer.normalizeValue(item.title);
		const summary = XmlNormalizer.normalizeValue(item.summary);
		const content = XmlNormalizer.normalizeValue(item.content);
		const link = XmlNormalizer.normalizeAtomLink(item.link);
		const author = XmlNormalizer.normalizeAtomAuthor(item.author, XmlNormalizer.normalizeValue(feed.title));

		const rssItem: RssItem = {
			title: title || 'Untitled',
			description: stripHtml(summary, 200),
			content: content || summary,
			link: link,
			pubDate: item.published || item.updated || new Date().toISOString(),
			author: author,
			categories: [],
			imageUrl: '',
			savedDate: new Date().toISOString()
		};

		rssItem.categories = this.normalizeCategories(item.category);

		if (this.settings.includeImages) {
			rssItem.imageUrl = this.imageExtractor.extractFromItem(item);

			// RSSフィードに画像がない場合、リンク先から取得
			if (!rssItem.imageUrl && this.settings.fetchImageFromLink && rssItem.link) {
				rssItem.imageUrl = await this.imageExtractor.fetchFromUrl(rssItem.link);
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

		const escapedTitle = escapeYamlValue(XmlNormalizer.normalizeValue(rssItem.title));
		const escapedAuthor = escapeYamlValue(XmlNormalizer.normalizeValue(rssItem.author));

		// descriptionの最初の50文字を取得（改行を除去）
		const descriptionCleaned = rssItem.description.replace(/\r?\n/g, ' ').trim();
		const descriptionShort = descriptionCleaned.substring(0, 50) + (descriptionCleaned.length > 50 ? '...' : '');
		const escapedDescription = escapeYamlValue(descriptionCleaned);
		const escapedDescriptionShort = escapeYamlValue(descriptionShort);

		let processedContent = rssItem.content;
		if (this.settings.imageWidth && this.settings.imageWidth !== '100%') {
			processedContent = this.resizeImagesInContent(processedContent);
		}
		// Convert HTML to Markdown
		processedContent = htmlToMarkdown(processedContent);

		const template = prepareTemplate(this.settings.template, rssItem);

		const fileContent = renderTemplate(template, {
			title: escapedTitle,
			link: rssItem.link,
			author: escapedAuthor,
			publishedTime: fullDateTime,
			savedTime: fullSavedDateTime,
			image: rssItem.imageUrl,
			description: escapedDescription,
			descriptionShort: escapedDescriptionShort,
			tags: rssItem.categories.map(c => `#${c}`).join(' '),
			content: processedContent
		});

		await this.app.vault.create(fileName, fileContent);
	}

	resizeImagesInContent(content: string): string {
		if (!content) return content;

		// 文字列でない場合はそのまま返す（xml2jsがオブジェクトを返す場合の対策）
		if (typeof content !== 'string') {
			console.warn('resizeImagesInContent: received non-string input', content);
			return '';
		}

		// Use DOM API instead of string manipulation (CLAUDE-OB.md compliance)
		const fragment = sanitizeHTMLToDom(content);
		const div = createDiv();
		div.appendChild(fragment);

		// Find all img elements and add width attribute
		const images = div.querySelectorAll('img');
		images.forEach((img) => {
			// Only add width if it doesn't already have width or style attribute
			if (!img.hasAttribute('width') && !img.hasAttribute('style')) {
				img.setAttribute('width', this.settings.imageWidth);
			}
		});

		return div.innerHTML;
	}

	private normalizeCategories(categoryField: unknown): string[] {
		if (!categoryField) {
			return [];
		}

		const categories = Array.isArray(categoryField) ? categoryField : [categoryField];
		return categories
			.map((category: unknown) => this.extractCategoryText(category))
			.filter((category: string): category is string => category.length > 0);
	}

	private extractCategoryText(category: unknown): string {
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
