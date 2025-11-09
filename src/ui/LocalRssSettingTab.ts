import { App, PluginSettingTab, Setting } from 'obsidian';
import { t } from '../../localization';
import { LocalRssSettings } from '../types';
import { AddFeedModal } from './AddFeedModal';

/**
 * RSS設定タブ
 * プラグイン設定画面のUI
 */
export class LocalRssSettingTab extends PluginSettingTab {
	private settings: LocalRssSettings;
	private onSaveSettings: () => Promise<void>;
	private onUpdateFeeds: () => Promise<void>;
	private onStartUpdateInterval: () => void;

	constructor(
		app: App,
		plugin: any,
		settings: LocalRssSettings,
		onSaveSettings: () => Promise<void>,
		onUpdateFeeds: () => Promise<void>,
		onStartUpdateInterval: () => void
	) {
		super(app, plugin);
		this.settings = settings;
		this.onSaveSettings = onSaveSettings;
		this.onUpdateFeeds = onUpdateFeeds;
		this.onStartUpdateInterval = onStartUpdateInterval;
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
				.setValue(this.settings.folderPath)
				.onChange(async (value) => {
					this.settings.folderPath = value;
					await this.onSaveSettings();
				}));

		new Setting(containerEl)
			.setName(t('fileNameTemplate'))
			.setDesc(t('fileNameTemplateDesc'))
			.addText(text => text
				.setPlaceholder('{{title}}')
				.setValue(this.settings.fileNameTemplate)
				.onChange(async (value) => {
					this.settings.fileNameTemplate = value;
					await this.onSaveSettings();
				}));

		const templateSetting = new Setting(containerEl)
			.setName(t('contentTemplate'))
			.setDesc(t('contentTemplateDesc'))
			.addTextArea(text => {
				text.setPlaceholder('---\ntitle: {{title}}\n---\n\n{{content}}')
					.setValue(this.settings.template)
					.onChange(async (value) => {
						this.settings.template = value;
						await this.onSaveSettings();
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
				.setValue(String(this.settings.updateInterval))
				.onChange(async (value) => {
					const interval = parseInt(value);
					if (!isNaN(interval) && interval >= 0) {
						this.settings.updateInterval = interval;
						await this.onSaveSettings();
						this.onStartUpdateInterval();
					}
				}));

		new Setting(containerEl)
			.setName(t('includeImages'))
			.setDesc(t('includeImagesDesc'))
			.addToggle(toggle => toggle
				.setValue(this.settings.includeImages)
				.onChange(async (value) => {
					this.settings.includeImages = value;
					await this.onSaveSettings();
				}));

		new Setting(containerEl)
			.setName(t('fetchImageFromLink'))
			.setDesc(t('fetchImageFromLinkDesc'))
			.addToggle(toggle => toggle
				.setValue(this.settings.fetchImageFromLink)
				.onChange(async (value) => {
					this.settings.fetchImageFromLink = value;
					await this.onSaveSettings();
				}));

		new Setting(containerEl)
			.setName(t('imageWidth'))
			.setDesc(t('imageWidthDesc'))
			.addText(text => text
				.setPlaceholder('50%')
				.setValue(this.settings.imageWidth)
				.onChange(async (value) => {
					this.settings.imageWidth = value;
					await this.onSaveSettings();
				}));

		new Setting(containerEl)
			.setName(t('autoDeleteOldArticles'))
			.setDesc(t('autoDeleteOldArticlesDesc'))
			.addToggle(toggle => toggle
				.setValue(this.settings.autoDeleteEnabled)
				.onChange(async (value) => {
					this.settings.autoDeleteEnabled = value;
					await this.onSaveSettings();
				}));

		new Setting(containerEl)
			.setName(t('periodBeforeDeletion'))
			.setDesc(t('periodBeforeDeletionDesc'))
			.addText(text => text
				.setPlaceholder('30')
				.setValue(String(this.settings.autoDeleteDays))
				.onChange(async (value) => {
					const days = parseInt(value);
					if (!isNaN(days) && days > 0) {
						this.settings.autoDeleteDays = days;
						await this.onSaveSettings();
					}
				}));

		new Setting(containerEl)
			.setName(t('timeUnit'))
			.setDesc(t('timeUnitDesc'))
			.addDropdown(dropdown => dropdown
				.addOption('days', t('days'))
				.addOption('minutes', t('minutes'))
				.setValue(this.settings.autoDeleteTimeUnit)
				.onChange(async (value) => {
					this.settings.autoDeleteTimeUnit = value;
					await this.onSaveSettings();
				}));

		new Setting(containerEl)
			.setName(t('deletionCriteria'))
			.setDesc(t('deletionCriteriaDesc'))
			.addDropdown(dropdown => dropdown
				.addOption('publish_date', t('publishedDate'))
				.addOption('saved', t('savedDate'))
				.setValue(this.settings.autoDeleteBasedOn)
				.onChange(async (value) => {
					this.settings.autoDeleteBasedOn = value;
					await this.onSaveSettings();
				}));

		new Setting(containerEl)
			.setName(t('updateRssFeeds'))
			.setHeading();

		this.settings.feeds.forEach((feed, index) => {
			const setting = new Setting(containerEl)
				.setName(feed.name)
				.setDesc(feed.url);

			setting.addToggle(toggle => toggle
				.setValue(feed.enabled)
				.onChange(async (value) => {
					this.settings.feeds[index].enabled = value;
					await this.onSaveSettings();
				}));

			setting.addButton(button => button
				.setIcon('trash')
				.setTooltip(t('cancel'))
				.onClick(async () => {
					this.settings.feeds.splice(index, 1);
					await this.onSaveSettings();
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
					new AddFeedModal(this.app, this.settings, this.onSaveSettings).open();
				}));

		new Setting(containerEl)
			.setName(t('updateFeedsNow'))
			.setDesc(t('updateFeedsNowDesc'))
			.addButton(button => button
				.setButtonText(t('updateNow'))
				.setCta()
				.onClick(() => {
					this.onUpdateFeeds();
				}));
	}
}
