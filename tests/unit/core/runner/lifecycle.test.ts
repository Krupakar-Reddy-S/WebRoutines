import { describe, expect, it } from 'vitest';

import {
  applySessionTabRemoval,
  reconcileEagerTabOrder,
} from '@/core/runner/lifecycle';
import type { RoutineSession } from '@/lib/types';

function createSession(overrides: Partial<RoutineSession> = {}): RoutineSession {
  return {
    routineId: 1,
    mode: 'tab-group',
    loadMode: 'eager',
    currentIndex: 1,
    tabId: 22,
    tabGroupId: 9,
    tabIds: [11, 22, 33, null],
    startedAt: 1000,
    ...overrides,
  };
}

describe('runner lifecycle helpers', () => {
  it('removing an inactive tab keeps current focus/index', () => {
    const session = createSession();
    const result = applySessionTabRemoval(session, 11);

    expect(result.affected).toBe(true);
    expect(result.shouldStop).toBe(false);
    expect(result.nextIndexChanged).toBe(false);
    expect(result.nextSession?.tabIds).toEqual([null, 22, 33, null]);
    expect(result.nextSession?.tabId).toBe(22);
    expect(result.nextSession?.currentIndex).toBe(1);
  });

  it('removing active tab prefers next valid tab', () => {
    const session = createSession({
      currentIndex: 1,
      tabId: 22,
      tabIds: [11, 22, 33, 44],
    });
    const result = applySessionTabRemoval(session, 22);

    expect(result.shouldStop).toBe(false);
    expect(result.nextIndex).toBe(2);
    expect(result.nextIndexChanged).toBe(true);
    expect(result.nextSession?.tabId).toBe(33);
    expect(result.nextSession?.tabIds).toEqual([11, null, 33, 44]);
  });

  it('removing active tab falls back to previous valid tab', () => {
    const session = createSession({
      currentIndex: 2,
      tabId: 33,
      tabIds: [11, null, 33, null],
    });
    const result = applySessionTabRemoval(session, 33);

    expect(result.shouldStop).toBe(false);
    expect(result.nextIndex).toBe(0);
    expect(result.nextSession?.tabId).toBe(11);
    expect(result.nextSession?.tabIds).toEqual([11, null, null, null]);
  });

  it('signals stop when all tabs are removed', () => {
    const session = createSession({
      currentIndex: 0,
      tabId: 11,
      tabIds: [11, null, null],
    });
    const result = applySessionTabRemoval(session, 11);

    expect(result.affected).toBe(true);
    expect(result.shouldStop).toBe(true);
    expect(result.nextSession).toBeNull();
  });

  it('reconciles eager tab order and updates current index/tab', () => {
    const session = createSession({
      tabId: 22,
      currentIndex: 1,
      tabIds: [11, 22, 33],
    });
    const result = reconcileEagerTabOrder(session, [33, 22, 11]);

    expect(result.changed).toBe(true);
    expect(result.nextSession.tabIds).toEqual([33, 22, 11]);
    expect(result.nextSession.currentIndex).toBe(1);
    expect(result.nextSession.tabId).toBe(22);
  });

  it('returns unchanged result when order is already the same', () => {
    const session = createSession({
      tabIds: [11, null, 22, 33],
    });
    const result = reconcileEagerTabOrder(session, [11, 22, 33]);

    expect(result.changed).toBe(false);
    expect(result.nextSession).toBe(session);
  });
});
