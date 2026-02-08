import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { formatDuration, formatTimeOfDay, resolveRunDurationMs } from '@/features/history/filtering';
import type { HistoryRow } from '@/features/history/types';

interface StatCardProps {
  label: string;
  value: string;
}

export function StatCard({ label, value }: StatCardProps) {
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

export function RunHistoryCard({ row, clockNow, onFilterRoutine }: RunHistoryCardProps) {
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
