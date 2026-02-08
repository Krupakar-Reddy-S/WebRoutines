import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  consumeRequestedSidepanelView,
  getRunnerState,
  removeRoutineSession,
  setRequestedSidepanelView,
} from '@/lib/session';

type ChangeRecord = Record<string, { oldValue: unknown; newValue: unknown }>;

function createStorageArea(
  areaName: 'session' | 'local',
  state: Record<string, unknown>,
  listeners: Set<(changes: ChangeRecord, areaName: 'session' | 'local') => void>,
) {
  return {
    get: vi.fn(async (keys?: string | string[] | Record<string, unknown>) => {
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((key) => [key, state[key]]));
      }

      if (typeof keys === 'string') {
        return { [keys]: state[keys] };
      }

      if (keys && typeof keys === 'object') {
        const entries = Object.entries(keys).map(([key, fallback]) => [key, state[key] ?? fallback]);
        return Object.fromEntries(entries);
      }

      return { ...state };
    }),
    set: vi.fn(async (patch: Record<string, unknown>) => {
      const changes: ChangeRecord = {};

      for (const [key, nextValue] of Object.entries(patch)) {
        const oldValue = state[key];
        state[key] = nextValue;
        changes[key] = { oldValue, newValue: nextValue };
      }

      if (Object.keys(changes).length > 0) {
        listeners.forEach((listener) => listener(changes, areaName));
      }
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const toRemove = Array.isArray(keys) ? keys : [keys];
      const changes: ChangeRecord = {};

      for (const key of toRemove) {
        if (!(key in state)) {
          continue;
        }

        const oldValue = state[key];
        delete state[key];
        changes[key] = { oldValue, newValue: undefined };
      }

      if (Object.keys(changes).length > 0) {
        listeners.forEach((listener) => listener(changes, areaName));
      }
    }),
  };
}

function installBrowserStorageMock(initialSessionState: Record<string, unknown> = {}) {
  const listeners = new Set<(changes: ChangeRecord, areaName: 'session' | 'local') => void>();
  const sessionState: Record<string, unknown> = { ...initialSessionState };
  const localState: Record<string, unknown> = {};
  const sessionArea = createStorageArea('session', sessionState, listeners);
  const localArea = createStorageArea('local', localState, listeners);

  vi.stubGlobal('browser', {
    storage: {
      session: sessionArea,
      local: localArea,
      onChanged: {
        addListener: vi.fn((listener) => {
          listeners.add(listener);
        }),
        removeListener: vi.fn((listener) => {
          listeners.delete(listener);
        }),
      },
    },
  });

  return { sessionState, sessionArea };
}

describe('session state behavior', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('migrates legacy activeSession into activeSessions and removes legacy key', async () => {
    const { sessionState, sessionArea } = installBrowserStorageMock({
      activeSession: {
        routineId: 42,
        mode: 'same-tab',
        loadMode: 'invalid',
        currentIndex: 0,
        tabId: 101,
        tabGroupId: 9,
        tabIds: [101, -1, 'bad'],
        startedAt: 1000,
      },
    });

    const state = await getRunnerState();

    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].routineId).toBe(42);
    expect(state.sessions[0].mode).toBe('tab-group');
    expect(state.sessions[0].loadMode).toBe('eager');
    expect(state.sessions[0].tabIds).toEqual([101, null, null]);
    expect(sessionArea.remove).toHaveBeenCalledWith('activeSession');
    expect(sessionState.activeSession).toBeUndefined();
  });

  it('normalizes invalid focused routine id to first available session', async () => {
    installBrowserStorageMock({
      activeSessions: [
        {
          routineId: 1,
          mode: 'tab-group',
          loadMode: 'eager',
          currentIndex: 0,
          tabId: 11,
          tabGroupId: 2,
          tabIds: [11],
          startedAt: 1000,
        },
        {
          routineId: 2,
          mode: 'tab-group',
          loadMode: 'lazy',
          currentIndex: 0,
          tabId: 22,
          tabGroupId: 3,
          tabIds: [22],
          startedAt: 2000,
        },
      ],
      focusedRoutineId: 999,
    });

    const state = await getRunnerState();
    expect(state.focusedRoutineId).toBe(2);
  });

  it('turns off focus mode when removing the final routine session', async () => {
    const { sessionState } = installBrowserStorageMock({
      activeSessions: [
        {
          routineId: 7,
          mode: 'tab-group',
          loadMode: 'eager',
          currentIndex: 0,
          tabId: 70,
          tabGroupId: 1,
          tabIds: [70],
          startedAt: 1000,
        },
      ],
      focusedRoutineId: 7,
      focusModeActive: true,
    });

    const removed = await removeRoutineSession(7);

    expect(removed).toBe(true);
    expect(sessionState.activeSessions).toEqual([]);
    expect(sessionState.focusedRoutineId).toBeNull();
    expect(sessionState.focusModeActive).toBe(false);
  });

  it('sets and consumes requested sidepanel view, clearing key afterwards', async () => {
    const { sessionState } = installBrowserStorageMock();

    await setRequestedSidepanelView('settings');
    expect(sessionState.requestedSidepanelView).toBe('settings');

    const consumed = await consumeRequestedSidepanelView();
    expect(consumed).toBe('settings');
    expect(sessionState.requestedSidepanelView).toBeUndefined();
  });

  it('removes invalid requested sidepanel view payloads on consume', async () => {
    const { sessionState } = installBrowserStorageMock({
      requestedSidepanelView: 'invalid-view',
    });

    const consumed = await consumeRequestedSidepanelView();
    expect(consumed).toBeNull();
    expect(sessionState.requestedSidepanelView).toBeUndefined();
  });
});
