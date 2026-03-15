import { describe, it, expect } from 'vitest';
import { ArticleRenderer } from '../../src/services/ArticleRenderer';
import { RssItem } from '../../src/types';

const makeRssItem = (overrides: Partial<RssItem> = {}): RssItem => ({
	title: 'Test Title',
	description: 'Test description',
	content: '<p>Test content</p>',
	link: 'https://example.com/article',
	pubDate: '2025-01-15T09:00:00Z',
	author: 'Test Author',
	categories: ['tech', 'news'],
	imageUrl: 'https://example.com/image.jpg',
	savedDate: '2025-01-15T12:00:00Z',
	...overrides,
});

describe('ArticleRenderer', () => {
	const renderer = new ArticleRenderer();

	describe('buildTemplateData', () => {
		it('should build template data from RssItem', () => {
			const item = makeRssItem();
			const data = renderer.buildTemplateData(item);

			expect(data.title).toBe('Test Title');
			expect(data.link).toBe('https://example.com/article');
			expect(data.author).toBe('Test Author');
			expect(data.image).toBe('https://example.com/image.jpg');
			expect(data.tags).toBe('#tech #news');
			expect(data.publishedTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
			expect(data.savedTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
			expect(data.publishedDate).toBeInstanceOf(Date);
			expect(data.savedDate).toBeInstanceOf(Date);
		});

		it('should escape YAML special characters in title', () => {
			const item = makeRssItem({ title: 'Title: with colon' });
			const data = renderer.buildTemplateData(item);
			expect(data.title).toBe('"Title: with colon"');
		});

		it('should truncate description to 50 chars for short version', () => {
			const item = makeRssItem({
				description: 'This is a very long description that should be truncated at fifty characters mark',
			});
			const data = renderer.buildTemplateData(item);
			expect(data.descriptionShort.length).toBeLessThanOrEqual(53 + 2); // 50 chars + "..." + possible quotes
		});

		it('should handle empty categories', () => {
			const item = makeRssItem({ categories: [] });
			const data = renderer.buildTemplateData(item);
			expect(data.tags).toBe('');
		});

		it('should clean newlines in description', () => {
			const item = makeRssItem({ description: 'line1\nline2\r\nline3' });
			const data = renderer.buildTemplateData(item);
			expect(data.description).not.toContain('\n');
			expect(data.description).not.toContain('\r');
		});
	});

	describe('render', () => {
		it('should render a complete article from template', () => {
			const item = makeRssItem();
			const template = '---\ntitle: {{title}}\nlink: {{link}}\n---\n\n{{content}}';
			const result = renderer.render(item, template, '<p>Hello world</p>');

			expect(result).toContain('title: Test Title');
			expect(result).toContain('link: https://example.com/article');
			expect(result).toContain('Hello world');
		});

		it('should remove image lines when imageUrl is empty', () => {
			const item = makeRssItem({ imageUrl: '' });
			const template = '---\nimage: {{image}}\n---\n\n![image]({{image}})\n\n{{content}}';
			const result = renderer.render(item, template, '<p>Content</p>');

			expect(result).not.toContain('{{image}}');
			expect(result).toContain('Content');
		});

		it('should convert HTML content to markdown', () => {
			const item = makeRssItem();
			const template = '{{content}}';
			const result = renderer.render(item, template, '<h1>Heading</h1><p>Paragraph</p>');

			expect(result).toContain('# Heading');
			expect(result).toContain('Paragraph');
		});
	});
});
