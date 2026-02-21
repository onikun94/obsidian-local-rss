import { describe, it, expect } from 'vitest';
import { RssItemBuilder } from '../../src/services/RssItemBuilder';
import { Feed, RssFeedItem, AtomFeedItem, AtomFeed } from '../../src/types';

const makeFeed = (overrides: Partial<Feed> = {}): Feed => ({
	url: 'https://example.com/feed',
	name: 'Test Feed',
	folder: 'test',
	enabled: true,
	...overrides,
});

describe('RssItemBuilder', () => {
	const builder = new RssItemBuilder();

	describe('fromRssItem', () => {
		it('should build RssItem from RSS feed item', () => {
			const item: RssFeedItem = {
				title: 'Article Title',
				description: '<p>Article description</p>',
				link: 'https://example.com/article',
				pubDate: '2025-01-15T09:00:00Z',
				author: 'John Doe',
				category: ['tech', 'news'],
			} as RssFeedItem;

			const result = builder.fromRssItem(item, makeFeed());

			expect(result.title).toBe('Article Title');
			expect(result.description).toBe('Article description');
			expect(result.link).toBe('https://example.com/article');
			expect(result.pubDate).toBe('2025-01-15T09:00:00Z');
			expect(result.author).toBe('John Doe');
			expect(result.categories).toEqual(['tech', 'news']);
			expect(result.imageUrl).toBe('');
		});

		it('should fallback to "Untitled" when title is missing', () => {
			const item = { description: 'desc', link: 'url' } as RssFeedItem;
			const result = builder.fromRssItem(item, makeFeed());
			expect(result.title).toBe('Untitled');
		});

		it('should fallback to feed name when author is missing', () => {
			const item = { title: 'Title', link: 'url' } as RssFeedItem;
			const result = builder.fromRssItem(item, makeFeed({ name: 'My Blog' }));
			expect(result.author).toBe('My Blog');
		});

		it('should use dc:creator as author fallback', () => {
			const item = {
				title: 'Title',
				'dc:creator': 'DC Author',
			} as RssFeedItem;
			const result = builder.fromRssItem(item, makeFeed());
			expect(result.author).toBe('DC Author');
		});

		it('should use content:encoded for content', () => {
			const item = {
				title: 'Title',
				description: 'Short desc',
				'content:encoded': '<p>Full content</p>',
			} as RssFeedItem;
			const result = builder.fromRssItem(item, makeFeed());
			expect(result.content).toBe('<p>Full content</p>');
		});

		it('should fallback to description for content', () => {
			const item = {
				title: 'Title',
				description: '<p>Description as content</p>',
			} as RssFeedItem;
			const result = builder.fromRssItem(item, makeFeed());
			expect(result.content).toBe('<p>Description as content</p>');
		});
	});

	describe('fromAtomItem', () => {
		const makeAtomFeed = (): AtomFeed => ({
			title: 'Atom Blog',
			link: { href: 'https://example.com' },
			entry: [],
		} as unknown as AtomFeed);

		it('should build RssItem from Atom feed item', () => {
			const item: AtomFeedItem = {
				title: 'Atom Article',
				summary: 'Atom summary',
				content: '<p>Atom content</p>',
				link: { href: 'https://example.com/atom-article' },
				published: '2025-01-15T09:00:00Z',
				author: { name: 'Jane Doe' },
			} as unknown as AtomFeedItem;

			const result = builder.fromAtomItem(item, makeAtomFeed(), makeFeed());

			expect(result.title).toBe('Atom Article');
			expect(result.link).toBe('https://example.com/atom-article');
			expect(result.author).toBe('Jane Doe');
			expect(result.content).toBe('<p>Atom content</p>');
		});

		it('should fallback to summary for content when content is missing', () => {
			const item: AtomFeedItem = {
				title: 'Title',
				summary: 'Summary text',
				link: { href: 'https://example.com' },
			} as unknown as AtomFeedItem;

			const result = builder.fromAtomItem(item, makeAtomFeed(), makeFeed());
			expect(result.content).toBe('Summary text');
		});

		it('should fallback to feed title for author when author is missing', () => {
			const item: AtomFeedItem = {
				title: 'Title',
				link: { href: 'https://example.com' },
			} as unknown as AtomFeedItem;

			const result = builder.fromAtomItem(item, makeAtomFeed(), makeFeed());
			expect(result.author).toBe('Atom Blog');
		});

		it('should handle Atom link with $ attribute format', () => {
			const item: AtomFeedItem = {
				title: 'Title',
				link: { $: { href: 'https://example.com/dollar' } },
			} as unknown as AtomFeedItem;

			const result = builder.fromAtomItem(item, makeAtomFeed(), makeFeed());
			expect(result.link).toBe('https://example.com/dollar');
		});

		it('should use updated date when published is missing', () => {
			const item: AtomFeedItem = {
				title: 'Title',
				link: { href: 'https://example.com' },
				updated: '2025-06-01T00:00:00Z',
			} as unknown as AtomFeedItem;

			const result = builder.fromAtomItem(item, makeAtomFeed(), makeFeed());
			expect(result.pubDate).toBe('2025-06-01T00:00:00Z');
		});
	});
});
