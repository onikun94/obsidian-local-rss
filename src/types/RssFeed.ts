export interface RssFeedItem {
	title?: string;
	description?: string;
	'content:encoded'?: string;
	link?: string;
	pubDate?: string;
	published?: string;
	author?: string;
	'dc:creator'?: string;
	category?: string | string[];
	'media:content'?: string | { $: { url: string } };
	'media:thumbnail'?: string | { $: { url: string } };
	enclosure?: string | { $: { type: string; url: string } };
}

export interface AtomFeedItem {
	title?: string | { _: string };
	summary?: string | { _: string };
	content?: string | { _: string };
	link?: { href: string } | { $: { href: string; rel?: string; type?: string } } | Array<{ href: string } | { $: { href: string; rel?: string; type?: string } }>;
	published?: string;
	updated?: string;
	author?: { name: string } | { name: string }[];
	category?: AtomCategory | AtomCategory[];
}

export interface AtomCategory {
	term?: string;
}

export interface AtomFeed {
	title?: string | { _: string };
	entry?: AtomFeedItem | AtomFeedItem[];
}

export interface RssItem {
	title: string;
	description: string;
	content: string;
	link: string;
	pubDate: string;
	author: string;
	categories: string[];
	imageUrl: string;
	savedDate: string;
}
