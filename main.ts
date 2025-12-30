import { Plugin } from 'obsidian';
import { t } from './src/adapters/i18n/localization';
import { FeedFetcher } from './src/adapters/http/FeedFetcher';
import { ImageExtractor } from './src/services/ImageExtractor';
import { UpdateFeeds } from './src/usecases/UpdateFeeds';
import { LocalRssSettingTab } from './src/ui/LocalRssSettingTab';
import {
	LocalRssSettings,
	DEFAULT_SETTINGS
} from './src/types';

export default class LocalRssPlugin extends Plugin {
	settings: LocalRssSettings;
	updateIntervalId: number | null = null;
	private feedFetcher: FeedFetcher;
	private imageExtractor: ImageExtractor;
	private updateFeedsUseCase: UpdateFeeds;

	async onload() {
		await this.loadSettings();

		// アダプターとサービスの初期化
		this.feedFetcher = new FeedFetcher();
		this.imageExtractor = new ImageExtractor(this.feedFetcher);

		// ユースケースの初期化
		this.updateFeedsUseCase = new UpdateFeeds(
			this.app.vault,
			this.settings,
			this.feedFetcher,
			this.imageExtractor
		);

		this.addRibbonIcon('rss', t('updateRssFeeds'), (evt: MouseEvent) => {
			this.updateFeeds();
		});

		this.addSettingTab(new LocalRssSettingTab(
			this.app,
			this,
			this.settings,
			this.saveSettings.bind(this),
			this.updateFeeds.bind(this),
			this.startUpdateInterval.bind(this)
		));

		this.addCommand({
			id: 'update-rss-feeds',
			name: t('updateRssFeeds'),
			callback: () => {
				this.updateFeeds();
			}
		});

		this.startUpdateInterval();
	}

	onunload() {
		if (this.updateIntervalId) {
			window.clearInterval(this.updateIntervalId);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	startUpdateInterval() {
		if (this.updateIntervalId) {
			window.clearInterval(this.updateIntervalId);
		}

		if (this.settings.updateInterval > 0) {
			this.updateIntervalId = window.setInterval(() => {
				this.updateFeeds();
			}, this.settings.updateInterval * 60 * 1000);
		}
	}

	async updateFeeds() {
		await this.updateFeedsUseCase.execute();

		this.settings.lastUpdateTime = Date.now();
		await this.saveSettings();
	}
}
