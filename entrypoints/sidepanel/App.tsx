import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeftIcon,
  DownloadIcon,
  GripVerticalIcon,
  PlusIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
  createRoutineBackupPayload,
  createRoutineLink,
  deleteRoutine,
  listRoutines,
  normalizeRoutineUrl,
  parseRoutineBackup,
  updateRoutine,
} from '@/lib/routines';
import {
  getRunnerState,
  setFocusedRoutine,
  subscribeToRunnerState,
} from '@/lib/session';
import type { NavigationMode, Routine, RoutineLink, RoutineSession } from '@/lib/types';

type SidepanelView = 'runner' | 'routines' | 'editor';

interface RunnerState {
  sessions: RoutineSession[];
  focusedRoutineId: number | null;
}

function App() {
  const routines = useLiveQuery(() => listRoutines(), []);

  const [view, setView] = useState<SidepanelView>('runner');
  const [runnerState, setRunnerState] = useState<RunnerState>({ sessions: [], focusedRoutineId: null });

  const [name, setName] = useState('');
  const [newLinkInput, setNewLinkInput] = useState('');
  const [draftLinks, setDraftLinks] = useState<RoutineLink[]>([]);
  const [editingRoutineId, setEditingRoutineId] = useState<number | null>(null);
  const [draggingLinkId, setDraggingLinkId] = useState<string | null>(null);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  const importInputRef = useRef<HTMLInputElement | null>(null);

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
    () => runnerState.sessions.map((session) => `${session.routineId}:${session.currentIndex}:${session.mode}`).join('|'),
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
    if (navigator.storage?.persist) {
      void navigator.storage.persist();
    }
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
        void onNavigateOffset(-1, focusedSession?.routineId);
      }

      if (event.altKey && event.shiftKey && event.key === 'ArrowRight') {
        event.preventDefault();
        void onNavigateOffset(1, focusedSession?.routineId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusedSession?.routineId]);

  function openCreateRoutinePage() {
    resetEditor();
    setView('editor');
  }

  function onEditRoutine(routine: Routine) {
    setName(routine.name);
    setDraftLinks(routine.links.map((link) => ({ ...link })));
    setEditingRoutineId(routine.id ?? null);
    setNewLinkInput('');
    setDraggingLinkId(null);
    setError(null);
    setMessage(null);
    setView('editor');
  }

  async function onSaveRoutine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Routine name is required.');
      return;
    }

    if (draftLinks.length === 0) {
      setError('Add at least one valid http/https link.');
      return;
    }

    setBusyAction('save-routine');

    try {
      if (editingRoutineId) {
        await updateRoutine(editingRoutineId, { name: trimmedName, links: draftLinks });
        setMessage('Routine updated.');
      } else {
        await createRoutine({ name: trimmedName, links: draftLinks });
        setMessage('Routine created.');
      }

      resetEditor();
      setView('routines');
    } catch (saveError) {
      setError(toErrorMessage(saveError, 'Failed to save routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  function onAddDraftLink() {
    setError(null);
    setMessage(null);

    const normalizedUrl = normalizeRoutineUrl(newLinkInput);

    if (!normalizedUrl) {
      setError('Enter a valid http/https URL to add link.');
      return;
    }

    if (draftLinks.some((link) => link.url === normalizedUrl)) {
      setError('This link already exists in the routine.');
      return;
    }

    setDraftLinks((previous) => [...previous, createRoutineLink(normalizedUrl)]);
    setNewLinkInput('');
  }

  function onRemoveDraftLink(linkId: string) {
    setDraftLinks((previous) => previous.filter((link) => link.id !== linkId));
  }

  function onDragStartLink(event: DragEvent<HTMLDivElement>, linkId: string) {
    setDraggingLinkId(linkId);
    event.dataTransfer.effectAllowed = 'move';
  }

  function onDragOverLink(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function onDropLink(event: DragEvent<HTMLDivElement>, targetLinkId: string) {
    event.preventDefault();

    if (!draggingLinkId || draggingLinkId === targetLinkId) {
      return;
    }

    setDraftLinks((previous) => {
      const fromIndex = previous.findIndex((link) => link.id === draggingLinkId);
      const toIndex = previous.findIndex((link) => link.id === targetLinkId);

      if (fromIndex < 0 || toIndex < 0) {
        return previous;
      }

      const next = [...previous];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
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
      const stopped = await stopActiveRoutine(routine.id);
      await deleteRoutine(routine.id);

      if (editingRoutineId === routine.id) {
        resetEditor();
      }

      setMessage(stopped ? 'Routine deleted and active runner closed.' : 'Routine deleted.');
    } catch (deleteError) {
      setError(toErrorMessage(deleteError, 'Failed to delete routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onStartRoutine(routine: Routine, mode: NavigationMode) {
    if (!routine.id) {
      return;
    }

    setBusyAction(`start-${routine.id}-${mode}`);
    setError(null);
    setMessage(null);

    try {
      const result = await startRoutine(routine, mode);

      if (result.alreadyRunning) {
        setMessage(`Runner already active for "${routine.name}". Showing existing runner.`);
      } else {
        setMessage(`Started "${routine.name}" in ${mode === 'same-tab' ? 'single-tab group' : 'multi-tab group'} mode.`);
      }

      setView('runner');
    } catch (startError) {
      setError(toErrorMessage(startError, 'Failed to start routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onFocusRoutineRunner(routineId: number) {
    await setFocusedRoutine(routineId);
    setView('runner');
    setError(null);
  }

  async function onNavigateOffset(offset: number, routineId?: number) {
    const targetRoutineId = routineId ?? focusedSession?.routineId;

    if (typeof targetRoutineId !== 'number') {
      setError('No active routine to navigate.');
      return;
    }

    setBusyAction(offset > 0 ? `next-${targetRoutineId}` : `previous-${targetRoutineId}`);
    setError(null);
    setMessage(null);

    try {
      const updated = await navigateSessionByOffset(targetRoutineId, offset);
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
    if (!focusedRoutine || !focusedSession) {
      return;
    }

    setBusyAction(`jump-${focusedSession.routineId}-${index}`);
    setError(null);
    setMessage(null);

    try {
      await navigateToIndex(focusedRoutine, focusedSession, index);
      setMessage(`Jumped to step ${index + 1}.`);
    } catch (jumpError) {
      setError(toErrorMessage(jumpError, 'Failed to jump to step.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onOpenCurrent(routineId?: number) {
    const targetRoutineId = routineId ?? focusedSession?.routineId;

    if (typeof targetRoutineId !== 'number') {
      setError('No active routine to open.');
      return;
    }

    setBusyAction(`open-current-${targetRoutineId}`);
    setError(null);
    setMessage(null);

    try {
      const updated = await openCurrentSessionLink(targetRoutineId);
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

  async function onStopRoutine(routineId?: number) {
    const targetRoutineId = routineId ?? focusedSession?.routineId;

    if (typeof targetRoutineId !== 'number') {
      setError('No active routine to stop.');
      return;
    }

    setBusyAction(`stop-${targetRoutineId}`);
    setError(null);
    setMessage(null);

    try {
      const stopped = await stopActiveRoutine(targetRoutineId);
      setMessage(stopped ? 'Runner stopped and group tabs closed.' : 'No active runner found.');
    } catch (stopError) {
      setError(toErrorMessage(stopError, 'Failed to stop routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onExportBackup() {
    setBusyAction('export-backup');
    setError(null);
    setMessage(null);

    try {
      const allRoutines = await listRoutines();

      if (allRoutines.length === 0) {
        setError('No routines available to export.');
        return;
      }

      const payload = createRoutineBackupPayload(allRoutines);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      anchor.href = url;
      anchor.download = `webroutines-backup-${timestamp}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setMessage(`Exported ${allRoutines.length} routine${allRoutines.length === 1 ? '' : 's'}.`);
    } catch (exportError) {
      setError(toErrorMessage(exportError, 'Failed to export routines.'));
    } finally {
      setBusyAction(null);
    }
  }

  function triggerImportDialog() {
    importInputRef.current?.click();
  }

  async function onImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setBusyAction('import-backup');
    setError(null);
    setMessage(null);

    try {
      const rawText = await file.text();
      const routinesToImport = parseRoutineBackup(rawText);

      for (const routineInput of routinesToImport) {
        await createRoutine(routineInput);
      }

      setMessage(`Imported ${routinesToImport.length} routine${routinesToImport.length === 1 ? '' : 's'}.`);
    } catch (importError) {
      setError(toErrorMessage(importError, 'Failed to import backup JSON.'));
    } finally {
      setBusyAction(null);
    }
  }

  function resetEditor() {
    setName('');
    setNewLinkInput('');
    setDraftLinks([]);
    setEditingRoutineId(null);
    setDraggingLinkId(null);
  }

  return (
    <main className="min-h-screen space-y-4 bg-background p-3 text-foreground">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={onImportFileChange}
      />

      {view === 'runner' && (
        <>
          <Card size="sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Runner Home</CardTitle>
                  <CardDescription>Focus on active routine progress.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setView('routines')}>
                    Manage routines
                  </Button>
                  <ThemeToggle />
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
                <div className="rounded-lg border border-dashed border-border/70 p-3">
                  <p className="text-sm text-muted-foreground">No active runners right now.</p>
                  <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setView('routines')}>
                    Start a routine
                  </Button>
                </div>
              )}

              {activeRunnerRows?.map(({ session, routine }) => {
                const totalLinks = routine?.links.length ?? 0;
                const stepNumber = totalLinks > 0 ? Math.min(session.currentIndex + 1, totalLinks) : 0;
                const progressPercent = totalLinks > 0 ? Math.round((stepNumber / totalLinks) * 100) : 0;
                const progressLabel = totalLinks > 0
                  ? `Step ${stepNumber}/${totalLinks} (${progressPercent}%)`
                  : 'Link count unavailable';

                return (
                  <div key={session.routineId} className="rounded-lg border border-border/70 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{routine?.name ?? `Routine #${session.routineId}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {session.mode === 'same-tab' ? 'Single-tab group' : 'Multi-tab group'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {progressLabel} · Active {formatElapsed(session.startedAt, clockNow)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {runnerState.focusedRoutineId === session.routineId && <Badge variant="secondary">Focused</Badge>}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void onFocusRoutineRunner(session.routineId)}
                        >
                          Focus
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => void onStopRoutine(session.routineId)}
                          disabled={busyAction === `stop-${session.routineId}`}
                        >
                          Stop
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
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

                  <Separator />
                  <div className="space-y-2">
                    {focusedRoutine.links.map((link, index) => (
                      <Button
                        key={link.id}
                        type="button"
                        variant={index === focusedSession.currentIndex ? 'secondary' : 'outline'}
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => void onJumpToIndex(index)}
                        disabled={busyAction === `jump-${focusedSession.routineId}-${index}`}
                      >
                        {index + 1}. {link.url}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {view === 'routines' && (
        <>
          <Card size="sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Routines</CardTitle>
                  <CardDescription>Create, run, edit, and backup routines.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setView('runner')}>
                    <ArrowLeftIcon />
                    Back to runner
                  </Button>
                  <ThemeToggle />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={openCreateRoutinePage}>
                  <PlusIcon />
                  New routine
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void onExportBackup()}
                  disabled={busyAction === 'export-backup'}
                >
                  <DownloadIcon />
                  Export JSON
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={triggerImportDialog}
                  disabled={busyAction === 'import-backup'}
                >
                  <UploadIcon />
                  Import JSON
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All routines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {routines === undefined && <p className="text-sm text-muted-foreground">Loading routines...</p>}
              {routines?.length === 0 && <p className="text-sm text-muted-foreground">No routines yet.</p>}

              {routines?.map((routine) => {
                const isRunning = runnerState.sessions.some((session) => session.routineId === routine.id);

                return (
                  <Card key={routine.id} size="sm" className="border border-border/80">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <CardTitle>{routine.name}</CardTitle>
                          <CardDescription>{routine.links.length} links</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {isRunning && <Badge variant="secondary">Running</Badge>}
                          <Badge variant="secondary">#{routine.id}</Badge>
                        </div>
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
                        Run single-tab
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void onStartRoutine(routine, 'tab-group')}
                        disabled={busyAction === `start-${routine.id}-tab-group`}
                      >
                        Run multi-tab
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
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {view === 'editor' && (
        <>
          <Card size="sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>{editingRoutineId ? 'Edit Routine' : 'New Routine'}</CardTitle>
                  <CardDescription>Add links and drag to reorder sequence.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setView('routines')}>
                    <ArrowLeftIcon />
                    Back to routines
                  </Button>
                  <ThemeToggle />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="pt-6">
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
                  <Label htmlFor="routine-link">Add link</Label>
                  <div className="flex gap-2">
                    <Input
                      id="routine-link"
                      value={newLinkInput}
                      onChange={(event) => setNewLinkInput(event.target.value)}
                      placeholder="https://example.com/blog"
                    />
                    <Button type="button" variant="outline" onClick={onAddDraftLink}>
                      <PlusIcon />
                      Add
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {draftLinks.length === 0 && (
                    <p className="text-xs text-muted-foreground">No links yet. Add your first link above.</p>
                  )}

                  {draftLinks.map((link, index) => (
                    <div
                      key={link.id}
                      draggable
                      onDragStart={(event) => onDragStartLink(event, link.id)}
                      onDragOver={onDragOverLink}
                      onDrop={(event) => onDropLink(event, link.id)}
                      onDragEnd={() => setDraggingLinkId(null)}
                      className="flex items-center gap-2 rounded-lg border border-border/70 bg-card px-2 py-1.5"
                    >
                      <GripVerticalIcon className="size-4 text-muted-foreground" />
                      <Badge variant="secondary">{index + 1}</Badge>
                      <p className="flex-1 break-all text-xs text-muted-foreground">{link.url}</p>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="outline"
                        onClick={() => onRemoveDraftLink(link.id)}
                        aria-label="Remove link"
                      >
                        <XIcon />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={busyAction === 'save-routine'}>
                    {editingRoutineId ? 'Update routine' : 'Create routine'}
                  </Button>

                  <Button type="button" variant="outline" onClick={() => setView('routines')}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}

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

function formatElapsed(startedAt: number, now: number): string {
  const elapsedMs = Math.max(0, now - startedAt);
  const totalMinutes = Math.floor(elapsedMs / 60_000);

  if (totalMinutes < 1) {
    return 'just now';
  }

  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === 'input'
    || tagName === 'textarea'
    || target.isContentEditable
    || target.closest('[contenteditable="true"]') !== null
  );
}

export default App;
