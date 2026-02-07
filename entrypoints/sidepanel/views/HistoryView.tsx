import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeftIcon, SettingsIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { db } from '@/lib/db';
import { cn } from '@/lib/utils';
import type { Routine, RoutineRun } from '@/lib/types';

interface HistoryRow {
  run: RoutineRun;
  routine: Routine | null;
}

interface HistoryGroup {
  label: string;
  rows: HistoryRow[];
}

interface HistoryViewProps {
  onOpenRunner: () => void;
  onOpenSettings: () => void;
}

interface HistoryStats {
  totalRuns: number;
  totalDurationMs: number;
  completionRate: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RUNS_PAGE_SIZE = 20;

type RunStatusFilter = 'all' | 'in-progress' | 'complete' | 'partial';

export function HistoryView({
  onOpenRunner,
  onOpenSettings,
}: HistoryViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clockNow, setClockNow] = useState(() => Date.now());

  const selectedRoutineId = useMemo(
    () => parseRoutineFilter(searchParams.get('routine')),
    [searchParams],
  );

  const selectedStatusFilter = useMemo(
    () => parseStatusFilter(searchParams.get('status')),
    [searchParams],
  );

  const currentPage = useMemo(
    () => parsePage(searchParams.get('page')),
    [searchParams],
  );

  const rows = useLiveQuery(
    async () => {
      const allRuns = await db.runs.orderBy('startedAt').reverse().toArray();
      const filteredRuns = typeof selectedRoutineId === 'number'
        ? allRuns.filter((run) => run.routineId === selectedRoutineId)
        : allRuns;

      const routineIds = [...new Set(filteredRuns.map((run) => run.routineId))];
      const loadedRoutines = routineIds.length > 0 ? await db.routines.bulkGet(routineIds) : [];
      const routineById = new Map<number, Routine>();

      routineIds.forEach((routineId, index) => {
        const routine = loadedRoutines[index];
        if (routine?.id) {
          routineById.set(routineId, routine);
        }
      });

      return filteredRuns.map((run) => ({
        run,
        routine: routineById.get(run.routineId) ?? null,
      }));
    },
    [selectedRoutineId],
  );

  const routineFilterOptions = useLiveQuery(
    async () => {
      const runs = await db.runs.toArray();
      const routineIds = [...new Set(runs.map((run) => run.routineId))];

      if (routineIds.length === 0) {
        return [] as Routine[];
      }

      const loadedRoutines = await db.routines.bulkGet(routineIds);
      return loadedRoutines
        .filter((routine): routine is Routine => Boolean(routine?.id))
        .sort((left, right) => {
          const leftStamp = left.lastRunAt ?? left.updatedAt;
          const rightStamp = right.lastRunAt ?? right.updatedAt;
          return rightStamp - leftStamp;
        });
    },
    [],
  );

  const filteredRows = useMemo(
    () => (rows ?? []).filter((row) => rowMatchesStatusFilter(row, selectedStatusFilter)),
    [rows, selectedStatusFilter],
  );

  const selectedRoutineLabel = useMemo(() => {
    if (typeof selectedRoutineId !== 'number') {
      return 'All routines';
    }

    const matched = routineFilterOptions?.find((routine) => routine.id === selectedRoutineId);
    if (matched) {
      return matched.name;
    }

    return `Routine #${selectedRoutineId}`;
  }, [routineFilterOptions, selectedRoutineId]);

