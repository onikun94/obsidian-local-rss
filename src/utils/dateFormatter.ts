/**
 * 日時をフォーマットされた文字列に変換
 * @param date Dateオブジェクト
 * @param format フォーマット文字列（省略時: 'YYYY-MM-DD HH:mm:ss'）
 * @returns フォーマットされた文字列
 */
export function formatDateTime(date: Date, format = 'YYYY-MM-DD HH:mm:ss'): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');

	return format
		.replace(/YYYY/g, String(year))
		.replace(/MM/g, month)
		.replace(/DD/g, day)
		.replace(/HH/g, hours)
		.replace(/mm/g, minutes)
		.replace(/ss/g, seconds);
}
