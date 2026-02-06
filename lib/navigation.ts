import { db } from '@/lib/db';
import {
  getRoutineSession,
  getRunnerState,
  removeRoutineSession,
  setFocusedRoutine,
  upsertRoutineSession,
} from '@/lib/session';
import type { NavigationMode, Routine, RoutineSession } from '@/lib/types';

export interface StartRoutineResult {
  session: RoutineSession;
  alreadyRunning: boolean;
}

export async function startRoutine(
  routine: Routine,
  mode: NavigationMode,
): Promise<StartRoutineResult> {
  if (!routine.id) {
    throw new Error('Routine is missing an id. Save it before running.');
  }

  if (routine.links.length === 0) {
    throw new Error('Add at least one link before starting a routine.');
  }

  const existing = await getRoutineSession(routine.id);

  if (existing) {
    await setFocusedRoutine(routine.id);
    return {
      session: existing,
      alreadyRunning: true,
    };
  }

  const session = mode === 'same-tab'
    ? await startInSingleTabGroup(routine)
    : await startInMultiTabGroup(routine);

  await upsertRoutineSession(session);

  return {
    session,
    alreadyRunning: false,
  };
}

export async function navigateSessionByOffset(
  routineIdOrOffset: number,
  maybeOffset?: number,
): Promise<RoutineSession | null> {
  const target = await resolveTargetSession(routineIdOrOffset, maybeOffset);

  if (!target) {
    return null;
  }

  const { routine, session } = target;

  return navigateToIndex(routine, session, session.currentIndex + (maybeOffset ?? routineIdOrOffset));
}

export async function openCurrentSessionLink(routineId?: number): Promise<RoutineSession | null> {
  const target = await resolveTargetSession(routineId);

  if (!target) {
    return null;
  }

  const { routine, session } = target;

  return navigateToIndex(routine, session, session.currentIndex);
}

export async function stopActiveRoutine(routineId?: number): Promise<boolean> {
  const target = await resolveTargetSession(routineId);

  if (!target) {
    return false;
  }

  await destroyRoutineSession(target.session);
  return true;
}

export async function stopRoutineById(routineId: number): Promise<boolean> {
  const session = await getRoutineSession(routineId);

  if (!session) {
    return false;
  }

  await destroyRoutineSession(session);
  return true;
}

export async function stopAllRoutines(): Promise<void> {
  const state = await getRunnerState();

  for (const session of state.sessions) {
    await closeRunnerTabs(session);
  }

  for (const session of state.sessions) {
    await removeRoutineSession(session.routineId);
  }
}

export async function openSidePanelForCurrentWindow(): Promise<boolean> {
  if (!browser.sidePanel?.open) {
    return false;
  }

  const windowId = await resolveTargetWindowId();
  if (typeof windowId !== 'number') {
    return false;
  }

  await browser.sidePanel.open({ windowId });
  return true;
}

export async function openSidePanelForTab(tabId: number): Promise<boolean> {
  if (!browser.sidePanel?.open || typeof tabId !== 'number') {
    return false;
  }

  await browser.sidePanel.open({ tabId });
  return true;
}

export async function navigateToIndex(
  routine: Routine,
  session: RoutineSession,
  index: number,
): Promise<RoutineSession> {
  if (routine.links.length === 0) {
    throw new Error('Routine has no links.');
  }

  const targetIndex = clampIndex(index, routine.links.length);
  const nextSession = session.mode === 'same-tab'
    ? await navigateSingleTabGroup(routine, session, targetIndex)
    : await navigateMultiTabGroup(routine, session, targetIndex);

  await upsertRoutineSession(nextSession);
  return nextSession;
}

async function resolveTargetSession(
  routineIdOrOffset?: number,
  maybeOffset?: number,
): Promise<{ routine: Routine; session: RoutineSession } | null> {
  const state = await getRunnerState();

  if (state.sessions.length === 0) {
    return null;
  }

  const routineId = maybeOffset === undefined
    ? state.focusedRoutineId ?? state.sessions[0].routineId
    : routineIdOrOffset;

  if (typeof routineId !== 'number') {
    return null;
  }

  const session = state.sessions.find((item) => item.routineId === routineId);

  if (!session) {
    return null;
  }

  const routine = await db.routines.get(session.routineId);

  if (!routine || routine.links.length === 0) {
    await destroyRoutineSession(session);
    return null;
  }

  await setFocusedRoutine(session.routineId);

  return {
    routine,
    session,
  };
}

