import type { Routine, RoutineRun, RunActionEvent } from '@/lib/types';

export interface HistoryRow {
  run: RoutineRun;
  routine: Routine | null;
}

export interface HistoryGroup {
  label: string;
  rows: HistoryRow[];
}

export interface HistoryStats {
  totalRuns: number;
  totalDurationMs: number;
  averageDurationMs: number;
  completionRate: number;
}

export type RunStatusFilter = 'all' | 'in-progress' | 'complete' | 'partial';

export interface HistoryRowsQueryResult {
  rows: HistoryRow[];
  totalRows: number;
  stats: HistoryStats;
}

export interface HistoryRunDetailResult {
  run: RoutineRun;
  routine: Routine | null;
  actionEvents: RunActionEvent[];
}
