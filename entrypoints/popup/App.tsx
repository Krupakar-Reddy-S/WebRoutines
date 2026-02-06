import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';

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
    <main className="popup">
      <header>
        <h1>WebRoutines</h1>
        <p>Quick controls</p>
      </header>

      {!hasActiveSession && (
        <p className="muted">No active routine. Open the side panel to start one.</p>
      )}

      {hasActiveSession && session && routine && (
        <section className="session">
          <p className="routine-name">{routine.name}</p>
          <p className="muted">
            Step {session.currentIndex + 1} of {routine.links.length}
          </p>
          {currentLink && <p className="link">{currentLink.url}</p>}

          <div className="actions">
            <button type="button" onClick={() => void onNavigate(-1)} disabled={busyAction === 'previous'}>
              Previous
            </button>
            <button type="button" onClick={() => void onNavigate(1)} disabled={busyAction === 'next'}>
              Next
            </button>
            <button type="button" className="secondary" onClick={() => void onOpenCurrent()} disabled={busyAction === 'open-current'}>
              Open current
            </button>
            <button type="button" className="danger" onClick={() => void onStopRoutine()} disabled={busyAction === 'stop'}>
              Stop
            </button>
          </div>
        </section>
      )}

      <button type="button" className="secondary full" onClick={() => void onOpenPanel()} disabled={busyAction === 'open-panel'}>
        Open side panel
      </button>

      {status && <p className="status">{status}</p>}
    </main>
  );
}

export default App;
