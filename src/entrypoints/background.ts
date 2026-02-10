import Dexie from 'dexie';

import { db } from '@/lib/db';
import {
  applySessionTabRemoval,
  isValidTabId,
  reconcileEagerTabOrder,
} from '@/core/runner/lifecycle';
import { getFocusedSession as getFocusedSessionFromState } from '@/core/runner/focus';
import {
  NAVIGATE_NEXT_COMMAND,
  NAVIGATE_PREVIOUS_COMMAND,
} from '@/lib/navigation-shortcuts';
import {
  navigateSessionByOffset,
  openSidePanelForCurrentWindow,
  openSidePanelForTab,
  stopActiveRoutine,
} from '@/lib/navigation';
import {
  getFocusModeActive,
  getRunnerState,
  removeRoutineSession,
  setFocusModeActive,
  setFocusedRoutine,
  updateRoutineSession,
} from '@/lib/session';
import {
  addRunStepActiveMs,
  ensureRunForSession,
  finalizeRun,
  logRunStepSyncAction,
} from '@/lib/run-history';
import type { RoutineSession } from '@/lib/types';

interface FocusControllerGetStateMessage {
  type: 'focus-controller:get-state';
}

interface FocusControllerSetFocusModeMessage {
  type: 'focus-controller:set-focus-mode';
  active: boolean;
}

interface FocusControllerNavigateMessage {
  type: 'focus-controller:navigate';
  offset: number;
  routineId?: number;
}

interface FocusControllerStopMessage {
  type: 'focus-controller:stop';
  routineId?: number;
}

interface FocusControllerOpenPanelMessage {
  type: 'focus-controller:open-sidepanel';
}

interface RunnerFlushActiveTimeMessage {
  type: 'runner:flush-active-time';
  routineId?: number;
}

type RuntimeMessage =
  | FocusControllerGetStateMessage
  | FocusControllerSetFocusModeMessage
  | FocusControllerNavigateMessage
  | FocusControllerStopMessage
  | FocusControllerOpenPanelMessage
  | RunnerFlushActiveTimeMessage;

interface ActiveStepTimer {
  windowId: number;
  routineId: number;
  runId: number;
  stepIndex: number;
  startedAt: number;
}

const activeStepTimersByWindow = new Map<number, ActiveStepTimer>();

async function configureSidePanelAction() {
  if (!browser.sidePanel?.setPanelBehavior) {
    return;
  }

  await browser.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true,
  });
}

function attachRunnerLifecycleListeners() {
  if (browser.tabGroups?.onRemoved) {
    browser.tabGroups.onRemoved.addListener((group) => {
      runGuarded('tabGroups.onRemoved', async () => {
        const groupId = resolveGroupId(group);

        if (typeof groupId !== 'number') {
          return;
        }

        await handleRunnerGroupRemoved(groupId);
      });
    });
  }

  if (browser.tabs?.onRemoved) {
    browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
      runGuarded('tabs.onRemoved', async () => {
        if (removeInfo?.isWindowClosing) {
          return;
        }

        await handleRunnerTabRemoved(tabId);
      });
    });
  }

  if (browser.tabs?.onMoved) {
    browser.tabs.onMoved.addListener((tabId) => {
      runGuarded('tabs.onMoved', async () => {
        await handleRunnerTabMoved(tabId);
      });
    });
  }

  if (browser.tabs?.onActivated) {
    browser.tabs.onActivated.addListener((activeInfo) => {
      runGuarded('tabs.onActivated', async () => {
        await handleRunnerTabActivated(activeInfo.tabId, activeInfo.windowId);
      });
    });
  }

  if (browser.windows?.onFocusChanged) {
    browser.windows.onFocusChanged.addListener((windowId) => {
      runGuarded('windows.onFocusChanged', async () => {
        await handleWindowFocusChanged(windowId);
      });
    });
  }
}

function resolveGroupId(group: unknown): number | null {
  if (typeof group === 'number') {
    return group;
  }

  if (!group || typeof group !== 'object') {
    return null;
  }

  const candidate = group as { id?: unknown };

  return typeof candidate.id === 'number' ? candidate.id : null;
}

