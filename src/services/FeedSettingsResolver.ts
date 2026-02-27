import { Feed, LocalRssSettings, ResolvedFeedSettings } from '../types';

/**
 * フィード個別設定とグローバル設定をマージして有効な設定を返す
 */
export class FeedSettingsResolver {
	static resolve(feed: Feed, globalSettings: LocalRssSettings): ResolvedFeedSettings {
		return {
			template: feed.customTemplate ?? globalSettings.template,
			autoDeleteEnabled: feed.customAutoDeleteEnabled ?? globalSettings.autoDeleteEnabled,
			autoDeleteDays: feed.customAutoDeleteDays ?? globalSettings.autoDeleteDays,
			autoDeleteTimeUnit: feed.customAutoDeleteTimeUnit ?? globalSettings.autoDeleteTimeUnit,
			autoDeleteBasedOn: feed.customAutoDeleteBasedOn ?? globalSettings.autoDeleteBasedOn,
		};
	}

	static hasCustomSettings(feed: Feed): boolean {
		return feed.customTemplate !== undefined
			|| feed.customAutoDeleteEnabled !== undefined;
	}
}
