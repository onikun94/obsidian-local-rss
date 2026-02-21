import { describe, it, expect } from 'vitest';
import { stripHtml, htmlToMarkdown, sanitizeContent, extractFirstImage } from '../../src/utils/htmlProcessor';

describe('stripHtml', () => {
	it('should strip HTML tags and return plain text', () => {
		expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
	});

	it('should truncate text to maxLength', () => {
		const result = stripHtml('<p>This is a long text that should be truncated</p>', 10);
		expect(result).toBe('This is a ...');
	});

	it('should not truncate if text is shorter than maxLength', () => {
		expect(stripHtml('<p>Short</p>', 100)).toBe('Short');
	});

	it('should return empty string for empty input', () => {
		expect(stripHtml('')).toBe('');
	});

	it('should return empty string for non-string input', () => {
		expect(stripHtml(null as unknown as string)).toBe('');
		expect(stripHtml(undefined as unknown as string)).toBe('');
	});

	it('should collapse multiple whitespace characters', () => {
		expect(stripHtml('<p>hello   \n   world</p>')).toBe('hello world');
	});
});

describe('htmlToMarkdown', () => {
	it('should convert basic HTML to markdown', () => {
		const result = htmlToMarkdown('<h1>Title</h1><p>Paragraph</p>');
		expect(result).toContain('# Title');
		expect(result).toContain('Paragraph');
	});

	it('should convert links', () => {
		const result = htmlToMarkdown('<a href="https://example.com">Link</a>');
		expect(result).toContain('[Link](https://example.com)');
	});

	it('should remove script tags', () => {
		const result = htmlToMarkdown('<p>Hello</p><script>alert("xss")</script>');
		expect(result).not.toContain('script');
		expect(result).not.toContain('alert');
	});

	it('should return empty string for empty input', () => {
		expect(htmlToMarkdown('')).toBe('');
	});

	it('should return empty string for non-string input', () => {
		expect(htmlToMarkdown(null as unknown as string)).toBe('');
	});
});

describe('sanitizeContent', () => {
	it('should allow safe HTML tags', () => {
		const result = sanitizeContent('<p>Hello <b>World</b></p>');
		expect(result).toContain('<p>');
		expect(result).toContain('<b>');
	});

	it('should allow img tags with safe attributes', () => {
		const result = sanitizeContent('<img src="test.jpg" alt="test" title="test">');
		expect(result).toContain('src="test.jpg"');
		expect(result).toContain('alt="test"');
	});

	it('should strip script tags', () => {
		const result = sanitizeContent('<p>Safe</p><script>alert("xss")</script>');
		expect(result).not.toContain('script');
	});

	it('should return empty string for empty input', () => {
		expect(sanitizeContent('')).toBe('');
	});
});

describe('extractFirstImage', () => {
	it('should extract src from first img tag', () => {
		const html = '<p>Text</p><img src="first.jpg"><img src="second.jpg">';
		expect(extractFirstImage(html)).toBe('first.jpg');
	});

	it('should return undefined when no img tag exists', () => {
		expect(extractFirstImage('<p>No images</p>')).toBeUndefined();
	});

	it('should return undefined for empty input', () => {
		expect(extractFirstImage('')).toBeUndefined();
	});
});