async function handleRunnerTabRemoved(tabId: number) {
  if (typeof tabId !== 'number') {
    return;
  }

  const state = await getRunnerState();

  for (const session of state.sessions) {
    const transition = applySessionTabRemoval(session, tabId);

    if (!transition.affected) {
      continue;
    }

    if (transition.shouldStop) {
      await finalizeSessionRun(session, 'tabs-closed');
      await removeRoutineSession(session.routineId);
      continue;
    }

    if (!transition.nextSession) {
      continue;
    }

    if (transition.nextIndexChanged) {
      await logStepChangeForSession(session, transition.nextIndex, 'tab-removed-shift');
    }

    await updateRoutineSession(transition.nextSession);
  }
}

async function handleRunnerTabMoved(tabId: number) {
  if (typeof tabId !== 'number') {
    return;
  }

  const state = await getRunnerState();

  for (const session of state.sessions) {
    if (!session.tabIds.includes(tabId)) {
      continue;
    }

    if (typeof session.tabGroupId !== 'number') {
      continue;
    }

    if (session.loadMode === 'lazy') {
      continue;
    }

    const groupTabs = await browser.tabs.query({ groupId: session.tabGroupId });
    if (groupTabs.length === 0) {
      continue;
    }

    const orderedIds = groupTabs
      .map((tab) => ({ id: tab.id, index: tab.index }))
      .filter((tab) => typeof tab.id === 'number')
      .sort((left, right) => left.index - right.index)
      .map((tab) => tab.id as number);

    const reconciliation = reconcileEagerTabOrder(session, orderedIds);
    if (!reconciliation.changed) {
      continue;
    }

    await updateRoutineSession(reconciliation.nextSession);
  }
}

async function handleRunnerTabActivated(tabId: number, windowId: number) {
  if (typeof tabId !== 'number' || typeof windowId !== 'number') {
    return;
  }

  const now = Date.now();
  await flushActiveTimerForWindow(windowId, now);

  const state = await getRunnerState();
  const session = state.sessions.find((item) => item.tabIds.includes(tabId));
  if (!session) {
    return;
  }

  const matchedIndex = session.tabIds.findIndex((id) => id === tabId);
  if (matchedIndex < 0) {
    return;
  }

  let nextSession: RoutineSession = session;

  if (matchedIndex !== session.currentIndex) {
    const shouldSuppressSync = await isRecentNavigateToStep(session, matchedIndex, now);
    await logStepChangeForSession(
      session,
      matchedIndex,
      shouldSuppressSync ? undefined : 'manual-tab-activate',
    );

    nextSession = {
      ...session,
      currentIndex: matchedIndex,
      tabId,
    };
    await updateRoutineSession(nextSession);
  } else if (session.tabId !== tabId) {
    nextSession = {
      ...session,
      tabId,
    };
    await updateRoutineSession(nextSession);
  }

  await setFocusedRoutine(nextSession.routineId);

  const runId = await ensureRunIdForSession(nextSession);
  if (typeof runId !== 'number') {
    return;
  }

  startActiveTimer({
    windowId,
    routineId: nextSession.routineId,
    runId,
    stepIndex: nextSession.currentIndex,
    startedAt: now,
  });
}

async function handleWindowFocusChanged(windowId: number) {
  if (typeof windowId !== 'number') {
    return;
  }

  if (windowId === browser.windows.WINDOW_ID_NONE) {
    await flushAllActiveTimers(Date.now());
    return;
  }

  await flushAllActiveTimers(Date.now());
  const [activeTab] = await browser.tabs.query({ active: true, windowId });
  if (typeof activeTab?.id !== 'number') {
    return;
  }

  await handleRunnerTabActivated(activeTab.id, windowId);
}

async function handleRunnerGroupRemoved(groupId: number) {
  const state = await getRunnerState();
  const affected = state.sessions.filter((session) => session.tabGroupId === groupId);

  if (affected.length === 0) {
    return;
  }

  for (const session of affected) {
    await finalizeSessionRun(session, 'group-removed');
    await removeRoutineSession(session.routineId);
  }
}

function startActiveTimer(timer: ActiveStepTimer) {
  activeStepTimersByWindow.set(timer.windowId, timer);
}

async function flushActiveTimerForWindow(windowId: number, stoppedAt: number = Date.now()) {
  const timer = activeStepTimersByWindow.get(windowId);
  if (!timer) {
    return;
  }

  activeStepTimersByWindow.delete(windowId);
  const activeMs = Math.max(0, stoppedAt - timer.startedAt);
  if (activeMs <= 0) {
    return;
  }

  await addRunStepActiveMs(timer.runId, timer.stepIndex, activeMs);
}

