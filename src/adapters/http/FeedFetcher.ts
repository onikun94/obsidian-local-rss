import { requestUrl } from 'obsidian';

/**
 * フィード取得アダプター
 * HTTP経由でRSS/Atomフィードを取得する
 */
export class FeedFetcher {
	/**
	 * フィードを取得
	 * @param url フィードURL
	 * @returns フィードのXML文字列
	 * @throws フィード取得に失敗した場合
	 */
	async fetch(url: string): Promise<string> {
		const response = await requestUrl(url);

		if (response.status !== 200) {
			throw new Error(`Failed to fetch feed: HTTP ${response.status}`);
		}

		return response.text;
	}

	/**
	 * URLからHTMLを取得（OGP画像取得用）
	 * @param url URL
	 * @returns HTMLテキスト（取得失敗時は空文字列）
	 */
	async fetchHtml(url: string): Promise<string> {
		try {
			const response = await requestUrl(url);

			if (response.status !== 200) {
				return '';
			}

			return response.text;
		} catch (error) {
			console.error(`Error fetching HTML from ${url}:`, error);
			return '';
		}
	}
}
