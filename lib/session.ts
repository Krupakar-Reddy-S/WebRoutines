import type { RoutineSession } from '@/lib/types';

const ACTIVE_SESSIONS_KEY = 'activeSessions';
const FOCUSED_ROUTINE_ID_KEY = 'focusedRoutineId';
const LEGACY_ACTIVE_SESSION_KEY = 'activeSession';

interface SessionStorageRecord {
  [ACTIVE_SESSIONS_KEY]?: RoutineSession[];
  [FOCUSED_ROUTINE_ID_KEY]?: number;
  [LEGACY_ACTIVE_SESSION_KEY]?: RoutineSession;
}

export interface RunnerState {
  sessions: RoutineSession[];
  focusedRoutineId: number | null;
}

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

  return true;
}

export async function clearAllRoutineSessions(): Promise<void> {
  await setRunnerState({
    sessions: [],
    focusedRoutineId: null,
  });
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
  return getFocusedSession(state);
}

// Compatibility layer for existing single-runner callsites.
export async function setActiveSession(session: RoutineSession): Promise<void> {
  await upsertRoutineSession(session);
}

// Compatibility layer for existing single-runner callsites.
export async function clearActiveSession(): Promise<void> {
  const state = await getRunnerState();
  const focusedSession = getFocusedSession(state);

  if (focusedSession) {
    await removeRoutineSession(focusedSession.routineId);
  }
}

// Compatibility layer for existing single-runner callsites.
export function subscribeToActiveSession(
  callback: (session: RoutineSession | null) => void,
): () => void {
  return subscribeToRunnerState((state) => {
    callback(getFocusedSession(state));
  });
}

function getFocusedSession(state: RunnerState): RoutineSession | null {
  if (state.sessions.length === 0) {
    return null;
  }

  if (typeof state.focusedRoutineId === 'number') {
    const focused = state.sessions.find((session) => session.routineId === state.focusedRoutineId);
    if (focused) {
      return focused;
    }
  }

  return state.sessions[0] ?? null;
}

function resolveFocusedRoutineId(
  sessions: RoutineSession[],
  focusedRoutineId: number | null | undefined,
): number | null {
  if (sessions.length === 0) {
    return null;
  }

  if (
    typeof focusedRoutineId === 'number'
    && sessions.some((session) => session.routineId === focusedRoutineId)
  ) {
    return focusedRoutineId;
  }

  return sessions[0].routineId;
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
      tabIds: Array.isArray(session.tabIds) ? session.tabIds.filter((id) => typeof id === 'number') : [],
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
    tabIds: Array.isArray(value.tabIds) ? value.tabIds.filter((id) => typeof id === 'number') : [],
  };
}

function isRoutineSession(value: unknown): value is RoutineSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<RoutineSession>;

  return (
    typeof session.routineId === 'number'
    && typeof session.mode === 'string'
    && typeof session.currentIndex === 'number'
    && Array.isArray(session.tabIds)
    && typeof session.startedAt === 'number'
  );
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
