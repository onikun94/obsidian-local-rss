import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, normalizePath, requestUrl } from 'obsidian';
import * as xml2js from 'xml2js';

// Remember to rename these classes and interfaces!

interface LocalRssSettings {
	feeds: Feed[];
	folderPath: string;
	template: string;
	fileNameTemplate: string;
	updateInterval: number;
	lastUpdateTime: number;
	includeImages: boolean;
	dateFormat: string;
	imageWidth: string;
	autoDeleteEnabled: boolean;
	autoDeleteDays: number;
	autoDeleteTimeUnit: string; // 'days' または 'minutes'
	autoDeleteBasedOn: string; // 'published' または 'saved'
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
	template: '---\ntitle: {{title}}\nlink: {{link}}\nauthor: {{author}}\npublish_date: {{publishedTime}}\nsaved_date: {{savedTime}}\ntags: {{#tags}}\n---\n\n{{#image}}\n<img src="{{image}}" width="{{imageWidth}}" />\n\n{{/image}}{{content}}',
	fileNameTemplate: '{{title}}',
	updateInterval: 60,
	lastUpdateTime: 0,
	includeImages: true,
	dateFormat: 'YYYY-MM-DD HH:mm:ss',
	imageWidth: '50%',
	autoDeleteEnabled: false,
	autoDeleteDays: 30,
	autoDeleteTimeUnit: 'days',
	autoDeleteBasedOn: 'saved'
}

// マークダウンフロントマターでエスケープが必要な文字のリスト
const YAML_SPECIAL_CHARS = /[[\]{}:>|*&!%@,]/;

export default class LocalRssPlugin extends Plugin {
	settings: LocalRssSettings;
	updateIntervalId: number | null = null;

	async onload() {
		await this.loadSettings();

		// サイドバーに手動取得ボタンを追加
		this.addRibbonIcon('rss', 'Update RSS Feeds', (evt: MouseEvent) => {
			this.updateFeeds();
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new LocalRssSettingTab(this.app, this));

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'update-rss-feeds',
			name: 'Update RSS feeds',
			callback: () => {
				this.updateFeeds();
			}
		});

		// Add a command to add a new feed
		this.addCommand({
			id: 'add-rss-feed',
			name: 'Add RSS feed',
			callback: () => {
				new AddFeedModal(this.app, this).open();
			}
		});

		// Start the update interval
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
		// Clear any existing interval
		if (this.updateIntervalId) {
			window.clearInterval(this.updateIntervalId);
		}

