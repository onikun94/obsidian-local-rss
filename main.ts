import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { t } from './localization';
import { FeedFetcher } from './src/adapters/http/FeedFetcher';
import { ImageExtractor } from './src/services/ImageExtractor';
import { UpdateFeeds } from './src/usecases/UpdateFeeds';
import {
	Feed,
	LocalRssSettings,
	DEFAULT_SETTINGS
} from './src/types';

export default class LocalRssPlugin extends Plugin {
	settings: LocalRssSettings;
	updateIntervalId: number | null = null;
	private feedFetcher: FeedFetcher;
	private imageExtractor: ImageExtractor;
	private updateFeedsUseCase: UpdateFeeds;

	async onload() {
		await this.loadSettings();

		// アダプターとサービスの初期化
		this.feedFetcher = new FeedFetcher();
		this.imageExtractor = new ImageExtractor(this.feedFetcher);

		// ユースケースの初期化
		this.updateFeedsUseCase = new UpdateFeeds(
			this.app.vault,
			this.settings,
			this.feedFetcher,
			this.imageExtractor
		);

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
		await this.updateFeedsUseCase.execute();

		this.settings.lastUpdateTime = Date.now();
		await this.saveSettings();
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
