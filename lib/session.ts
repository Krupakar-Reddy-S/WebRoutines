import type { RoutineSession } from '@/lib/types';

const ACTIVE_SESSION_KEY = 'activeSession';

interface SessionStorageRecord {
  [ACTIVE_SESSION_KEY]?: RoutineSession;
}

export async function getActiveSession(): Promise<RoutineSession | null> {
  const result = (await browser.storage.session.get(ACTIVE_SESSION_KEY)) as SessionStorageRecord;
  return result[ACTIVE_SESSION_KEY] ?? null;
}

export async function setActiveSession(session: RoutineSession): Promise<void> {
  await browser.storage.session.set({
    [ACTIVE_SESSION_KEY]: session,
  });
}

export async function clearActiveSession(): Promise<void> {
  await browser.storage.session.remove(ACTIVE_SESSION_KEY);
}

export function subscribeToActiveSession(
  callback: (session: RoutineSession | null) => void,
): () => void {
  const listener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (
    changes,
    areaName,
  ) => {
    if (areaName !== 'session' || !(ACTIVE_SESSION_KEY in changes)) {
      return;
    }

    callback((changes[ACTIVE_SESSION_KEY].newValue as RoutineSession | undefined) ?? null);
  };

  browser.storage.onChanged.addListener(listener);

  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}
