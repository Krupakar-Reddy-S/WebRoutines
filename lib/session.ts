import type { RoutineSession } from '@/lib/types';
import {
  getFocusedSession as getFocusedSessionFromState,
  resolveFocusedRoutineId,
} from '@/core/runner/focus';

const ACTIVE_SESSIONS_KEY = 'activeSessions';
const FOCUSED_ROUTINE_ID_KEY = 'focusedRoutineId';
const LEGACY_ACTIVE_SESSION_KEY = 'activeSession';
const FOCUS_MODE_ACTIVE_KEY = 'focusModeActive';
const REQUESTED_SIDEPANEL_VIEW_KEY = 'requestedSidepanelView';

interface SessionStorageRecord {
  [ACTIVE_SESSIONS_KEY]?: RoutineSession[];
  [FOCUSED_ROUTINE_ID_KEY]?: number;
  [LEGACY_ACTIVE_SESSION_KEY]?: RoutineSession;
  [FOCUS_MODE_ACTIVE_KEY]?: boolean;
  [REQUESTED_SIDEPANEL_VIEW_KEY]?: SidepanelViewRequest;
}

export interface RunnerState {
  sessions: RoutineSession[];
  focusedRoutineId: number | null;
}

export type SidepanelViewRequest = 'runner' | 'routines' | 'editor' | 'settings' | 'history';

export async function getRunnerState(): Promise<RunnerState> {
  const record = (await browser.storage.session.get([
    ACTIVE_SESSIONS_KEY,
    FOCUSED_ROUTINE_ID_KEY,
    LEGACY_ACTIVE_SESSION_KEY,
  ])) as SessionStorageRecord;

  const storedSessions = normalizeSessions(record[ACTIVE_SESSIONS_KEY]);
  const legacySession = normalizeLegacySession(record[LEGACY_ACTIVE_SESSION_KEY]);

  const sessions = storedSessions.length > 0
    ? storedSessions
    : legacySession
      ? [legacySession]
      : [];

  const focusedRoutineId = resolveFocusedRoutineId(sessions, record[FOCUSED_ROUTINE_ID_KEY]);

  const needsMigration = Boolean(legacySession) || !arraysEqualByRoutineId(storedSessions, sessions);
  const needsFocusedFix = record[FOCUSED_ROUTINE_ID_KEY] !== focusedRoutineId;

  if (needsMigration || needsFocusedFix) {
    await persistRunnerState({ sessions, focusedRoutineId });
    if (legacySession) {
      await browser.storage.session.remove(LEGACY_ACTIVE_SESSION_KEY);
    }
  }

  return {
    sessions,
    focusedRoutineId,
  };
}

export async function setRunnerState(state: RunnerState): Promise<void> {
  const sessions = normalizeSessions(state.sessions);
  const focusedRoutineId = resolveFocusedRoutineId(sessions, state.focusedRoutineId);

  await persistRunnerState({
    sessions,
    focusedRoutineId,
  });
}

export async function getRoutineSession(routineId: number): Promise<RoutineSession | null> {
  const state = await getRunnerState();
  return state.sessions.find((session) => session.routineId === routineId) ?? null;
}

export async function upsertRoutineSession(session: RoutineSession): Promise<void> {
  const state = await getRunnerState();
  const withoutRoutine = state.sessions.filter((existing) => existing.routineId !== session.routineId);

  await setRunnerState({
    sessions: [session, ...withoutRoutine],
    focusedRoutineId: session.routineId,
  });
}

export async function updateRoutineSession(session: RoutineSession): Promise<void> {
  const state = await getRunnerState();
  const sessions = state.sessions.map((existing) => (
    existing.routineId === session.routineId ? session : existing
  ));

  if (!sessions.some((existing) => existing.routineId === session.routineId)) {
    sessions.unshift(session);
  }

  await setRunnerState({
    sessions,
    focusedRoutineId: state.focusedRoutineId,
  });
}

export async function removeRoutineSession(routineId: number): Promise<boolean> {
  const state = await getRunnerState();
  const sessions = state.sessions.filter((session) => session.routineId !== routineId);

  if (sessions.length === state.sessions.length) {
    return false;
  }

  await setRunnerState({
    sessions,
    focusedRoutineId: state.focusedRoutineId,
  });

  if (sessions.length === 0) {
    await setFocusModeActive(false);
  }

  return true;
}

export async function clearAllRoutineSessions(): Promise<void> {
  await setRunnerState({
    sessions: [],
    focusedRoutineId: null,
  });

  await setFocusModeActive(false);
}

export async function setFocusedRoutine(routineId: number | null): Promise<void> {
  const state = await getRunnerState();

  await setRunnerState({
    sessions: state.sessions,
    focusedRoutineId: routineId,
  });
}

export async function handleRunnerGroupRemoved(groupId: number): Promise<void> {
  const state = await getRunnerState();
  const sessions = state.sessions.filter((session) => session.tabGroupId !== groupId);

  if (sessions.length === state.sessions.length) {
    return;
  }

  await setRunnerState({
    sessions,
    focusedRoutineId: state.focusedRoutineId,
  });

  if (sessions.length === 0) {
    await setFocusModeActive(false);
  }
}

export async function getFocusModeActive(): Promise<boolean> {
  const record = (await browser.storage.session.get(FOCUS_MODE_ACTIVE_KEY)) as SessionStorageRecord;
  return record[FOCUS_MODE_ACTIVE_KEY] ?? false;
}

export async function setFocusModeActive(active: boolean): Promise<void> {
  await browser.storage.session.set({
    [FOCUS_MODE_ACTIVE_KEY]: active,
  });
}

