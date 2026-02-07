import type { RoutineRun } from '@/lib/types';

import type { HistoryGroup, HistoryRow, RunStatusFilter } from '@/features/history/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseRoutineFilter(rawValue: string | null): number | null {
  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parsePage(rawValue: string | null): number {
  if (!rawValue) {
    return 1;
  }

  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseStatusFilter(rawValue: string | null): RunStatusFilter {
  if (rawValue === 'in-progress' || rawValue === 'complete' || rawValue === 'partial') {
    return rawValue;
  }

  return 'all';
}

export function runMatchesStatusFilter(run: RoutineRun, statusFilter: RunStatusFilter): boolean {
  if (statusFilter === 'all') {
    return true;
  }

  if (statusFilter === 'in-progress') {
    return run.stoppedAt === null;
  }

  if (statusFilter === 'complete') {
    return run.stoppedAt !== null && run.completedFull;
  }

  return run.stoppedAt !== null && !run.completedFull;
}

export function rowMatchesStatusFilter(row: HistoryRow, statusFilter: RunStatusFilter): boolean {
  return runMatchesStatusFilter(row.run, statusFilter);
}

export function getStatusFilterLabel(statusFilter: RunStatusFilter): string {
  switch (statusFilter) {
    case 'in-progress':
      return 'In progress';
    case 'complete':
      return 'Complete';
    case 'partial':
      return 'Partial';
    case 'all':
    default:
      return 'All statuses';
  }
}

export function resolveRunDurationMs(run: RoutineRun, clockNow: number): number {
  if (typeof run.durationMs === 'number') {
    return Math.max(0, run.durationMs);
  }

  if (typeof run.stoppedAt === 'number') {
    return Math.max(0, run.stoppedAt - run.startedAt);
  }

  return Math.max(0, clockNow - run.startedAt);
}

export function groupRowsByDate(rows: HistoryRow[], clockNow: number): HistoryGroup[] {
  if (rows.length === 0) {
    return [];
  }

  const groups = new Map<string, HistoryRow[]>();

  for (const row of rows) {
    const label = getDateGroupLabel(row.run.startedAt, clockNow);
    const current = groups.get(label) ?? [];
    current.push(row);
    groups.set(label, current);
  }

  const orderedLabels = ['Today', 'Yesterday', 'This week', 'Earlier'];
  return orderedLabels
    .map((label) => ({
      label,
      rows: groups.get(label) ?? [],
    }))
    .filter((group) => group.rows.length > 0);
}

function getDateGroupLabel(timestamp: number, now: number): string {
  const startOfToday = getStartOfDay(now);
  const startOfTimestamp = getStartOfDay(timestamp);

  if (startOfTimestamp === startOfToday) {
    return 'Today';
  }

  if (startOfTimestamp === startOfToday - DAY_MS) {
    return 'Yesterday';
  }

  if (timestamp >= startOfToday - (7 * DAY_MS)) {
    return 'This week';
  }

  return 'Earlier';
}

function getStartOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function formatTimeOfDay(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDuration(durationMs: number): string {
  const safeMs = Math.max(0, durationMs);
  const totalSeconds = Math.floor(safeMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);

  if (totalMinutes < 1) {
    return `${Math.max(totalSeconds, 0)}s`;
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
