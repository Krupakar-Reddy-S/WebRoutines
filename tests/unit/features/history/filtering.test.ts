import { describe, expect, it } from 'vitest';

import {
  formatDuration,
  parsePage,
  parseRoutineFilter,
  parseStatusFilter,
  resolveRunDurationMs,
  runMatchesStatusFilter,
} from '@/features/history/filtering';
import type { RoutineRun } from '@/lib/types';

function createRun(input: Partial<RoutineRun> = {}): RoutineRun {
  return {
    routineId: 1,
    startedAt: 10_000,
    stoppedAt: 70_000,
    stepsCompleted: 2,
    totalSteps: 4,
    completedFull: false,
    mode: 'tab-group',
    durationMs: null,
    ...input,
  };
}

describe('history filtering helpers', () => {
  it('parses routine and page values safely', () => {
    expect(parseRoutineFilter('12')).toBe(12);
    expect(parseRoutineFilter('0')).toBeNull();
    expect(parseRoutineFilter('abc')).toBeNull();
    expect(parsePage('3')).toBe(3);
    expect(parsePage('-2')).toBe(1);
    expect(parsePage(null)).toBe(1);
  });

  it('parses status filter with fallback', () => {
    expect(parseStatusFilter('complete')).toBe('complete');
    expect(parseStatusFilter('in-progress')).toBe('in-progress');
    expect(parseStatusFilter('partial')).toBe('partial');
    expect(parseStatusFilter('invalid')).toBe('all');
  });

  it('matches runs by status filter', () => {
    const inProgress = createRun({ stoppedAt: null });
    const complete = createRun({ completedFull: true, stoppedAt: 70_000 });
    const partial = createRun({ completedFull: false, stoppedAt: 70_000 });

    expect(runMatchesStatusFilter(inProgress, 'in-progress')).toBe(true);
    expect(runMatchesStatusFilter(complete, 'complete')).toBe(true);
    expect(runMatchesStatusFilter(partial, 'partial')).toBe(true);
    expect(runMatchesStatusFilter(partial, 'complete')).toBe(false);
  });

  it('resolves duration from explicit value, stop delta, or active clock', () => {
    expect(resolveRunDurationMs(createRun({ durationMs: 1500 }), 99_000)).toBe(1500);
    expect(resolveRunDurationMs(createRun({ durationMs: null, startedAt: 10_000, stoppedAt: 15_000 }), 99_000)).toBe(5_000);
    expect(resolveRunDurationMs(createRun({ durationMs: null, startedAt: 10_000, stoppedAt: null }), 13_500)).toBe(3_500);
  });

  it('formats durations for seconds, minutes, and hours', () => {
    expect(formatDuration(35_000)).toBe('35s');
    expect(formatDuration(120_000)).toBe('2m');
    expect(formatDuration(7_560_000)).toBe('2h 6m');
  });
});
