import { Notice, Vault, TFile, TFolder } from 'obsidian';
import * as xml2js from 'xml2js';
import { Feed, LocalRssSettings, ResolvedFeedSettings, RssItem } from '../types';
import { FeedFetcher } from '../adapters/http/FeedFetcher';
import { ImageExtractor } from '../services/ImageExtractor';
import { ArticleHistoryService } from '../services/ArticleHistoryService';
import { RssItemBuilder } from '../services/RssItemBuilder';
import { FileNameGenerator } from '../services/FileNameGenerator';
import { ArticleRenderer } from '../services/ArticleRenderer';
import { FeedSettingsResolver } from '../services/FeedSettingsResolver';
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
		private imageExtractor: ImageExtractor,
		private articleHistory: ArticleHistoryService
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

		const resolved = FeedSettingsResolver.resolve(feed, this.settings);

		// アイテム収集（RSS/Atom共通）
		const collectedItems: { rssItem: RssItem; originalItem: unknown }[] = [];

		// RSS or Atom判定
		let channel = result.rss?.channel;
		if (!channel && result['rdf:RDF']) {
			channel = result['rdf:RDF'].channel;
			if (channel) {
				// RSS 1.0 (RDF) では item は channel の外にあるため、手動でマッピング
				channel.item = result['rdf:RDF'].item;
			}
		}

		if (!channel) {
			// Atom feed
			const atomFeed = result.feed;
			if (atomFeed && atomFeed.entry) {
				const items = Array.isArray(atomFeed.entry) ? atomFeed.entry : [atomFeed.entry];
				for (const item of items) {
					const rssItem = this.rssItemBuilder.fromAtomItem(item, atomFeed, feed);
					await this.enrichWithImage(rssItem, item);
					collectedItems.push({ rssItem, originalItem: item });
				}
			} else {
				new Notice(t('unsupportedFeedFormat', feed.name));
			}
		} else {
			// RSS feed
			const items = Array.isArray(channel.item) ? channel.item : [channel.item];
			for (const item of items) {
				const rssItem = this.rssItemBuilder.fromRssItem(item, feed);
				await this.enrichWithImage(rssItem, item);
				collectedItems.push({ rssItem, originalItem: item });
			}
		}

		if (this.settings.singleFilePerFeed) {
			// single-file mode: フィードごとに1つの.mdファイルに追記
			const feedFilePath = normalizePath(`${baseFolderPath}/${feed.folder || feed.name}.md`);
			await this.saveItemsToFeedFile(collectedItems.map(c => c.rssItem), feedFilePath);
		} else {
			// デフォルト: フィードごとにフォルダを作成し、記事ごとにファイルを作成
			const feedFolderPath = normalizePath(`${baseFolderPath}/${feed.folder || feed.name}`);
			const feedFolder = this.vault.getAbstractFileByPath(feedFolderPath);
			if (!feedFolder) {
				await this.vault.createFolder(feedFolderPath);
			}

			for (const { rssItem } of collectedItems) {
				await this.saveRssItem(rssItem, feedFolderPath, resolved.template);
			}

			if (resolved.autoDeleteEnabled) {
				await this.deleteOldFiles(feedFolderPath, resolved);
				this.articleHistory.purgeOlderThan(this.calcCutoffDate(resolved));
			}
		}

		this.articleHistory.enforceCapLimit();
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
	 * 自動削除のカットオフ日時を計算
	 */
	private calcCutoffDate(resolved: ResolvedFeedSettings): number {
		if (resolved.autoDeleteTimeUnit === 'minutes') {
			return Date.now() - (resolved.autoDeleteDays * 60 * 1000);
		}
		return Date.now() - (resolved.autoDeleteDays * 24 * 60 * 60 * 1000);
	}

	/**
	 * 古いファイルを削除
	 */
	private async deleteOldFiles(folderPath: string, deleteSettings: ResolvedFeedSettings): Promise<void> {
		try {
			const folder = this.vault.getAbstractFileByPath(folderPath);
			if (!folder || !(folder instanceof TFolder)) {
				return;
			}
			const files = folder.children.filter(file => file instanceof TFile && file.extension === 'md') as TFile[];

			let cutoffDate: number;
			if (deleteSettings.autoDeleteTimeUnit === 'minutes') {
				cutoffDate = Date.now() - (deleteSettings.autoDeleteDays * 60 * 1000);
			} else {
				cutoffDate = Date.now() - (deleteSettings.autoDeleteDays * 24 * 60 * 60 * 1000);
			}

			for (const file of files) {
				try {
					const fileContent = await this.vault.read(file);

					if (deleteSettings.autoDeleteBasedOn === 'publish_date') {
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
	 * 複数のRSSアイテムを1つのMarkdownファイルに保存（single-file mode）
	 * 新しい記事はファイルの先頭に追記される
	 */
	private async saveItemsToFeedFile(items: RssItem[], feedFilePath: string): Promise<void> {
		const newSections: string[] = [];

		for (const rssItem of items) {
			if (rssItem.link && this.articleHistory.hasBeenDownloaded(rssItem.link)) {
				continue;
			}

			let processedContent = rssItem.content;
			if (this.settings.imageWidth && this.settings.imageWidth !== '100%') {
				processedContent = this.resizeImagesInContent(processedContent);
			}

			const section = this.articleRenderer.renderSection(rssItem, processedContent);
			newSections.push(section);

			if (rssItem.link) {
				this.articleHistory.addToHistory(rssItem.link);
			}
		}

		if (newSections.length === 0) return;

		const newContent = newSections.join('\n');
		const existingFile = this.vault.getAbstractFileByPath(feedFilePath);

		if (existingFile instanceof TFile) {
			const existingContent = await this.vault.read(existingFile);
			await this.vault.modify(existingFile, newContent + '\n' + existingContent);
		} else {
			await this.vault.create(feedFilePath, newContent);
		}
	}

	/**
	 * RSSアイテムをMarkdownファイルとして保存
	 */
	private async saveRssItem(rssItem: RssItem, folderPath: string, template: string): Promise<void> {
		// 履歴ベースの重複チェック
		if (rssItem.link && this.articleHistory.hasBeenDownloaded(rssItem.link)) {
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

		const fileContent = this.articleRenderer.render(rssItem, template, processedContent);
		await this.vault.create(fileName, fileContent);

		if (rssItem.link) {
			this.articleHistory.addToHistory(rssItem.link);
		}
	}

	/**
	 * コンテンツ内の画像をリサイズ
	 */
	private resizeImagesInContent(content: string): string {
		if (!content) return content;

		if (typeof content !== 'string') {
			console.error('resizeImagesInContent: received non-string input', content);
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

}