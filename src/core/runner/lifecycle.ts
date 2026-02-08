import type { RoutineSession } from '@/lib/types';

export interface TabRemovalResult {
  affected: boolean;
  shouldStop: boolean;
  nextSession: RoutineSession | null;
  nextIndex: number;
  nextIndexChanged: boolean;
}

export interface EagerReorderResult {
  changed: boolean;
  nextSession: RoutineSession;
}

export function applySessionTabRemoval(session: RoutineSession, removedTabId: number): TabRemovalResult {
  if (!session.tabIds.includes(removedTabId)) {
    return {
      affected: false,
      shouldStop: false,
      nextSession: session,
      nextIndex: session.currentIndex,
      nextIndexChanged: false,
    };
  }

  const removedIndex = session.tabIds.indexOf(removedTabId);
  const nextTabIds = session.tabIds.map((id, index) => (
    index === removedIndex ? null : id
  ));
  const validTabIds = nextTabIds.filter(isValidTabId);

  if (validTabIds.length === 0) {
    return {
      affected: true,
      shouldStop: true,
      nextSession: null,
      nextIndex: session.currentIndex,
      nextIndexChanged: false,
    };
  }

  let nextTabId = session.tabId;
  let nextIndex = session.currentIndex;

  if (session.tabId === removedTabId) {
    const forwardIndex = findNextValidIndex(nextTabIds, removedIndex + 1);
    const backwardIndex = findPreviousValidIndex(nextTabIds, removedIndex - 1);
    const resolvedIndex = forwardIndex ?? backwardIndex ?? 0;

    nextIndex = resolvedIndex;
    nextTabId = isValidTabId(nextTabIds[resolvedIndex]) ? nextTabIds[resolvedIndex] : null;
  }

  return {
    affected: true,
    shouldStop: false,
    nextSession: {
      ...session,
      tabIds: nextTabIds,
      tabId: nextTabId,
      currentIndex: nextIndex >= 0 ? nextIndex : 0,
    },
    nextIndex,
    nextIndexChanged: nextIndex !== session.currentIndex,
  };
}

export function reconcileEagerTabOrder(session: RoutineSession, orderedIds: number[]): EagerReorderResult {
  if (orderedIds.length === 0) {
    return {
      changed: false,
      nextSession: session,
    };
  }

  const loadedIds = session.tabIds.filter(isValidTabId);
  if (arraysEqualNumbers(orderedIds, loadedIds)) {
    return {
      changed: false,
      nextSession: session,
    };
  }

  const activeIndex = typeof session.tabId === 'number'
    ? orderedIds.indexOf(session.tabId)
    : 0;
  const nextIndex = activeIndex >= 0 ? activeIndex : 0;
  const nextTabId = typeof session.tabId === 'number' && activeIndex >= 0
    ? session.tabId
    : orderedIds[0] ?? null;

  return {
    changed: true,
    nextSession: {
      ...session,
      tabIds: orderedIds,
      currentIndex: nextIndex,
      tabId: nextTabId,
    },
  };
}

export function isValidTabId(id: number | null | undefined): id is number {
  return typeof id === 'number' && id >= 0;
}

export function arraysEqualNumbers(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function findNextValidIndex(values: Array<number | null>, startIndex: number): number | null {
  for (let index = startIndex; index < values.length; index += 1) {
    if (isValidTabId(values[index])) {
      return index;
    }
  }

  return null;
}

export function findPreviousValidIndex(values: Array<number | null>, startIndex: number): number | null {
  for (let index = startIndex; index >= 0; index -= 1) {
    if (isValidTabId(values[index])) {
      return index;
    }
  }

  return null;
}
