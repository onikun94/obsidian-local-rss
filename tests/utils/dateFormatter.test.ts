import { describe, it, expect } from 'vitest';
import { formatDateTime } from '../../src/utils/dateFormatter';

describe('formatDateTime', () => {
	it('should format a date as YYYY-MM-DD HH:mm:ss', () => {
		const date = new Date(2025, 0, 15, 9, 5, 3); // 2025-01-15 09:05:03
		expect(formatDateTime(date)).toBe('2025-01-15 09:05:03');
	});

	it('should pad single-digit months, days, hours, minutes, seconds', () => {
		const date = new Date(2025, 2, 3, 4, 5, 6); // 2025-03-03 04:05:06
		expect(formatDateTime(date)).toBe('2025-03-03 04:05:06');
	});

	it('should handle midnight correctly', () => {
		const date = new Date(2025, 11, 31, 0, 0, 0); // 2025-12-31 00:00:00
		expect(formatDateTime(date)).toBe('2025-12-31 00:00:00');
	});

	it('should handle end of day correctly', () => {
		const date = new Date(2025, 5, 15, 23, 59, 59); // 2025-06-15 23:59:59
		expect(formatDateTime(date)).toBe('2025-06-15 23:59:59');
	});
});
