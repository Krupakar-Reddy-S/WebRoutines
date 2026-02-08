import type { RoutineSession } from '@/lib/types';

export interface FocusedRunnerResolver {
  getFocusedSession: (
    sessions: RoutineSession[],
    focusedRoutineId: number | null | undefined,
  ) => RoutineSession | null;
  resolveFocusedRoutineId: (
    sessions: RoutineSession[],
    focusedRoutineId: number | null | undefined,
  ) => number | null;
}

export function getFocusedSession(
  sessions: RoutineSession[],
  focusedRoutineId: number | null | undefined,
): RoutineSession | null {
  if (sessions.length === 0) {
    return null;
  }

  if (typeof focusedRoutineId === 'number') {
    const focused = sessions.find((session) => session.routineId === focusedRoutineId);
    if (focused) {
      return focused;
    }
  }

  return sessions[0] ?? null;
}

export function resolveFocusedRoutineId(
  sessions: RoutineSession[],
  focusedRoutineId: number | null | undefined,
): number | null {
  if (sessions.length === 0) {
    return null;
  }

  if (
    typeof focusedRoutineId === 'number'
    && sessions.some((session) => session.routineId === focusedRoutineId)
  ) {
    return focusedRoutineId;
  }

  return sessions[0].routineId;
}

export const focusedRunnerResolver: FocusedRunnerResolver = {
  getFocusedSession,
  resolveFocusedRoutineId,
};
