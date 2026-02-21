import { describe, it, expect } from 'vitest';
import { FileNameGenerator } from '../../src/services/FileNameGenerator';

describe('FileNameGenerator', () => {
	const generator = new FileNameGenerator();

	it('should replace {{title}} with article title', () => {
		const result = generator.generate('{{title}}', 'My Article', '2025-01-15T09:00:00Z');
		expect(result).toBe('My Article');
	});

	it('should replace {{published}} with formatted date (colons sanitized to hyphens)', () => {
		const result = generator.generate('{{published}}', 'Title', '2025-01-15T09:00:00Z');
		// colons in time are replaced by '-' during filename sanitization
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}$/);
	});

	it('should handle template with both title and published', () => {
		const result = generator.generate('{{published}} - {{title}}', 'My Article', '2025-01-15T09:00:00Z');
		expect(result).toContain('My Article');
		expect(result).toContain(' - ');
	});

	it('should sanitize illegal filename characters', () => {
		const result = generator.generate('{{title}}', 'File: "test" <1>|2', '2025-01-01T00:00:00Z');
		expect(result).not.toMatch(/[\\/:*?"<>|]/);
	});

	it('should replace backslash', () => {
		const result = generator.generate('{{title}}', 'path\\to\\file', '2025-01-01T00:00:00Z');
		expect(result).not.toContain('\\');
	});

	it('should trim whitespace from title', () => {
		const result = generator.generate('{{title}}', '  Spaced Title  ', '2025-01-01T00:00:00Z');
		expect(result).toBe('Spaced Title');
	});

	it('should trim whitespace from result', () => {
		const result = generator.generate('  {{title}}  ', 'Title', '2025-01-01T00:00:00Z');
		expect(result).toBe('Title');
	});
});
