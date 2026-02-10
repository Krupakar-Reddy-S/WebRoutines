import { db } from '@/lib/db';
import type {
  Routine,
  RunActionEvent,
  RunActionEventAction,
  RunActionEventSource,
  RoutineRun,
  RoutineSession,
  RunStopReason,
  RunStepNote,
  RunStepTime,
} from '@/lib/types';

interface EnsureRunResult {
  runId: number;
  created: boolean;
}

export const MAX_STEP_NOTE_LENGTH = 2_000;

export async function createRunForSession(
  routine: Routine,
  session: RoutineSession,
  source: RunActionEventSource = 'system',
): Promise<number> {
  const totalSteps = routine.links.length;
  const startingStep = Math.min(session.currentIndex + 1, totalSteps || 0);

  const run: RoutineRun = {
    routineId: routine.id!,
    startedAt: session.startedAt,
    stoppedAt: null,
    stepsCompleted: startingStep,
    totalSteps,
    completedFull: false,
    mode: 'tab-group',
    durationMs: null,
  };

  const runId = await db.runs.add(run);
  await logRunActionEvent({
    runId,
    routineId: routine.id!,
    timestamp: session.startedAt,
    type: 'run-start',
    source,
    toStepIndex: session.currentIndex,
  });

  return runId;
}

export async function ensureRunForSession(
  session: RoutineSession,
  routine: Routine | null,
  source: RunActionEventSource = 'system',
): Promise<EnsureRunResult | null> {
  if (typeof session.runId === 'number') {
    return { runId: session.runId, created: false };
  }

  if (!routine?.id) {
    return null;
  }

  const runId = await createRunForSession(routine, session, source);
  return { runId, created: true };
}

export async function finalizeRun(
  runId: number,
  routineId: number,
  stoppedAt: number,
  stopReason: RunStopReason,
  source: RunActionEventSource = 'system',
): Promise<void> {
  const run = await db.runs.get(runId);
  if (!run || run.stoppedAt !== null) {
    return;
  }

  const routine = await db.routines.get(routineId);
  const totalSteps = routine?.links.length ?? run.totalSteps ?? 0;

  const actionEvents = await db.runActionEvents.where('runId').equals(runId).toArray();
  const maxStepIndex = actionEvents
    .filter((event) => typeof event.toStepIndex === 'number')
    .reduce((max, event) => Math.max(max, event.toStepIndex!, max), -1);

  const stepsCompleted = totalSteps > 0
    ? Math.min(Math.max(maxStepIndex + 1, 1), totalSteps)
    : 0;
  const completedFull = totalSteps > 0 && stepsCompleted >= totalSteps;
  const durationMs = Math.max(0, stoppedAt - run.startedAt);

  await db.runs.update(runId, {
    stoppedAt,
    stepsCompleted,
    totalSteps,
    completedFull,
    durationMs,
    stopReason,
  });

  await logRunActionEvent({
    runId,
    routineId,
    timestamp: stoppedAt,
    type: 'run-stop',
    action: resolveStopAction(stopReason),
    source,
    toStepIndex: Math.max(0, Math.min(stepsCompleted - 1, Math.max(totalSteps - 1, 0))),
    meta: { stopReason },
  });
}

export async function upsertRunStepNote(
  runId: number,
  stepIndex: number,
  rawNote: string,
  updatedAt: number = Date.now(),
): Promise<void> {
  const run = await db.runs.get(runId);
  if (!run) {
    return;
  }

  const note = rawNote.trim().slice(0, MAX_STEP_NOTE_LENGTH);
  const withoutCurrentStep = (run.stepNotes ?? []).filter((item) => item.stepIndex !== stepIndex);

  const nextStepNotes: RunStepNote[] = note
    ? [...withoutCurrentStep, { stepIndex, note, updatedAt }].sort((left, right) => left.stepIndex - right.stepIndex)
    : withoutCurrentStep;

  await db.runs.update(runId, {
    stepNotes: nextStepNotes.length > 0 ? nextStepNotes : undefined,
  });
}

export async function addRunStepActiveMs(
  runId: number,
  stepIndex: number,
  activeMsDelta: number,
): Promise<void> {
  const safeDelta = Math.max(0, Math.floor(activeMsDelta));
  if (safeDelta <= 0) {
    return;
  }

  const run = await db.runs.get(runId);
  if (!run) {
    return;
  }

  const stepTimes = run.stepTimes ?? [];
  const existing = stepTimes.find((item) => item.stepIndex === stepIndex);
  const withoutCurrentStep = stepTimes.filter((item) => item.stepIndex !== stepIndex);

  const nextStepTime: RunStepTime = {
    stepIndex,
    activeMs: Math.max(0, Math.floor((existing?.activeMs ?? 0) + safeDelta)),
  };

  const nextStepTimes = [...withoutCurrentStep, nextStepTime]
    .sort((left, right) => left.stepIndex - right.stepIndex);

  await db.runs.update(runId, {
    stepTimes: nextStepTimes,
  });
}

export async function logRunNavigationAction(input: {
  runId: number;
  routineId: number;
  source: RunActionEventSource;
  action: Extract<RunActionEventAction, 'next' | 'previous' | 'jump' | 'open-current'>;
  fromStepIndex: number;
  toStepIndex: number;
  timestamp?: number;
}): Promise<void> {
  const {
    runId,
    routineId,
    source,
    action,
    fromStepIndex,
    toStepIndex,
    timestamp = Date.now(),
  } = input;

  await logRunActionEvent({
    runId,
    routineId,
    timestamp,
    type: 'navigate',
    action,
    source,
    fromStepIndex,
    toStepIndex,
  });
}

export async function logRunStepSyncAction(input: {
  runId: number;
  routineId: number;
  source: RunActionEventSource;
  action: Extract<RunActionEventAction, 'manual-tab-activate' | 'tab-removed-shift'>;
  fromStepIndex: number;
  toStepIndex: number;
  timestamp?: number;
}): Promise<void> {
  const {
    runId,
    routineId,
    source,
    action,
    fromStepIndex,
    toStepIndex,
    timestamp = Date.now(),
  } = input;

  await logRunActionEvent({
    runId,
    routineId,
    timestamp,
    type: 'step-sync',
    action,
    source,
    fromStepIndex,
    toStepIndex,
  });
}

export async function logRunActionEvent(event: Omit<RunActionEvent, 'id'>): Promise<void> {
  await db.runActionEvents.add(event);
}

function resolveStopAction(stopReason: RunStopReason): Extract<
  RunActionEventAction,
  'group-removed' | 'tabs-closed' | 'user-stop' | 'system-stop'
> {
  if (stopReason === 'group-removed') {
    return 'group-removed';
  }

  if (stopReason === 'tabs-closed') {
    return 'tabs-closed';
  }

  if (stopReason === 'user-stop') {
    return 'user-stop';
  }

  return 'system-stop';
}
