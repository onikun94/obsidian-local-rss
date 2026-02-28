import { App, Modal, Notice, Setting } from 'obsidian';
import { t } from '../adapters/i18n/localization';
import { Feed, LocalRssSettings } from '../types';

/**
 * フィード編集モーダル
 * 既存のRSSフィードを編集するためのUI（フィード個別設定を含む）
 */
export class EditFeedModal extends Modal {
	private settings: LocalRssSettings;
	private feed: Feed;
	private feedIndex: number;
	private onSave: () => Promise<void>;
	private onDisplayRefresh: () => void;
	private nameInput: HTMLInputElement;
	private urlInput: HTMLInputElement;
	private folderInput: HTMLInputElement;

	// フィード個別設定の一時的な状態
	private useCustomTemplate: boolean;
	private customTemplate: string;
	private useCustomAutoDelete: boolean;
	private customAutoDeleteEnabled: boolean;
	private customAutoDeleteDays: number;
	private customAutoDeleteTimeUnit: string;
	private customAutoDeleteBasedOn: string;

	constructor(
		app: App,
		settings: LocalRssSettings,
		feedIndex: number,
		onSave: () => Promise<void>,
		onDisplayRefresh: () => void
	) {
		super(app);
		if (feedIndex < 0 || feedIndex >= settings.feeds.length) {
			throw new Error(`Invalid feed index: ${feedIndex}`);
		}
		this.settings = settings;
		this.feedIndex = feedIndex;
		this.feed = settings.feeds[feedIndex];
		this.onSave = onSave;
		this.onDisplayRefresh = onDisplayRefresh;

		// 現在のフィード個別設定を読み込み
		this.useCustomTemplate = this.feed.customTemplate !== undefined;
		this.customTemplate = this.feed.customTemplate ?? this.settings.template;
		this.useCustomAutoDelete = this.feed.customAutoDeleteEnabled !== undefined;
		this.customAutoDeleteEnabled = this.feed.customAutoDeleteEnabled ?? this.settings.autoDeleteEnabled;
		this.customAutoDeleteDays = this.feed.customAutoDeleteDays ?? this.settings.autoDeleteDays;
		this.customAutoDeleteTimeUnit = this.feed.customAutoDeleteTimeUnit ?? this.settings.autoDeleteTimeUnit;
		this.customAutoDeleteBasedOn = this.feed.customAutoDeleteBasedOn ?? this.settings.autoDeleteBasedOn;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('local-rss-edit-feed-modal');

		contentEl.createEl('h2', { text: t('editFeed') });

		// --- 基本情報 ---
		new Setting(contentEl)
			.setName(t('feedName'))
			.addText(text => {
				this.nameInput = text.inputEl;
				text.setValue(this.feed.name);
			});

		new Setting(contentEl)
			.setName(t('feedUrl'))
			.addText(text => {
				this.urlInput = text.inputEl;
				text.setValue(this.feed.url);
			});

		new Setting(contentEl)
			.setName(t('customFolderName'))
			.setDesc(t('customFolderNameDesc'))
			.addText(text => {
				this.folderInput = text.inputEl;
				text.setValue(this.feed.folder || '');
				text.setPlaceholder(t('customFolderPlaceholder'));
			});

		// --- カスタムテンプレート ---
		this.renderTemplateSection(contentEl);

		// --- カスタム削除設定 ---
		this.renderAutoDeleteSection(contentEl);

		// --- ボタン ---
		new Setting(contentEl)
			.addButton(button => {
				button.setButtonText(t('save'))
					.setCta()
					.onClick(async () => {
						await this.handleSave();
					});
			})
			.addButton(button => {
				button.setButtonText(t('cancel'))
					.onClick(() => {
						this.close();
					});
			});
	}

	private renderTemplateSection(containerEl: HTMLElement): void {
		const templateContainer = containerEl.createDiv('local-rss-feed-section');

		new Setting(templateContainer)
			.setName(t('useCustomTemplate'))
			.setDesc(t('useCustomTemplateDesc'))
			.addToggle(toggle => toggle
				.setValue(this.useCustomTemplate)
				.onChange((value) => {
					this.useCustomTemplate = value;
					if (value && this.feed.customTemplate === undefined) {
						this.customTemplate = this.settings.template;
					}
					this.refreshTemplateDetails(templateContainer);
				}));

		this.refreshTemplateDetails(templateContainer);
	}

