const YAML_SPECIAL_CHARS = /[[\]{}:>|*&!%@,]/;
const YAML_DANGEROUS_START = /^[["']/;

/**
 * YAML値をエスケープ
 * @param value エスケープする文字列
 * @returns エスケープされた文字列
 */
export function escapeYamlValue(value: string): string {
	// 改行文字を空白に置き換える
	const valueWithoutNewlines = value.replace(/\r?\n/g, ' ').trim();

	// 特殊文字を含む OR 危険な先頭文字（[, ", '）の場合はクォートで囲む
	if (YAML_SPECIAL_CHARS.test(valueWithoutNewlines) || YAML_DANGEROUS_START.test(valueWithoutNewlines)) {
		const escapedValue = valueWithoutNewlines.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		return `"${escapedValue}"`;
	}
	return valueWithoutNewlines;
}
