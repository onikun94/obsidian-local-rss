import en from './en';

const ja: Partial<typeof en> = {
	// Commands
	updateRssFeeds: 'RSS フィードを更新',
	addRssFeed: 'RSS フィードを追加',
	
	// Notices
	updatingRssFeeds: 'RSSフィードを更新中...',
	failedToFetchFeed: 'フィードの取得に失敗しました: %0',
	unsupportedFeedFormat: 'サポートされていないフィード形式です: %0',
	updatedFeed: 'フィードを更新しました: %0',
	errorUpdatingFeed: 'フィードの更新中にエラーが発生しました: %0',
	rssFeedUpdateCompleted: 'RSSフィードの更新が完了しました',
	feedNameRequired: 'フィード名は必須です',
	feedUrlRequired: 'フィードURLは必須です',
	addedFeed: 'フィードを追加しました: %0',
	
	// Settings
	rssFolder: 'RSSフォルダ',
	rssFolderDesc: 'RSSの記事が保存されるフォルダ',
	fileNameTemplate: 'ファイル名テンプレート',
	fileNameTemplateDesc: '記事のファイル名のテンプレート。{{title}}と{{published}}変数が使用可能',
	contentTemplate: 'コンテンツテンプレート',
	contentTemplateDesc: 'フロントマター付きの記事コンテンツのテンプレート',
	updateInterval: '更新間隔',
	updateIntervalDesc: 'フィードをチェックする頻度（分単位、0で無効）',
	includeImages: '画像を含める',
	includeImagesDesc: 'フィード記事から画像URLを含める',
	imageWidth: '画像の幅',
	imageWidthDesc: 'コンテンツ内の画像の幅（例：50%、300px）',
	autoDeleteOldArticles: '古い記事を自動削除',
	autoDeleteOldArticlesDesc: '一定期間経過した記事を自動的に削除する',
	periodBeforeDeletion: '削除までの期間',
	periodBeforeDeletionDesc: '作成されてから経過した後に記事を削除する',
	timeUnit: '時間単位',
	timeUnitDesc: '削除までの期間の単位',
	deletionCriteria: '削除基準',
	deletionCriteriaDesc: '記事を削除する基準',
	addNewFeed: '新しいフィードを追加',
	addNewFeedDesc: 'ダウンロードする新しいRSSフィードを追加',
	updateFeedsNow: '今すぐフィードを更新',
	updateFeedsNowDesc: '有効なすべてのRSSフィードを手動で更新',
	
	// Modal
	feedName: 'フィード名',
	feedUrl: 'フィードURL',
	customFolderName: 'カスタムフォルダ名（オプション）',
	customFolderNameDesc: 'RSSフォルダ内のサブフォルダ名',
	customFolderPlaceholder: 'フィード名を使用する場合は空のままにしてください',
	
	// Buttons
	addFeed: 'フィードを追加',
	cancel: 'キャンセル',
	updateNow: '今すぐ更新',
	
	// Settings header
	rssFeedDownloaderSettings: 'RSSフィードダウンローダー設定',
	
	// Time units
	days: '日',
	minutes: '分',
	
	// Date options
	publishedDate: '公開日',
	savedDate: '保存日'
};

export default ja;