import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';
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
import {
  navigateSessionByOffset,
  openCurrentSessionLink,
  openSidePanelForCurrentWindow,
  stopActiveRoutine,
} from '@/lib/navigation';
import { getActiveSession, subscribeToActiveSession } from '@/lib/session';
import type { RoutineSession } from '@/lib/types';

function App() {
  const [session, setSession] = useState<RoutineSession | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const routine = useLiveQuery(
    async () => {
      if (!session) {
        return null;
      }

      return (await db.routines.get(session.routineId)) ?? null;
    },
    [session?.routineId],
  );

  const currentLink = useMemo(() => {
    if (!session || !routine) {
      return null;
    }

    return routine.links[session.currentIndex] ?? null;
  }, [routine, session]);

  useEffect(() => {
    void getActiveSession().then(setSession);
    const unsubscribe = subscribeToActiveSession(setSession);

    return unsubscribe;
  }, []);

  const hasActiveSession = Boolean(session && routine);

  async function onNavigate(offset: number) {
    setBusyAction(offset > 0 ? 'next' : 'previous');
    setStatus(null);

    try {
      const updated = await navigateSessionByOffset(offset);
      setStatus(updated ? (offset > 0 ? 'Moved next.' : 'Moved previous.') : 'No active routine.');
    } catch {
      setStatus('Unable to navigate right now.');
    } finally {
      setBusyAction(null);
    }
  }

  async function onOpenCurrent() {
    setBusyAction('open-current');
    setStatus(null);

    try {
      const updated = await openCurrentSessionLink();
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
      await openSidePanelForCurrentWindow();
      setStatus('Side panel opened.');
      window.close();
    } catch {
      setStatus('Unable to open side panel.');
    } finally {
      setBusyAction(null);
    }
  }

  async function onStopRoutine() {
    setBusyAction('stop');
    setStatus(null);

    try {
      await stopActiveRoutine();
      setStatus('Routine stopped.');
    } catch {
      setStatus('Unable to stop routine.');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="w-80 space-y-2 bg-background p-2 text-foreground">
      <Card size="sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>WebRoutines</CardTitle>
              <CardDescription>Quick controls</CardDescription>
            </div>
            <ThemeToggle />
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {!hasActiveSession && (
            <p className="text-xs text-muted-foreground">No active routine. Open side panel to start one.</p>
          )}

          {hasActiveSession && session && routine && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{routine.name}</p>
              <p className="text-xs text-muted-foreground">
                Step {session.currentIndex + 1} of {routine.links.length}
              </p>
              {currentLink && <p className="break-all text-xs text-muted-foreground">{currentLink.url}</p>}
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
          <Button type="button" variant="outline" className="w-full" onClick={() => void onOpenPanel()} disabled={busyAction === 'open-panel'}>
            Open side panel
          </Button>

          {status && <p className="w-full text-xs text-muted-foreground">{status}</p>}
        </CardFooter>
      </Card>
    </main>
  );
}

export default App;
