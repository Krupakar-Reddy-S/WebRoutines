import { db } from '@/lib/db';
import {
  getRoutineSession,
  getRunnerState,
  removeRoutineSession,
  setFocusedRoutine,
  updateRoutineSession,
  upsertRoutineSession,
} from '@/lib/session';
import { setRoutineLastRunAt } from '@/lib/routines';
import {
  createRunForSession,
  ensureRunForSession,
  finalizeRun,
  logRunNavigationAction,
} from '@/lib/run-history';
import { getSettings } from '@/lib/settings';
import type { Routine, RoutineSession, RunActionEventSource, RunStopReason, TabLoadMode } from '@/lib/types';

export interface StartRoutineResult {
  session: RoutineSession;
  alreadyRunning: boolean;
}

interface NavigationActionContext {
  source: RunActionEventSource;
  action: 'next' | 'previous' | 'jump' | 'open-current';
}

export async function startRoutine(
  routine: Routine,
  source: RunActionEventSource = 'system',
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
    const ensured = await ensureRunForSession(existing, routine, source);
    let session = existing;

    if (ensured?.created) {
      session = { ...existing, runId: ensured.runId };
      await updateRoutineSession(session);
      await setRoutineLastRunAt(routine.id, existing.startedAt);
    }

    return {
      session,
      alreadyRunning: true,
    };
  }

  const settings = await getSettings();
  const session = settings.tabLoadMode === 'lazy'
    ? await startInLazyTabGroup(routine)
    : await startInEagerTabGroup(routine);

  const runId = await createRunForSession(routine, session, source);
  session.runId = runId;
  await setRoutineLastRunAt(routine.id, session.startedAt);
  await upsertRoutineSession(session);

  return {
    session,
    alreadyRunning: false,
  };
}

export async function navigateSessionByOffset(
  routineIdOrOffset: number,
  maybeOffset?: number,
  source: RunActionEventSource = 'system',
): Promise<RoutineSession | null> {
  const target = await resolveTargetSession(routineIdOrOffset, maybeOffset);

  if (!target) {
    return null;
  }

  const { routine, session } = target;
  const offset = maybeOffset ?? routineIdOrOffset;

  return navigateToIndex(
    routine,
    session,
    session.currentIndex + offset,
    {
      source,
      action: offset >= 0 ? 'next' : 'previous',
    },
  );
}

export async function openCurrentSessionLink(
  routineId?: number,
  source: RunActionEventSource = 'system',
): Promise<RoutineSession | null> {
  const target = await resolveTargetSession(routineId);

  if (!target) {
    return null;
  }

  const { routine, session } = target;

  return navigateToIndex(
    routine,
    session,
    session.currentIndex,
    {
      source,
      action: 'open-current',
    },
  );
}

export async function stopActiveRoutine(
  routineId?: number,
  source: RunActionEventSource = 'system',
): Promise<boolean> {
  const target = await resolveTargetSession(routineId);

  if (!target) {
    return false;
  }

  await destroyRoutineSession(target.session, 'user-stop', source);
  return true;
}

export async function stopRoutineById(
  routineId: number,
  source: RunActionEventSource = 'system',
): Promise<boolean> {
  const session = await getRoutineSession(routineId);

  if (!session) {
    return false;
  }

  await destroyRoutineSession(session, 'user-stop', source);
  return true;
}

export async function stopAllRoutines(): Promise<void> {
  const state = await getRunnerState();

  for (const session of state.sessions) {
    await destroyRoutineSession(session, 'user-stop', 'system');
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
  actionContext?: NavigationActionContext,
): Promise<RoutineSession> {
  if (routine.links.length === 0) {
    throw new Error('Routine has no links.');
  }

  const targetIndex = clampIndex(index, routine.links.length);
  const runResult = await ensureRunForSession(session, routine, actionContext?.source ?? 'system');
  let runId = session.runId;

  if (runResult) {
    runId = runResult.runId;
    if (runResult.created) {
      await setRoutineLastRunAt(routine.id!, session.startedAt);
    }
  }

  const nextSession = await navigateTabGroup(routine, session, targetIndex);

  if (typeof runId === 'number') {
    nextSession.runId = runId;
  }

  if (typeof runId === 'number' && routine.id && actionContext) {
    await logRunNavigationAction({
      runId,
      routineId: routine.id,
      source: actionContext.source,
      action: actionContext.action,
      fromStepIndex: session.currentIndex,
      toStepIndex: targetIndex,
    });
  }

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
    await destroyRoutineSession(session, 'system-stop', 'system');
    return null;
  }

  await setFocusedRoutine(session.routineId);

  return {
    routine,
    session,
  };
}

