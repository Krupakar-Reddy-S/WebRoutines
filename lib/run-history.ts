import { db } from '@/lib/db';
import type {
  NavigationMode,
  Routine,
  RoutineRun,
  RoutineRunEventType,
  RoutineSession,
  RunStopReason,
} from '@/lib/types';

interface EnsureRunResult {
  runId: number;
  created: boolean;
}

export async function createRunForSession(
  routine: Routine,
  session: RoutineSession,
  mode: NavigationMode,
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
    mode,
    durationMs: null,
  };

  const runId = await db.runs.add(run);
  await logRunEvent(runId, routine.id!, 'start', session.currentIndex, session.startedAt);

  return runId;
}

export async function ensureRunForSession(
  session: RoutineSession,
  routine: Routine | null,
): Promise<EnsureRunResult | null> {
  if (typeof session.runId === 'number') {
    return { runId: session.runId, created: false };
  }

  if (!routine?.id) {
    return null;
  }

  const runId = await createRunForSession(routine, session, session.mode);
  return { runId, created: true };
}

export async function logStepChange(
  runId: number,
  routineId: number,
  stepIndex: number,
  timestamp: number = Date.now(),
): Promise<void> {
  await logRunEvent(runId, routineId, 'step', stepIndex, timestamp);
}

export async function finalizeRun(
  runId: number,
  routineId: number,
  stoppedAt: number,
  stopReason: RunStopReason,
): Promise<void> {
  const run = await db.runs.get(runId);
  if (!run || run.stoppedAt !== null) {
    return;
  }

  const routine = await db.routines.get(routineId);
  const totalSteps = routine?.links.length ?? run.totalSteps ?? 0;

  const events = await db.runEvents.where('runId').equals(runId).toArray();
  const maxStepIndex = events
    .filter((event) => typeof event.stepIndex === 'number')
    .reduce((max, event) => Math.max(max, event.stepIndex ?? max), -1);

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

  await logRunEvent(runId, routineId, 'stop', undefined, stoppedAt);
}

async function logRunEvent(
  runId: number,
  routineId: number,
  type: RoutineRunEventType,
  stepIndex?: number,
  timestamp: number = Date.now(),
): Promise<void> {
  await db.runEvents.add({
    runId,
    routineId,
    timestamp,
    type,
    stepIndex,
  });
}