async function destroyRoutineSession(session: RoutineSession): Promise<void> {
  await closeRunnerTabs(session);
  await removeRoutineSession(session.routineId);
}

async function closeRunnerTabs(session: RoutineSession): Promise<void> {
  const tabIds = dedupeNumbers([session.tabId, ...session.tabIds]);

  if (tabIds.length > 0) {
    try {
      await browser.tabs.remove(tabIds);
    } catch {
      // Ignore close failures (tabs may already be gone).
    }
  }
}

async function startInSingleTabGroup(routine: Routine): Promise<RoutineSession> {
  const firstUrl = routine.links[0].url;
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });

  const createOptions: Record<string, unknown> = {
    url: firstUrl,
    active: true,
  };

  if (typeof activeTab?.windowId === 'number') {
    createOptions.windowId = activeTab.windowId;
  }

  const createdTab = await browser.tabs.create(createOptions);
  const tabId = createdTab.id ?? null;

  let tabGroupId: number | null = null;

  if (typeof tabId === 'number') {
    try {
      tabGroupId = await browser.tabs.group({ tabIds: [tabId] });
      await browser.tabGroups.update(tabGroupId, {
        title: `${routine.name} (single)`,
        color: 'blue',
        collapsed: false,
      });
    } catch {
      tabGroupId = null;
    }
  }

  return {
    routineId: routine.id!,
    mode: 'same-tab',
    currentIndex: 0,
    tabId,
    tabGroupId,
    tabIds: typeof tabId === 'number' ? [tabId] : [],
    startedAt: Date.now(),
  };
}

async function startInMultiTabGroup(routine: Routine): Promise<RoutineSession> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  const tabIds: number[] = [];

  for (const [index, link] of routine.links.entries()) {
    const createOptions: Record<string, unknown> = {
      url: link.url,
      active: index === 0,
    };

    if (typeof activeTab?.windowId === 'number') {
      createOptions.windowId = activeTab.windowId;
    }

    const createdTab = await browser.tabs.create(createOptions);

    if (typeof createdTab.id === 'number') {
      tabIds[index] = createdTab.id;
    }
  }

  let tabGroupId: number | null = null;
  const groupableTabIds = asNonEmpty(tabIds.filter((id) => typeof id === 'number'));

  if (groupableTabIds) {
    try {
      tabGroupId = await browser.tabs.group({ tabIds: groupableTabIds });
      await browser.tabGroups.update(tabGroupId, {
        title: `${routine.name} (multi)`,
        color: 'blue',
        collapsed: false,
      });
    } catch {
      tabGroupId = null;
    }
  }

  return {
    routineId: routine.id!,
    mode: 'tab-group',
    currentIndex: 0,
    tabId: tabIds[0] ?? null,
    tabGroupId,
    tabIds: tabIds.map((id) => id ?? -1),
    startedAt: Date.now(),
  };
}

async function navigateSingleTabGroup(
  routine: Routine,
  session: RoutineSession,
  targetIndex: number,
): Promise<RoutineSession> {
  const targetUrl = routine.links[targetIndex].url;
  let tabId = session.tabId;

  if (typeof tabId === 'number') {
    try {
      await browser.tabs.update(tabId, { url: targetUrl, active: true });
    } catch {
      tabId = null;
    }
  }

  if (typeof tabId !== 'number') {
    const createdTab = await browser.tabs.create({ url: targetUrl, active: true });
    tabId = createdTab.id ?? null;

    if (typeof tabId === 'number' && typeof session.tabGroupId === 'number') {
      try {
        await browser.tabs.group({ groupId: session.tabGroupId, tabIds: [tabId] });
      } catch {
        // Keep navigation functional even if group assignment fails.
      }
    }
  }

  return {
    ...session,
    currentIndex: targetIndex,
    tabId,
    tabIds: typeof tabId === 'number' ? [tabId] : [],
  };
}

