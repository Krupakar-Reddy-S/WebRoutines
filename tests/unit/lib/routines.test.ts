import { describe, expect, it } from 'vitest';
import type { Routine } from '@/lib/types';

import {
  hasRoutineSchedule,
  isRoutineScheduledForDay,
  normalizeRoutineScheduleDays,
  normalizeRoutineUrl,
  parseRoutineBackup,
} from '@/lib/routines';

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

  it('parses routine schedules and normalizes days', () => {
    const rawJson = JSON.stringify({
      version: 2,
      exportedAt: '2026-02-08T00:00:00.000Z',
      routines: [
        {
          name: 'Weekdays',
          links: ['https://example.com'],
          schedule: {
            days: [5, 1, 1, 3, 12, '2'],
          },
        },
      ],
    });

    const parsed = parseRoutineBackup(rawJson);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].schedule).toEqual({ days: [1, 2, 3, 5] });
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

describe('schedule helpers', () => {
  it('normalizes and sorts valid schedule days', () => {
    expect(normalizeRoutineScheduleDays([4, 1, '2', -1, 7, 1])).toEqual([1, 2, 4]);
    expect(normalizeRoutineScheduleDays('bad')).toEqual([]);
  });

  it('checks schedule presence and matching day', () => {
    const routine: Routine = {
      name: 'Daily',
      links: [],
      createdAt: 1,
      updatedAt: 1,
      schedule: { days: [1, 3] as const },
    };

    expect(hasRoutineSchedule(routine)).toBe(true);
    expect(isRoutineScheduledForDay(routine, 1)).toBe(true);
    expect(isRoutineScheduledForDay(routine, 2)).toBe(false);
  });
});
