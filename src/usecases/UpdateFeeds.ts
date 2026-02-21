import { Notice, Vault, TFile, TFolder } from 'obsidian';
import * as xml2js from 'xml2js';
import { Feed, LocalRssSettings, RssItem } from '../types';
import { FeedFetcher } from '../adapters/http/FeedFetcher';
import { ImageExtractor } from '../services/ImageExtractor';
import { RssItemBuilder } from '../services/RssItemBuilder';
import { FileNameGenerator } from '../services/FileNameGenerator';
import { ArticleRenderer } from '../services/ArticleRenderer';
import { t } from '../adapters/i18n/localization';
import { normalizePath, sanitizeHTMLToDom } from 'obsidian';

/**
 * フィード更新ユースケース
 * RSS/Atomフィードを取得・処理・保存するオーケストレーション
 */
export class UpdateFeeds {
	private rssItemBuilder = new RssItemBuilder();
	private fileNameGenerator = new FileNameGenerator();
	private articleRenderer = new ArticleRenderer();

	constructor(
		private vault: Vault,
		private settings: LocalRssSettings,
		private feedFetcher: FeedFetcher,
		private imageExtractor: ImageExtractor
	) {}

	/**
	 * 有効なフィードを全て更新
	 */
	async execute(): Promise<void> {
		new Notice(t('updatingRssFeeds'));

		const folderPath = normalizePath(this.settings.folderPath);
		const folder = this.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await this.vault.createFolder(folderPath);
		}

		for (const feed of this.settings.feeds.filter(f => f.enabled)) {
			try {
				await this.updateFeed(feed, folderPath);
				new Notice(t('updatedFeed', feed.name));
			} catch (error) {
				console.error(`Error updating feed ${feed.name}:`, error);
				new Notice(t('errorUpdatingFeed', feed.name));
			}
		}

