import { useLiveQuery } from 'dexie-react-hooks';
import { SettingsIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { db } from '@/lib/db';
import { isTextInputTarget } from '@/lib/dom';
import {
  navigateSessionByOffset,
  openCurrentSessionLink,
  openSidePanelForCurrentWindow,
  stopActiveRoutine,
} from '@/lib/navigation';
import {
  getRunnerState,
  setFocusedRoutine,
  setRequestedSidepanelView,
  subscribeToRunnerState,
} from '@/lib/session';
import { formatElapsed } from '@/lib/time';
import { useSettings } from '@/lib/use-settings';
import type { RoutineSession } from '@/lib/types';

interface RunnerState {
  sessions: RoutineSession[];
  focusedRoutineId: number | null;
}

function App() {
  const { settings } = useSettings();
  const [runnerState, setRunnerState] = useState<RunnerState>({ sessions: [], focusedRoutineId: null });
  const [status, setStatus] = useState<string | null>(null);
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

  const routine = useLiveQuery(
    async () => {
      if (!focusedSession) {
        return null;
      }

      return (await db.routines.get(focusedSession.routineId)) ?? null;
    },
    [focusedSession?.routineId],
  );

  const currentLink = useMemo(() => {
    if (!focusedSession || !routine) {
      return null;
    }

    return routine.links[focusedSession.currentIndex] ?? null;
  }, [routine, focusedSession]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextInputTarget(event.target)) {
        return;
      }

      if (event.altKey && event.shiftKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        void onNavigate(-1);
      }

      if (event.altKey && event.shiftKey && event.key === 'ArrowRight') {
        event.preventDefault();
        void onNavigate(1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusedSession?.routineId]);

  useEffect(() => {
    if (!status) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStatus(null);
    }, 3_500);

    return () => window.clearTimeout(timeoutId);
  }, [status]);

  const hasActiveSession = Boolean(focusedSession && routine);

  async function onNavigate(offset: number) {
    if (!focusedSession) {
      setStatus('No active routine.');
      return;
    }

    setBusyAction(offset > 0 ? 'next' : 'previous');
    setStatus(null);

    try {
      const updated = await navigateSessionByOffset(focusedSession.routineId, offset);
      setStatus(updated ? (offset > 0 ? 'Moved next.' : 'Moved previous.') : 'No active routine.');
    } catch {
      setStatus('Unable to navigate right now.');
    } finally {
      setBusyAction(null);
    }
  }

  async function onOpenCurrent() {
    if (!focusedSession) {
      setStatus('No active routine.');
      return;
    }

    setBusyAction('open-current');
    setStatus(null);

    try {
      const updated = await openCurrentSessionLink(focusedSession.routineId);
      setStatus(updated ? 'Opened current link.' : 'No active routine.');
    } catch {
      setStatus('Unable to open current link.');
    } finally {
      setBusyAction(null);
    }
  }

  async function onOpenPanel() {
    setBusyAction('open-panel');
    setStatus(null);

    try {
      const opened = await openSidePanelForCurrentWindow();
      if (!opened) {
        setStatus('Unable to open side panel.');
        return;
      }

      setStatus('Side panel opened.');
      window.close();
    } catch {
      setStatus('Unable to open side panel.');
    } finally {
      setBusyAction(null);
    }
  }

  async function onStopRoutine() {
    if (!focusedSession) {
      setStatus('No active routine.');
      return;
    }

    if (settings.confirmBeforeStop) {
      const shouldStop = window.confirm('Stop this runner and close its runner tabs?');
      if (!shouldStop) {
        return;
      }
    }

    setBusyAction('stop');
    setStatus(null);

    try {
      const stopped = await stopActiveRoutine(focusedSession.routineId);
      setStatus(stopped ? 'Runner stopped.' : 'No active routine.');
    } catch {
      setStatus('Unable to stop routine.');
    } finally {
      setBusyAction(null);
    }
  }

  async function onFocusNextRunner() {
    if (runnerState.sessions.length < 2 || !focusedSession) {
      return;
    }

    const currentIndex = runnerState.sessions.findIndex((session) => session.routineId === focusedSession.routineId);
    const nextIndex = currentIndex < 0
      ? 0
      : (currentIndex + 1) % runnerState.sessions.length;

    const nextSession = runnerState.sessions[nextIndex];

    await setFocusedRoutine(nextSession.routineId);
    setStatus('Switched focused runner.');
  }

  async function onOpenSettingsPage() {
    setStatus(null);

    try {
      await setRequestedSidepanelView('settings');
      const opened = await openSidePanelForCurrentWindow();
      if (!opened) {
        setStatus('Unable to open side panel.');
        return;
      }
      setStatus('Opened settings in side panel.');
      window.close();
    } catch {
      setStatus('Unable to open settings.');
    }
  }

  return (
    <main className="w-80 space-y-2 bg-background p-2 text-foreground">
      <Card size="sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>WebRoutines</CardTitle>
              <CardDescription>Focused runner controls + hotkeys</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Active runners</p>
            <Badge variant="secondary">{runnerState.sessions.length}</Badge>
          </div>

          {!hasActiveSession && (
            <p className="text-xs text-muted-foreground">No active routine. Open side panel to start one.</p>
          )}

          {hasActiveSession && focusedSession && routine && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{routine.name}</p>
              <p className="text-xs text-muted-foreground">
                Step {focusedSession.currentIndex + 1} of {routine.links.length}
              </p>
              <p className="text-xs text-muted-foreground">
                Active {formatElapsed(focusedSession.startedAt, clockNow)}
              </p>
              {currentLink && <p className="break-all text-xs text-muted-foreground">{currentLink.url}</p>}
              <p className="text-xs text-muted-foreground">Alt+Shift+Left/Right to move steps.</p>
              <Separator />
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" onClick={() => void onNavigate(-1)} disabled={busyAction === 'previous'}>
                  Previous
                </Button>
                <Button type="button" size="sm" onClick={() => void onNavigate(1)} disabled={busyAction === 'next'}>
                  Next
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void onOpenCurrent()}
                  disabled={busyAction === 'open-current'}
                >
                  Open current
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => void onStopRoutine()}
                  disabled={busyAction === 'stop'}
                >
                  Stop
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void onFocusNextRunner()}
            disabled={runnerState.sessions.length < 2}
          >
            Next runner
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void onOpenPanel()}
            disabled={busyAction === 'open-panel'}
          >
            Open side panel
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void onOpenSettingsPage()}
          >
            <SettingsIcon />
            Settings
          </Button>

          {status && (
            <p className="w-full text-xs text-muted-foreground" role="status" aria-live="polite">
              {status}
            </p>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}

export default App;
