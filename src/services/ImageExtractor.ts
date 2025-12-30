import { RssFeedItem, AtomFeedItem } from '../types';
import { XmlNormalizer } from '../adapters/parsers/XmlNormalizer';
import { FeedFetcher } from '../adapters/http/FeedFetcher';

/**
 * 画像URL抽出サービス
 * RSSフィードアイテムから画像URLを抽出するビジネスロジック
 */
export class ImageExtractor {
	constructor(private feedFetcher: FeedFetcher) {}

	/**
	 * フィードアイテムから画像URLを抽出
	 * @param item RSSまたはAtomフィードアイテム
	 * @returns 画像URL（見つからない場合は空文字列）
	 */
	extractFromItem(item: RssFeedItem | AtomFeedItem): string {
		// 1. メディア要素から抽出
		const mediaUrl = this.extractFromMediaElements(item);
		if (mediaUrl) return mediaUrl;

		// 2. HTMLコンテンツから抽出
		const contentUrl = this.extractFromHtmlContent(item);
		if (contentUrl) return contentUrl;

		return '';
	}

	/**
	 * メディア要素（media:content, media:thumbnail, enclosure）から画像URLを抽出
	 * @param item フィードアイテム
	 * @returns 画像URL（見つからない場合は空文字列）
	 */
	private extractFromMediaElements(item: RssFeedItem | AtomFeedItem): string {
		if (!('media:content' in item || 'media:thumbnail' in item || 'enclosure' in item)) {
			return '';
		}

		const rssItem = item as RssFeedItem;

		// media:content
		if (rssItem['media:content']) {
			const mediaContent = rssItem['media:content'];
			if (typeof mediaContent === 'string') {
				return mediaContent;
			} else if (mediaContent.$ && mediaContent.$.url) {
				return mediaContent.$.url;
			}
		}

		// media:thumbnail
		if (rssItem['media:thumbnail']) {
			const mediaThumbnail = rssItem['media:thumbnail'];
			if (typeof mediaThumbnail === 'string') {
				return mediaThumbnail;
			} else if (mediaThumbnail.$ && mediaThumbnail.$.url) {
				return mediaThumbnail.$.url;
			}
		}

		// enclosure
		if (rssItem.enclosure) {
			const enclosure = rssItem.enclosure;
			let enclosureUrl = '';

			if (typeof enclosure === 'string') {
				enclosureUrl = enclosure;
			} else if (enclosure.$ && enclosure.$.url) {
				enclosureUrl = enclosure.$.url;
			}

			if (enclosureUrl) {
				// 画像URLかどうかを検証
				if (this.isImageUrl(enclosureUrl)) {
					return enclosureUrl;
				}
				// MIMEタイプで画像かチェック
				if (typeof enclosure === 'object' && enclosure.$ && enclosure.$.type && enclosure.$.type.startsWith('image/')) {
					return enclosureUrl;
				}
			}
		}

		return '';
	}

	/**
	 * URLが画像URLかどうかを判定
	 * @param url URL
	 * @returns 画像URLの場合true
	 */
	private isImageUrl(url: string): boolean {
		return (
			url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) !== null ||
			url.includes('cloudinary.com') ||
			url.includes('imgur.com') ||
			url.includes('googleusercontent.com')
		);
	}

	/**
	 * HTMLコンテンツから画像URLを抽出
	 * @param item フィードアイテム
	 * @returns 画像URL（見つからない場合は空文字列）
	 */
	private extractFromHtmlContent(item: RssFeedItem | AtomFeedItem): string {
		let content = '';

		if ('content:encoded' in item) {
			content = (item as RssFeedItem)['content:encoded'] || (item as RssFeedItem).description || '';
		} else if ('content' in item) {
			const atomItem = item as AtomFeedItem;
			content = XmlNormalizer.normalizeValue(atomItem.content) || XmlNormalizer.normalizeValue(atomItem.summary) || '';
		}

		if (content && typeof content === 'string') {
			const match = /<img.*?src=["'](.*?)["']/.exec(content);
			if (match && match[1]) {
				return match[1];
			}
		}

		return '';
	}

	/**
	 * URLからOGP画像を取得
	 * @param url URL
	 * @returns OGP画像URL（見つからない場合は空文字列）
	 */
	async fetchFromUrl(url: string): Promise<string> {
		const html = await this.feedFetcher.fetchHtml(url);
		if (!html) {
			return '';
		}

		try {
			let imageUrl = '';

			// OGP画像を抽出
			// <meta property="og:image" content="..." />
			const ogImageMatch1 = /<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i.exec(html);
			if (ogImageMatch1 && ogImageMatch1[1]) {
				imageUrl = ogImageMatch1[1];
			}

			// <meta content="..." property="og:image" />
			if (!imageUrl) {
				const ogImageMatch2 = /<meta\s+content=["'](.*?)["']\s+property=["']og:image["']/i.exec(html);
				if (ogImageMatch2 && ogImageMatch2[1]) {
					imageUrl = ogImageMatch2[1];
				}
			}

			// twitter:image も試す
			if (!imageUrl) {
				const twitterImageMatch1 = /<meta\s+name=["']twitter:image["']\s+content=["'](.*?)["']/i.exec(html);
				if (twitterImageMatch1 && twitterImageMatch1[1]) {
					imageUrl = twitterImageMatch1[1];
				}
			}

			if (!imageUrl) {
				const twitterImageMatch2 = /<meta\s+content=["'](.*?)["']\s+name=["']twitter:image["']/i.exec(html);
				if (twitterImageMatch2 && twitterImageMatch2[1]) {
					imageUrl = twitterImageMatch2[1];
				}
			}

			if (!imageUrl) {
				return '';
			}

			// 相対パスの場合は絶対URLに変換
			if (imageUrl.startsWith('/')) {
				const urlObj = new URL(url);
				imageUrl = `${urlObj.origin}${imageUrl}`;
			}

			return imageUrl;
		} catch (error) {
			console.error(`[ImageExtractor] Error parsing OGP image from ${url}:`, error);
			return '';
		}
	}
}
