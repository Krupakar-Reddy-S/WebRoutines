import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeftIcon, HistoryIcon, PlusIcon, SettingsIcon, UploadIcon } from 'lucide-react';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';

import { RoutineAccordionCard } from '@/components/RoutineAccordionCard';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { startRoutine, stopActiveRoutine } from '@/lib/navigation';
import {
  createRoutineBackupPayload,
  deleteRoutine,
  importRoutines,
  hasRoutineSchedule,
  isRoutineScheduledForDay,
  listRoutines,
  parseRoutineBackup,
} from '@/lib/routines';
import { getRunnerState, setFocusedRoutine, subscribeToRunnerState } from '@/lib/session';
import type { Routine, RoutineSession } from '@/lib/types';

interface RunnerState {
  sessions: RoutineSession[];
  focusedRoutineId: number | null;
}

interface RoutinesViewProps {
  onOpenSettings: () => void;
  onOpenHistory: (routineId?: number) => void;
  onOpenRunner: () => void;
  onCreateRoutine: () => void;
  onEditRoutine: (routineId: number) => void;
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
}

export function RoutinesView({
  onOpenSettings,
  onOpenHistory,
  onOpenRunner,
  onCreateRoutine,
  onEditRoutine,
  onMessage,
  onError,
}: RoutinesViewProps) {
  const routines = useLiveQuery(() => listRoutines(), []);
  const [runnerState, setRunnerState] = useState<RunnerState>({ sessions: [], focusedRoutineId: null });
  const [expandedRoutineId, setExpandedRoutineId] = useState<number | null>(null);
  const [deleteDialogRoutine, setDeleteDialogRoutine] = useState<Routine | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const todayDay = new Date(clockNow).getDay();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const isDeletingRoutine = Boolean(
    deleteDialogRoutine?.id
      && busyAction === `delete-${deleteDialogRoutine.id}`,
  );

  const sortedRoutines = useMemo(() => {
    if (!routines) {
      return routines;
    }

    const activeByRoutine = new Map(runnerState.sessions.map((session) => [session.routineId, session.startedAt]));

    return [...routines].sort((left, right) => {
      const leftBucket = isRoutineScheduledForDay(left, todayDay)
        ? 0
        : hasRoutineSchedule(left)
          ? 2
          : 1;
      const rightBucket = isRoutineScheduledForDay(right, todayDay)
        ? 0
        : hasRoutineSchedule(right)
          ? 2
          : 1;

      if (leftBucket !== rightBucket) {
        return leftBucket - rightBucket;
      }

      const leftRunningStamp = left.id ? activeByRoutine.get(left.id) : undefined;
      const rightRunningStamp = right.id ? activeByRoutine.get(right.id) : undefined;

      if (typeof leftRunningStamp === 'number' && typeof rightRunningStamp !== 'number') {
        return -1;
      }

      if (typeof leftRunningStamp !== 'number' && typeof rightRunningStamp === 'number') {
        return 1;
      }

      if (typeof leftRunningStamp === 'number' && typeof rightRunningStamp === 'number') {
        return rightRunningStamp - leftRunningStamp;
      }

      const leftLastRun = left.lastRunAt ?? null;
      const rightLastRun = right.lastRunAt ?? null;

      if (typeof leftLastRun === 'number' && typeof rightLastRun === 'number') {
        return rightLastRun - leftLastRun;
      }

      if (typeof leftLastRun === 'number') {
        return -1;
      }

      if (typeof rightLastRun === 'number') {
        return 1;
      }

      return right.createdAt - left.createdAt;
    });
  }, [routines, runnerState.sessions, todayDay]);

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

  async function onStartRoutine(routine: Routine) {
    if (!routine.id) {
      return;
    }

    setBusyAction(`start-${routine.id}`);
    onError(null);
    onMessage(null);

    try {
      const result = await startRoutine(routine, 'sidepanel');

      if (result.alreadyRunning) {
        onMessage(`Runner already active for "${routine.name}". Showing existing runner.`);
      } else {
        const loadingLabel = result.session.loadMode === 'lazy' ? 'lazy loading' : 'load all tabs';
        onMessage(`Started "${routine.name}" (${loadingLabel}).`);
      }

      onOpenRunner();
    } catch (startError) {
      onError(toErrorMessage(startError, 'Failed to start routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  function onRequestDeleteRoutine(routine: Routine) {
    if (!routine.id) {
      return;
    }

    onError(null);
    onMessage(null);
    setDeleteDialogRoutine(routine);
  }

  async function onDeleteRoutine() {
    const routineToDelete = deleteDialogRoutine;
    if (!routineToDelete?.id) {
      return;
    }

    setBusyAction(`delete-${routineToDelete.id}`);
    onError(null);
    onMessage(null);

    try {
      const stopped = await stopActiveRoutine(routineToDelete.id, 'sidepanel');
      await deleteRoutine(routineToDelete.id);

      onMessage(stopped ? 'Routine deleted and active runner closed.' : 'Routine deleted.');
      if (expandedRoutineId === routineToDelete.id) {
        setExpandedRoutineId(null);
      }
      setDeleteDialogRoutine(null);
    } catch (deleteError) {
      onError(toErrorMessage(deleteError, 'Failed to delete routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onFocusRoutineRunner(routineId: number) {
    await setFocusedRoutine(routineId);
    onOpenRunner();
    onError(null);
  }

  async function onExportRoutine(routine: Routine) {
    if (!routine.id) {
      return;
    }

    setBusyAction(`export-routine-${routine.id}`);
    onError(null);
    onMessage(null);

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

      onMessage(`Exported "${routine.name}" as JSON.`);
    } catch (exportError) {
      onError(toErrorMessage(exportError, 'Failed to export routine JSON.'));
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
    onError(null);
    onMessage(null);

    try {
      const rawText = await file.text();
      const routinesToImport = parseRoutineBackup(rawText);
      const importedCount = await importRoutines(routinesToImport);
      onMessage(`Imported ${importedCount} routine${importedCount === 1 ? '' : 's'}.`);
    } catch (importError) {
      onError(toErrorMessage(importError, 'Failed to import backup JSON.'));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={onImportFileChange}
      />

      <Card size="sm">
        <CardHeader>
          <div>
            <CardTitle>Routines</CardTitle>
            <CardDescription>Create, run, edit, and backup routines.</CardDescription>
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onOpenRunner}>
                <ArrowLeftIcon />
                Back to runner
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onOpenSettings}>
                <SettingsIcon />
                Settings
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenHistory()}>
                <HistoryIcon />
                History
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onCreateRoutine}>
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
          {routines === undefined && <p className="text-sm text-muted-foreground">Loading routines...</p>}
          {routines?.length === 0 && <p className="text-sm text-muted-foreground">No routines yet.</p>}

          {sortedRoutines?.map((routine) => {
            const routineId = routine.id;
            const isRunning = runnerState.sessions.some((session) => session.routineId === routine.id);
            const isExpanded = typeof routineId === 'number' && expandedRoutineId === routineId;

            return (
              <RoutineAccordionCard
                key={routine.id}
                routine={routine}
                isRunning={isRunning}
                isScheduledToday={isRoutineScheduledForDay(routine, todayDay)}
                isExpanded={isExpanded}
                busyAction={busyAction}
                clockNow={clockNow}
                onToggleExpanded={() => {
                  if (typeof routineId !== 'number') {
                    return;
                  }

                  setExpandedRoutineId((previous) => (previous === routineId ? null : routineId));
                }}
                onStart={() => void onStartRoutine(routine)}
                onEdit={() => {
                  if (typeof routineId === 'number') {
                    onEditRoutine(routineId);
                  }
                }}
                onExport={() => void onExportRoutine(routine)}
                onHistory={() => {
                  if (typeof routineId === 'number') {
                    onOpenHistory(routineId);
                  } else {
                    onOpenHistory();
                  }
                }}
                onDelete={() => onRequestDeleteRoutine(routine)}
                onMessage={onMessage}
                onError={onError}
              />
            );
          })}
        </CardContent>
      </Card>

      {runnerState.sessions.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Running routines</p>
              <div className="flex flex-wrap gap-2">
                {runnerState.sessions.map((session) => (
                  <Button
                    key={session.routineId}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void onFocusRoutineRunner(session.routineId)}
                  >
                    Focus #{session.routineId}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={Boolean(deleteDialogRoutine)}
        onOpenChange={(open) => {
          if (!open && !isDeletingRoutine) {
            setDeleteDialogRoutine(null);
          }
        }}
      >
        <DialogContent showCloseButton={!isDeletingRoutine}>
          <DialogHeader>
            <DialogTitle>Delete routine?</DialogTitle>
            <DialogDescription>
              {deleteDialogRoutine
                ? `This will permanently delete "${deleteDialogRoutine.name}".`
                : 'This will permanently delete the selected routine.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogRoutine(null)}
              disabled={isDeletingRoutine}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void onDeleteRoutine()}
              disabled={isDeletingRoutine}
            >
              Delete routine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function toFileSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toErrorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) {
    return value.message;
  }

  return fallback;
}