async function navigateMultiTabGroup(
  routine: Routine,
  session: RoutineSession,
  targetIndex: number,
): Promise<RoutineSession> {
  const targetUrl = routine.links[targetIndex].url;
  const tabIds = [...session.tabIds];
  let tabId: number | null = tabIds[targetIndex] ?? null;

  if (typeof tabId === 'number') {
    try {
      await browser.tabs.update(tabId, { active: true });
    } catch {
      tabId = null;
    }
  }

  if (typeof tabId !== 'number') {
    const groupTabs = typeof session.tabGroupId === 'number'
      ? await browser.tabs.query({ groupId: session.tabGroupId })
      : [];
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    const createOptions: Record<string, unknown> = {
      url: targetUrl,
      active: true,
    };

    const windowId = groupTabs[0]?.windowId ?? activeTab?.windowId;
    if (typeof windowId === 'number') {
      createOptions.windowId = windowId;
    }

    const insertIndex = resolveGroupInsertIndex(session, targetIndex, groupTabs);
    if (typeof insertIndex === 'number') {
      createOptions.index = insertIndex;
    }

    const createdTab = await browser.tabs.create(createOptions);
    tabId = createdTab.id ?? null;

    if (typeof tabId === 'number') {
      tabIds[targetIndex] = tabId;

      if (typeof session.tabGroupId === 'number') {
        try {
          await browser.tabs.group({ groupId: session.tabGroupId, tabIds: [tabId] });
        } catch {
          // Ignore group assignment failures and continue with functional navigation.
        }
      }
    }
  }

  return {
    ...session,
    currentIndex: targetIndex,
    tabId,
    tabIds,
  };
}

function dedupeNumbers(values: Array<number | null | undefined>): number[] {
  const dedupe = new Set<number>();

  for (const value of values) {
    if (typeof value === 'number' && value >= 0) {
      dedupe.add(value);
    }
  }

  return [...dedupe];
}

function asNonEmpty(values: number[]): [number, ...number[]] | null {
  if (values.length === 0) {
    return null;
  }

  return values as [number, ...number[]];
}

function clampIndex(index: number, length: number): number {
  if (index <= 0) {
    return 0;
  }

  if (index >= length - 1) {
    return length - 1;
  }

  return index;
}

async function resolveTargetWindowId(): Promise<number | null> {
  const [currentWindowActive] = await browser.tabs.query({ active: true, currentWindow: true });
  if (typeof currentWindowActive?.windowId === 'number') {
    return currentWindowActive.windowId;
  }

  const [lastFocusedActive] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  if (typeof lastFocusedActive?.windowId === 'number') {
    return lastFocusedActive.windowId;
  }

  if (browser.windows?.getLastFocused) {
    try {
      const lastFocusedWindow = await browser.windows.getLastFocused();
      if (typeof lastFocusedWindow.id === 'number') {
        return lastFocusedWindow.id;
      }
    } catch {
      return null;
    }
  }

  return null;
}

type TabSnapshot = { id?: number; index: number; windowId?: number };

function resolveGroupInsertIndex(
  session: RoutineSession,
  targetIndex: number,
  groupTabs: TabSnapshot[],
): number | undefined {
  if (groupTabs.length === 0) {
    return undefined;
  }

  const tabIndexById = new Map<number, number>();

  for (const tab of groupTabs) {
    if (typeof tab.id === 'number') {
      tabIndexById.set(tab.id, tab.index);
    }
  }

  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const prevTabId = session.tabIds[index];
    if (typeof prevTabId === 'number' && tabIndexById.has(prevTabId)) {
      return (tabIndexById.get(prevTabId) ?? 0) + 1;
    }
  }

  for (let index = targetIndex + 1; index < session.tabIds.length; index += 1) {
    const nextTabId = session.tabIds[index];
    if (typeof nextTabId === 'number' && tabIndexById.has(nextTabId)) {
      return tabIndexById.get(nextTabId);
    }
  }

  return undefined;
}
