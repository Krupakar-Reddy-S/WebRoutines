import { describe, expect, it } from 'vitest';

import { normalizeRoutineUrl, parseRoutineBackup } from '@/lib/routines';

describe('normalizeRoutineUrl', () => {
  it('accepts valid http/https URLs', () => {
    expect(normalizeRoutineUrl('https://example.com/path')).toBe('https://example.com/path');
    expect(normalizeRoutineUrl('http://example.com')).toBe('http://example.com/');
  });

  it('rejects unsupported or malformed URLs', () => {
    expect(normalizeRoutineUrl('chrome://settings')).toBeNull();
    expect(normalizeRoutineUrl('file:///tmp/a.txt')).toBeNull();
    expect(normalizeRoutineUrl('not a url')).toBeNull();
    expect(normalizeRoutineUrl('   ')).toBeNull();
  });
});

describe('parseRoutineBackup', () => {
  it('parses versioned backup payloads and deduplicates links', () => {
    const rawJson = JSON.stringify({
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      routines: [
        {
          name: 'Morning',
          links: [
            'https://example.com',
            'invalid-url',
            { url: 'https://example.com', title: 'Duplicate' },
            { url: 'http://news.ycombinator.com', title: 'HN' },
          ],
        },
        {
          name: '',
          links: ['https://ignored.com'],
        },
      ],
    });

    const parsed = parseRoutineBackup(rawJson);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Morning');
    expect(parsed[0].links.map((link) => link.url)).toEqual([
      'https://example.com/',
      'http://news.ycombinator.com/',
    ]);
    expect(parsed[0].links[1].title).toBe('HN');
  });

  it('parses array-style legacy payloads', () => {
    const rawJson = JSON.stringify([
      {
        name: 'Legacy',
        links: ['https://example.com'],
      },
    ]);

    const parsed = parseRoutineBackup(rawJson);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Legacy');
    expect(parsed[0].links).toHaveLength(1);
  });

  it('throws when no valid routines remain', () => {
    const rawJson = JSON.stringify({
      routines: [
        { name: 'Broken', links: ['chrome://settings', 'not-a-url'] },
      ],
    });

    expect(() => parseRoutineBackup(rawJson)).toThrow('No valid routines found in backup file.');
  });
});
