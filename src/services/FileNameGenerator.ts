import { formatDateTime } from '../utils/dateFormatter';

/**
 * ファイル名生成サービス
 * テンプレートからMarkdownファイル名を生成する
 */
export class FileNameGenerator {
	/**
	 * テンプレートとRSSアイテム情報からファイル名を生成
	 * @param template ファイル名テンプレート（例: "{{title}}"）
	 * @param title 記事タイトル
	 * @param pubDate 公開日時の文字列
	 * @returns サニタイズされたファイル名（拡張子なし）
	 */
	generate(template: string, title: string, pubDate: string): string {
		let fileName = template
			.replace(/{{title}}/g, title.trim())
			.replace(/{{published}}/g, formatDateTime(new Date(pubDate)));

		fileName = fileName.replace(/[\\/:*?"<>|]/g, '-').trim();
		return fileName;
	}
}