		// Set up a new interval if the interval is greater than 0
		if (this.settings.updateInterval > 0) {
			this.updateIntervalId = window.setInterval(() => {
				this.updateFeeds();
			}, this.settings.updateInterval * 60 * 1000);
		}
	}

	async updateFeeds() {
		new Notice('RSSフィードを更新中...');
		
		// Create the base RSS folder if it doesn't exist
		const folderPath = this.settings.folderPath;
		if (!(await this.app.vault.adapter.exists(folderPath))) {
			await this.app.vault.createFolder(folderPath);
		}
		
		// Process each enabled feed
		for (const feed of this.settings.feeds.filter(f => f.enabled)) {
			try {
				// Fetch the RSS feed
				const response = await requestUrl(feed.url);
				if (response.status !== 200) {
					new Notice(`フィードの取得に失敗しました: ${feed.name}`);
					continue;
				}
				
				// Parse the XML
				const parser = new xml2js.Parser({ explicitArray: false });
				const result = await parser.parseStringPromise(response.text);
				
				// Create the feed folder if needed
				const feedFolderPath = `${folderPath}/${feed.folder || feed.name}`;
				if (!(await this.app.vault.adapter.exists(feedFolderPath))) {
					await this.app.vault.createFolder(feedFolderPath);
				}
				
				// Process the RSS items
				const channel = result.rss?.channel;
				if (!channel) {
					// Try to handle Atom feeds
					const feed = result.feed;
					if (feed && feed.entry) {
						const items = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
						for (const item of items) {
							await this.processAtomItem(item, feed, feedFolderPath);
						}
					} else {
						new Notice(`サポートされていないフィード形式です: ${feed.name}`);
					}
					continue;
				}
				
				const items = Array.isArray(channel.item) ? channel.item : [channel.item];
				
				for (const item of items) {
					await this.processRssItem(item, feed, feedFolderPath);
				}
				
				// 古いファイルを削除（自動削除が有効な場合）
				if (this.settings.autoDeleteEnabled) {
					await this.deleteOldFiles(feedFolderPath);
				}
				
				new Notice(`フィードを更新しました: ${feed.name}`);
			} catch (error) {
				console.error(`フィード ${feed.name} の更新中にエラーが発生しました:`, error);
				new Notice(`フィードの更新中にエラーが発生しました: ${feed.name}`);
			}
		}
		
		// Update the last update time
		this.settings.lastUpdateTime = Date.now();
		await this.saveSettings();
		
		new Notice('RSSフィードの更新が完了しました');
	}
	
	async processRssItem(item: any, feed: Feed, folderPath: string) {
		// Extract item data
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
		
		// Process categories
		if (item.category) {
			if (Array.isArray(item.category)) {
				rssItem.categories = item.category;
			} else {
				rssItem.categories = [item.category];
			}
		}
		
		// Extract image URL if enabled
		if (this.settings.includeImages) {
			rssItem.imageUrl = this.extractImageUrl(item);
		}
		
		// Create a normalized filename
		let fileName = this.settings.fileNameTemplate
			.replace(/{{title}}/g, rssItem.title)
			.replace(/{{published}}/g, this.formatDateTime(new Date(rssItem.pubDate)));
		
		// Sanitize the filename to remove special characters
		fileName = fileName.replace(/[\\/:*?"<>|]/g, '-');
		fileName = normalizePath(`${folderPath}/${fileName}.md`);
		
		// Check if the file already exists
		if (await this.app.vault.adapter.exists(fileName)) {
			return; // Skip if the file already exists
		}
		
		// Format the dates
		const pubDate = new Date(rssItem.pubDate);
		const fullDateTime = this.formatDateTime(pubDate);
		
		// 保存日時のフォーマット
		const savedDate = new Date(rssItem.savedDate);
		const fullSavedDateTime = this.formatDateTime(savedDate);
		
		// YAMLで問題になる可能性のある文字を持つ値をエスケープ
		const escapedTitle = this.escapeYamlValue(rssItem.title);
		const escapedAuthor = this.escapeYamlValue(rssItem.author);
		
		// 本文中の画像サイズを調整
		let processedContent = rssItem.content;
		if (this.settings.imageWidth && this.settings.imageWidth !== '100%') {
			processedContent = this.resizeImagesInContent(processedContent);
		}
		
		// Create the file content using the template
		const content = this.settings.template
			.replace(/{{title}}/g, escapedTitle)
			.replace(/{{link}}/g, rssItem.link)
			.replace(/{{author}}/g, escapedAuthor)
			.replace(/{{publishedTime}}/g, fullDateTime)
			.replace(/{{savedTime}}/g, fullSavedDateTime)
			.replace(/{{imageWidth}}/g, this.settings.imageWidth)
			.replace(/{{#tags}}/g, rssItem.categories.map(c => `#${c}`).join(' '))
			.replace(/{{#image}}\n([^]*?)\n{{\/image}}/g, (match, p1) => {
				if (rssItem.imageUrl) {
					return p1.replace(/{{image}}/g, rssItem.imageUrl);
				}
				return '';
			})
			.replace(/{{content}}/g, processedContent);
		
		// Create the file
		await this.app.vault.create(fileName, content);
	}

	async processAtomItem(item: any, feed: any, folderPath: string) {
		// Extract item data
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
		
		// Process categories
		if (item.category) {
			if (Array.isArray(item.category)) {
				rssItem.categories = item.category.map((c: any) => c.term || c);
			} else {
				rssItem.categories = [item.category.term || item.category];
			}
		}
		
		// Extract image URL if enabled
		if (this.settings.includeImages) {
			rssItem.imageUrl = this.extractImageUrl(item);
		}
		
		// Create a normalized filename
		let fileName = this.settings.fileNameTemplate
			.replace(/{{title}}/g, rssItem.title)
			.replace(/{{published}}/g, this.formatDateTime(new Date(rssItem.pubDate)));
		
		// Sanitize the filename to remove special characters
		fileName = fileName.replace(/[\\/:*?"<>|]/g, '-');
		fileName = normalizePath(`${folderPath}/${fileName}.md`);
		
		// Check if the file already exists
		if (await this.app.vault.adapter.exists(fileName)) {
			return; // Skip if the file already exists
		}
		
		// Format the dates
		const pubDate = new Date(rssItem.pubDate);
		const fullDateTime = this.formatDateTime(pubDate);
		
		// 保存日時のフォーマット
		const savedDate = new Date(rssItem.savedDate);
		const fullSavedDateTime = this.formatDateTime(savedDate);
		
		// YAMLで問題になる可能性のある文字を持つ値をエスケープ
		const escapedTitle = this.escapeYamlValue(rssItem.title);
		const escapedAuthor = this.escapeYamlValue(rssItem.author);
		
		// 本文中の画像サイズを調整
		let processedContent = rssItem.content;
		if (this.settings.imageWidth && this.settings.imageWidth !== '100%') {
			processedContent = this.resizeImagesInContent(processedContent);
		}
		
		// Create the file content using the template
		const content = this.settings.template
			.replace(/{{title}}/g, escapedTitle)
			.replace(/{{link}}/g, rssItem.link)
			.replace(/{{author}}/g, escapedAuthor)
			.replace(/{{publishedTime}}/g, fullDateTime)
			.replace(/{{savedTime}}/g, fullSavedDateTime)
			.replace(/{{imageWidth}}/g, this.settings.imageWidth)
			.replace(/{{#tags}}/g, rssItem.categories.map(c => `#${c}`).join(' '))
			.replace(/{{#image}}\n([^]*?)\n{{\/image}}/g, (match, p1) => {
				if (rssItem.imageUrl) {
					return p1.replace(/{{image}}/g, rssItem.imageUrl);
				}
				return '';
			})
			.replace(/{{content}}/g, processedContent);
		
		// Create the file
		await this.app.vault.create(fileName, content);
	}
	
	// HTMLコンテンツ内の画像サイズを調整する関数
	resizeImagesInContent(content: string): string {
		// img タグを検出して width 属性を追加
		return content.replace(/<img(.*?)>/g, (match, attributes) => {
			// すでに width または style が指定されている場合は変更しない
			if (attributes.includes('width=') || attributes.includes('style=')) {
				return match;
			}
			return `<img${attributes} width="${this.settings.imageWidth}">`;
		});
	}
	
	// YAMLフロントマターで問題になりうる値をエスケープする関数
	escapeYamlValue(value: string): string {
		// 特殊文字を含む場合はダブルクォートでエスケープ
		if (YAML_SPECIAL_CHARS.test(value)) {
			// バックスラッシュとダブルクォートをエスケープ
			const escapedValue = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
			return `"${escapedValue}"`;
		}
		return value;
	}
	
	// 日付フォーマット関数（YYYY-MM-DD）
	formatDate(date: Date): string {
		return date.toISOString().split('T')[0];
	}
	
	// 日付と時間フォーマット関数
	formatDateTime(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');
		
		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	}
	
	// 画像URLを抽出する関数
	extractImageUrl(item: any): string {
		// media:contentから取得を試みる
		if (item['media:content'] && item['media:content'].$.url) {
			return item['media:content'].$.url;
		}
		
		// media:thumbnailから取得を試みる
		if (item['media:thumbnail'] && item['media:thumbnail'].$.url) {
			return item['media:thumbnail'].$.url;
		}
		
		// enclosureから取得を試みる
		if (item.enclosure && item.enclosure.$.type && item.enclosure.$.type.startsWith('image/')) {
			return item.enclosure.$.url;
		}
		
		// contentから画像を抽出
		if (item['content:encoded'] || item.description) {
			const content = item['content:encoded'] || item.description;
			const match = /<img.*?src=["'](.*?)["']/.exec(content);
			if (match && match[1]) {
				return match[1];
			}
		}
		
		return '';
	}


	// 古いファイルを削除する関数
	async deleteOldFiles(folderPath: string) {
		try {
			// フォルダ内のファイル一覧を取得
			const files = await this.app.vault.adapter.list(folderPath);
			
			// 現在の日時から削除期間を計算
			let cutoffDate: number;
			if (this.settings.autoDeleteTimeUnit === 'minutes') {
				// 分単位で計算
				cutoffDate = Date.now() - (this.settings.autoDeleteDays * 60 * 1000);
			} else {
				// 日数単位で計算（デフォルト）
				cutoffDate = Date.now() - (this.settings.autoDeleteDays * 24 * 60 * 60 * 1000);
			}
			
			// MDファイルのみを対象に処理
			for (const file of files.files) {
				if (file.endsWith('.md')) {
					try {
						// ファイルの内容を読み込む
						const fileContent = await this.app.vault.adapter.read(file);
						
						// 削除基準によって判断を分ける
						if (this.settings.autoDeleteBasedOn === 'publish_date') {
							// 公開日を基準に削除
							// フロントマターから公開日時を抽出
							const publishedMatch = fileContent.match(/publish_date: (.*?)$/m);
							
							if (publishedMatch && publishedMatch[1]) {
								const publishedTime = new Date(publishedMatch[1]).getTime();
								if (publishedTime && publishedTime < cutoffDate) {
									await this.app.vault.adapter.remove(file);
								}
							}
						} else {
							// 保存日を基準に削除（デフォルト）
							// まずはフロントマターからsavedを取得
							const savedMatch = fileContent.match(/saved: (.*?)$/m);
							
							if (savedMatch && savedMatch[1]) {
								// フロントマターに保存日時がある場合はそれを使用
								const savedTime = new Date(savedMatch[1]).getTime();
								if (savedTime && savedTime < cutoffDate) {
									await this.app.vault.adapter.remove(file);
								}
							} else {
								// フロントマターに保存日時がない場合はファイルの作成日時を使用
								const stat = await this.app.vault.adapter.stat(file);
								if (stat && stat.ctime < cutoffDate) {
									await this.app.vault.adapter.remove(file);
								}
							}
						}
					} catch (e) {
						console.error(`ファイル処理中にエラーが発生しました: ${file}`, e);
					}
				}
			}
		} catch (error) {
			console.error('古いファイルの削除中にエラーが発生しました:', error);
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
		const {contentEl} = this;

		new Setting(contentEl)
			.setName('フィード名')
			.addText(text => {
				this.nameInput = text.inputEl;
				text.setPlaceholder('マイフィード');
			});

		new Setting(contentEl)
			.setName('フィードURL')
			.addText(text => {
				this.urlInput = text.inputEl;
				text.setPlaceholder('https://example.com/feed.xml');
			});

		new Setting(contentEl)
			.setName('カスタムフォルダ名（オプション）')
			.setDesc('RSSフォルダ内のサブフォルダ名')
			.addText(text => {
				this.folderInput = text.inputEl;
				text.setPlaceholder('空白の場合はフィード名を使用');
			});

		new Setting(contentEl)
			.addButton(button => {
				button.setButtonText('フィードを追加')
					.setCta()
					.onClick(async () => {
						const name = this.nameInput.value.trim();
						const url = this.urlInput.value.trim();
						const folder = this.folderInput.value.trim();

						if (!name) {
							new Notice('フィード名は必須です');
							return;
						}

						if (!url) {
							new Notice('フィードURLは必須です');
							return;
						}

						// Add the feed
						this.plugin.settings.feeds.push({
							name,
							url,
							folder,
							enabled: true
						});

						await this.plugin.saveSettings();
						new Notice(`フィードを追加しました: ${name}`);
						this.close();
					});
			})
			.addButton(button => {
				button.setButtonText('キャンセル')
					.onClick(() => {
						this.close();
					});
			});
	}

	onClose() {
		const {contentEl} = this;
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
		const {containerEl} = this;
		containerEl.empty();

		containerEl.createEl('h2', {text: 'RSSフィードダウンローダー設定'});

		// RSS Output Folder Setting
		new Setting(containerEl)
			.setName('RSSフォルダ')
			.setDesc('RSSの記事が保存されるフォルダ')
			.addText(text => text
				.setPlaceholder('RSS')
				.setValue(this.plugin.settings.folderPath)
				.onChange(async (value) => {
					this.plugin.settings.folderPath = value;
					await this.plugin.saveSettings();
				}));

		// File name template setting
		new Setting(containerEl)
			.setName('ファイル名テンプレート')
			.setDesc('記事のファイル名のテンプレート。{{title}}と{{published}}変数が使用可能')
			.addText(text => text
				.setPlaceholder('{{title}}')
				.setValue(this.plugin.settings.fileNameTemplate)
				.onChange(async (value) => {
					this.plugin.settings.fileNameTemplate = value;
					await this.plugin.saveSettings();
				}));

		// Content template setting
		new Setting(containerEl)
			.setName('コンテンツテンプレート')
			.setDesc('フロントマター付きの記事コンテンツのテンプレート')
			.addTextArea(text => text
				.setPlaceholder('---\ntitle: {{title}}\n---\n\n{{content}}')
				.setValue(this.plugin.settings.template)
				.onChange(async (value) => {
					this.plugin.settings.template = value;
					await this.plugin.saveSettings();
				}));
		
		// Update interval setting
		new Setting(containerEl)
			.setName('更新間隔')
			.setDesc('フィードをチェックする頻度（分単位、0で無効）')
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
				
		// Include images setting
		new Setting(containerEl)
			.setName('画像を含める')
			.setDesc('フィード記事から画像URLを含める')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeImages)
				.onChange(async (value) => {
					this.plugin.settings.includeImages = value;
					await this.plugin.saveSettings();
				}));
				
		// Image width setting
		new Setting(containerEl)
			.setName('画像の幅')
			.setDesc('コンテンツ内の画像の幅（例：50%、300px）')
			.addText(text => text
				.setPlaceholder('50%')
				.setValue(this.plugin.settings.imageWidth)
				.onChange(async (value) => {
					this.plugin.settings.imageWidth = value;
					await this.plugin.saveSettings();
				}));

		// 自動削除有効/無効の設定
		new Setting(containerEl)
			.setName('古い記事を自動削除')
			.setDesc('一定期間経過した記事を自動的に削除する')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoDeleteEnabled)
				.onChange(async (value) => {
					this.plugin.settings.autoDeleteEnabled = value;
					await this.plugin.saveSettings();
				}));
		
		// 自動削除期間の設定
		new Setting(containerEl)
			.setName('削除までの期間')
			.setDesc('作成されてから経過した後に記事を削除する')
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
				
		// 時間単位の設定
		new Setting(containerEl)
			.setName('時間単位')
			.setDesc('削除までの期間の単位')
			.addDropdown(dropdown => dropdown
				.addOption('days', '日')
				.addOption('minutes', '分')
				.setValue(this.plugin.settings.autoDeleteTimeUnit)
				.onChange(async (value) => {
					this.plugin.settings.autoDeleteTimeUnit = value;
					await this.plugin.saveSettings();
				}));

		// 削除基準の設定
		new Setting(containerEl)
			.setName('削除基準')
			.setDesc('記事を削除する基準')
			.addDropdown(dropdown => dropdown
				.addOption('publish_date', '公開日')
				.addOption('saved', '保存日')
				.setValue(this.plugin.settings.autoDeleteBasedOn)
				.onChange(async (value) => {
					this.plugin.settings.autoDeleteBasedOn = value;
					await this.plugin.saveSettings();
				}));

		// Add a heading for the feeds section
		containerEl.createEl('h3', {text: 'RSSフィード'});
		
		// Display all feeds with edit/delete options
		this.plugin.settings.feeds.forEach((feed, index) => {
			const setting = new Setting(containerEl)
				.setName(feed.name)
				.setDesc(feed.url);
			
			// Add toggle for enabled/disabled
			setting.addToggle(toggle => toggle
				.setValue(feed.enabled)
				.onChange(async (value) => {
					this.plugin.settings.feeds[index].enabled = value;
					await this.plugin.saveSettings();
				}));
			
			// Add delete button
			setting.addButton(button => button
				.setIcon('trash')
				.setTooltip('削除')
				.onClick(async () => {
					this.plugin.settings.feeds.splice(index, 1);
					await this.plugin.saveSettings();
					this.display();
				}));
		});

		// Add button to add a new feed
		new Setting(containerEl)
			.setName('新しいフィードを追加')
			.setDesc('ダウンロードする新しいRSSフィードを追加')
			.addButton(button => button
				.setButtonText('フィード追加')
				.setCta()
				.onClick(() => {
					new AddFeedModal(this.app, this.plugin).open();
				}));
		
		// Add button to update feeds now
		new Setting(containerEl)
			.setName('今すぐフィードを更新')
			.setDesc('有効なすべてのRSSフィードを手動で更新')
			.addButton(button => button
				.setButtonText('今すぐ更新')
				.setCta()
				.onClick(() => {
					this.plugin.updateFeeds();
				}));
	}
}
