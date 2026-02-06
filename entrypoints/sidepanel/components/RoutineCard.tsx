import { DownloadIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { NavigationMode, Routine } from '@/lib/types';

interface RoutineCardProps {
  routine: Routine;
  isRunning: boolean;
  isExpanded: boolean;
  defaultRunMode: NavigationMode;
  busyAction: string | null;
  onToggleExpanded: () => void;
  onFocus: () => void;
  onStart: (mode: NavigationMode) => void;
  onEdit: () => void;
  onExport: () => void;
  onDelete: () => void;
}

export function RoutineCard({
  routine,
  isRunning,
  isExpanded,
  defaultRunMode,
  busyAction,
  onToggleExpanded,
  onFocus,
  onStart,
  onEdit,
  onExport,
  onDelete,
}: RoutineCardProps) {
  const routineId = routine.id;
  const hasHiddenLinks = routine.links.length > 3;
  const visibleLinks = hasHiddenLinks && !isExpanded
    ? routine.links.slice(0, 3)
    : routine.links;

  return (
    <Card size="sm" className="border border-border/80">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>{routine.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{routine.links.length} links</p>
          </div>
          <div className="flex items-center gap-2">
            {isRunning && <Badge variant="secondary">Running</Badge>}
            {isRunning && typeof routineId === 'number' && (
              <Button type="button" size="xs" variant="outline" onClick={onFocus}>
                Focus
              </Button>
            )}
            <Badge variant="secondary">#{routine.id}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <ol className="space-y-1 pl-4 text-xs text-muted-foreground">
          {visibleLinks.map((link) => (
            <li key={link.id} className="list-decimal break-all">
              {link.url}
            </li>
          ))}
        </ol>
        {hasHiddenLinks && typeof routineId === 'number' && (
          <Button type="button" size="xs" variant="ghost" onClick={onToggleExpanded}>
            {isExpanded ? 'Show less' : `Show all ${routine.links.length} links`}
          </Button>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={defaultRunMode === 'same-tab' ? 'default' : 'outline'}
          onClick={() => onStart('same-tab')}
          disabled={busyAction === `start-${routine.id}-same-tab`}
        >
          Run single-tab
        </Button>

        <Button
          type="button"
          size="sm"
          variant={defaultRunMode === 'tab-group' ? 'default' : 'outline'}
          onClick={() => onStart('tab-group')}
          disabled={busyAction === `start-${routine.id}-tab-group`}
        >
          Run multi-tab
        </Button>

        <Button type="button" size="sm" variant="outline" onClick={onEdit}>
          Edit
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onExport}
          disabled={busyAction === `export-routine-${routine.id}`}
        >
          <DownloadIcon />
          Export JSON
        </Button>

        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={onDelete}
          disabled={busyAction === `delete-${routine.id}`}
        >
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
