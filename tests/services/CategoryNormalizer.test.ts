import { describe, it, expect } from 'vitest';
import { CategoryNormalizer } from '../../src/services/CategoryNormalizer';

describe('CategoryNormalizer', () => {
	const normalizer = new CategoryNormalizer();

	describe('normalize', () => {
		it('should return empty array for null/undefined', () => {
			expect(normalizer.normalize(null)).toEqual([]);
			expect(normalizer.normalize(undefined)).toEqual([]);
		});

		it('should normalize a single string category', () => {
			expect(normalizer.normalize('tech')).toEqual(['tech']);
		});

		it('should normalize an array of string categories', () => {
			expect(normalizer.normalize(['tech', 'news', 'ai'])).toEqual(['tech', 'news', 'ai']);
		});

		it('should trim whitespace from categories', () => {
			expect(normalizer.normalize('  tech  ')).toEqual(['tech']);
		});

		it('should filter out empty strings', () => {
			expect(normalizer.normalize(['tech', '', '  ', 'news'])).toEqual(['tech', 'news']);
		});

		it('should extract text from objects with _ property (xml2js format)', () => {
			expect(normalizer.normalize({ _: 'technology' })).toEqual(['technology']);
		});

		it('should extract text from objects with term property (Atom format)', () => {
			expect(normalizer.normalize({ term: 'technology' })).toEqual(['technology']);
		});

		it('should handle array of mixed format categories', () => {
			const categories = [
				'plain',
				{ _: 'xml2js' },
				{ term: 'atom' },
			];
			expect(normalizer.normalize(categories)).toEqual(['plain', 'xml2js', 'atom']);
		});

		it('should handle null elements in array', () => {
			expect(normalizer.normalize([null, 'valid', undefined])).toEqual(['valid']);
		});

		it('should return empty array for object without recognized properties', () => {
			expect(normalizer.normalize({ unknown: 'value' })).toEqual([]);
		});
	});
});
