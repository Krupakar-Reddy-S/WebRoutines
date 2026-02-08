import Dexie from 'dexie';

import { db } from '@/lib/db';
import type { Routine, RoutineRun } from '@/lib/types';

import { resolveRunDurationMs, runMatchesStatusFilter } from '@/features/history/filtering';
import type { HistoryRowsQueryResult, HistoryStats, RunStatusFilter } from '@/features/history/types';

interface QueryHistoryRowsInput {
  routineId: number | null;
  statusFilter: RunStatusFilter;
  page: number;
  pageSize: number;
  clockNow: number;
}

export async function queryHistoryRows({
  routineId,
  statusFilter,
  page,
  pageSize,
  clockNow,
}: QueryHistoryRowsInput): Promise<HistoryRowsQueryResult> {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const startOffset = (safePage - 1) * safePageSize;

  const matchingRuns: RoutineRun[] = [];
  let totalRows = 0;
  let completedCount = 0;
  let totalDurationMs = 0;

  const runsCollection = getRunsCollection(routineId);

  await runsCollection.each((run) => {
    if (!runMatchesStatusFilter(run, statusFilter)) {
      return;
    }

    totalRows += 1;
    if (run.completedFull) {
      completedCount += 1;
    }
    totalDurationMs += resolveRunDurationMs(run, clockNow);

    if (totalRows <= startOffset || matchingRuns.length >= safePageSize) {
      return;
    }

    matchingRuns.push(run);
  });

  const routinesById = await getRoutineMapForRuns(matchingRuns);
  const rows = matchingRuns.map((run) => ({
    run,
    routine: routinesById.get(run.routineId) ?? null,
  }));

  return {
    rows,
    totalRows,
    stats: buildHistoryStats(totalRows, totalDurationMs, completedCount),
  };
}

export async function queryRoutineFilterOptions(): Promise<Routine[]> {
  const keys = await db.runs.orderBy('routineId').uniqueKeys();
  const routineIds = keys
    .filter((key): key is number => typeof key === 'number' && Number.isInteger(key) && key > 0);

  if (routineIds.length === 0) {
    return [];
  }

  const loadedRoutines = await db.routines.bulkGet(routineIds);

  return loadedRoutines
    .filter((routine): routine is Routine => Boolean(routine?.id))
    .sort((left, right) => {
      const leftStamp = left.lastRunAt ?? left.updatedAt;
      const rightStamp = right.lastRunAt ?? right.updatedAt;
      return rightStamp - leftStamp;
    });
}

function getRunsCollection(routineId: number | null) {
  if (typeof routineId === 'number') {
    return db.runs
      .where('[routineId+startedAt]')
      .between([routineId, Dexie.minKey], [routineId, Dexie.maxKey])
      .reverse();
  }

  return db.runs.orderBy('startedAt').reverse();
}

async function getRoutineMapForRuns(runs: RoutineRun[]): Promise<Map<number, Routine>> {
  const routineIds = [...new Set(runs.map((run) => run.routineId))];
  if (routineIds.length === 0) {
    return new Map();
  }

  const routines = await db.routines.bulkGet(routineIds);
  const byId = new Map<number, Routine>();

  routines.forEach((routine) => {
    if (routine?.id) {
      byId.set(routine.id, routine);
    }
  });

  return byId;
}

function buildHistoryStats(
  totalRows: number,
  totalDurationMs: number,
  completedCount: number,
): HistoryStats {
  if (totalRows === 0) {
    return {
      totalRuns: 0,
      totalDurationMs: 0,
      completionRate: 0,
    };
  }

  return {
    totalRuns: totalRows,
    totalDurationMs,
    completionRate: Math.round((completedCount / totalRows) * 100),
  };
}
