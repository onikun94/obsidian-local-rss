import { DownloadHistoryEntry } from '../types';

const MAX_HISTORY_SIZE = 50_000;

/**
 * ダウンロード済み記事URLの履歴管理サービス
 * settings.downloadHistory 配列への参照を保持し、Setで高速な重複チェックを行う
 */
export class ArticleHistoryService {
	private historySet: Set<string>;
	private historyArray: DownloadHistoryEntry[];

	constructor(historyArray: DownloadHistoryEntry[]) {
		this.historyArray = historyArray;
		this.historySet = new Set(historyArray.map(e => e.link));
	}

	hasBeenDownloaded(link: string): boolean {
		return this.historySet.has(link);
	}

	addToHistory(link: string): void {
		if (this.historySet.has(link)) return;
		this.historySet.add(link);
		this.historyArray.push({ link, downloadedAt: Date.now() });
	}

	addMultipleToHistory(entries: DownloadHistoryEntry[]): void {
		for (const entry of entries) {
			if (this.historySet.has(entry.link)) continue;
			this.historySet.add(entry.link);
			this.historyArray.push(entry);
		}
	}

	clearHistory(): void {
		this.historySet.clear();
		this.historyArray.length = 0;
	}

	/**
	 * 指定カットオフ時刻より古いエントリを削除
	 */
	purgeOlderThan(cutoffMs: number): number {
		const before = this.historyArray.length;
		const kept: DownloadHistoryEntry[] = [];
		for (const entry of this.historyArray) {
			if (entry.downloadedAt >= cutoffMs) {
				kept.push(entry);
			} else {
				this.historySet.delete(entry.link);
			}
		}
		this.historyArray.length = 0;
		for (const entry of kept) {
			this.historyArray.push(entry);
		}
		return before - this.historyArray.length;
	}

	/**
	 * 上限を超えた分を古い順に削除
	 */
	enforceCapLimit(): number {
		if (this.historyArray.length <= MAX_HISTORY_SIZE) return 0;
		const excess = this.historyArray.length - MAX_HISTORY_SIZE;
		const removed = this.historyArray.splice(0, excess);
		for (const entry of removed) {
			this.historySet.delete(entry.link);
		}
		return excess;
	}

	get size(): number {
		return this.historySet.size;
	}
}
