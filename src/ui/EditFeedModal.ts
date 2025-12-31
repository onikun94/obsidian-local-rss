import { App, Modal, Notice, Setting } from 'obsidian';
import { t } from '../adapters/i18n/localization';
import { Feed, LocalRssSettings } from '../types';

/**
 * フィード編集モーダル
 * 既存のRSSフィードを編集するためのUI
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

	constructor(
		app: App,
		settings: LocalRssSettings,
		feedIndex: number,
		onSave: () => Promise<void>,
		onDisplayRefresh: () => void
	) {
		super(app);
		this.settings = settings;
		this.feedIndex = feedIndex;
		this.feed = settings.feeds[feedIndex];
		this.onSave = onSave;
		this.onDisplayRefresh = onDisplayRefresh;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl('h2', { text: t('editFeed') });

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

		new Setting(contentEl)
			.addButton(button => {
				button.setButtonText(t('save'))
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

						this.settings.feeds[this.feedIndex] = {
							...this.feed,
							name,
							url,
							folder
						};

						await this.onSave();
						new Notice(t('savedFeed', name));
						this.close();
						this.onDisplayRefresh();
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
