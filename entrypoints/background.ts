import { db } from '@/lib/db';
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
  updateRoutineSession,
} from '@/lib/session';
import { ensureRunForSession, finalizeRun, logStepChange } from '@/lib/run-history';

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

type FocusControllerMessage =
  | FocusControllerGetStateMessage
  | FocusControllerSetFocusModeMessage
  | FocusControllerNavigateMessage
  | FocusControllerStopMessage
  | FocusControllerOpenPanelMessage;

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
      const groupId = resolveGroupId(group);

      if (typeof groupId !== 'number') {
        return;
      }

      void handleRunnerGroupRemoved(groupId);
    });
  }

  if (browser.tabs?.onRemoved) {
    browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
      if (removeInfo?.isWindowClosing) {
        return;
      }

      void handleRunnerTabRemoved(tabId);
    });
  }

  if (browser.tabs?.onMoved) {
    browser.tabs.onMoved.addListener((tabId) => {
      void handleRunnerTabMoved(tabId);
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
    if (!session.tabIds.includes(tabId)) {
      continue;
    }

    const removedIndex = session.tabIds.indexOf(tabId);
    const nextTabIds = session.tabIds.map((id, index) => (
      index === removedIndex ? null : id
    ));
    const validTabIds = nextTabIds.filter(isValidTabId);

    if (validTabIds.length === 0) {
      await finalizeSessionRun(session, 'tabs-closed');
      await removeRoutineSession(session.routineId);
      continue;
    }

    let nextTabId = session.tabId;
    let nextIndex = session.currentIndex;

    if (session.tabId === tabId) {
      const forwardIndex = findNextValidIndex(nextTabIds, removedIndex + 1);
      const backwardIndex = findPreviousValidIndex(nextTabIds, removedIndex - 1);
      const resolvedIndex = forwardIndex ?? backwardIndex ?? 0;

      nextIndex = resolvedIndex;
      nextTabId = isValidTabId(nextTabIds[resolvedIndex]) ? nextTabIds[resolvedIndex] : null;
    }

    if (nextIndex !== session.currentIndex) {
      await logStepChangeForSession(session, nextIndex);
    }

    await updateRoutineSession({
      ...session,
      tabIds: nextTabIds,
      tabId: nextTabId,
      currentIndex: nextIndex >= 0 ? nextIndex : 0,
    });
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

    if (orderedIds.length === 0) {
      continue;
    }

    const loadedIds = session.tabIds.filter(isValidTabId);
    if (arraysEqual(orderedIds, loadedIds)) {
      continue;
    }

    const activeIndex = typeof session.tabId === 'number'
      ? orderedIds.indexOf(session.tabId)
      : 0;
    const nextIndex = activeIndex >= 0 ? activeIndex : 0;
    const nextTabId = typeof session.tabId === 'number' && activeIndex >= 0
      ? session.tabId
      : orderedIds[0] ?? null;

    await updateRoutineSession({
      ...session,
      tabIds: orderedIds,
      currentIndex: nextIndex,
      tabId: nextTabId,
    });
  }
}

function isValidTabId(id: number | null | undefined): id is number {
  return typeof id === 'number' && id >= 0;
}

function arraysEqual(left: number[], right: number[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
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

async function finalizeSessionRun(session: Parameters<typeof updateRoutineSession>[0], reason: 'tabs-closed' | 'group-removed') {
  if (typeof session.runId === 'number') {
    await finalizeRun(session.runId, session.routineId, Date.now(), reason);
    return;
  }

  const routine = await db.routines.get(session.routineId);
  if (!routine) {
    return;
  }

  const ensured = await ensureRunForSession(session, routine);
  if (ensured?.runId) {
    await finalizeRun(ensured.runId, session.routineId, Date.now(), reason);
  }
}

async function logStepChangeForSession(session: Parameters<typeof updateRoutineSession>[0], stepIndex: number) {
  if (typeof session.runId === 'number') {
    await logStepChange(session.runId, session.routineId, stepIndex);
    return;
  }

  const routine = await db.routines.get(session.routineId);
  if (!routine) {
    return;
  }

  const ensured = await ensureRunForSession(session, routine);
  if (ensured?.runId) {
    await updateRoutineSession({ ...session, runId: ensured.runId });
    await logStepChange(ensured.runId, session.routineId, stepIndex);
  }
}

function findNextValidIndex(values: Array<number | null>, startIndex: number): number | null {
  for (let index = startIndex; index < values.length; index += 1) {
    if (isValidTabId(values[index])) {
      return index;
    }
  }

  return null;
}

function findPreviousValidIndex(values: Array<number | null>, startIndex: number): number | null {
  for (let index = startIndex; index >= 0; index -= 1) {
    if (isValidTabId(values[index])) {
      return index;
    }
  }

  return null;
}

function attachControllerMessageBridge() {
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isFocusControllerMessage(message)) {
      return undefined;
    }

    void handleFocusControllerMessage(message, _sender).then(sendResponse);
    return true;
  });
}

async function handleFocusControllerMessage(
  message: FocusControllerMessage,
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
          await navigateSessionByOffset(message.routineId, message.offset);
        } else {
          await navigateSessionByOffset(message.offset);
        }

        return {
          ok: true,
          state: await getFocusControllerState(),
        };

      case 'focus-controller:stop':
        if (typeof message.routineId === 'number') {
          await stopActiveRoutine(message.routineId);
        } else {
          await stopActiveRoutine();
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
  const focusedSession = resolveFocusedSession(runnerState.sessions, runnerState.focusedRoutineId);

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

function resolveFocusedSession(
  sessions: Awaited<ReturnType<typeof getRunnerState>>['sessions'],
  focusedRoutineId: number | null,
) {
  if (sessions.length === 0) {
    return null;
  }

  if (typeof focusedRoutineId === 'number') {
    const focused = sessions.find((session) => session.routineId === focusedRoutineId);
    if (focused) {
      return focused;
    }
  }

  return sessions[0] ?? null;
}

function isFocusControllerMessage(value: unknown): value is FocusControllerMessage {
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
  );
}

function toErrorMessage(value: unknown): string {
  if (value instanceof Error && value.message) {
    return value.message;
  }

  return 'Unexpected controller bridge error.';
}

export default defineBackground(() => {
  void configureSidePanelAction();
  attachRunnerLifecycleListeners();
  attachControllerMessageBridge();

  browser.runtime.onInstalled.addListener(() => {
    void configureSidePanelAction();
  });
});