async function flushAllActiveTimers(stoppedAt: number = Date.now()) {
  const windowIds = [...activeStepTimersByWindow.keys()];
  for (const windowId of windowIds) {
    await flushActiveTimerForWindow(windowId, stoppedAt);
  }
}

async function flushActiveTimersForRoutine(routineId: number, stoppedAt: number = Date.now()) {
  const windowIds = [...activeStepTimersByWindow.entries()]
    .filter(([, timer]) => timer.routineId === routineId)
    .map(([windowId]) => windowId);

  for (const windowId of windowIds) {
    await flushActiveTimerForWindow(windowId, stoppedAt);
  }
}

async function ensureRunIdForSession(session: RoutineSession): Promise<number | null> {
  if (typeof session.runId === 'number') {
    return session.runId;
  }

  const routine = await db.routines.get(session.routineId);
  if (!routine) {
    return null;
  }

  const ensured = await ensureRunForSession(session, routine, 'system');
  if (!ensured?.runId) {
    return null;
  }

  await updateRoutineSession({
    ...session,
    runId: ensured.runId,
  });

  return ensured.runId;
}

async function isRecentNavigateToStep(session: RoutineSession, stepIndex: number, now: number): Promise<boolean> {
  if (typeof session.runId !== 'number') {
    return false;
  }

  const latest = await db.runActionEvents
    .where('[runId+timestamp]')
    .between([session.runId, Dexie.minKey], [session.runId, Dexie.maxKey])
    .reverse()
    .first();

  if (!latest) {
    return false;
  }

  return latest.type === 'navigate'
    && latest.toStepIndex === stepIndex
    && Math.max(0, now - latest.timestamp) <= 1200;
}

async function finalizeSessionRun(session: Parameters<typeof updateRoutineSession>[0], reason: 'tabs-closed' | 'group-removed') {
  await flushActiveTimersForRoutine(session.routineId, Date.now());

  if (typeof session.runId === 'number') {
    await finalizeRun(session.runId, session.routineId, Date.now(), reason, 'system');
    return;
  }

  const routine = await db.routines.get(session.routineId);
  if (!routine) {
    return;
  }

  const ensured = await ensureRunForSession(session, routine, 'system');
  if (ensured?.runId) {
    await finalizeRun(ensured.runId, session.routineId, Date.now(), reason, 'system');
  }
}

async function logStepChangeForSession(
  session: Parameters<typeof updateRoutineSession>[0],
  stepIndex: number,
  action?: 'tab-removed-shift' | 'manual-tab-activate',
) {
  if (!action) {
    return;
  }

  const fromStepIndex = session.currentIndex;

  if (typeof session.runId === 'number') {
    await logRunStepSyncAction({
      runId: session.runId,
      routineId: session.routineId,
      source: 'system',
      action,
      fromStepIndex,
      toStepIndex: stepIndex,
    });
    return;
  }

  const routine = await db.routines.get(session.routineId);
  if (!routine) {
    return;
  }

  const ensured = await ensureRunForSession(session, routine, 'system');
  if (ensured?.runId) {
    await updateRoutineSession({ ...session, runId: ensured.runId });
    await logRunStepSyncAction({
      runId: ensured.runId,
      routineId: session.routineId,
      source: 'system',
      action,
      fromStepIndex,
      toStepIndex: stepIndex,
    });
  }
}

function attachControllerMessageBridge() {
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isRuntimeMessage(message)) {
      return undefined;
    }

    runGuarded('runtime.onMessage', async () => {
      const response = await handleRuntimeMessage(message, _sender);
      sendResponse(response);
    }, (error) => {
      sendResponse({
        ok: false,
        error: toErrorMessage(error),
      });
    });

    return true;
  });
}

function attachCommandListeners() {
  if (!browser.commands?.onCommand) {
    return;
  }

  browser.commands.onCommand.addListener((command) => {
    runGuarded('commands.onCommand', async () => {
      await handleCommand(command);
    });
  });
}

async function handleCommand(command: string) {
  if (command === NAVIGATE_PREVIOUS_COMMAND) {
    await navigateSessionByOffset(-1, undefined, 'background');
    return;
  }

  if (command === NAVIGATE_NEXT_COMMAND) {
    await navigateSessionByOffset(1, undefined, 'background');
  }
}

