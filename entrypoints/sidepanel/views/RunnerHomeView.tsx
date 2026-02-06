import { useLiveQuery } from 'dexie-react-hooks';
import { SettingsIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { db } from '@/lib/db';
import {
  navigateSessionByOffset,
  navigateToIndex,
  openCurrentSessionLink,
  stopActiveRoutine,
} from '@/lib/navigation';
import { setSettingsPatch } from '@/lib/settings';
import {
  getRunnerState,
  setFocusModeActive,
  setFocusedRoutine,
  subscribeToRunnerState,
} from '@/lib/session';
import { useSettings } from '@/lib/use-settings';
import type { Routine, RoutineSession } from '@/lib/types';

import { ActiveRunnerCard } from '../components/ActiveRunnerCard';
import { EmptyState } from '../components/EmptyState';
import { StepList } from '../components/StepList';

interface RunnerState {
  sessions: RoutineSession[];
  focusedRoutineId: number | null;
}

interface RunnerHomeViewProps {
  onOpenRoutines: () => void;
  onOpenSettings: () => void;
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
}

export function RunnerHomeView({
  onOpenRoutines,
  onOpenSettings,
  onMessage,
  onError,
}: RunnerHomeViewProps) {
  const { settings } = useSettings();
  const [runnerState, setRunnerState] = useState<RunnerState>({ sessions: [], focusedRoutineId: null });
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  const focusedSession = useMemo(() => {
    if (runnerState.sessions.length === 0) {
      return null;
    }

    if (typeof runnerState.focusedRoutineId === 'number') {
      const focused = runnerState.sessions.find((session) => session.routineId === runnerState.focusedRoutineId);
      if (focused) {
        return focused;
      }
    }

    return runnerState.sessions[0] ?? null;
  }, [runnerState.focusedRoutineId, runnerState.sessions]);

  const activeRunnerRowsKey = useMemo(
    () => runnerState.sessions.map((session) => `${session.routineId}:${session.currentIndex}:${session.loadMode}`).join('|'),
    [runnerState.sessions],
  );

  const activeRunnerRows = useLiveQuery(
    async () => {
      if (runnerState.sessions.length === 0) {
        return [] as Array<{ session: RoutineSession; routine: Routine | null }>;
      }

      const routineIds = runnerState.sessions.map((session) => session.routineId);
      const loaded = await db.routines.bulkGet(routineIds);

      return runnerState.sessions.map((session, index) => ({
        session,
        routine: loaded[index] ?? null,
      }));
    },
    [activeRunnerRowsKey],
  );

  const focusedRoutine = useLiveQuery(
    async () => {
      if (!focusedSession) {
        return null;
      }

      return (await db.routines.get(focusedSession.routineId)) ?? null;
    },
    [focusedSession?.routineId],
  );

  const currentLink = useMemo(() => {
    if (!focusedSession || !focusedRoutine) {
      return null;
    }

    return focusedRoutine.links[focusedSession.currentIndex] ?? null;
  }, [focusedRoutine, focusedSession]);

  useEffect(() => {
    void getRunnerState().then(setRunnerState);
    const unsubscribe = subscribeToRunnerState(setRunnerState);

    return unsubscribe;
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 60_000);

    return () => window.clearInterval(timerId);
  }, []);

  async function onFocusRoutineRunner(routineId: number) {
    await setFocusedRoutine(routineId);
  }

  async function onNavigateOffset(offset: number, routineId?: number) {
    const targetRoutineId = routineId ?? focusedSession?.routineId;

    if (typeof targetRoutineId !== 'number') {
      onError('No active routine to navigate.');
      return;
    }

    setBusyAction(offset > 0 ? `next-${targetRoutineId}` : `previous-${targetRoutineId}`);
    onError(null);
    onMessage(null);

    try {
      const updated = await navigateSessionByOffset(targetRoutineId, offset);
      if (!updated) {
        onError('No active routine to navigate.');
        return;
      }

      onMessage(offset > 0 ? 'Moved to next link.' : 'Moved to previous link.');
    } catch (navigationError) {
      onError(toErrorMessage(navigationError, 'Failed to navigate routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onJumpToIndex(index: number) {
    if (!focusedRoutine || !focusedSession) {
      return;
    }

    setBusyAction(`jump-${focusedSession.routineId}-${index}`);
    onError(null);
    onMessage(null);

    try {
      await navigateToIndex(focusedRoutine, focusedSession, index);
      onMessage(`Jumped to step ${index + 1}.`);
    } catch (jumpError) {
      onError(toErrorMessage(jumpError, 'Failed to jump to step.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onOpenCurrent(routineId?: number) {
    const targetRoutineId = routineId ?? focusedSession?.routineId;

    if (typeof targetRoutineId !== 'number') {
      onError('No active routine to open.');
      return;
    }

    setBusyAction(`open-current-${targetRoutineId}`);
    onError(null);
    onMessage(null);

    try {
      const updated = await openCurrentSessionLink(targetRoutineId);
      if (!updated) {
        onError('No active routine to open.');
        return;
      }

      onMessage('Opened current link.');
    } catch (openError) {
      onError(toErrorMessage(openError, 'Failed to open current link.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onStopRoutine(routineId?: number) {
    const targetRoutineId = routineId ?? focusedSession?.routineId;

    if (typeof targetRoutineId !== 'number') {
      onError('No active routine to stop.');
      return;
    }

    if (settings.confirmBeforeStop) {
      const shouldStop = window.confirm('Stop this runner and close its runner tabs?');
      if (!shouldStop) {
        return;
      }
    }

    setBusyAction(`stop-${targetRoutineId}`);
    onError(null);
    onMessage(null);

    try {
      const stopped = await stopActiveRoutine(targetRoutineId);
      onMessage(stopped ? 'Runner stopped and group tabs closed.' : 'No active runner found.');
    } catch (stopError) {
      onError(toErrorMessage(stopError, 'Failed to stop routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onEnterFocusMode() {
    if (!focusedSession) {
      onError('No focused runner to continue in focus mode.');
      return;
    }

    setBusyAction('enter-focus-mode');
    onError(null);
    onMessage(null);

    try {
      if (!settings.focusModeEnabled) {
        await setSettingsPatch({ focusModeEnabled: true });
      }

      await setFocusModeActive(true);
      window.close();
    } catch (focusModeError) {
      onError(toErrorMessage(focusModeError, 'Unable to enter focus mode.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onQuickEnableFocusMode() {
    onError(null);
    onMessage(null);

    try {
      await setSettingsPatch({ focusModeEnabled: true });
      onMessage('Focus mode enabled. You can now enter focus mode from Runner Home.');
    } catch (updateError) {
      onError(toErrorMessage(updateError, 'Unable to enable focus mode.'));
    }
  }

  return (
    <>
      <Card size="sm">
        <CardHeader>
          <div>
            <div>
              <CardTitle>Runner Home</CardTitle>
              <CardDescription>Focus on active routine progress.</CardDescription>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onOpenRoutines}>
                Manage routines
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onOpenSettings}>
                <SettingsIcon />
                Settings
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Runners</CardTitle>
          <CardDescription>One runner max per routine, many routines can run together.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {activeRunnerRows === undefined && <p className="text-sm text-muted-foreground">Loading runners...</p>}
          {activeRunnerRows?.length === 0 && (
            <EmptyState
              description="No active runners right now."
              action={(
                <Button type="button" size="sm" variant="outline" onClick={onOpenRoutines}>
                  Start a routine
                </Button>
              )}
            />
          )}

          {activeRunnerRows?.map(({ session, routine }) => (
            <ActiveRunnerCard
              key={session.routineId}
              session={session}
              routine={routine}
              isFocused={runnerState.focusedRoutineId === session.routineId}
              clockNow={clockNow}
              busyAction={busyAction}
              onFocus={() => void onFocusRoutineRunner(session.routineId)}
              onStop={() => void onStopRoutine(session.routineId)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Focused Runner</CardTitle>
          <CardDescription>Hotkeys: Alt+Shift+Left / Alt+Shift+Right.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!focusedSession && <p className="text-sm text-muted-foreground">No focused runner.</p>}

          {focusedSession && focusedRoutine && (
            <>
              <div className="space-y-1 text-sm">
                <p className="font-medium">
                  {focusedRoutine.name} ({focusedSession.currentIndex + 1}/{focusedRoutine.links.length})
                </p>
                {currentLink && <p className="break-all text-xs text-muted-foreground">Current: {currentLink.url}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void onNavigateOffset(-1, focusedSession.routineId)}
                  disabled={busyAction === `previous-${focusedSession.routineId}`}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void onNavigateOffset(1, focusedSession.routineId)}
                  disabled={busyAction === `next-${focusedSession.routineId}`}
                >
                  Next
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void onOpenCurrent(focusedSession.routineId)}
                  disabled={busyAction === `open-current-${focusedSession.routineId}`}
                >
                  Open current
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => void onStopRoutine(focusedSession.routineId)}
                  disabled={busyAction === `stop-${focusedSession.routineId}`}
                >
                  Stop
                </Button>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => void onEnterFocusMode()}
                disabled={busyAction === 'enter-focus-mode' || !settings.focusModeEnabled}
              >
                Enter focus mode
              </Button>
              {!settings.focusModeEnabled && (
                <div className="space-y-2 rounded-lg border border-dashed border-border/70 p-2">
                  <p className="text-xs text-muted-foreground">Focus mode is currently disabled.</p>
                  <Button type="button" size="xs" variant="outline" onClick={() => void onQuickEnableFocusMode()}>
                    Enable focus mode
                  </Button>
                </div>
              )}

              <Separator />
              <StepList
                routineId={focusedSession.routineId}
                links={focusedRoutine.links}
                session={focusedSession}
                currentIndex={focusedSession.currentIndex}
                busyAction={busyAction}
                onJump={(index) => void onJumpToIndex(index)}
              />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function toErrorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) {
    return value.message;
  }

  return fallback;
}
