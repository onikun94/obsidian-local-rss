import { describe, it, expect } from 'vitest';
import { FeedSettingsResolver } from '../../src/services/FeedSettingsResolver';
import { Feed, LocalRssSettings, DEFAULT_SETTINGS } from '../../src/types';

const makeFeed = (overrides: Partial<Feed> = {}): Feed => ({
	url: 'https://example.com/feed',
	name: 'Test Feed',
	folder: '',
	enabled: true,
	...overrides,
});

const makeSettings = (overrides: Partial<LocalRssSettings> = {}): LocalRssSettings => ({
	...DEFAULT_SETTINGS,
	...overrides,
});

describe('FeedSettingsResolver', () => {
	describe('resolve', () => {
		it('カスタム設定なしの場合、グローバル設定をそのまま返す', () => {
			const feed = makeFeed();
			const settings = makeSettings();
			const resolved = FeedSettingsResolver.resolve(feed, settings);

			expect(resolved.template).toBe(settings.template);
			expect(resolved.autoDeleteEnabled).toBe(settings.autoDeleteEnabled);
			expect(resolved.autoDeleteDays).toBe(settings.autoDeleteDays);
			expect(resolved.autoDeleteTimeUnit).toBe(settings.autoDeleteTimeUnit);
			expect(resolved.autoDeleteBasedOn).toBe(settings.autoDeleteBasedOn);
		});

		it('カスタムテンプレートが設定されている場合、それを使用する', () => {
			const customTemplate = '---\ntitle: {{title}}\n---\n{{content}}';
			const feed = makeFeed({ customTemplate });
			const settings = makeSettings();
			const resolved = FeedSettingsResolver.resolve(feed, settings);

			expect(resolved.template).toBe(customTemplate);
			expect(resolved.autoDeleteEnabled).toBe(settings.autoDeleteEnabled);
		});

		it('カスタム削除設定が設定されている場合、それを使用する', () => {
			const feed = makeFeed({
				customAutoDeleteEnabled: true,
				customAutoDeleteDays: 7,
				customAutoDeleteTimeUnit: 'days',
				customAutoDeleteBasedOn: 'publish_date',
			});
			const settings = makeSettings({ autoDeleteEnabled: false, autoDeleteDays: 30 });
			const resolved = FeedSettingsResolver.resolve(feed, settings);

			expect(resolved.autoDeleteEnabled).toBe(true);
			expect(resolved.autoDeleteDays).toBe(7);
			expect(resolved.autoDeleteTimeUnit).toBe('days');
			expect(resolved.autoDeleteBasedOn).toBe('publish_date');
			expect(resolved.template).toBe(settings.template);
		});

		it('一部のみカスタムの場合、残りはグローバルにフォールバックする', () => {
			const feed = makeFeed({
				customAutoDeleteEnabled: true,
				// customAutoDeleteDays は未設定 → グローバルの30を使用
			});
			const settings = makeSettings({ autoDeleteDays: 30 });
			const resolved = FeedSettingsResolver.resolve(feed, settings);

			expect(resolved.autoDeleteEnabled).toBe(true);
			expect(resolved.autoDeleteDays).toBe(30);
		});

		it('グローバルOFFでもフィード個別でON可能（完全オーバーライド）', () => {
			const feed = makeFeed({
				customAutoDeleteEnabled: true,
				customAutoDeleteDays: 3,
			});
			const settings = makeSettings({ autoDeleteEnabled: false });
			const resolved = FeedSettingsResolver.resolve(feed, settings);

			expect(resolved.autoDeleteEnabled).toBe(true);
			expect(resolved.autoDeleteDays).toBe(3);
		});

		it('テンプレートと削除設定の両方をオーバーライド可能', () => {
			const feed = makeFeed({
				customTemplate: 'custom',
				customAutoDeleteEnabled: true,
				customAutoDeleteDays: 14,
				customAutoDeleteTimeUnit: 'minutes',
				customAutoDeleteBasedOn: 'saved',
			});
			const settings = makeSettings();
			const resolved = FeedSettingsResolver.resolve(feed, settings);

			expect(resolved.template).toBe('custom');
			expect(resolved.autoDeleteEnabled).toBe(true);
			expect(resolved.autoDeleteDays).toBe(14);
			expect(resolved.autoDeleteTimeUnit).toBe('minutes');
			expect(resolved.autoDeleteBasedOn).toBe('saved');
		});
	});

	describe('hasCustomSettings', () => {
		it('カスタム設定なしならfalse', () => {
			expect(FeedSettingsResolver.hasCustomSettings(makeFeed())).toBe(false);
		});

		it('カスタムテンプレートがあればtrue', () => {
			expect(FeedSettingsResolver.hasCustomSettings(makeFeed({ customTemplate: 'x' }))).toBe(true);
		});

		it('カスタム削除設定があればtrue', () => {
			expect(FeedSettingsResolver.hasCustomSettings(makeFeed({ customAutoDeleteEnabled: true }))).toBe(true);
		});

		it('両方あればtrue', () => {
			expect(FeedSettingsResolver.hasCustomSettings(makeFeed({
				customTemplate: 'x',
				customAutoDeleteEnabled: false,
			}))).toBe(true);
		});
	});
});
