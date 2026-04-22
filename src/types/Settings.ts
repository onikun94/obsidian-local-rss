export interface Feed {
	url: string;
	name: string;
	folder: string;
	enabled: boolean;
	// フィード個別オーバーライド（undefinedならグローバル設定を使用）
	customTemplate?: string;
	customAutoDeleteEnabled?: boolean;
	customAutoDeleteDays?: number;
	customAutoDeleteTimeUnit?: string;
	customAutoDeleteBasedOn?: string;
}

export interface ResolvedFeedSettings {
	template: string;
	autoDeleteEnabled: boolean;
	autoDeleteDays: number;
	autoDeleteTimeUnit: string;
	autoDeleteBasedOn: string;
}

export interface DownloadHistoryEntry {
	link: string;
	downloadedAt: number;
}

export interface LocalRssSettings {
	feeds: Feed[];
	folderPath: string;
	template: string;
	fileNameTemplate: string;
	updateInterval: number;
	lastUpdateTime: number;
	includeImages: boolean;
	fetchImageFromLink: boolean;
	dateFormat: string;
	imageWidth: string;
	autoDeleteEnabled: boolean;
	autoDeleteDays: number;
	autoDeleteTimeUnit: string;
	autoDeleteBasedOn: string;
	downloadHistory: DownloadHistoryEntry[];
	singleFilePerFeed: boolean;
}

export const DEFAULT_SETTINGS: LocalRssSettings = {
	feeds: [],
	folderPath: 'RSS',
	template: '---\ntitle: {{title}}\nlink: {{link}}\nauthor: {{author}}\npublish_date: {{publishedTime}}\nsaved_date: {{savedTime}}\nimage: {{image}}\ntags: {{#tags}}\n---\n\n![image]({{image}})\n\n{{content}}',
	fileNameTemplate: '{{title}}',
	updateInterval: 60,
	lastUpdateTime: 0,
	includeImages: true,
	fetchImageFromLink: false,
	dateFormat: 'YYYY-MM-DD HH:mm:ss',
	imageWidth: '50%',
	autoDeleteEnabled: false,
	autoDeleteDays: 30,
	autoDeleteTimeUnit: 'days',
	autoDeleteBasedOn: 'saved',
	downloadHistory: [],
	singleFilePerFeed: false,
};