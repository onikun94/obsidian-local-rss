import { Feed, RssFeedItem, AtomFeedItem, AtomFeed, RssItem } from '../types';
import { XmlNormalizer } from '../adapters/parsers/XmlNormalizer';
import { stripHtml } from '../utils/htmlProcessor';
import { CategoryNormalizer } from './CategoryNormalizer';

/**
 * RssItemビルダーサービス
 * RSS/AtomフィードアイテムからドメインモデルRssItemを構築する
 */
export class RssItemBuilder {
	private categoryNormalizer = new CategoryNormalizer();

	/**
	 * RSSフィードアイテムからRssItemを構築
	 * @param item RSSフィードアイテム
	 * @param feed フィード設定
	 * @returns RssItemドメインモデル
	 */
	fromRssItem(item: RssFeedItem, feed: Feed): RssItem {
		return {
			title: item.title || 'Untitled',
			description: stripHtml(item.description || '', 200),
			content: item['content:encoded'] || item.description || '',
			link: item.link || '',
			pubDate: item.pubDate || item.published || item['dc:date'] || new Date().toISOString(),
			author: item.author || item['dc:creator'] || feed.name,
			categories: this.categoryNormalizer.normalize(item.category),
			imageUrl: '',
			savedDate: new Date().toISOString(),
		};
	}

	/**
	 * AtomフィードアイテムからRssItemを構築
	 * @param item Atomフィードアイテム
	 * @param atomFeed Atomフィード全体
	 * @param feed フィード設定
	 * @returns RssItemドメインモデル
	 */
	fromAtomItem(item: AtomFeedItem, atomFeed: AtomFeed, feed: Feed): RssItem {
		const title = XmlNormalizer.normalizeValue(item.title);
		const summary = XmlNormalizer.normalizeValue(item.summary);
		const content = XmlNormalizer.normalizeValue(item.content);
		const link = XmlNormalizer.normalizeAtomLink(item.link);
		const author = XmlNormalizer.normalizeAtomAuthor(
			item.author,
			XmlNormalizer.normalizeValue(atomFeed.title)
		);

		return {
			title: title || 'Untitled',
			description: stripHtml(summary, 200),
			content: content || summary,
			link: link,
			pubDate: item.published || item.updated || new Date().toISOString(),
			author: author,
			categories: this.categoryNormalizer.normalize(item.category),
			imageUrl: '',
			savedDate: new Date().toISOString(),
		};
	}
}
