import { describe, it, expect, vi } from 'vitest';
import { ImageExtractor } from '../../src/services/ImageExtractor';
import { FeedFetcher } from '../../src/adapters/http/FeedFetcher';
import { RssFeedItem } from '../../src/types';

const createMockFeedFetcher = (): FeedFetcher => ({
	fetch: vi.fn(),
	fetchHtml: vi.fn(),
}) as unknown as FeedFetcher;

const makeRssItem = (overrides: Partial<RssFeedItem> = {}): RssFeedItem => ({
	title: 'Test',
	description: 'Desc',
	link: 'https://example.com',
	pubDate: '2025-01-01',
	...overrides,
} as RssFeedItem);

describe('ImageExtractor.extractFromItem', () => {
	it('should extract from media:content url attribute', () => {
		const extractor = new ImageExtractor(createMockFeedFetcher());
		const item = makeRssItem({
			'media:content': { $: { url: 'https://example.com/media.jpg' } },
		} as Partial<RssFeedItem>);
		expect(extractor.extractFromItem(item)).toBe('https://example.com/media.jpg');
	});

	it('should extract from media:content string', () => {
		const extractor = new ImageExtractor(createMockFeedFetcher());
		const item = makeRssItem({
			'media:content': 'https://example.com/media.jpg',
		} as Partial<RssFeedItem>);
		expect(extractor.extractFromItem(item)).toBe('https://example.com/media.jpg');
	});

	it('should extract from media:thumbnail', () => {
		const extractor = new ImageExtractor(createMockFeedFetcher());
		const item = makeRssItem({
			'media:thumbnail': { $: { url: 'https://example.com/thumb.jpg' } },
		} as Partial<RssFeedItem>);
		expect(extractor.extractFromItem(item)).toBe('https://example.com/thumb.jpg');
	});

	it('should extract from enclosure with image URL', () => {
		const extractor = new ImageExtractor(createMockFeedFetcher());
		const item = makeRssItem({
			enclosure: { $: { url: 'https://example.com/photo.png', type: 'image/png' } },
		} as Partial<RssFeedItem>);
		expect(extractor.extractFromItem(item)).toBe('https://example.com/photo.png');
	});

	it('should extract from HTML content img tag', () => {
		const extractor = new ImageExtractor(createMockFeedFetcher());
		const item = makeRssItem({
			'content:encoded': '<p>Text</p><img src="https://example.com/inline.jpg">',
		} as Partial<RssFeedItem>);
		expect(extractor.extractFromItem(item)).toBe('https://example.com/inline.jpg');
	});

	it('should return empty string when no image found', () => {
		const extractor = new ImageExtractor(createMockFeedFetcher());
		const item = makeRssItem();
		expect(extractor.extractFromItem(item)).toBe('');
	});

	it('should prioritize media:content over HTML content', () => {
		const extractor = new ImageExtractor(createMockFeedFetcher());
		const item = makeRssItem({
			'media:content': { $: { url: 'https://example.com/media.jpg' } },
			'content:encoded': '<img src="https://example.com/inline.jpg">',
		} as Partial<RssFeedItem>);
		expect(extractor.extractFromItem(item)).toBe('https://example.com/media.jpg');
	});
});

describe('ImageExtractor.fetchFromUrl', () => {
	it('should extract og:image from HTML', async () => {
		const fetcher = createMockFeedFetcher();
		vi.mocked(fetcher.fetchHtml).mockResolvedValue(
			'<html><head><meta property="og:image" content="https://example.com/og.jpg" /></head></html>'
		);
		const extractor = new ImageExtractor(fetcher);
		const result = await extractor.fetchFromUrl('https://example.com');
		expect(result).toBe('https://example.com/og.jpg');
	});

	it('should extract twitter:image as fallback', async () => {
		const fetcher = createMockFeedFetcher();
		vi.mocked(fetcher.fetchHtml).mockResolvedValue(
			'<html><head><meta name="twitter:image" content="https://example.com/tw.jpg" /></head></html>'
		);
		const extractor = new ImageExtractor(fetcher);
		const result = await extractor.fetchFromUrl('https://example.com');
		expect(result).toBe('https://example.com/tw.jpg');
	});

	it('should convert relative og:image paths to absolute', async () => {
		const fetcher = createMockFeedFetcher();
		vi.mocked(fetcher.fetchHtml).mockResolvedValue(
			'<html><head><meta property="og:image" content="/images/og.jpg" /></head></html>'
		);
		const extractor = new ImageExtractor(fetcher);
		const result = await extractor.fetchFromUrl('https://example.com/page');
		expect(result).toBe('https://example.com/images/og.jpg');
	});

	it('should return empty string when no OGP image found', async () => {
		const fetcher = createMockFeedFetcher();
		vi.mocked(fetcher.fetchHtml).mockResolvedValue('<html><head></head></html>');
		const extractor = new ImageExtractor(fetcher);
		const result = await extractor.fetchFromUrl('https://example.com');
		expect(result).toBe('');
	});

	it('should return empty string when HTML fetch fails', async () => {
		const fetcher = createMockFeedFetcher();
		vi.mocked(fetcher.fetchHtml).mockResolvedValue('');
		const extractor = new ImageExtractor(fetcher);
		const result = await extractor.fetchFromUrl('https://example.com');
		expect(result).toBe('');
	});
});
