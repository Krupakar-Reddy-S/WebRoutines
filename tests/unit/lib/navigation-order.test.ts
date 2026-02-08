import { describe, expect, it } from 'vitest';

import {
  clampIndex,
  getLoadedStepCount,
  isStepLoaded,
  resolveGroupInsertIndex,
  type TabSnapshot,
} from '@/lib/navigation';
import type { RoutineSession } from '@/lib/types';

function createSession(overrides: Partial<RoutineSession> = {}): RoutineSession {
  return {
    routineId: 1,
    mode: 'tab-group',
    loadMode: 'lazy',
    currentIndex: 0,
    tabId: 11,
    tabGroupId: 5,
    tabIds: [11, null, 33, null],
    startedAt: 1000,
    ...overrides,
  };
}

describe('navigation order helpers', () => {
  it('resolves insert index after nearest previous loaded tab', () => {
    const groupTabs: TabSnapshot[] = [
      { id: 11, index: 5 },
      { id: 33, index: 9 },
    ];

    const insertIndex = resolveGroupInsertIndex([11, null, 33, null], 1, groupTabs);
    expect(insertIndex).toBe(6);
  });

  it('falls back to nearest next loaded tab when no previous loaded tab exists', () => {
    const groupTabs: TabSnapshot[] = [
      { id: 33, index: 12 },
    ];

    const insertIndex = resolveGroupInsertIndex([null, null, 33], 0, groupTabs);
    expect(insertIndex).toBe(12);
  });

  it('returns undefined when no neighboring loaded tabs are found', () => {
    const groupTabs: TabSnapshot[] = [
      { id: 44, index: 3 },
    ];

    const insertIndex = resolveGroupInsertIndex([11, null, 33], 1, groupTabs);
    expect(insertIndex).toBeUndefined();
  });

  it('clamps indexes to valid bounds', () => {
    expect(clampIndex(-5, 4)).toBe(0);
    expect(clampIndex(0, 4)).toBe(0);
    expect(clampIndex(2, 4)).toBe(2);
    expect(clampIndex(99, 4)).toBe(3);
  });

  it('computes loaded step counts and loaded state for eager/lazy sessions', () => {
    const lazy = createSession({ loadMode: 'lazy', tabIds: [11, null, 33] });
    expect(getLoadedStepCount(lazy)).toBe(2);
    expect(isStepLoaded(lazy, 0)).toBe(true);
    expect(isStepLoaded(lazy, 1)).toBe(false);

    const eager = createSession({ loadMode: 'eager', tabIds: [11, null, 33] });
    expect(getLoadedStepCount(eager)).toBe(3);
  });
});
