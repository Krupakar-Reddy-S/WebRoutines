import { useLiveQuery } from 'dexie-react-hooks';
import { HistoryIcon, SettingsIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getFocusedSession as getFocusedSessionFromState } from '@/core/runner/focus';
import { StopRunnerDialog } from '@/components/StopRunnerDialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { db } from '@/lib/db';
import {
  navigateSessionByOffset,
  navigateToIndex,
  openCurrentSessionLink,
  stopActiveRoutine,
} from '@/lib/navigation';
import { MAX_STEP_NOTE_LENGTH, upsertRunStepNote } from '@/lib/run-history';
import { formatNavigationShortcutPair, useNavigationShortcuts } from '@/lib/navigation-shortcuts';
import { setSettingsPatch } from '@/lib/settings';
import {
  getRunnerState,
  setFocusModeActive,
  setFocusedRoutine,
  subscribeToRunnerState,
} from '@/lib/session';
import { useSettings } from '@/lib/use-settings';
import { formatElapsed } from '@/lib/time';
import { formatDuration } from '@/features/history/filtering';
import type { Routine, RoutineSession } from '@/lib/types';

import { ActiveRunnerCard } from '../components/ActiveRunnerCard';
import { EmptyState } from '../components/EmptyState';
import { StepList } from '../components/StepList';

interface RunnerState {
  sessions: RoutineSession[];
  focusedRoutineId: number | null;
}

interface RunnerHomeViewProps {
  onOpenRoutines: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
}

