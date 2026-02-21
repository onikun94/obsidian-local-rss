import { describe, it, expect } from 'vitest';
import { XmlNormalizer } from '../../../src/adapters/parsers/XmlNormalizer';

describe('XmlNormalizer.normalizeValue', () => {
	it('should return string as-is', () => {
		expect(XmlNormalizer.normalizeValue('hello')).toBe('hello');
	});

	it('should extract _ property from object', () => {
		expect(XmlNormalizer.normalizeValue({ _: 'extracted' })).toBe('extracted');
	});

	it('should return empty string for undefined', () => {
		expect(XmlNormalizer.normalizeValue(undefined)).toBe('');
	});

	it('should return empty string for empty string', () => {
		expect(XmlNormalizer.normalizeValue('')).toBe('');
	});
});

describe('XmlNormalizer.normalizeAtomLink', () => {
	it('should extract href from direct format', () => {
		expect(XmlNormalizer.normalizeAtomLink({ href: 'https://example.com' })).toBe('https://example.com');
	});

	it('should extract href from $ attribute format', () => {
		expect(XmlNormalizer.normalizeAtomLink({ $: { href: 'https://example.com' } })).toBe('https://example.com');
	});

	it('should handle array of links (take first)', () => {
		const links = [
			{ $: { href: 'https://first.com' } },
			{ $: { href: 'https://second.com' } },
		];
		expect(XmlNormalizer.normalizeAtomLink(links)).toBe('https://first.com');
	});

	it('should return empty string for undefined', () => {
		expect(XmlNormalizer.normalizeAtomLink(undefined)).toBe('');
	});

	it('should return empty string for empty array', () => {
		expect(XmlNormalizer.normalizeAtomLink([])).toBe('');
	});
});

describe('XmlNormalizer.normalizeAtomAuthor', () => {
	it('should extract name from author object', () => {
		expect(XmlNormalizer.normalizeAtomAuthor({ name: 'John' })).toBe('John');
	});

	it('should extract name from author array (take first)', () => {
		expect(XmlNormalizer.normalizeAtomAuthor([{ name: 'John' }, { name: 'Jane' }])).toBe('John');
	});

	it('should fallback to feedTitle when author is undefined', () => {
		expect(XmlNormalizer.normalizeAtomAuthor(undefined, 'My Blog')).toBe('My Blog');
	});

	it('should fallback to feedTitle when author name is empty', () => {
		expect(XmlNormalizer.normalizeAtomAuthor({ name: '' }, 'My Blog')).toBe('My Blog');
	});

	it('should return empty string when both author and feedTitle are missing', () => {
		expect(XmlNormalizer.normalizeAtomAuthor(undefined)).toBe('');
	});
});
