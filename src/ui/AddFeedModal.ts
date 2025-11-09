import { App, Modal, Notice, Setting } from 'obsidian';
import { t } from '../adapters/i18n/localization';
import { LocalRssSettings } from '../types';

/**
 * フィード追加モーダル
 * 新しいRSSフィードを追加するためのUI
 */
export class AddFeedModal extends Modal {
	private settings: LocalRssSettings;
	private onSave: () => Promise<void>;
	private nameInput: HTMLInputElement;
	private urlInput: HTMLInputElement;
	private folderInput: HTMLInputElement;

	constructor(app: App, settings: LocalRssSettings, onSave: () => Promise<void>) {
		super(app);
		this.settings = settings;
		this.onSave = onSave;
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

						this.settings.feeds.push({
							name,
							url,
							folder,
							enabled: true
						});

						await this.onSave();
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
