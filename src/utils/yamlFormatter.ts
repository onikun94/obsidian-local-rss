const YAML_SPECIAL_CHARS = /[[\]{}:>|*&!%@,]/;

/**
 * YAML値をエスケープ
 * @param value エスケープする文字列
 * @returns エスケープされた文字列
 */
export function escapeYamlValue(value: string): string {
	// 改行文字を空白に置き換える
	const valueWithoutNewlines = value.replace(/\r?\n/g, ' ').trim();

	if (YAML_SPECIAL_CHARS.test(valueWithoutNewlines)) {
		const escapedValue = valueWithoutNewlines.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		return `"${escapedValue}"`;
	}
	return valueWithoutNewlines;
}
