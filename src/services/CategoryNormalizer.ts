/**
 * カテゴリ正規化サービス
 * RSSフィードのカテゴリフィールドを文字列配列に正規化する
 */
export class CategoryNormalizer {
	/**
	 * カテゴリフィールドを正規化して文字列配列を返す
	 * @param categoryField xml2jsでパースされたカテゴリフィールド
	 * @returns 正規化されたカテゴリ文字列の配列
	 */
	normalize(categoryField: unknown): string[] {
		if (!categoryField) {
			return [];
		}

		const categories = Array.isArray(categoryField) ? categoryField : [categoryField];
		return categories
			.map((category: unknown) => this.extractText(category))
			.filter((category: string): category is string => category.length > 0);
	}

	/**
	 * カテゴリ要素からテキストを抽出
	 * @param category 個別のカテゴリ要素
	 * @returns カテゴリテキスト
	 */
	private extractText(category: unknown): string {
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
}
