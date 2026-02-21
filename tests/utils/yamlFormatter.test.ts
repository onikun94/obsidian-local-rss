import { describe, it, expect } from 'vitest';
import { escapeYamlValue } from '../../src/utils/yamlFormatter';

describe('escapeYamlValue', () => {
	it('should return plain string as-is', () => {
		expect(escapeYamlValue('Hello World')).toBe('Hello World');
	});

	it('should trim whitespace', () => {
		expect(escapeYamlValue('  hello  ')).toBe('hello');
	});

	it('should replace newlines with spaces', () => {
		expect(escapeYamlValue('line1\nline2\r\nline3')).toBe('line1 line2 line3');
	});

	it('should quote strings with YAML special characters', () => {
		expect(escapeYamlValue('value: with colon')).toBe('"value: with colon"');
		expect(escapeYamlValue('value [with brackets]')).toBe('"value [with brackets]"');
		expect(escapeYamlValue('value {with braces}')).toBe('"value {with braces}"');
		expect(escapeYamlValue('value > with gt')).toBe('"value > with gt"');
		expect(escapeYamlValue('value | with pipe')).toBe('"value | with pipe"');
		expect(escapeYamlValue('value * with star')).toBe('"value * with star"');
		expect(escapeYamlValue('value & with amp')).toBe('"value & with amp"');
		expect(escapeYamlValue('value ! with bang')).toBe('"value ! with bang"');
		expect(escapeYamlValue('value % with pct')).toBe('"value % with pct"');
		expect(escapeYamlValue('value @ with at')).toBe('"value @ with at"');
		expect(escapeYamlValue('value, with comma')).toBe('"value, with comma"');
	});

	it('should quote strings starting with dangerous characters', () => {
		expect(escapeYamlValue('[list item]')).toBe('"[list item]"');
		expect(escapeYamlValue('"quoted"')).toBe('"\\"quoted\\""');
		expect(escapeYamlValue("'single quoted'")).toBe("\"'single quoted'\"");
	});

	it('should escape backslashes and double quotes inside quoted strings', () => {
		expect(escapeYamlValue('path\\to: file')).toBe('"path\\\\to: file"');
		expect(escapeYamlValue('say "hello": world')).toBe('"say \\"hello\\": world"');
	});

	it('should handle empty string', () => {
		expect(escapeYamlValue('')).toBe('');
	});
});
