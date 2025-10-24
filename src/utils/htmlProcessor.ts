import TurndownService from 'turndown';
import sanitizeHtml from 'sanitize-html';

/**
 * HTML → Markdown変換用の設定
 */
const turndownService = new TurndownService({
	headingStyle: 'atx',
	codeBlockStyle: 'fenced',
	bulletListMarker: '-',
});

// 不要なタグを除去するルール追加
turndownService.addRule('removeScripts', {
	filter: ['script', 'style'],
	replacement: () => ''
});

/**
 * HTMLタグを除去してプレーンテキスト化
 * @param html HTMLコンテンツ
 * @param maxLength 最大文字数（省略可）
 * @returns プレーンテキスト
 */
export function stripHtml(html: string, maxLength?: number): string {
	if (!html) return '';

	// ブラウザネイティブのDOMParserを使用
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	let text = doc.body.textContent || '';

	// 余分な空白・改行を整理
	text = text.replace(/\s+/g, ' ').trim();

	if (maxLength && text.length > maxLength) {
		text = text.substring(0, maxLength) + '...';
	}

	return text;
}

/**
 * HTML → Markdown変換
 * @param html HTMLコンテンツ
 * @returns Markdownコンテンツ
 */
export function htmlToMarkdown(html: string): string {
	if (!html) return '';

	// scriptタグなどを事前に除去
	const cleanHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

	return turndownService.turndown(cleanHtml);
}

/**
 * HTMLのサニタイズ（危険なタグを除去）
 * @param html HTMLコンテンツ
 * @returns サニタイズされたHTML
 */
export function sanitizeContent(html: string): string {
	if (!html) return '';

	return sanitizeHtml(html, {
		allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
		allowedAttributes: {
			...sanitizeHtml.defaults.allowedAttributes,
			img: ['src', 'alt', 'title']
		}
	});
}

/**
 * 画像URLの抽出（最初の画像を取得）
 * @param html HTMLコンテンツ
 * @returns 画像URL（存在しない場合はundefined）
 */
export function extractFirstImage(html: string): string | undefined {
	if (!html) return undefined;

	// ブラウザネイティブのDOMParserを使用
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	const firstImg = doc.querySelector('img');
	return firstImg?.getAttribute('src') || undefined;
}
