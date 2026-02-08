import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeftIcon, HistoryIcon, SettingsIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDuration, formatTimeOfDay, resolveRunDurationMs } from '@/features/history/filtering';
import { queryHistoryRunDetail } from '@/features/history/query';
import type { HistoryRunDetailResult } from '@/features/history/types';
import type { RunActionEvent, RunStepNote } from '@/lib/types';

interface HistoryRunDetailViewProps {
  runId: number;
  onOpenHistory: () => void;
  onOpenRunner: () => void;
  onOpenSettings: () => void;
}

export function HistoryRunDetailView({
  runId,
  onOpenHistory,
  onOpenRunner,
  onOpenSettings,
}: HistoryRunDetailViewProps) {
  const [clockNow, setClockNow] = useState(() => Date.now());

  const detail = useLiveQuery(
    async () => queryHistoryRunDetail(runId),
    [runId],
  );

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 30_000);

    return () => window.clearInterval(timerId);
  }, []);

  if (detail === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Run Details</CardTitle>
          <CardDescription>Loading run details...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (detail === null) {
    return (
      <>
        <Card size="sm">
          <CardHeader>
            <div>
              <CardTitle>Run Details</CardTitle>
              <CardDescription>Run not found.</CardDescription>
              <div className="mt-2">
                <Button type="button" size="sm" variant="outline" onClick={onOpenHistory}>
                  <ArrowLeftIcon />
                  Back to history
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      </>
    );
  }

  const run = detail.run;
  const routineLabel = detail.routine?.name ?? `Routine #${run.routineId}`;
  const runStatus = run.stoppedAt === null
    ? 'In progress'
    : run.completedFull
      ? 'Complete'
      : 'Partial';

  const stepNotes = [...(run.stepNotes ?? [])].sort((left, right) => left.stepIndex - right.stepIndex);

  return (
    <>
      <Card size="sm">
        <CardHeader>
          <div>
            <CardTitle>Run Details</CardTitle>
            <CardDescription>{routineLabel}</CardDescription>
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onOpenHistory}>
                <ArrowLeftIcon />
                Back to history
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onOpenRunner}>
                <HistoryIcon />
                Runner
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
          <CardTitle>Summary</CardTitle>
          <CardDescription>
            Started {new Date(run.startedAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={runStatus === 'Complete' ? 'secondary' : 'outline'}>{runStatus}</Badge>
            <span className="text-muted-foreground">{run.stepsCompleted}/{run.totalSteps} steps</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {formatDuration(resolveRunDurationMs(run, clockNow))}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Stop reason: {run.stopReason ? run.stopReason.replace(/-/g, ' ') : 'N/A'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Action Timeline</CardTitle>
          <CardDescription>{detail.actionEvents.length} event{detail.actionEvents.length === 1 ? '' : 's'}</CardDescription>
        </CardHeader>
        <CardContent>
          {detail.actionEvents.length === 0 && (
            <p className="text-sm text-muted-foreground">No action events recorded for this run.</p>
          )}

          {detail.actionEvents.length > 0 && (
            <div className="space-y-2">
              {detail.actionEvents.map((event) => (
                <ActionEventRow key={event.id ?? `${event.timestamp}-${event.type}`} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step Notes</CardTitle>
          <CardDescription>{stepNotes.length} note{stepNotes.length === 1 ? '' : 's'}</CardDescription>
        </CardHeader>
        <CardContent>
          {stepNotes.length === 0 && (
            <p className="text-sm text-muted-foreground">No notes captured in this run.</p>
          )}

          {stepNotes.length > 0 && (
            <div className="space-y-2">
              {stepNotes.map((note) => (
                <StepNoteRow key={`${note.stepIndex}-${note.updatedAt}`} note={note} detail={detail} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function ActionEventRow({ event }: { event: RunActionEvent }) {
  const actionLabel = describeAction(event);

  return (
    <div className="rounded-lg border border-border/70 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{actionLabel}</p>
        <Badge variant="outline">{event.source}</Badge>
        <span className="text-muted-foreground">{formatTimeOfDay(event.timestamp)}</span>
      </div>
      {(typeof event.fromStepIndex === 'number' || typeof event.toStepIndex === 'number') && (
        <p className="mt-1 text-muted-foreground">
          Step {formatStepIndex(event.fromStepIndex)} → {formatStepIndex(event.toStepIndex)}
        </p>
      )}
      {event.meta?.stopReason && (
        <p className="mt-1 text-muted-foreground">
          Stop reason: {event.meta.stopReason.replace(/-/g, ' ')}
        </p>
      )}
    </div>
  );
}

function StepNoteRow({
  note,
  detail,
}: {
  note: RunStepNote;
  detail: HistoryRunDetailResult;
}) {
  const link = detail.routine?.links[note.stepIndex];

  return (
    <div className="rounded-lg border border-border/70 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Step {note.stepIndex + 1}</p>
        {link?.url && <span className="text-muted-foreground truncate">{new URL(link.url).hostname}</span>}
        <span className="text-muted-foreground">{formatTimeOfDay(note.updatedAt)}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm">{note.note}</p>
    </div>
  );
}

function describeAction(event: RunActionEvent): string {
  if (event.type === 'run-start') {
    return 'Run started';
  }

  if (event.type === 'run-stop') {
    return event.action ? `Run stopped (${event.action.replace(/-/g, ' ')})` : 'Run stopped';
  }

  if (event.action) {
    return event.action.replace(/-/g, ' ');
  }

  return event.type.replace(/-/g, ' ');
}

function formatStepIndex(value: number | undefined): string {
  if (typeof value !== 'number') {
    return '—';
  }

  return String(value + 1);
}
