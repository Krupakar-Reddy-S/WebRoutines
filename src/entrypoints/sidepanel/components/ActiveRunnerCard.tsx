import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Routine, RoutineSession } from '@/lib/types';
import { formatElapsed } from '@/lib/time';

interface ActiveRunnerCardProps {
  session: RoutineSession;
  routine: Routine | null;
  isFocused: boolean;
  clockNow: number;
  busyAction: string | null;
  onFocus: () => void;
  onStop: () => void;
}

export function ActiveRunnerCard({
  session,
  routine,
  isFocused,
  clockNow,
  busyAction,
  onFocus,
  onStop,
}: ActiveRunnerCardProps) {
  const totalLinks = routine?.links.length ?? 0;
  const stepNumber = totalLinks > 0 ? Math.min(session.currentIndex + 1, totalLinks) : 0;
  const progressPercent = totalLinks > 0 ? Math.round((stepNumber / totalLinks) * 100) : 0;
  const progressLabel = totalLinks > 0
    ? `Step ${stepNumber}/${totalLinks} (${progressPercent}%)`
    : 'Link count unavailable';

  return (
    <div className="rounded-lg border border-border/70 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{routine?.name ?? `Routine #${session.routineId}`}</p>
          <p className="text-xs text-muted-foreground">Tab group runner</p>
          <p className="text-xs text-muted-foreground">
            Loading: {session.loadMode === 'lazy' ? 'lazy' : 'all tabs'}
          </p>
          <p className="text-xs text-muted-foreground">
            {progressLabel} · Active {formatElapsed(session.startedAt, clockNow)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isFocused && <Badge variant="secondary">Focused</Badge>}
          <Button type="button" size="sm" variant="outline" onClick={onFocus}>
            Focus
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={onStop}
            disabled={busyAction === `stop-${session.routineId}`}
          >
            Stop
          </Button>
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
