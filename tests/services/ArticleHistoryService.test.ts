import { describe, it, expect, vi } from 'vitest';
import { ArticleHistoryService } from '../../src/services/ArticleHistoryService';
import { DownloadHistoryEntry } from '../../src/types';

const entry = (link: string, downloadedAt = Date.now()): DownloadHistoryEntry => ({ link, downloadedAt });

describe('ArticleHistoryService', () => {
	it('既存の履歴配列からSetを構築する', () => {
		const history = [entry('https://a.com'), entry('https://b.com')];
		const service = new ArticleHistoryService(history);

		expect(service.size).toBe(2);
		expect(service.hasBeenDownloaded('https://a.com')).toBe(true);
		expect(service.hasBeenDownloaded('https://b.com')).toBe(true);
	});

	it('空配列で初期化できる', () => {
		const service = new ArticleHistoryService([]);
		expect(service.size).toBe(0);
	});

	describe('hasBeenDownloaded', () => {
		it('履歴にあるURLに対してtrueを返す', () => {
			const service = new ArticleHistoryService([entry('https://example.com')]);
			expect(service.hasBeenDownloaded('https://example.com')).toBe(true);
		});

		it('履歴にないURLに対してfalseを返す', () => {
			const service = new ArticleHistoryService([]);
			expect(service.hasBeenDownloaded('https://example.com')).toBe(false);
		});
	});

	describe('addToHistory', () => {
		it('新しいURLを追加する', () => {
			const history: DownloadHistoryEntry[] = [];
			const service = new ArticleHistoryService(history);

			service.addToHistory('https://new.com');

			expect(service.size).toBe(1);
			expect(service.hasBeenDownloaded('https://new.com')).toBe(true);
		});

		it('重複URLは追加しない', () => {
			const history = [entry('https://existing.com')];
			const service = new ArticleHistoryService(history);

			service.addToHistory('https://existing.com');

			expect(service.size).toBe(1);
			expect(history).toHaveLength(1);
		});

		it('元の配列を直接mutateする', () => {
			const history: DownloadHistoryEntry[] = [];
			const service = new ArticleHistoryService(history);

			service.addToHistory('https://a.com');
			service.addToHistory('https://b.com');

			expect(history).toHaveLength(2);
			expect(history[0].link).toBe('https://a.com');
			expect(history[1].link).toBe('https://b.com');
		});

		it('downloadedAtにDate.now()が設定される', () => {
			const now = 1700000000000;
			vi.setSystemTime(now);

			const history: DownloadHistoryEntry[] = [];
			const service = new ArticleHistoryService(history);
			service.addToHistory('https://a.com');

			expect(history[0].downloadedAt).toBe(now);

			vi.useRealTimers();
		});
	});

	describe('addMultipleToHistory', () => {
		it('複数のエントリを一括追加する', () => {
			const history: DownloadHistoryEntry[] = [];
			const service = new ArticleHistoryService(history);

			service.addMultipleToHistory([
				entry('https://a.com', 100),
				entry('https://b.com', 200),
				entry('https://c.com', 300),
			]);

			expect(service.size).toBe(3);
			expect(history).toHaveLength(3);
		});

		it('重複を除外して追加する', () => {
			const history = [entry('https://a.com', 100)];
			const service = new ArticleHistoryService(history);

			service.addMultipleToHistory([entry('https://a.com', 200), entry('https://b.com', 300)]);

			expect(service.size).toBe(2);
			expect(history).toHaveLength(2);
			// 既存エントリのdownloadedAtは更新されない
			expect(history[0].downloadedAt).toBe(100);
		});
	});

	describe('clearHistory', () => {
		it('全履歴をクリアする', () => {
			const history = [entry('https://a.com'), entry('https://b.com')];
			const service = new ArticleHistoryService(history);

			service.clearHistory();

			expect(service.size).toBe(0);
			expect(service.hasBeenDownloaded('https://a.com')).toBe(false);
		});

		it('元の配列もクリアされる', () => {
			const history = [entry('https://a.com'), entry('https://b.com')];
			const service = new ArticleHistoryService(history);

			service.clearHistory();

			expect(history).toHaveLength(0);
		});
	});

	describe('purgeOlderThan', () => {
		it('カットオフより古いエントリを削除する', () => {
			const history = [
				entry('https://old.com', 1000),
				entry('https://new.com', 3000),
			];
			const service = new ArticleHistoryService(history);

			const removed = service.purgeOlderThan(2000);

			expect(removed).toBe(1);
			expect(service.size).toBe(1);
			expect(service.hasBeenDownloaded('https://old.com')).toBe(false);
			expect(service.hasBeenDownloaded('https://new.com')).toBe(true);
		});

		it('元の配列も更新される', () => {
			const history = [
				entry('https://old1.com', 1000),
				entry('https://old2.com', 1500),
				entry('https://new.com', 3000),
			];
			const service = new ArticleHistoryService(history);

			service.purgeOlderThan(2000);

			expect(history).toHaveLength(1);
			expect(history[0].link).toBe('https://new.com');
		});

		it('全エントリが古い場合は全件削除', () => {
			const history = [entry('https://a.com', 100), entry('https://b.com', 200)];
			const service = new ArticleHistoryService(history);

			const removed = service.purgeOlderThan(1000);

			expect(removed).toBe(2);
			expect(service.size).toBe(0);
		});

		it('削除対象がない場合は0を返す', () => {
			const history = [entry('https://a.com', 5000)];
			const service = new ArticleHistoryService(history);

			const removed = service.purgeOlderThan(1000);

			expect(removed).toBe(0);
			expect(service.size).toBe(1);
		});
	});

	describe('enforceCapLimit', () => {
		it('上限以下なら何もしない', () => {
			const history = [entry('https://a.com'), entry('https://b.com')];
			const service = new ArticleHistoryService(history);

			const removed = service.enforceCapLimit();

			expect(removed).toBe(0);
			expect(service.size).toBe(2);
		});

		it('上限超過時に古い順から削除する', () => {
			// 50,001件のエントリを作成
			const history: DownloadHistoryEntry[] = [];
			for (let i = 0; i < 50_001; i++) {
				history.push(entry(`https://example.com/${i}`, i));
			}
			const service = new ArticleHistoryService(history);

			const removed = service.enforceCapLimit();

			expect(removed).toBe(1);
			expect(service.size).toBe(50_000);
			// 最も古いエントリ（index 0）が削除される
			expect(service.hasBeenDownloaded('https://example.com/0')).toBe(false);
			expect(service.hasBeenDownloaded('https://example.com/1')).toBe(true);
		});
	});

	describe('size', () => {
		it('履歴のサイズを返す', () => {
			const service = new ArticleHistoryService([entry('https://a.com'), entry('https://b.com')]);
			expect(service.size).toBe(2);

			service.addToHistory('https://c.com');
			expect(service.size).toBe(3);
		});
	});
});