async function destroyRoutineSession(
  session: RoutineSession,
  stopReason: RunStopReason,
  source: RunActionEventSource,
): Promise<void> {
  await requestBackgroundActiveTimeFlush(session.routineId);

  if (typeof session.runId === 'number') {
    await finalizeRun(session.runId, session.routineId, Date.now(), stopReason, source);
  } else {
    const routine = await db.routines.get(session.routineId);
    if (routine?.id) {
      const ensured = await ensureRunForSession(session, routine, source);
      if (ensured?.runId) {
        await finalizeRun(ensured.runId, session.routineId, Date.now(), stopReason, source);
      }
    }
  }

  await removeRoutineSession(session.routineId);
  await closeRunnerTabs(session);
}

async function requestBackgroundActiveTimeFlush(routineId?: number): Promise<void> {
  try {
    await browser.runtime.sendMessage({
      type: 'runner:flush-active-time',
      routineId,
    });
  } catch {
    // Ignore if background context is unavailable.
  }
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

async function startInEagerTabGroup(routine: Routine): Promise<RoutineSession> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  const tabIds: Array<number | null> = Array.from({ length: routine.links.length }, () => null);

  for (const [index, link] of routine.links.entries()) {
    const createOptions: Record<string, unknown> = {
      url: link.url,
      active: index === 0,
    };

    if (typeof activeTab?.windowId === 'number') {
      createOptions.windowId = activeTab.windowId;
    }

    const createdTab = await browser.tabs.create(createOptions);
    tabIds[index] = typeof createdTab.id === 'number' ? createdTab.id : null;
  }

  let tabGroupId: number | null = null;
  const groupableTabIds = asNonEmpty(tabIds.filter((id): id is number => typeof id === 'number'));

  if (groupableTabIds) {
    try {
      tabGroupId = await browser.tabs.group({ tabIds: groupableTabIds });
      await browser.tabGroups.update(tabGroupId, {
        title: routine.name,
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
    loadMode: 'eager',
    currentIndex: 0,
    tabId: tabIds[0] ?? null,
    tabGroupId,
    tabIds,
    startedAt: Date.now(),
  };
}

async function startInLazyTabGroup(routine: Routine): Promise<RoutineSession> {
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
  const tabId = typeof createdTab.id === 'number' ? createdTab.id : null;

  let tabGroupId: number | null = null;

  if (typeof tabId === 'number') {
    try {
      tabGroupId = await browser.tabs.group({ tabIds: [tabId] });
      await browser.tabGroups.update(tabGroupId, {
        title: routine.name,
        color: 'blue',
        collapsed: false,
      });
    } catch {
      tabGroupId = null;
    }
  }

  const tabIds: Array<number | null> = Array.from({ length: routine.links.length }, () => null);
  tabIds[0] = tabId;

  return {
    routineId: routine.id!,
    mode: 'tab-group',
    loadMode: 'lazy',
    currentIndex: 0,
    tabId,
    tabGroupId,
    tabIds,
    startedAt: Date.now(),
  };
}

async function navigateTabGroup(
  routine: Routine,
  session: RoutineSession,
  targetIndex: number,
): Promise<RoutineSession> {
  const tabIds = normalizeTabIds(session.tabIds, routine.links.length);
  let tabGroupId = session.tabGroupId;
  let tabId = tabIds[targetIndex] ?? null;

  if (typeof tabId === 'number') {
    try {
      await browser.tabs.update(tabId, { active: true });
    } catch {
      tabIds[targetIndex] = null;
      tabId = null;
    }
  }

  if (typeof tabId !== 'number') {
    const created = await createTabForStep(routine, session, tabIds, targetIndex, tabGroupId);
    tabId = created.tabId;
    tabGroupId = created.tabGroupId;
    tabIds[targetIndex] = tabId;
  }

  return {
    ...session,
    currentIndex: targetIndex,
    tabId,
    tabGroupId,
    tabIds,
  };
}

async function createTabForStep(
  routine: Routine,
  session: RoutineSession,
  tabIds: Array<number | null>,
  targetIndex: number,
  tabGroupId: number | null,
): Promise<{ tabId: number | null; tabGroupId: number | null }> {
  const targetUrl = routine.links[targetIndex]?.url;
  if (!targetUrl) {
    return { tabId: null, tabGroupId };
  }

  const groupTabs = typeof tabGroupId === 'number'
    ? await browser.tabs.query({ groupId: tabGroupId })
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

  const insertIndex = resolveGroupInsertIndex(tabIds, targetIndex, groupTabs);
  if (typeof insertIndex === 'number') {
    createOptions.index = insertIndex;
  }

  const createdTab = await browser.tabs.create(createOptions);
  const createdTabId = typeof createdTab.id === 'number' ? createdTab.id : null;

  if (typeof createdTabId !== 'number') {
    return { tabId: null, tabGroupId };
  }

  if (typeof tabGroupId === 'number') {
    try {
      await browser.tabs.group({ groupId: tabGroupId, tabIds: [createdTabId] });
    } catch {
      // Keep navigation functional if grouping fails.
    }

    return { tabId: createdTabId, tabGroupId };
  }

  const existingTabIds = dedupeNumbers(tabIds);
  const tabIdsToGroup = asNonEmpty([createdTabId, ...existingTabIds]);

  if (!tabIdsToGroup) {
    return { tabId: createdTabId, tabGroupId };
  }

  try {
    const nextGroupId = await browser.tabs.group({ tabIds: tabIdsToGroup });
    await browser.tabGroups.update(nextGroupId, {
      title: routine.name,
      color: 'blue',
      collapsed: false,
    });
    return { tabId: createdTabId, tabGroupId: nextGroupId };
  } catch {
    return { tabId: createdTabId, tabGroupId };
  }
}

function normalizeTabIds(tabIds: Array<number | null>, totalLinks: number): Array<number | null> {
  const normalized: Array<number | null> = Array.from({ length: totalLinks }, () => null);

  for (let index = 0; index < totalLinks; index += 1) {
    const id = tabIds[index];
    normalized[index] = typeof id === 'number' && id >= 0 ? id : null;
  }

  return normalized;
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

export function clampIndex(index: number, length: number): number {
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

export type TabSnapshot = { id?: number; index: number };

export function resolveGroupInsertIndex(
  sessionTabIds: Array<number | null>,
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
    const prevTabId = sessionTabIds[index];
    if (typeof prevTabId === 'number' && tabIndexById.has(prevTabId)) {
      return (tabIndexById.get(prevTabId) ?? 0) + 1;
    }
  }

  for (let index = targetIndex + 1; index < sessionTabIds.length; index += 1) {
    const nextTabId = sessionTabIds[index];
    if (typeof nextTabId === 'number' && tabIndexById.has(nextTabId)) {
      return tabIndexById.get(nextTabId);
    }
  }

  return undefined;
}

export function getLoadedStepCount(session: RoutineSession): number {
  if (session.loadMode === 'eager') {
    return session.tabIds.length;
  }

  return session.tabIds.filter((id) => typeof id === 'number').length;
}

export function isStepLoaded(session: RoutineSession, index: number): boolean {
  const id = session.tabIds[index];
  return typeof id === 'number';
}

export function getSessionLoadMode(session: RoutineSession): TabLoadMode {
  return session.loadMode;
}
