import { describe, it, expect } from 'vitest';
import { prepareTemplate, renderTemplate } from '../../src/utils/templateEngine';
import { RssItem } from '../../src/types';

const makeRssItem = (overrides: Partial<RssItem> = {}): RssItem => ({
	title: 'Test Title',
	description: 'Test description',
	content: '<p>Test content</p>',
	link: 'https://example.com/article',
	pubDate: '2025-01-01T00:00:00Z',
	author: 'Test Author',
	categories: ['tech', 'news'],
	imageUrl: 'https://example.com/image.jpg',
	savedDate: '2025-01-01T12:00:00Z',
	...overrides,
});

describe('prepareTemplate', () => {
	it('should keep {{image}} lines when imageUrl is present', () => {
		const template = '---\nimage: {{image}}\n---\n\n![image]({{image}})\n\n{{content}}';
		const item = makeRssItem();
		const result = prepareTemplate(template, item);
		expect(result).toContain('{{image}}');
	});

	it('should remove {{image}} lines when imageUrl is empty', () => {
		const template = '---\nimage: {{image}}\n---\n\n![image]({{image}})\n\n{{content}}';
		const item = makeRssItem({ imageUrl: '' });
		const result = prepareTemplate(template, item);
		expect(result).not.toContain('{{image}}');
		expect(result).toContain('{{content}}');
	});

	it('should handle template without {{image}} placeholder', () => {
		const template = '---\ntitle: {{title}}\n---\n\n{{content}}';
		const item = makeRssItem({ imageUrl: '' });
		const result = prepareTemplate(template, item);
		expect(result).toBe(template);
	});
});

describe('renderTemplate', () => {
	it('should replace all template variables', () => {
		const template = '---\ntitle: {{title}}\nlink: {{link}}\nauthor: {{author}}\n---\n\n{{content}}';
		const result = renderTemplate(template, {
			title: 'My Article',
			link: 'https://example.com',
			author: 'John',
			publishedTime: '2025-01-01 00:00:00',
			savedTime: '2025-01-01 12:00:00',
			publishedDate: new Date('2025-01-01T00:00:00Z'),
			savedDate: new Date('2025-01-01T12:00:00Z'),
			image: '',
			description: 'A description',
			descriptionShort: 'A des...',
			tags: '#tech #news',
			content: 'Article body',
		});

		expect(result).toContain('title: My Article');
		expect(result).toContain('link: https://example.com');
		expect(result).toContain('author: John');
		expect(result).toContain('Article body');
	});

	it('should replace multiple occurrences of the same variable', () => {
		const template = '{{title}} - {{title}}';
		const result = renderTemplate(template, {
			title: 'Dup',
			link: '',
			author: '',
			publishedTime: '',
			savedTime: '',
			publishedDate: new Date(),
			savedDate: new Date(),
			image: '',
			description: '',
			descriptionShort: '',
			tags: '',
			content: '',
		});
		expect(result).toBe('Dup - Dup');
	});

	it('should support date filter pipe syntax for publishedTime', () => {
		const template = "date: {{publishedTime | date('YYYY-MM-DD')}}";
		const pubDate = new Date(2025, 0, 15, 9, 30, 0);
		const result = renderTemplate(template, {
			title: '',
			link: '',
			author: '',
			publishedTime: '2025-01-15 09:30:00',
			savedTime: '',
			publishedDate: pubDate,
			savedDate: new Date(),
			image: '',
			description: '',
			descriptionShort: '',
			tags: '',
			content: '',
		});
		expect(result).toBe('date: 2025-01-15');
	});

	it('should support date filter pipe syntax for savedTime', () => {
		const template = "saved: {{savedTime | date('YYYY/MM/DD HH:mm')}}";
		const savedDate = new Date(2025, 5, 20, 14, 30, 0);
		const result = renderTemplate(template, {
			title: '',
			link: '',
			author: '',
			publishedTime: '',
			savedTime: '2025-06-20 14:30:00',
			publishedDate: new Date(),
			savedDate: savedDate,
			image: '',
			description: '',
			descriptionShort: '',
			tags: '',
			content: '',
		});
		expect(result).toBe('saved: 2025/06/20 14:30');
	});
});