		new Notice(t('rssFeedUpdateCompleted'));
	}

	/**
	 * 個別のフィードを更新
	 */
	private async updateFeed(feed: Feed, baseFolderPath: string): Promise<void> {
		const xml = await this.feedFetcher.fetch(feed.url);

		const parser = new xml2js.Parser({ explicitArray: false });
		const result = await parser.parseStringPromise(xml);

		const feedFolderPath = normalizePath(`${baseFolderPath}/${feed.folder || feed.name}`);
		const feedFolder = this.vault.getAbstractFileByPath(feedFolderPath);
		if (!feedFolder) {
			await this.vault.createFolder(feedFolderPath);
		}

		// RSS or Atom判定
		const channel = result.rss?.channel;
		if (!channel) {
			// Atom feed
			const atomFeed = result.feed;
			if (atomFeed && atomFeed.entry) {
				const items = Array.isArray(atomFeed.entry) ? atomFeed.entry : [atomFeed.entry];
				for (const item of items) {
					const rssItem = this.rssItemBuilder.fromAtomItem(item, atomFeed, feed);
					await this.enrichWithImage(rssItem, item);
					await this.saveRssItem(rssItem, feedFolderPath);
				}
			} else {
				new Notice(t('unsupportedFeedFormat', feed.name));
			}
			return;
		}

		// RSS feed
		const items = Array.isArray(channel.item) ? channel.item : [channel.item];
		for (const item of items) {
			const rssItem = this.rssItemBuilder.fromRssItem(item, feed);
			await this.enrichWithImage(rssItem, item);
			await this.saveRssItem(rssItem, feedFolderPath);
		}

		// 古いファイルを削除
		if (this.settings.autoDeleteEnabled) {
			await this.deleteOldFiles(feedFolderPath);
		}
	}

	/**
	 * 画像URLでRssItemを補完
	 */
	private async enrichWithImage(rssItem: RssItem, originalItem: unknown): Promise<void> {
		if (!this.settings.includeImages) return;

		rssItem.imageUrl = this.imageExtractor.extractFromItem(originalItem as Parameters<ImageExtractor['extractFromItem']>[0]);

		if (!rssItem.imageUrl && this.settings.fetchImageFromLink && rssItem.link) {
			rssItem.imageUrl = await this.imageExtractor.fetchFromUrl(rssItem.link);
		}
	}

	/**
	 * 古いファイルを削除
	 */
	private async deleteOldFiles(folderPath: string): Promise<void> {
		try {
			const folder = this.vault.getAbstractFileByPath(folderPath);
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
					const fileContent = await this.vault.read(file);

					if (this.settings.autoDeleteBasedOn === 'publish_date') {
						const publishedMatch = fileContent.match(/publish_date: (.*?)$/m);

						if (publishedMatch && publishedMatch[1]) {
							const publishedTime = new Date(publishedMatch[1]).getTime();
							if (publishedTime && publishedTime < cutoffDate) {
								await this.vault.delete(file);
							}
						}
					} else {
						const savedMatch = fileContent.match(/saved: (.*?)$/m);

						if (savedMatch && savedMatch[1]) {
							const savedTime = new Date(savedMatch[1]).getTime();
							if (savedTime && savedTime < cutoffDate) {
								await this.vault.delete(file);
							}
						} else {
							if (file.stat.ctime < cutoffDate) {
								await this.vault.delete(file);
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

	/**
	 * RSSアイテムをMarkdownファイルとして保存
	 */
	private async saveRssItem(rssItem: RssItem, folderPath: string): Promise<void> {
		// URLベースの重複チェック
		if (rssItem.link && await this.isArticleAlreadySaved(rssItem.link, folderPath)) {
			return;
		}

		const fileNameBase = this.fileNameGenerator.generate(
			this.settings.fileNameTemplate,
			rssItem.title,
			rssItem.pubDate
		);
		const fileName = normalizePath(`${folderPath}/${fileNameBase}.md`);

		const existingFile = this.vault.getAbstractFileByPath(fileName);
		if (existingFile) {
			return;
		}

		let processedContent = rssItem.content;
		if (this.settings.imageWidth && this.settings.imageWidth !== '100%') {
			processedContent = this.resizeImagesInContent(processedContent);
		}

		const fileContent = this.articleRenderer.render(rssItem, this.settings.template, processedContent);
		await this.vault.create(fileName, fileContent);
	}

	/**
	 * コンテンツ内の画像をリサイズ
	 */
	private resizeImagesInContent(content: string): string {
		if (!content) return content;

		if (typeof content !== 'string') {
			console.warn('resizeImagesInContent: received non-string input', content);
			return '';
		}

		const fragment = sanitizeHTMLToDom(content);
		const div = createDiv();
		div.appendChild(fragment);

		const images = div.querySelectorAll('img');
		images.forEach((img) => {
			if (!img.hasAttribute('width') && !img.hasAttribute('style')) {
				img.setAttribute('width', this.settings.imageWidth);
			}
		});

		return div.innerHTML;
	}

	/**
	 * 既存記事の重複チェック（URLベース）
	 */
	private async isArticleAlreadySaved(link: string, folderPath: string): Promise<boolean> {
		try {
			const folder = this.vault.getAbstractFileByPath(folderPath);
			if (!folder || !(folder instanceof TFolder)) {
				return false;
			}

			const files = folder.children.filter(
				file => file instanceof TFile && file.extension === 'md'
			) as TFile[];

			for (const file of files) {
				try {
					const fileContent = await this.vault.read(file);
					const linkMatch = fileContent.match(/link: (.*?)$/m);

					if (linkMatch && linkMatch[1]) {
						const existingLink = linkMatch[1].trim();
						if (existingLink === link) {
							return true;
						}
					}
				} catch (e) {
					console.error(`Error reading file: ${file.path}`, e);
				}
			}

			return false;
		} catch (error) {
			console.error('Error checking for duplicate articles:', error);
			return false;
		}
	}
}
