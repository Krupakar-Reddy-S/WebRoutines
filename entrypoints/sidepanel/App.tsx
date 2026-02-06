import { useLiveQuery } from 'dexie-react-hooks';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { db } from '@/lib/db';
import {
  navigateSessionByOffset,
  navigateToIndex,
  openCurrentSessionLink,
  startRoutine,
  stopActiveRoutine,
} from '@/lib/navigation';
import {
  createRoutine,
  deleteRoutine,
  linksToEditorText,
  listRoutines,
  parseLinksFromText,
  updateRoutine,
} from '@/lib/routines';
import { getActiveSession, subscribeToActiveSession } from '@/lib/session';
import type { NavigationMode, Routine, RoutineSession } from '@/lib/types';

function App() {
  const routines = useLiveQuery(() => listRoutines(), []);
  const [session, setSession] = useState<RoutineSession | null>(null);

  const [name, setName] = useState('');
  const [linksInput, setLinksInput] = useState('');
  const [editingRoutineId, setEditingRoutineId] = useState<number | null>(null);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activeRoutine = useLiveQuery(
    async () => {
      if (!session) {
        return null;
      }

      return (await db.routines.get(session.routineId)) ?? null;
    },
    [session?.routineId],
  );

  const currentLink = useMemo(() => {
    if (!session || !activeRoutine) {
      return null;
    }

    return activeRoutine.links[session.currentIndex] ?? null;
  }, [activeRoutine, session]);

  useEffect(() => {
    void getActiveSession().then(setSession);
    const unsubscribe = subscribeToActiveSession(setSession);

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (navigator.storage?.persist) {
      void navigator.storage.persist();
    }
  }, []);

  async function onSaveRoutine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Routine name is required.');
      return;
    }

    const links = parseLinksFromText(linksInput);
    if (links.length === 0) {
      setError('Add at least one valid http/https link.');
      return;
    }

    setBusyAction('save-routine');

    try {
      if (editingRoutineId) {
        await updateRoutine(editingRoutineId, { name: trimmedName, links });
        setMessage('Routine updated.');
      } else {
        await createRoutine({ name: trimmedName, links });
        setMessage('Routine created.');
      }

      resetForm();
    } catch (saveError) {
      setError(toErrorMessage(saveError, 'Failed to save routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onDeleteRoutine(routine: Routine) {
    if (!routine.id) {
      return;
    }

    const shouldDelete = window.confirm(`Delete routine "${routine.name}"?`);
    if (!shouldDelete) {
      return;
    }

    setBusyAction(`delete-${routine.id}`);
    setError(null);
    setMessage(null);

    try {
      await deleteRoutine(routine.id);

      if (session?.routineId === routine.id) {
        await stopActiveRoutine();
      }

      if (editingRoutineId === routine.id) {
        resetForm();
      }

      setMessage('Routine deleted.');
    } catch (deleteError) {
      setError(toErrorMessage(deleteError, 'Failed to delete routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  function onEditRoutine(routine: Routine) {
    setName(routine.name);
    setLinksInput(linksToEditorText(routine.links));
    setEditingRoutineId(routine.id ?? null);
    setError(null);
    setMessage(null);
  }

  async function onStartRoutine(routine: Routine, mode: NavigationMode) {
    setBusyAction(`start-${routine.id}-${mode}`);
    setError(null);
    setMessage(null);

    try {
      await startRoutine(routine, mode);
      setMessage(`Started "${routine.name}" in ${mode === 'same-tab' ? 'same tab' : 'tab group'} mode.`);
    } catch (startError) {
      setError(toErrorMessage(startError, 'Failed to start routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onNavigateOffset(offset: number) {
    setBusyAction(offset > 0 ? 'next' : 'previous');
    setError(null);
    setMessage(null);

    try {
      const updated = await navigateSessionByOffset(offset);
      if (!updated) {
        setError('No active routine to navigate.');
        return;
      }

      setMessage(offset > 0 ? 'Moved to next link.' : 'Moved to previous link.');
    } catch (navigationError) {
      setError(toErrorMessage(navigationError, 'Failed to navigate routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onJumpToIndex(index: number) {
    if (!activeRoutine || !session) {
      return;
    }

    setBusyAction(`jump-${index}`);
    setError(null);
    setMessage(null);

    try {
      await navigateToIndex(activeRoutine, session, index);
      setMessage(`Jumped to step ${index + 1}.`);
    } catch (jumpError) {
      setError(toErrorMessage(jumpError, 'Failed to jump to step.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onOpenCurrent() {
    setBusyAction('open-current');
    setError(null);
    setMessage(null);

    try {
      const updated = await openCurrentSessionLink();
      if (!updated) {
        setError('No active routine to open.');
        return;
      }

      setMessage('Opened current link.');
    } catch (openError) {
      setError(toErrorMessage(openError, 'Failed to open current link.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onStopRoutine() {
    setBusyAction('stop');
    setError(null);
    setMessage(null);

    try {
      await stopActiveRoutine();
      setMessage('Active routine stopped.');
    } catch (stopError) {
      setError(toErrorMessage(stopError, 'Failed to stop routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  function resetForm() {
    setName('');
    setLinksInput('');
    setEditingRoutineId(null);
  }

  const hasActiveSession = Boolean(session && activeRoutine);

  return (
    <main className="panel">
      <header className="panel-header">
        <h1>WebRoutines</h1>
        <p>Build ordered daily website routines and run them from your sidebar.</p>
      </header>

      <section className="card">
        <h2>{editingRoutineId ? 'Edit Routine' : 'New Routine'}</h2>

        <form className="routine-form" onSubmit={onSaveRoutine}>
          <label>
            Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Morning Reads"
              required
            />
          </label>

          <label>
            Links (one per line)
            <textarea
              value={linksInput}
              onChange={(event) => setLinksInput(event.target.value)}
              placeholder="https://example.com/blog\nhttps://news.ycombinator.com"
              rows={7}
            />
          </label>

          <div className="actions">
            <button type="submit" disabled={busyAction === 'save-routine'}>
              {editingRoutineId ? 'Update routine' : 'Create routine'}
            </button>

            {editingRoutineId && (
              <button
                type="button"
                className="secondary"
                onClick={resetForm}
                disabled={busyAction === 'save-routine'}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Routines</h2>

        {routines === undefined && <p className="muted">Loading routines...</p>}
        {routines?.length === 0 && <p className="muted">No routines yet. Create one above.</p>}

        <div className="routine-list">
          {routines?.map((routine) => (
            <article className="routine-item" key={routine.id}>
              <div className="routine-item-header">
                <div>
                  <h3>{routine.name}</h3>
                  <p className="muted">{routine.links.length} links</p>
                </div>
              </div>

              <ol>
                {routine.links.map((link) => (
                  <li key={link.id}>{link.url}</li>
                ))}
              </ol>

              <div className="actions grid">
                <button
                  type="button"
                  onClick={() => void onStartRoutine(routine, 'same-tab')}
                  disabled={busyAction === `start-${routine.id}-same-tab`}
                >
                  Run in same tab
                </button>

                <button
                  type="button"
                  className="secondary"
                  onClick={() => void onStartRoutine(routine, 'tab-group')}
                  disabled={busyAction === `start-${routine.id}-tab-group`}
                >
                  Run in tab group
                </button>

                <button type="button" className="secondary" onClick={() => onEditRoutine(routine)}>
                  Edit
                </button>

                <button
                  type="button"
                  className="danger"
                  onClick={() => void onDeleteRoutine(routine)}
                  disabled={busyAction === `delete-${routine.id}`}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Runner</h2>

        {!hasActiveSession && (
          <p className="muted">No active routine. Start one from the routine list.</p>
        )}

        {hasActiveSession && session && activeRoutine && (
          <>
            <p>
              <strong>{activeRoutine.name}</strong>
              {' '}
              ({session.currentIndex + 1}/{activeRoutine.links.length})
              {' '}
              in {session.mode === 'same-tab' ? 'same tab' : 'tab group'} mode
            </p>

            {currentLink && <p className="muted">Current link: {currentLink.url}</p>}

            <div className="actions grid">
              <button type="button" onClick={() => void onNavigateOffset(-1)} disabled={busyAction === 'previous'}>
                Previous
              </button>

              <button type="button" onClick={() => void onNavigateOffset(1)} disabled={busyAction === 'next'}>
                Next
              </button>

              <button type="button" className="secondary" onClick={() => void onOpenCurrent()} disabled={busyAction === 'open-current'}>
                Open current
              </button>

              <button type="button" className="danger" onClick={() => void onStopRoutine()} disabled={busyAction === 'stop'}>
                Stop
              </button>
            </div>

            <div className="step-list">
              {activeRoutine.links.map((link, index) => (
                <button
                  key={link.id}
                  type="button"
                  className={index === session.currentIndex ? 'step is-active' : 'step'}
                  onClick={() => void onJumpToIndex(index)}
                  disabled={busyAction === `jump-${index}`}
                >
                  {index + 1}. {link.url}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice success">{message}</p>}
    </main>
  );
}

function toErrorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) {
    return value.message;
  }

  return fallback;
}

export default App;