  const selectedStatusLabel = useMemo(
    () => getStatusFilterLabel(selectedStatusFilter),
    [selectedStatusFilter],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRows.length / RUNS_PAGE_SIZE)),
    [filteredRows.length],
  );

  const safeCurrentPage = useMemo(
    () => Math.min(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const pageRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * RUNS_PAGE_SIZE;
    return filteredRows.slice(start, start + RUNS_PAGE_SIZE);
  }, [filteredRows, safeCurrentPage]);

  const stats = useMemo(
    () => computeHistoryStats(filteredRows, clockNow),
    [clockNow, filteredRows],
  );

  const groupedRows = useMemo(
    () => groupRowsByDate(pageRows, clockNow),
    [clockNow, pageRows],
  );

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 30_000);

    return () => window.clearInterval(timerId);
  }, []);

  function onSelectRoutineFilter(value: string | null) {
    if (!value) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);

    if (value === 'all') {
      nextParams.delete('routine');
    } else {
      nextParams.set('routine', value);
    }
    nextParams.delete('page');

    setSearchParams(nextParams);
  }

  function onSelectStatusFilter(value: string | null) {
    if (!value) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);

    if (value === 'all') {
      nextParams.delete('status');
    } else {
      nextParams.set('status', value);
    }
    nextParams.delete('page');

    setSearchParams(nextParams);
  }

  function onFocusRoutineFilter(routineId: number) {
    onSelectRoutineFilter(String(routineId));
  }

  function onPageChange(nextPage: number) {
    if (!Number.isFinite(nextPage)) {
      return;
    }

    const safePage = Math.max(1, Math.min(totalPages, Math.floor(nextPage)));
    const nextParams = new URLSearchParams(searchParams);

    if (safePage <= 1) {
      nextParams.delete('page');
    } else {
      nextParams.set('page', String(safePage));
    }

    setSearchParams(nextParams);
  }

  return (
    <>
      <Card size="sm">
        <CardHeader>
          <div>
            <CardTitle>History</CardTitle>
            <CardDescription>Run stats and recent routine activity.</CardDescription>
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onOpenRunner}>
                <ArrowLeftIcon />
                Back to runner
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onOpenSettings}>
                <SettingsIcon />
                Settings
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Summary</CardTitle>
              <CardDescription>{`${selectedRoutineLabel} · ${selectedStatusLabel}`}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={typeof selectedRoutineId === 'number' ? String(selectedRoutineId) : 'all'}
                onValueChange={onSelectRoutineFilter}
              >
                <SelectTrigger className="h-8 w-[10.5rem]" id="history-routine-filter">
                  <SelectValue>{selectedRoutineLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All routines</SelectItem>
                  {routineFilterOptions?.map((routine) => (
                    <SelectItem key={routine.id} value={String(routine.id)}>
                      {routine.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedStatusFilter}
                onValueChange={onSelectStatusFilter}
              >
                <SelectTrigger className="h-8 w-[8rem]" id="history-status-filter">
                  <SelectValue>{selectedStatusLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="in-progress">In progress</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              label="Total runs"
              value={String(stats.totalRuns)}
            />
            <StatCard
              label="Total time"
              value={formatDuration(stats.totalDurationMs)}
            />
            <StatCard
              label="Completion"
              value={`${stats.completionRate}%`}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
          <CardDescription>
            {filteredRows.length} run{filteredRows.length === 1 ? '' : 's'} found
            {` · Page ${safeCurrentPage} of ${totalPages}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows === undefined && (
            <p className="text-sm text-muted-foreground">Loading run history...</p>
          )}

          {rows?.length === 0 && (
            <p className="text-sm text-muted-foreground">No run history yet. Start a routine to build history.</p>
          )}
          {rows && rows.length > 0 && filteredRows.length === 0 && (
            <p className="text-sm text-muted-foreground">No runs match the selected filters.</p>
          )}

          {groupedRows.map((group) => (
            <section key={group.label} className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
              <div className="space-y-2">
                {group.rows.map((row) => (
                  <RunHistoryCard
                    key={row.run.id}
                    row={row}
                    clockNow={clockNow}
                    onFilterRoutine={onFocusRoutineFilter}
                  />
                ))}
              </div>
            </section>
          ))}

          {filteredRows.length > RUNS_PAGE_SIZE && (
            <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-2">
              <p className="text-xs text-muted-foreground">
                Showing {(safeCurrentPage - 1) * RUNS_PAGE_SIZE + 1}
                -
                {Math.min(safeCurrentPage * RUNS_PAGE_SIZE, filteredRows.length)}
                {` of ${filteredRows.length}`}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => onPageChange(safeCurrentPage - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => onPageChange(safeCurrentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

interface StatCardProps {
  label: string;
  value: string;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-card px-2 py-2">
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

interface RunHistoryCardProps {
  row: HistoryRow;
  clockNow: number;
  onFilterRoutine: (routineId: number) => void;
}

function RunHistoryCard({ row, clockNow, onFilterRoutine }: RunHistoryCardProps) {
  const { run, routine } = row;
  const routineLabel = routine?.name ?? `Routine #${run.routineId}`;
  const runTimeLabel = formatTimeOfDay(run.startedAt);
  const durationLabel = run.stoppedAt === null
    ? 'In progress'
    : formatDuration(resolveRunDurationMs(run, clockNow));
  const completionLabel = run.stoppedAt === null
    ? 'In progress'
    : run.completedFull
      ? 'Complete'
      : 'Partial';

  return (
    <div className="rounded-lg border border-border/70 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="truncate text-left text-sm font-medium hover:underline"
          onClick={() => onFilterRoutine(run.routineId)}
        >
          {routineLabel}
        </button>
        <span className="text-xs text-muted-foreground">{runTimeLabel}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StepDots completed={run.stepsCompleted} total={run.totalSteps} />
        <span className="text-xs text-muted-foreground">
          {Math.min(Math.max(run.stepsCompleted, 0), Math.max(run.totalSteps, 0))}
          /
          {Math.max(run.totalSteps, 0)}
        </span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">{durationLabel}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <Badge
          variant={run.stoppedAt === null ? 'outline' : run.completedFull ? 'secondary' : 'outline'}
          className={cn(
            run.stoppedAt === null ? 'text-blue-600 dark:text-blue-400' : '',
            run.completedFull ? 'text-emerald-700 dark:text-emerald-400' : '',
          )}
        >
          {completionLabel}
        </Badge>
      </div>

      {run.stopReason && run.stopReason !== 'user-stop' && run.stoppedAt !== null && (
        <p className="mt-1 text-xs text-muted-foreground">
          Stop reason: {run.stopReason.replace(/-/g, ' ')}
        </p>
      )}
    </div>
  );
}

interface StepDotsProps {
  completed: number;
  total: number;
  maxDots?: number;
}

function StepDots({ completed, total, maxDots = 10 }: StepDotsProps) {
  const safeTotal = Math.max(0, total);
  const safeCompleted = Math.min(Math.max(0, completed), safeTotal);

  if (safeTotal === 0) {
    return <span className="text-xs text-muted-foreground">No steps</span>;
  }

  if (safeTotal <= maxDots) {
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: safeTotal }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              index < safeCompleted ? 'bg-emerald-500' : 'bg-muted-foreground/30',
            )}
          />
        ))}
      </div>
    );
  }

  const headCount = 4;
  const tailCount = 3;
  const tailStartIndex = Math.max(safeTotal - tailCount, headCount);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: headCount }, (_, index) => (
        <span
          key={`h-${index}`}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            index < safeCompleted ? 'bg-emerald-500' : 'bg-muted-foreground/30',
          )}
        />
      ))}
      <span className="text-[10px] text-muted-foreground">…</span>
      {Array.from({ length: tailCount }, (_, offset) => {
        const index = tailStartIndex + offset;
        return (
          <span
            key={`t-${index}`}
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              index < safeCompleted ? 'bg-emerald-500' : 'bg-muted-foreground/30',
            )}
          />
        );
      })}
    </div>
  );
}

