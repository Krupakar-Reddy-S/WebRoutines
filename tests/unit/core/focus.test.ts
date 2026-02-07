import { describe, expect, it } from 'vitest';

import { getFocusedSession, resolveFocusedRoutineId } from '@/core/runner/focus';
import type { RoutineSession } from '@/lib/types';

const sessions: RoutineSession[] = [
  {
    routineId: 10,
    mode: 'tab-group',
    loadMode: 'eager',
    currentIndex: 0,
    tabId: 100,
    tabGroupId: 200,
    tabIds: [100],
    startedAt: 1_000,
  },
  {
    routineId: 11,
    mode: 'tab-group',
    loadMode: 'lazy',
    currentIndex: 1,
    tabId: 101,
    tabGroupId: 201,
    tabIds: [101],
    startedAt: 2_000,
  },
];

describe('focused runner resolver', () => {
  it('returns explicit focused session when found', () => {
    expect(getFocusedSession(sessions, 11)?.routineId).toBe(11);
  });

  it('falls back to first session when focused id is missing', () => {
    expect(getFocusedSession(sessions, 999)?.routineId).toBe(10);
    expect(resolveFocusedRoutineId(sessions, 999)).toBe(10);
  });

  it('resolves null when no sessions exist', () => {
    expect(getFocusedSession([], 10)).toBeNull();
    expect(resolveFocusedRoutineId([], 10)).toBeNull();
  });
});
