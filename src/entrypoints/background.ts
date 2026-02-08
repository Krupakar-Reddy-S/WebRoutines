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
      await logStepChangeForSession(session, transition.nextIndex);
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

function attachControllerMessageBridge() {
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isFocusControllerMessage(message)) {
      return undefined;
    }

    runGuarded('runtime.onMessage', async () => {
      const response = await handleFocusControllerMessage(message, _sender);
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
    await navigateSessionByOffset(-1);
    return;
  }

  if (command === NAVIGATE_NEXT_COMMAND) {
    await navigateSessionByOffset(1);
  }
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