function parseRoutineFilter(rawValue: string | null): number | null {
  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePage(rawValue: string | null): number {
  if (!rawValue) {
    return 1;
  }

  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseStatusFilter(rawValue: string | null): RunStatusFilter {
  if (rawValue === 'in-progress' || rawValue === 'complete' || rawValue === 'partial') {
    return rawValue;
  }

  return 'all';
}

function rowMatchesStatusFilter(row: HistoryRow, statusFilter: RunStatusFilter): boolean {
  if (statusFilter === 'all') {
    return true;
  }

  if (statusFilter === 'in-progress') {
    return row.run.stoppedAt === null;
  }

  if (statusFilter === 'complete') {
    return row.run.stoppedAt !== null && row.run.completedFull;
  }

  return row.run.stoppedAt !== null && !row.run.completedFull;
}

function getStatusFilterLabel(statusFilter: RunStatusFilter): string {
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

function computeHistoryStats(rows: HistoryRow[], clockNow: number): HistoryStats {
  if (rows.length === 0) {
    return {
      totalRuns: 0,
      totalDurationMs: 0,
      completionRate: 0,
    };
  }

  const totalDurationMs = rows.reduce(
    (sum, row) => sum + resolveRunDurationMs(row.run, clockNow),
    0,
  );
  const completedCount = rows.filter((row) => row.run.completedFull).length;

  return {
    totalRuns: rows.length,
    totalDurationMs,
    completionRate: Math.round((completedCount / rows.length) * 100),
  };
}

function resolveRunDurationMs(run: RoutineRun, clockNow: number): number {
  if (typeof run.durationMs === 'number') {
    return Math.max(0, run.durationMs);
  }

  if (typeof run.stoppedAt === 'number') {
    return Math.max(0, run.stoppedAt - run.startedAt);
  }

  return Math.max(0, clockNow - run.startedAt);
}

function groupRowsByDate(rows: HistoryRow[], clockNow: number): HistoryGroup[] {
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

function formatTimeOfDay(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(durationMs: number): string {
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
