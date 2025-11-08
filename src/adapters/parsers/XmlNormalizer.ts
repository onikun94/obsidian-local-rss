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
	static normalizeAtomLink(link: { href: string } | { href: string }[] | undefined): string {
		if (!link) return '';
		if (Array.isArray(link)) {
			// 配列の場合は最初のリンクを返す
			return link[0]?.href || '';
		}
		return link.href || '';
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
