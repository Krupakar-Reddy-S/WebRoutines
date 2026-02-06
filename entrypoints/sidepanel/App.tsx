import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeftIcon,
  DownloadIcon,
  GripVerticalIcon,
  PlusIcon,
  SettingsIcon,
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
  setSettingsPatch,
} from '@/lib/settings';
import {
  consumeRequestedSidepanelView,
  getRunnerState,
  setFocusModeActive,
  setFocusedRoutine,
  subscribeToRequestedSidepanelView,
  subscribeToRunnerState,
} from '@/lib/session';
import { useSettings } from '@/lib/use-settings';
import type { NavigationMode, Routine, RoutineLink, RoutineSession } from '@/lib/types';

type SidepanelView = 'runner' | 'routines' | 'editor' | 'settings';

interface RunnerState {
  sessions: RoutineSession[];
  focusedRoutineId: number | null;
}

function App() {
  const { settings } = useSettings();
  const routines = useLiveQuery(() => listRoutines(), []);

  const [view, setView] = useState<SidepanelView>('runner');
  const [runnerState, setRunnerState] = useState<RunnerState>({ sessions: [], focusedRoutineId: null });

  const [name, setName] = useState('');
  const [newLinkInput, setNewLinkInput] = useState('');
  const [draftLinks, setDraftLinks] = useState<RoutineLink[]>([]);
  const [editingRoutineId, setEditingRoutineId] = useState<number | null>(null);
  const [draggingLinkId, setDraggingLinkId] = useState<string | null>(null);
  const [dropTargetLinkId, setDropTargetLinkId] = useState<string | null>(null);
  const [confirmLinkRemovalId, setConfirmLinkRemovalId] = useState<string | null>(null);
  const [routineSearchQuery, setRoutineSearchQuery] = useState('');
  const [expandedRoutineIds, setExpandedRoutineIds] = useState<number[]>([]);

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

  const filteredRoutines = useMemo(() => {
    if (!routines) {
      return routines;
    }

    const query = routineSearchQuery.trim().toLowerCase();

    if (!query) {
      return routines;
    }

    return routines.filter((routine) => routine.name.toLowerCase().includes(query));
  }, [routineSearchQuery, routines]);

  const parsedDraftInputUrls = useMemo(
    () => parseDraftInputUrls(newLinkInput),
    [newLinkInput],
  );

  const pendingDraftRemovalLink = useMemo(
    () => draftLinks.find((link) => link.id === confirmLinkRemovalId) ?? null,
    [confirmLinkRemovalId, draftLinks],
  );

  useEffect(() => {
    void getRunnerState().then(setRunnerState);
    const unsubscribe = subscribeToRunnerState(setRunnerState);

    return unsubscribe;
  }, []);

  useEffect(() => {
    void consumeRequestedSidepanelView().then((requestedView) => {
      if (requestedView) {
        setView(requestedView);
      }
    });

    return subscribeToRequestedSidepanelView((requestedView) => {
      setView(requestedView);
      setError(null);
      setMessage(null);
    });
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
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage(null);
    }, 3_500);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  useEffect(() => {
    if (!confirmLinkRemovalId) {
      return;
    }

    if (draftLinks.some((link) => link.id === confirmLinkRemovalId)) {
      return;
    }

    setConfirmLinkRemovalId(null);
  }, [confirmLinkRemovalId, draftLinks]);

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
    setDropTargetLinkId(null);
    setConfirmLinkRemovalId(null);
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

    if (parsedDraftInputUrls.length === 0) {
      setError('Enter valid http/https URLs (comma-separated or one per line).');
      return;
    }

    const existingUrls = new Set(draftLinks.map((link) => link.url));
    const urlsToAdd = parsedDraftInputUrls.filter((url) => !existingUrls.has(url));

    if (urlsToAdd.length === 0) {
      setError('All provided links already exist in this routine.');
      return;
    }

    setDraftLinks((previous) => [...previous, ...urlsToAdd.map((url) => createRoutineLink(url))]);
    setNewLinkInput('');
    const skippedCount = parsedDraftInputUrls.length - urlsToAdd.length;
    setMessage(
      skippedCount > 0
        ? `Added ${urlsToAdd.length} link${urlsToAdd.length === 1 ? '' : 's'} (${skippedCount} duplicates skipped).`
        : `Added ${urlsToAdd.length} link${urlsToAdd.length === 1 ? '' : 's'}.`,
    );
  }

  function onConfirmRemoveDraftLink(linkId: string) {
    setDraftLinks((previous) => previous.filter((link) => link.id !== linkId));
    setConfirmLinkRemovalId(null);
    setMessage('Link removed from routine draft.');
  }

  function onDragStartLink(event: DragEvent<HTMLDivElement>, linkId: string) {
    setDraggingLinkId(linkId);
    setDropTargetLinkId(linkId);
    event.dataTransfer.effectAllowed = 'move';
  }

  function onDragEnterLink(event: DragEvent<HTMLDivElement>, targetLinkId: string) {
    event.preventDefault();

    if (!draggingLinkId || draggingLinkId === targetLinkId) {
      return;
    }

    setDropTargetLinkId(targetLinkId);
  }

  function onDragOverLink(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function onDropLink(event: DragEvent<HTMLDivElement>, targetLinkId: string) {
    event.preventDefault();

    if (!draggingLinkId || draggingLinkId === targetLinkId) {
      setDropTargetLinkId(null);
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

    setDropTargetLinkId(null);
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

  async function onOpenSettingsPage() {
    setError(null);
    setMessage(null);
    setView('settings');
  }

  function onToggleRoutineLinks(routineId: number) {
    setExpandedRoutineIds((previous) => (
      previous.includes(routineId)
        ? previous.filter((id) => id !== routineId)
        : [...previous, routineId]
    ));
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

    if (settings.confirmBeforeStop) {
      const shouldStop = window.confirm('Stop this runner and close its runner tabs?');
      if (!shouldStop) {
        return;
      }
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

  async function onEnterFocusMode() {
    if (!focusedSession) {
      setError('No focused runner to continue in focus mode.');
      return;
    }

    setBusyAction('enter-focus-mode');
    setError(null);
    setMessage(null);

    try {
      if (!settings.focusModeEnabled) {
        await setSettingsPatch({ focusModeEnabled: true });
      }

      await setFocusModeActive(true);
      window.close();
    } catch (focusModeError) {
      setError(toErrorMessage(focusModeError, 'Unable to enter focus mode.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onQuickEnableFocusMode() {
    setError(null);
    setMessage(null);

    try {
      await setSettingsPatch({ focusModeEnabled: true });
      setMessage('Focus mode enabled. You can now enter focus mode from Runner Home.');
    } catch (updateError) {
      setError(toErrorMessage(updateError, 'Unable to enable focus mode.'));
    }
  }

  async function onSetStaticTheme(value: string) {
    if (value !== 'light' && value !== 'dark' && value !== 'system') {
      return;
    }

    await setSettingsPatch({ staticTheme: value });
  }

  async function onSetDefaultRunMode(value: string) {
    if (value !== 'same-tab' && value !== 'tab-group') {
      return;
    }

    await setSettingsPatch({ defaultRunMode: value });
  }

  async function onSetBooleanSetting(
    key: 'confirmBeforeStop' | 'focusModeEnabled',
    checked: boolean,
  ) {
    await setSettingsPatch({ [key]: checked });
  }

  async function onExportRoutine(routine: Routine) {
    if (!routine.id) {
      return;
    }

    setBusyAction(`export-routine-${routine.id}`);
    setError(null);
    setMessage(null);

    try {
      const payload = createRoutineBackupPayload([routine]);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const routineSlug = toFileSlug(routine.name);

      anchor.href = url;
      anchor.download = `webroutine-${routineSlug || routine.id}-${timestamp}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setMessage(`Exported "${routine.name}" as JSON.`);
    } catch (exportError) {
      setError(toErrorMessage(exportError, 'Failed to export routine JSON.'));
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
    setDropTargetLinkId(null);
    setConfirmLinkRemovalId(null);
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
                  <Button type="button" size="sm" variant="outline" onClick={() => void onOpenSettingsPage()}>
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
                      <p className="text-xs text-muted-foreground">
                        Focus mode is currently disabled.
                      </p>
                      <Button type="button" size="xs" variant="outline" onClick={() => void onQuickEnableFocusMode()}>
                        Enable focus mode
                      </Button>
                    </div>
                  )}

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
                  <Button type="button" size="sm" variant="outline" onClick={() => void onOpenSettingsPage()}>
                    <SettingsIcon />
                    Settings
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setView('runner')}>
                    <ArrowLeftIcon />
                    Back to runner
                  </Button>
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
              <CardDescription>{routines?.length ?? 0} total routines</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={routineSearchQuery}
                onChange={(event) => setRoutineSearchQuery(event.target.value)}
                placeholder="Search routines by name"
                aria-label="Search routines"
              />

              {routines === undefined && <p className="text-sm text-muted-foreground">Loading routines...</p>}
              {routines?.length === 0 && <p className="text-sm text-muted-foreground">No routines yet.</p>}
              {routines && routines.length > 0 && filteredRoutines?.length === 0 && (
                <p className="text-sm text-muted-foreground">No routines match your search.</p>
              )}

              {filteredRoutines?.map((routine) => {
                const routineId = routine.id;
                const isRunning = runnerState.sessions.some((session) => session.routineId === routine.id);
                const isExpanded = typeof routineId === 'number' && expandedRoutineIds.includes(routineId);
                const hasHiddenLinks = routine.links.length > 3;
                const visibleLinks = hasHiddenLinks && !isExpanded
                  ? routine.links.slice(0, 3)
                  : routine.links;

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
                          {isRunning && typeof routineId === 'number' && (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => void onFocusRoutineRunner(routineId)}
                            >
                              Focus
                            </Button>
                          )}
                          <Badge variant="secondary">#{routine.id}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <ol className="space-y-1 pl-4 text-xs text-muted-foreground">
                        {visibleLinks.map((link) => (
                          <li key={link.id} className="list-decimal break-all">
                            {link.url}
                          </li>
                        ))}
                      </ol>
                      {hasHiddenLinks && typeof routineId === 'number' && (
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => onToggleRoutineLinks(routineId)}
                        >
                          {isExpanded ? 'Show less' : `Show all ${routine.links.length} links`}
                        </Button>
                      )}
                    </CardContent>
                    <CardFooter className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={settings.defaultRunMode === 'same-tab' ? 'default' : 'outline'}
                        onClick={() => void onStartRoutine(routine, 'same-tab')}
                        disabled={busyAction === `start-${routine.id}-same-tab`}
                      >
                        Run single-tab
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant={settings.defaultRunMode === 'tab-group' ? 'default' : 'outline'}
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
                        variant="outline"
                        onClick={() => void onExportRoutine(routine)}
                        disabled={busyAction === `export-routine-${routine.id}`}
                      >
                        <DownloadIcon />
                        Export JSON
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
                  <Button type="button" size="sm" variant="outline" onClick={() => void onOpenSettingsPage()}>
                    <SettingsIcon />
                    Settings
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setView('routines')}>
                    <ArrowLeftIcon />
                    Back to routines
                  </Button>
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
                      placeholder="https://example.com/blog, https://news.ycombinator.com"
                    />
                    <Button type="button" variant="outline" onClick={onAddDraftLink}>
                      <PlusIcon />
                      {parsedDraftInputUrls.length > 0 ? `Add (${parsedDraftInputUrls.length})` : 'Add'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Paste one or more URLs here. Supported formats: comma-separated or one URL per line.
                  </p>
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
                      onDragEnter={(event) => onDragEnterLink(event, link.id)}
                      onDragOver={onDragOverLink}
                      onDrop={(event) => onDropLink(event, link.id)}
                      onDragEnd={() => {
                        setDraggingLinkId(null);
                        setDropTargetLinkId(null);
                      }}
                      className={`flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5 transition-colors ${
                        dropTargetLinkId === link.id && draggingLinkId !== link.id
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border/70'
                      } ${
                        draggingLinkId === link.id ? 'opacity-70' : ''
                      }`}
                    >
                      <GripVerticalIcon className="size-4 text-muted-foreground" />
                      <Badge variant="secondary">{index + 1}</Badge>
                      <p className="flex-1 break-all text-xs text-muted-foreground">{link.url}</p>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="outline"
                        onClick={() => setConfirmLinkRemovalId(link.id)}
                        aria-label="Remove link"
                      >
                        <XIcon />
                      </Button>
                    </div>
                  ))}

                  {pendingDraftRemovalLink && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2">
                      <p className="text-xs font-medium text-destructive">Remove this link from the routine?</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">{pendingDraftRemovalLink.url}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="destructive"
                          onClick={() => onConfirmRemoveDraftLink(pendingDraftRemovalLink.id)}
                        >
                          Remove link
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => setConfirmLinkRemovalId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
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

      {view === 'settings' && (
        <>
          <Card size="sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Settings</CardTitle>
                  <CardDescription>Configure behavior and theme preferences.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setView('runner')}>
                    <ArrowLeftIcon />
                    Back to runner
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
              <CardDescription>Core runner behavior across sidepanel, popup, and focus controller.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Default run mode</span>
                <select
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                  value={settings.defaultRunMode}
                  onChange={(event) => void onSetDefaultRunMode(event.target.value)}
                >
                  <option value="tab-group">Tab group</option>
                  <option value="same-tab">Single tab</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.confirmBeforeStop}
                  onChange={(event) => void onSetBooleanSetting('confirmBeforeStop', event.target.checked)}
                />
                Confirm before stop actions
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.focusModeEnabled}
                  onChange={(event) => void onSetBooleanSetting('focusModeEnabled', event.target.checked)}
                />
                Enable focus mini-controller mode
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Choose the extension theme for sidepanel and popup.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Theme</span>
                <select
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                  value={settings.staticTheme}
                  onChange={(event) => void onSetStaticTheme(event.target.value)}
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
            </CardContent>
          </Card>
        </>
      )}

      {error && (
        <Card size="sm" className="border-destructive/30">
          <CardContent role="alert" aria-live="assertive">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {message && (
        <Card size="sm" className="border-primary/30">
          <CardContent role="status" aria-live="polite">
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

function parseDraftInputUrls(rawInput: string): string[] {
  const segments = rawInput
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  const dedupe = new Set<string>();
  const urls: string[] = [];

  for (const segment of segments) {
    const normalizedUrl = normalizeRoutineUrl(segment);
    if (!normalizedUrl || dedupe.has(normalizedUrl)) {
      continue;
    }

    dedupe.add(normalizedUrl);
    urls.push(normalizedUrl);
  }

  return urls;
}

function toFileSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