	private refreshTemplateDetails(container: HTMLElement): void {
		const existing = container.querySelector('.local-rss-feed-template-details');
		if (existing) existing.remove();

		if (!this.useCustomTemplate) return;

		const detailsEl = container.createDiv('local-rss-feed-template-details');

		// テキストエリア（全幅）
		const textareaSetting = new Setting(detailsEl)
			.addTextArea(text => {
				text.setValue(this.customTemplate)
					.onChange((value) => {
						this.customTemplate = value;
					});
				text.inputEl.addClass('local-rss-modal-template-textarea');
				return text;
			});
		textareaSetting.settingEl.addClass('local-rss-modal-template-setting');

		// 変数リファレンス（折りたたみ式）
		const detailsTag = detailsEl.createEl('details', { cls: 'local-rss-modal-variables' });
		detailsTag.createEl('summary', { text: t('availableVariables') });
		const variablesList = detailsTag.createEl('div', { cls: 'local-rss-modal-variables-list' });
		const variables = [
			'{{title}}', '{{link}}', '{{author}}', '{{publishedTime}}',
			'{{savedTime}}', '{{image}}', '{{description}}',
			'{{descriptionShort}}', '{{content}}', '{{#tags}}'
		];
		variablesList.createEl('code', {
			text: variables.join('  '),
			cls: 'local-rss-modal-variables-code'
		});
	}

	private renderAutoDeleteSection(containerEl: HTMLElement): void {
		const deleteContainer = containerEl.createDiv('local-rss-feed-section');

		new Setting(deleteContainer)
			.setName(t('useCustomAutoDelete'))
			.setDesc(t('useCustomAutoDeleteDesc'))
			.addToggle(toggle => toggle
				.setValue(this.useCustomAutoDelete)
				.onChange((value) => {
					this.useCustomAutoDelete = value;
					if (value && this.feed.customAutoDeleteEnabled === undefined) {
						this.customAutoDeleteEnabled = this.settings.autoDeleteEnabled;
						this.customAutoDeleteDays = this.settings.autoDeleteDays;
						this.customAutoDeleteTimeUnit = this.settings.autoDeleteTimeUnit;
						this.customAutoDeleteBasedOn = this.settings.autoDeleteBasedOn;
					}
					this.refreshAutoDeleteDetails(deleteContainer);
				}));

		this.refreshAutoDeleteDetails(deleteContainer);
	}

	private refreshAutoDeleteDetails(container: HTMLElement): void {
		const existing = container.querySelector('.local-rss-feed-delete-details');
		if (existing) existing.remove();

		if (!this.useCustomAutoDelete) return;

		const detailsEl = container.createDiv('local-rss-feed-delete-details');

		new Setting(detailsEl)
			.setName(t('autoDeleteOldArticles'))
			.addToggle(toggle => toggle
				.setValue(this.customAutoDeleteEnabled)
				.onChange((value) => {
					this.customAutoDeleteEnabled = value;
				}));

		new Setting(detailsEl)
			.setName(t('periodBeforeDeletion'))
			.addText(text => text
				.setPlaceholder('30')
				.setValue(String(this.customAutoDeleteDays))
				.onChange((value) => {
					const days = parseInt(value);
					if (!isNaN(days) && days > 0) {
						this.customAutoDeleteDays = days;
					}
				}));

		new Setting(detailsEl)
			.setName(t('timeUnit'))
			.addDropdown(dropdown => dropdown
				.addOption('days', t('days'))
				.addOption('minutes', t('minutes'))
				.setValue(this.customAutoDeleteTimeUnit)
				.onChange((value) => {
					this.customAutoDeleteTimeUnit = value;
				}));

		new Setting(detailsEl)
			.setName(t('deletionCriteria'))
			.addDropdown(dropdown => dropdown
				.addOption('publish_date', t('publishedDate'))
				.addOption('saved', t('savedDate'))
				.setValue(this.customAutoDeleteBasedOn)
				.onChange((value) => {
					this.customAutoDeleteBasedOn = value;
				}));
	}

	private async handleSave(): Promise<void> {
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

		const originalFeed = this.feed;
		try {
			const updatedFeed: Feed = {
				...this.feed,
				name,
				url,
				folder,
				customTemplate: this.useCustomTemplate ? this.customTemplate : undefined,
				customAutoDeleteEnabled: this.useCustomAutoDelete ? this.customAutoDeleteEnabled : undefined,
				customAutoDeleteDays: this.useCustomAutoDelete ? this.customAutoDeleteDays : undefined,
				customAutoDeleteTimeUnit: this.useCustomAutoDelete ? this.customAutoDeleteTimeUnit : undefined,
				customAutoDeleteBasedOn: this.useCustomAutoDelete ? this.customAutoDeleteBasedOn : undefined,
			};

			this.settings.feeds[this.feedIndex] = updatedFeed;

			await this.onSave();
			new Notice(t('savedFeed', name));
			this.close();
			this.onDisplayRefresh();
		} catch (error) {
			this.settings.feeds[this.feedIndex] = originalFeed;
			console.error('Failed to save feed settings:', error);
			new Notice(t('errorSavingFeed'));
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
