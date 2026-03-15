import { Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import { t } from './src/adapters/i18n/localization';
import { FeedFetcher } from './src/adapters/http/FeedFetcher';
import { ImageExtractor } from './src/services/ImageExtractor';
import { ArticleHistoryService } from './src/services/ArticleHistoryService';
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
	private articleHistory: ArticleHistoryService;
	private updateFeedsUseCase: UpdateFeeds;

	async onload() {
		await this.loadSettings();

		// アダプターとサービスの初期化
		this.feedFetcher = new FeedFetcher();
		this.imageExtractor = new ImageExtractor(this.feedFetcher);
		this.articleHistory = new ArticleHistoryService(this.settings.downloadHistory);

		// 既存記事のマイグレーション（初回のみ）
		await this.migrateExistingArticlesToHistory();

		// ユースケースの初期化
		this.updateFeedsUseCase = new UpdateFeeds(
			this.app.vault,
			this.settings,
			this.feedFetcher,
			this.imageExtractor,
			this.articleHistory
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
			this.startUpdateInterval.bind(this),
			this.articleHistory
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
			this.updateIntervalId = this.registerInterval(window.setInterval(() => {
				this.updateFeeds();
			}, this.settings.updateInterval * 60 * 1000));
		}
	}

	async updateFeeds() {
		await this.updateFeedsUseCase.execute();

		this.settings.lastUpdateTime = Date.now();
		await this.saveSettings();
	}

	/**
	 * 既存記事からリンクを抽出してダウンロード履歴にマイグレーション（初回のみ）
	 */
	private async migrateExistingArticlesToHistory(): Promise<void> {
		if (this.settings.downloadHistory.length > 0) return;

		const folderPath = normalizePath(this.settings.folderPath);
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder || !(folder instanceof TFolder)) return;

		const files: TFile[] = [];
		const collectFiles = (f: TFolder) => {
			for (const child of f.children) {
				if (child instanceof TFile && child.extension === 'md') {
					files.push(child);
				} else if (child instanceof TFolder) {
					collectFiles(child);
				}
			}
		};
		collectFiles(folder);

		const entries: { link: string; downloadedAt: number }[] = [];
		for (const file of files) {
			try {
				const content = await this.app.vault.read(file);
				const linkMatch = content.match(/link: (.*?)$/m);
				if (linkMatch && linkMatch[1]) {
					const link = linkMatch[1].trim();
					if (link) {
						entries.push({ link, downloadedAt: file.stat.ctime });
					}
				}
			} catch (e) {
				console.error(`Error reading file for migration: ${file.path}`, e);
			}
		}

		if (entries.length > 0) {
			this.articleHistory.addMultipleToHistory(entries);
			await this.saveSettings();
		}
	}
}