export function RunnerHomeView({
  onOpenRoutines,
  onOpenHistory,
  onOpenSettings,
  onMessage,
  onError,
}: RunnerHomeViewProps) {
  const { settings } = useSettings();
  const navigationShortcuts = useNavigationShortcuts();
  const [runnerState, setRunnerState] = useState<RunnerState>({ sessions: [], focusedRoutineId: null });
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [stopDialogRoutineId, setStopDialogRoutineId] = useState<number | null>(null);
  const [stepNoteDraft, setStepNoteDraft] = useState('');
  const [stepNoteDirty, setStepNoteDirty] = useState(false);
  const [noteStatus, setNoteStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const focusedSession = useMemo(
    () => getFocusedSessionFromState(runnerState.sessions, runnerState.focusedRoutineId),
    [runnerState.focusedRoutineId, runnerState.sessions],
  );

  const activeRunnerRowsKey = useMemo(
    () => runnerState.sessions.map((session) => `${session.routineId}:${session.currentIndex}:${session.loadMode}`).join('|'),
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

  const focusedRun = useLiveQuery(
    async () => {
      if (typeof focusedSession?.runId !== 'number') {
        return null;
      }

      return (await db.runs.get(focusedSession.runId)) ?? null;
    },
    [focusedSession?.runId],
  );

  const currentLink = useMemo(() => {
    if (!focusedSession || !focusedRoutine) {
      return null;
    }

    return focusedRoutine.links[focusedSession.currentIndex] ?? null;
  }, [focusedRoutine, focusedSession]);

  const routineById = useMemo(() => {
    const pairs = (activeRunnerRows ?? []).map(({ session, routine }) => [session.routineId, routine] as const);
    return new Map<number, Routine | null>(pairs);
  }, [activeRunnerRows]);

  const stopDialogSession = useMemo(() => {
    if (typeof stopDialogRoutineId !== 'number') {
      return null;
    }

    return runnerState.sessions.find((session) => session.routineId === stopDialogRoutineId) ?? null;
  }, [runnerState.sessions, stopDialogRoutineId]);

  const stopDialogRoutine = useMemo(() => {
    if (typeof stopDialogRoutineId !== 'number') {
      return null;
    }

    const matched = routineById.get(stopDialogRoutineId);
    if (matched !== undefined) {
      return matched;
    }

    if (focusedRoutine && focusedSession?.routineId === stopDialogRoutineId) {
      return focusedRoutine;
    }

    return null;
  }, [focusedRoutine, focusedSession?.routineId, routineById, stopDialogRoutineId]);

  const stopDialogRun = useLiveQuery(
    async () => {
      if (typeof stopDialogSession?.runId !== 'number') {
        return null;
      }

      return (await db.runs.get(stopDialogSession.runId)) ?? null;
    },
    [stopDialogSession?.runId],
  );

  const stopDialogAnalytics = useMemo(() => {
    const totalSteps = stopDialogRoutine?.links.length ?? 0;
    const currentStep = stopDialogSession
      ? Math.min(stopDialogSession.currentIndex + 1, totalSteps || 1)
      : 0;
    const completionPercent = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;
    const notesCount = stopDialogRun?.stepNotes?.length ?? 0;
    const totalActiveMs = stopDialogRun?.stepTimes?.reduce((sum, st) => sum + st.activeMs, 0) ?? 0;
    const activeTimeLabel = totalActiveMs > 0 ? formatDuration(totalActiveMs) : null;

    return { completionPercent, notesCount, activeTimeLabel };
  }, [stopDialogRoutine, stopDialogSession, stopDialogRun]);

  const canEditStepNote = typeof focusedSession?.runId === 'number';

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
    if (!focusedSession || !focusedRun) {
      setStepNoteDraft('');
      setStepNoteDirty(false);
      setNoteStatus('idle');
      return;
    }

    if (stepNoteDirty) {
      return;
    }

    const existing = focusedRun.stepNotes?.find((item) => item.stepIndex === focusedSession.currentIndex)?.note ?? '';
    setStepNoteDraft(existing);
    setStepNoteDirty(false);
    setNoteStatus('idle');
  }, [focusedRun, focusedSession, stepNoteDirty]);

  const flushFocusedStepNote = useCallback(async () => {
    if (!focusedSession || typeof focusedSession.runId !== 'number' || !stepNoteDirty) {
      return;
    }

    setNoteStatus('saving');

    try {
      await upsertRunStepNote(
        focusedSession.runId,
        focusedSession.currentIndex,
        stepNoteDraft,
      );
      setStepNoteDirty(false);
      setNoteStatus('saved');
    } catch {
      setNoteStatus('error');
    }
  }, [focusedSession, stepNoteDirty, stepNoteDraft]);

  useEffect(() => {
    if (!stepNoteDirty) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void flushFocusedStepNote();
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [flushFocusedStepNote, stepNoteDirty]);

  async function onFocusRoutineRunner(routineId: number) {
    await setFocusedRoutine(routineId);
  }

  async function onNavigateOffset(offset: number, routineId?: number) {
    const targetRoutineId = routineId ?? focusedSession?.routineId;

    if (typeof targetRoutineId !== 'number') {
      onError('No active routine to navigate.');
      return;
    }

    setBusyAction(offset > 0 ? `next-${targetRoutineId}` : `previous-${targetRoutineId}`);
    onError(null);
    onMessage(null);

    try {
      await flushFocusedStepNote();
      const updated = await navigateSessionByOffset(targetRoutineId, offset, 'sidepanel');
      if (!updated) {
        onError('No active routine to navigate.');
        return;
      }

      onMessage(offset > 0 ? 'Moved to next link.' : 'Moved to previous link.');
    } catch (navigationError) {
      onError(toErrorMessage(navigationError, 'Failed to navigate routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onJumpToIndex(index: number) {
    if (!focusedRoutine || !focusedSession) {
      return;
    }

    setBusyAction(`jump-${focusedSession.routineId}-${index}`);
    onError(null);
    onMessage(null);

    try {
      await flushFocusedStepNote();
      await navigateToIndex(
        focusedRoutine,
        focusedSession,
        index,
        {
          source: 'sidepanel',
          action: 'jump',
        },
      );
      onMessage(`Jumped to step ${index + 1}.`);
    } catch (jumpError) {
      onError(toErrorMessage(jumpError, 'Failed to jump to step.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onOpenCurrent(routineId?: number) {
    const targetRoutineId = routineId ?? focusedSession?.routineId;

    if (typeof targetRoutineId !== 'number') {
      onError('No active routine to open.');
      return;
    }

    setBusyAction(`open-current-${targetRoutineId}`);
    onError(null);
    onMessage(null);

    try {
      await flushFocusedStepNote();
      const updated = await openCurrentSessionLink(targetRoutineId, 'sidepanel');
      if (!updated) {
        onError('No active routine to open.');
        return;
      }

      onMessage('Opened current link.');
    } catch (openError) {
      onError(toErrorMessage(openError, 'Failed to open current link.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function executeStopRoutine(targetRoutineId: number) {
    setBusyAction(`stop-${targetRoutineId}`);
    onError(null);
    onMessage(null);

    try {
      await flushFocusedStepNote();
      const stopped = await stopActiveRoutine(targetRoutineId, 'sidepanel');
      onMessage(stopped ? 'Runner stopped and group tabs closed.' : 'No active runner found.');
      setStopDialogRoutineId(null);
    } catch (stopError) {
      onError(toErrorMessage(stopError, 'Failed to stop routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onStopRoutine(routineId?: number) {
    const targetRoutineId = routineId ?? focusedSession?.routineId;

    if (typeof targetRoutineId !== 'number') {
      onError('No active routine to stop.');
      return;
    }

    if (settings.confirmBeforeStop) {
      setStopDialogRoutineId(targetRoutineId);
      return;
    }

    await executeStopRoutine(targetRoutineId);
  }

  async function onEnterFocusMode() {
    if (!focusedSession) {
      onError('No focused runner to continue in focus mode.');
      return;
    }

    setBusyAction('enter-focus-mode');
    onError(null);
    onMessage(null);

    try {
      if (!settings.focusModeEnabled) {
        await setSettingsPatch({ focusModeEnabled: true });
      }

      await flushFocusedStepNote();
      await setFocusModeActive(true);
      window.close();
    } catch (focusModeError) {
      onError(toErrorMessage(focusModeError, 'Unable to enter focus mode.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function onQuickEnableFocusMode() {
    onError(null);
    onMessage(null);

    try {
      await setSettingsPatch({ focusModeEnabled: true });
      onMessage('Focus mode enabled. You can now enter focus mode from Runner Home.');
    } catch (updateError) {
      onError(toErrorMessage(updateError, 'Unable to enable focus mode.'));
    }
  }

  return (
    <>
      <Card size="sm">
        <CardHeader>
          <div>
            <div>
              <CardTitle>Runner Home</CardTitle>
              <CardDescription>Focus on active routine progress.</CardDescription>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onOpenRoutines}>
                Manage routines
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onOpenSettings}>
                <SettingsIcon />
                Settings
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onOpenHistory}>
                <HistoryIcon />
                History
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
            <EmptyState
              description="No active runners right now."
              action={(
                <Button type="button" size="sm" variant="outline" onClick={onOpenRoutines}>
                  Start a routine
                </Button>
              )}
            />
          )}

          {activeRunnerRows?.map(({ session, routine }) => (
            <ActiveRunnerCard
              key={session.routineId}
              session={session}
              routine={routine}
              isFocused={runnerState.focusedRoutineId === session.routineId}
              clockNow={clockNow}
              busyAction={busyAction}
              onFocus={() => void onFocusRoutineRunner(session.routineId)}
              onStop={() => void onStopRoutine(session.routineId)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Focused Runner</CardTitle>
          <CardDescription>{`Hotkeys: ${formatNavigationShortcutPair(navigationShortcuts)}.`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!focusedSession && <p className="text-sm text-muted-foreground">No focused runner.</p>}

          {focusedSession && focusedRoutine && (
            <>
              <div className="space-y-1.5 text-sm">
                <p className="font-medium">
                  {focusedRoutine.name} ({focusedSession.currentIndex + 1}/{focusedRoutine.links.length})
                </p>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${focusedRoutine.links.length > 0 ? Math.round(((focusedSession.currentIndex + 1) / focusedRoutine.links.length) * 100) : 0}%` }}
                  />
                </div>
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
                <div className="space-y-2 rounded-lg border border-dashed border-brand/30 bg-brand-glow p-2">
                  <p className="text-xs text-muted-foreground">Focus mode is currently disabled.</p>
                  <Button type="button" size="xs" variant="outline" onClick={() => void onQuickEnableFocusMode()}>
                    Enable focus mode
                  </Button>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Step note</p>
                <Textarea
                  value={stepNoteDraft}
                  disabled={!canEditStepNote}
                  onChange={(event) => {
                    if (!canEditStepNote) {
                      return;
                    }

                    setStepNoteDraft(event.target.value);
                    setStepNoteDirty(true);
                    setNoteStatus('idle');
                  }}
                  onBlur={() => {
                    if (!canEditStepNote) {
                      return;
                    }

                    void flushFocusedStepNote();
                  }}
                  rows={3}
                  maxLength={MAX_STEP_NOTE_LENGTH}
                  placeholder="Add a note for this step..."
                />
                <p className={`text-[11px] ${noteStatus === 'saved' ? 'text-brand' : noteStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {!canEditStepNote
                    ? 'Start or resume this run to add notes'
                    : noteStatus === 'saving'
                      ? 'Saving...'
                      : noteStatus === 'saved'
                        ? 'Saved'
                        : noteStatus === 'error'
                          ? 'Failed to save note'
                          : 'Notes are saved to this run only'}
                </p>
              </div>

              <Separator />
              <StepList
                routineId={focusedSession.routineId}
                links={focusedRoutine.links}
                session={focusedSession}
                currentIndex={focusedSession.currentIndex}
                busyAction={busyAction}
                onJump={(index) => void onJumpToIndex(index)}
              />
            </>
          )}
        </CardContent>
      </Card>

      <StopRunnerDialog
        open={stopDialogSession !== null}
        onOpenChange={(open) => {
          if (!open) {
            setStopDialogRoutineId(null);
          }
        }}
        busy={typeof stopDialogRoutineId === 'number' && busyAction === `stop-${stopDialogRoutineId}`}
        routineLabel={stopDialogRoutine?.name ?? (
          stopDialogSession ? `Routine #${stopDialogSession.routineId}` : 'Unknown routine'
        )}
        stepLabel={(() => {
          if (!stopDialogSession) {
            return 'N/A';
          }

          const totalSteps = stopDialogRoutine?.links.length ?? 0;
          if (totalSteps <= 0) {
            return `${stopDialogSession.currentIndex + 1}`;
          }

          return `${Math.min(stopDialogSession.currentIndex + 1, totalSteps)}/${totalSteps}`;
        })()}
        elapsedLabel={stopDialogSession ? formatElapsed(stopDialogSession.startedAt, clockNow) : 'N/A'}
        completionPercent={stopDialogAnalytics.completionPercent}
        notesCount={stopDialogAnalytics.notesCount}
        activeTimeLabel={stopDialogAnalytics.activeTimeLabel}
        onConfirm={() => {
          if (typeof stopDialogRoutineId !== 'number') {
            return;
          }

          void executeStopRoutine(stopDialogRoutineId);
        }}
      />
    </>
  );
}

function toErrorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) {
    return value.message;
  }

  return fallback;
}
