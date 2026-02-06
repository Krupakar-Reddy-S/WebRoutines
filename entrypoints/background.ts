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
  handleRunnerGroupRemoved,
  setFocusModeActive,
} from '@/lib/session';

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
  if (!browser.tabGroups?.onRemoved) {
    return;
  }

  browser.tabGroups.onRemoved.addListener((group) => {
    const groupId = resolveGroupId(group);

    if (typeof groupId !== 'number') {
      return;
    }

    void handleRunnerGroupRemoved(groupId);
  });
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
