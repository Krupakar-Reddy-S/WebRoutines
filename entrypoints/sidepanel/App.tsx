import { useLiveQuery } from 'dexie-react-hooks';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
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
    <main className="min-h-screen space-y-4 bg-background p-3 text-foreground">
      <Card size="sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>WebRoutines</CardTitle>
              <CardDescription>Ordered daily browsing from your side panel.</CardDescription>
            </div>
            <ThemeToggle />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingRoutineId ? 'Edit Routine' : 'New Routine'}</CardTitle>
          <CardDescription>Enter one valid URL per line.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSaveRoutine}>
            <div className="space-y-1.5">
              <Label htmlFor="routine-name">Name</Label>
              <Input
                id="routine-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Morning Reads"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="routine-links">Links</Label>
              <Textarea
                id="routine-links"
                value={linksInput}
                onChange={(event) => setLinksInput(event.target.value)}
                placeholder="https://example.com/blog\nhttps://news.ycombinator.com"
                rows={7}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busyAction === 'save-routine'}>
                {editingRoutineId ? 'Update routine' : 'Create routine'}
              </Button>

              {editingRoutineId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={busyAction === 'save-routine'}
                >
                  Cancel edit
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Routines</CardTitle>
          <CardDescription>Start a routine in same-tab or tab-group mode.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {routines === undefined && <p className="text-sm text-muted-foreground">Loading routines...</p>}
          {routines?.length === 0 && <p className="text-sm text-muted-foreground">No routines yet. Create one above.</p>}

          {routines?.map((routine) => (
            <Card key={routine.id} size="sm" className="border border-border/80">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle>{routine.name}</CardTitle>
                    <CardDescription>{routine.links.length} links</CardDescription>
                  </div>
                  <Badge variant="secondary">#{routine.id}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <ol className="space-y-1 pl-4 text-xs text-muted-foreground">
                  {routine.links.map((link) => (
                    <li key={link.id} className="list-decimal break-all">
                      {link.url}
                    </li>
                  ))}
                </ol>
              </CardContent>
              <CardFooter className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void onStartRoutine(routine, 'same-tab')}
                  disabled={busyAction === `start-${routine.id}-same-tab`}
                >
                  Run same tab
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void onStartRoutine(routine, 'tab-group')}
                  disabled={busyAction === `start-${routine.id}-tab-group`}
                >
                  Run tab group
                </Button>

                <Button type="button" size="sm" variant="outline" onClick={() => onEditRoutine(routine)}>
                  Edit
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => void onDeleteRoutine(routine)}
                  disabled={busyAction === `delete-${routine.id}`}
                >
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runner</CardTitle>
          <CardDescription>Use controls here or from popup quick controls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasActiveSession && (
            <p className="text-sm text-muted-foreground">No active routine. Start one from the routine list.</p>
          )}

          {hasActiveSession && session && activeRoutine && (
            <>
              <div className="space-y-1 text-sm">
                <p className="font-medium">
                  {activeRoutine.name} ({session.currentIndex + 1}/{activeRoutine.links.length})
                </p>
                {currentLink && <p className="break-all text-xs text-muted-foreground">Current: {currentLink.url}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" onClick={() => void onNavigateOffset(-1)} disabled={busyAction === 'previous'}>
                  Previous
                </Button>
                <Button type="button" size="sm" onClick={() => void onNavigateOffset(1)} disabled={busyAction === 'next'}>
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

              <Separator />
              <div className="space-y-2">
                {activeRoutine.links.map((link, index) => (
                  <Button
                    key={link.id}
                    type="button"
                    variant={index === session.currentIndex ? 'secondary' : 'outline'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => void onJumpToIndex(index)}
                    disabled={busyAction === `jump-${index}`}
                  >
                    {index + 1}. {link.url}
                  </Button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card size="sm" className="border-destructive/30">
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {message && (
        <Card size="sm" className="border-primary/30">
          <CardContent>
            <p className="text-sm text-primary">{message}</p>
          </CardContent>
        </Card>
      )}
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
