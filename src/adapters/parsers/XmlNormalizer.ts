/**
 * XML正規化ユーティリティ
 * xml2jsがパースしたオブジェクトを文字列に正規化する
 */
export class XmlNormalizer {
	/**
	 * xml2jsがパースした値を文字列に正規化
	 * @param value パース済みの値
	 * @returns 正規化された文字列
	 */
	static normalizeValue(value: string | { _: string } | undefined): string {
		if (!value) return '';
		if (typeof value === 'string') return value;
		if (typeof value === 'object' && '_' in value) return value._;
		return '';
	}

	/**
	 * Atomのlinkを正規化
	 * @param link Atomのlink要素
	 * @returns 正規化されたURL
	 */
	static normalizeAtomLink(link: { href: string } | { $: { href: string } } | Array<{ href: string } | { $: { href: string } }> | undefined): string {
		if (!link) return '';

		// 配列の場合は最初の要素を取得
		const linkObj = Array.isArray(link) ? link[0] : link;
		if (!linkObj) return '';

		// xml2js attributes format: { $: { href: "..." } }
		if ('$' in linkObj && linkObj.$ && 'href' in linkObj.$) {
			return linkObj.$.href || '';
		}
		// Direct format: { href: "..." }
		if ('href' in linkObj) {
			return linkObj.href || '';
		}
		return '';
	}

	/**
	 * Atomのauthorを正規化
	 * @param author Atomのauthor要素
	 * @param feedTitle フィードタイトル（フォールバック用）
	 * @returns 正規化されたauthor名
	 */
	static normalizeAtomAuthor(author: { name: string } | { name: string }[] | undefined, feedTitle?: string): string {
		if (!author) return feedTitle || '';
		if (Array.isArray(author)) {
			return author[0]?.name || feedTitle || '';
		}
		return author.name || feedTitle || '';
	}
}
