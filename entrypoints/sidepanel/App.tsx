import { useLiveQuery } from 'dexie-react-hooks';
import { DownloadIcon, GripVerticalIcon, PlusIcon, UploadIcon, XIcon } from 'lucide-react';
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
import { getActiveSession, subscribeToActiveSession } from '@/lib/session';
import type { NavigationMode, Routine, RoutineLink, RoutineSession } from '@/lib/types';

function App() {
  const routines = useLiveQuery(() => listRoutines(), []);
  const [session, setSession] = useState<RoutineSession | null>(null);

  const [name, setName] = useState('');
  const [newLinkInput, setNewLinkInput] = useState('');
  const [draftLinks, setDraftLinks] = useState<RoutineLink[]>([]);
  const [editingRoutineId, setEditingRoutineId] = useState<number | null>(null);

  const [draggingLinkId, setDraggingLinkId] = useState<string | null>(null);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const importInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextInputTarget(event.target)) {
        return;
      }

      if (event.altKey && event.shiftKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        void onNavigateOffset(-1);
      }

      if (event.altKey && event.shiftKey && event.key === 'ArrowRight') {
        event.preventDefault();
        void onNavigateOffset(1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

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

      resetForm();
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
    setDraftLinks(routine.links.map((link) => ({ ...link })));
    setEditingRoutineId(routine.id ?? null);
    setNewLinkInput('');
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

  function resetForm() {
    setName('');
    setNewLinkInput('');
    setDraftLinks([]);
    setEditingRoutineId(null);
    setDraggingLinkId(null);
  }

  const hasActiveSession = Boolean(session && activeRoutine);

  return (
    <main className="min-h-screen space-y-4 bg-background p-3 text-foreground">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={onImportFileChange}
      />

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
          <CardDescription>Add links and drag to reorder sequence.</CardDescription>
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
          <CardDescription>Run routines and import/export backups.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
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
          <CardDescription>Hotkeys: Alt+Shift+Left (prev), Alt+Shift+Right (next).</CardDescription>
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