export function subscribeToFocusModeActive(callback: (active: boolean) => void): () => void {
  const listener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, areaName) => {
    if (areaName !== 'session' || !(FOCUS_MODE_ACTIVE_KEY in changes)) {
      return;
    }

    const nextValue = changes[FOCUS_MODE_ACTIVE_KEY]?.newValue;
    callback(typeof nextValue === 'boolean' ? nextValue : false);
  };

  browser.storage.onChanged.addListener(listener);

  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}

export async function setRequestedSidepanelView(view: SidepanelViewRequest | null): Promise<void> {
  if (view === null) {
    await browser.storage.session.remove(REQUESTED_SIDEPANEL_VIEW_KEY);
    return;
  }

  await browser.storage.session.set({
    [REQUESTED_SIDEPANEL_VIEW_KEY]: view,
  });
}

export async function consumeRequestedSidepanelView(): Promise<SidepanelViewRequest | null> {
  const record = (await browser.storage.session.get(REQUESTED_SIDEPANEL_VIEW_KEY)) as SessionStorageRecord;
  const raw = record[REQUESTED_SIDEPANEL_VIEW_KEY];

  if (!isSidepanelViewRequest(raw)) {
    await browser.storage.session.remove(REQUESTED_SIDEPANEL_VIEW_KEY);
    return null;
  }

  await browser.storage.session.remove(REQUESTED_SIDEPANEL_VIEW_KEY);
  return raw;
}

export function subscribeToRequestedSidepanelView(
  callback: (view: SidepanelViewRequest) => void,
): () => void {
  const listener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, areaName) => {
    if (areaName !== 'session' || !(REQUESTED_SIDEPANEL_VIEW_KEY in changes)) {
      return;
    }

    const next = changes[REQUESTED_SIDEPANEL_VIEW_KEY]?.newValue;
    if (!isSidepanelViewRequest(next)) {
      return;
    }

    callback(next);
    void browser.storage.session.remove(REQUESTED_SIDEPANEL_VIEW_KEY);
  };

  browser.storage.onChanged.addListener(listener);

  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}

export function subscribeToRunnerState(callback: (state: RunnerState) => void): () => void {
  const listener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (
    changes,
    areaName,
  ) => {
    if (areaName !== 'session') {
      return;
    }

    if (
      !(ACTIVE_SESSIONS_KEY in changes)
      && !(FOCUSED_ROUTINE_ID_KEY in changes)
      && !(LEGACY_ACTIVE_SESSION_KEY in changes)
    ) {
      return;
    }

    void getRunnerState().then(callback);
  };

  browser.storage.onChanged.addListener(listener);

  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}

// Compatibility layer for existing single-runner callsites.
export async function getActiveSession(): Promise<RoutineSession | null> {
  const state = await getRunnerState();
  return getFocusedSessionFromState(state.sessions, state.focusedRoutineId);
}

// Compatibility layer for existing single-runner callsites.
export async function setActiveSession(session: RoutineSession): Promise<void> {
  await upsertRoutineSession(session);
}

// Compatibility layer for existing single-runner callsites.
export async function clearActiveSession(): Promise<void> {
  const state = await getRunnerState();
  const focusedSession = getFocusedSessionFromState(state.sessions, state.focusedRoutineId);

  if (focusedSession) {
    await removeRoutineSession(focusedSession.routineId);
  }
}

// Compatibility layer for existing single-runner callsites.
export function subscribeToActiveSession(
  callback: (session: RoutineSession | null) => void,
): () => void {
  return subscribeToRunnerState((state) => {
    callback(getFocusedSessionFromState(state.sessions, state.focusedRoutineId));
  });
}

function normalizeSessions(value: RoutineSession[] | undefined): RoutineSession[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const byRoutineId = new Map<number, RoutineSession>();

  for (const session of value) {
    if (!isRoutineSession(session)) {
      continue;
    }

    byRoutineId.set(session.routineId, {
      ...session,
      mode: 'tab-group',
      loadMode: session.loadMode === 'lazy' ? 'lazy' : 'eager',
      tabIds: normalizeTabIds(session.tabIds),
    });
  }

  return [...byRoutineId.values()].sort((left, right) => right.startedAt - left.startedAt);
}

function normalizeLegacySession(value: RoutineSession | undefined): RoutineSession | null {
  if (!isRoutineSession(value)) {
    return null;
  }

  return {
    ...value,
    mode: 'tab-group',
    loadMode: value.loadMode === 'lazy' ? 'lazy' : 'eager',
    tabIds: normalizeTabIds(value.tabIds),
  };
}

function isRoutineSession(value: unknown): value is RoutineSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<RoutineSession>;

  return (
    typeof session.routineId === 'number'
    && (session.mode === 'tab-group' || session.mode === 'same-tab')
    && typeof session.currentIndex === 'number'
    && Array.isArray(session.tabIds)
    && typeof session.startedAt === 'number'
  );
}

function normalizeTabIds(tabIds: unknown): Array<number | null> {
  if (!Array.isArray(tabIds)) {
    return [];
  }

  return tabIds.map((id) => (typeof id === 'number' && id >= 0 ? id : null));
}

function arraysEqualByRoutineId(left: RoutineSession[], right: RoutineSession[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((session, index) => session.routineId === right[index]?.routineId);
}

async function persistRunnerState(state: RunnerState): Promise<void> {
  await browser.storage.session.set({
    [ACTIVE_SESSIONS_KEY]: state.sessions,
    [FOCUSED_ROUTINE_ID_KEY]: state.focusedRoutineId,
  });
}

function isSidepanelViewRequest(value: unknown): value is SidepanelViewRequest {
  return (
    value === 'runner'
    || value === 'routines'
    || value === 'editor'
    || value === 'settings'
    || value === 'history'
  );
}