async function handleRuntimeMessage(
  message: RuntimeMessage,
  sender?: { tab?: { id?: number } },
): Promise<unknown> {
  try {
    switch (message.type) {
      case 'focus-controller:get-state':
        return {
          ok: true,
          state: await getFocusControllerState(),
        };

      case 'focus-controller:set-focus-mode':
        await setFocusModeActive(Boolean(message.active));
        return {
          ok: true,
          state: await getFocusControllerState(),
        };

      case 'focus-controller:navigate':
        if (typeof message.offset !== 'number') {
          throw new Error('Invalid offset for navigation action.');
        }

        if (typeof message.routineId === 'number') {
          await navigateSessionByOffset(message.routineId, message.offset, 'focus-controller');
        } else {
          await navigateSessionByOffset(message.offset, undefined, 'focus-controller');
        }

        return {
          ok: true,
          state: await getFocusControllerState(),
        };

      case 'focus-controller:stop':
        if (typeof message.routineId === 'number') {
          await stopActiveRoutine(message.routineId, 'focus-controller');
        } else {
          await stopActiveRoutine(undefined, 'focus-controller');
        }

        if ((await getRunnerState()).sessions.length === 0) {
          await setFocusModeActive(false);
        }

        return {
          ok: true,
          state: await getFocusControllerState(),
        };

      case 'focus-controller:open-sidepanel':
        if (typeof sender?.tab?.id === 'number') {
          const openedForTab = await openSidePanelForTab(sender.tab.id);
          if (!openedForTab && !(await openSidePanelForCurrentWindow())) {
            throw new Error('Unable to open sidepanel for the current tab/window.');
          }
        } else if (!(await openSidePanelForCurrentWindow())) {
          throw new Error('Unable to open sidepanel for an active window.');
        }

        await setFocusModeActive(false);
        return {
          ok: true,
          state: await getFocusControllerState(),
        };

      case 'runner:flush-active-time':
        if (typeof message.routineId === 'number') {
          await flushActiveTimersForRoutine(message.routineId);
        } else {
          await flushAllActiveTimers();
        }

        return {
          ok: true,
        };
    }
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    };
  }
}

async function getFocusControllerState() {
  const [runnerState, focusModeActive] = await Promise.all([getRunnerState(), getFocusModeActive()]);
  const focusedSession = getFocusedSessionFromState(
    runnerState.sessions,
    runnerState.focusedRoutineId,
  );

  if (!focusedSession) {
    return {
      focusModeActive,
      runnerState,
      focusedSession: null,
      focusedRoutine: null,
    };
  }

  const routine = await db.routines.get(focusedSession.routineId);
  const currentLink = routine?.links[focusedSession.currentIndex] ?? null;

  return {
    focusModeActive,
    runnerState,
    focusedSession,
    focusedRoutine: routine
      ? {
        id: routine.id,
        name: routine.name,
        linksCount: routine.links.length,
        currentUrl: currentLink?.url ?? null,
      }
      : null,
  };
}

function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { type?: unknown };

  return (
    candidate.type === 'focus-controller:get-state'
    || candidate.type === 'focus-controller:set-focus-mode'
    || candidate.type === 'focus-controller:navigate'
    || candidate.type === 'focus-controller:stop'
    || candidate.type === 'focus-controller:open-sidepanel'
    || candidate.type === 'runner:flush-active-time'
  );
}

function toErrorMessage(value: unknown): string {
  if (value instanceof Error && value.message) {
    return value.message;
  }

  return 'Unexpected controller bridge error.';
}

function runGuarded(label: string, task: () => Promise<void>, onError?: (error: unknown) => void) {
  void task().catch((error) => {
    console.error(`[WebRoutines][background] ${label} failed:`, error);
    onError?.(error);
  });
}

export default defineBackground(() => {
  runGuarded('configureSidePanelAction:init', async () => {
    await configureSidePanelAction();
  });
  attachRunnerLifecycleListeners();
  attachControllerMessageBridge();
  attachCommandListeners();

  browser.runtime.onInstalled.addListener(() => {
    runGuarded('runtime.onInstalled', async () => {
      await configureSidePanelAction();
    });
  });
});
