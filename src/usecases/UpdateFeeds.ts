import { Notice, Vault, TFile, TFolder } from 'obsidian';
import * as xml2js from 'xml2js';
import { Feed, LocalRssSettings, RssFeedItem, AtomFeedItem, AtomFeed, RssItem } from '../types';
import { FeedFetcher } from '../adapters/http/FeedFetcher';
import { ImageExtractor } from '../services/ImageExtractor';
import { XmlNormalizer } from '../adapters/parsers/XmlNormalizer';
import { stripHtml, htmlToMarkdown } from '../utils/htmlProcessor';
import { escapeYamlValue } from '../utils/yamlFormatter';
import { prepareTemplate, renderTemplate } from '../utils/templateEngine';
import { t } from '../adapters/i18n/localization';
import { normalizePath, sanitizeHTMLToDom } from 'obsidian';

/**
 * フィード更新ユースケース
 * RSS/Atomフィードを取得・処理・保存するオーケストレーション
 */
export class UpdateFeeds {
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

		const folderPath = this.settings.folderPath;
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

		const feedFolderPath = `${baseFolderPath}/${feed.folder || feed.name}`;
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
					await this.processAtomItem(item, atomFeed, feed, feedFolderPath);
				}
			} else {
				new Notice(t('unsupportedFeedFormat', feed.name));
			}
			return;
		}

		// RSS feed
		const items = Array.isArray(channel.item) ? channel.item : [channel.item];
		for (const item of items) {
			await this.processRssItem(item, feed, feedFolderPath);
		}

		// 古いファイルを削除
		if (this.settings.autoDeleteEnabled) {
			await this.deleteOldFiles(feedFolderPath);
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
	 * RSSアイテムを処理
	 */
	private async processRssItem(item: RssFeedItem, feed: Feed, folderPath: string): Promise<void> {
		const rssItem: RssItem = {
			title: item.title || 'Untitled',
			description: stripHtml(item.description || '', 200),
			content: item['content:encoded'] || item.description || '',
			link: item.link || '',
			pubDate: item.pubDate || item.published || new Date().toISOString(),
			author: item.author || item['dc:creator'] || feed.name,
			categories: this.normalizeCategories(item.category),
			imageUrl: '',
			savedDate: new Date().toISOString()
		};

		// 画像抽出
		if (this.settings.includeImages) {
			rssItem.imageUrl = this.imageExtractor.extractFromItem(item);

			if (!rssItem.imageUrl && this.settings.fetchImageFromLink && rssItem.link) {
				rssItem.imageUrl = await this.imageExtractor.fetchFromUrl(rssItem.link);
			}
		}

		await this.saveRssItem(rssItem, folderPath);
	}

	/**
	 * Atomアイテムを処理
	 */
	private async processAtomItem(item: AtomFeedItem, atomFeed: AtomFeed, feed: Feed, folderPath: string): Promise<void> {
		const title = XmlNormalizer.normalizeValue(item.title);
		const summary = XmlNormalizer.normalizeValue(item.summary);
		const content = XmlNormalizer.normalizeValue(item.content);
		const link = XmlNormalizer.normalizeAtomLink(item.link);
		const author = XmlNormalizer.normalizeAtomAuthor(item.author, XmlNormalizer.normalizeValue(atomFeed.title));

		const rssItem: RssItem = {
			title: title || 'Untitled',
			description: stripHtml(summary, 200),
			content: content || summary,
			link: link,
			pubDate: item.published || item.updated || new Date().toISOString(),
			author: author,
			categories: this.normalizeCategories(item.category),
			imageUrl: '',
			savedDate: new Date().toISOString()
		};

		// 画像抽出
		if (this.settings.includeImages) {
			rssItem.imageUrl = this.imageExtractor.extractFromItem(item);

			if (!rssItem.imageUrl && this.settings.fetchImageFromLink && rssItem.link) {
				rssItem.imageUrl = await this.imageExtractor.fetchFromUrl(rssItem.link);
			}
		}

		await this.saveRssItem(rssItem, folderPath);
	}

	/**
	 * RSSアイテムをMarkdownファイルとして保存
	 */
	private async saveRssItem(rssItem: RssItem, folderPath: string): Promise<void> {
		let fileName = this.settings.fileNameTemplate
			.replace(/{{title}}/g, rssItem.title)
			.replace(/{{published}}/g, this.formatDateTime(new Date(rssItem.pubDate)));

		fileName = fileName.replace(/[\\/:*?"<>|]/g, '-');
		fileName = normalizePath(`${folderPath}/${fileName}.md`);

		const existingFile = this.vault.getAbstractFileByPath(fileName);
		if (existingFile) {
			return; // 既に存在する場合はスキップ
		}

		const pubDate = new Date(rssItem.pubDate);
		const fullDateTime = this.formatDateTime(pubDate);

		const savedDate = new Date(rssItem.savedDate);
		const fullSavedDateTime = this.formatDateTime(savedDate);

		const escapedTitle = escapeYamlValue(XmlNormalizer.normalizeValue(rssItem.title));
		const escapedAuthor = escapeYamlValue(XmlNormalizer.normalizeValue(rssItem.author));

		const descriptionCleaned = rssItem.description.replace(/\r?\n/g, ' ').trim();
		const descriptionShort = descriptionCleaned.substring(0, 50) + (descriptionCleaned.length > 50 ? '...' : '');
		const escapedDescription = escapeYamlValue(descriptionCleaned);
		const escapedDescriptionShort = escapeYamlValue(descriptionShort);

		let processedContent = rssItem.content;
		if (this.settings.imageWidth && this.settings.imageWidth !== '100%') {
			processedContent = this.resizeImagesInContent(processedContent);
		}
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

		await this.vault.create(fileName, fileContent);
	}

	/**
	 * カテゴリを正規化
	 */
	private normalizeCategories(categoryField: unknown): string[] {
		if (!categoryField) {
			return [];
		}

		const categories = Array.isArray(categoryField) ? categoryField : [categoryField];
		return categories
			.map((category: unknown) => this.extractCategoryText(category))
			.filter((category: string): category is string => category.length > 0);
	}

	/**
	 * カテゴリテキストを抽出
	 */
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

	/**
	 * 日時フォーマット
	 */
	private formatDateTime(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');

		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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
}
