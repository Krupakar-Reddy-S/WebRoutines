import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeftIcon, PlusIcon, SettingsIcon, UploadIcon } from 'lucide-react';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { startRoutine, stopActiveRoutine } from '@/lib/navigation';
import {
  createRoutine,
  createRoutineBackupPayload,
  deleteRoutine,
  listRoutines,
  parseRoutineBackup,
} from '@/lib/routines';
import { getRunnerState, setFocusedRoutine, subscribeToRunnerState } from '@/lib/session';
import { useSettings } from '@/lib/use-settings';
import type { NavigationMode, Routine, RoutineSession } from '@/lib/types';

import { RoutineCard } from '../components/RoutineCard';

interface RunnerState {
  sessions: RoutineSession[];
  focusedRoutineId: number | null;
}

interface RoutinesViewProps {
  onOpenSettings: () => void;
  onOpenRunner: () => void;
  onCreateRoutine: () => void;
  onEditRoutine: (routineId: number) => void;
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
}

export function RoutinesView({
  onOpenSettings,
  onOpenRunner,
  onCreateRoutine,
  onEditRoutine,
  onMessage,
  onError,
}: RoutinesViewProps) {
  const { settings } = useSettings();
  const routines = useLiveQuery(() => listRoutines(), []);
  const [runnerState, setRunnerState] = useState<RunnerState>({ sessions: [], focusedRoutineId: null });
  const [routineSearchQuery, setRoutineSearchQuery] = useState('');
  const [expandedRoutineIds, setExpandedRoutineIds] = useState<number[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    void getRunnerState().then(setRunnerState);
    const unsubscribe = subscribeToRunnerState(setRunnerState);

    return unsubscribe;
  }, []);

  function onToggleRoutineLinks(routineId: number) {
    setExpandedRoutineIds((previous) => (
      previous.includes(routineId)
        ? previous.filter((id) => id !== routineId)
        : [...previous, routineId]
    ));
  }

  async function onStartRoutine(routine: Routine, mode: NavigationMode) {
    if (!routine.id) {
      return;
    }

    setBusyAction(`start-${routine.id}-${mode}`);
    onError(null);
    onMessage(null);

    try {
      const result = await startRoutine(routine, mode);

      if (result.alreadyRunning) {
        onMessage(`Runner already active for "${routine.name}". Showing existing runner.`);
      } else {
        onMessage(`Started "${routine.name}" in ${mode === 'same-tab' ? 'single-tab group' : 'multi-tab group'} mode.`);
      }

      onOpenRunner();
    } catch (startError) {
      onError(toErrorMessage(startError, 'Failed to start routine.'));
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
    onError(null);
    onMessage(null);

    try {
      const stopped = await stopActiveRoutine(routine.id);
      await deleteRoutine(routine.id);

      onMessage(stopped ? 'Routine deleted and active runner closed.' : 'Routine deleted.');
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

      for (const routineInput of routinesToImport) {
        await createRoutine(routineInput);
      }

      onMessage(`Imported ${routinesToImport.length} routine${routinesToImport.length === 1 ? '' : 's'}.`);
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
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Routines</CardTitle>
              <CardDescription>Create, run, edit, and backup routines.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onOpenSettings}>
                <SettingsIcon />
                Settings
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onOpenRunner}>
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

            return (
              <RoutineCard
                key={routine.id}
                routine={routine}
                isRunning={isRunning}
                isExpanded={isExpanded}
                defaultRunMode={settings.defaultRunMode}
                busyAction={busyAction}
                onToggleExpanded={() => {
                  if (typeof routineId === 'number') {
                    onToggleRoutineLinks(routineId);
                  }
                }}
                onFocus={() => {
                  if (typeof routineId === 'number') {
                    void onFocusRoutineRunner(routineId);
                  }
                }}
                onStart={(mode) => void onStartRoutine(routine, mode)}
                onEdit={() => {
                  if (typeof routineId === 'number') {
                    onEditRoutine(routineId);
                  }
                }}
                onExport={() => void onExportRoutine(routine)}
                onDelete={() => void onDeleteRoutine(routine)}
              />
            );
          })}
        </CardContent>
      </Card>
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
