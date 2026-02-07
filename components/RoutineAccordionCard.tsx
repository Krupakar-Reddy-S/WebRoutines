import { ChevronDownIcon, ChevronUpIcon, MoreVerticalIcon, PlayIcon } from 'lucide-react';
import { useMemo } from 'react';

import { FaviconImage } from '@/components/FaviconImage';
import { FaviconStrip } from '@/components/FaviconStrip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatLastRunLabel } from '@/lib/time';
import type { Routine, RoutineLink } from '@/lib/types';
import { getDisplayUrl } from '@/lib/url';

interface RoutineAccordionCardProps {
  routine: Routine;
  isRunning: boolean;
  isExpanded: boolean;
  busyAction: string | null;
  clockNow: number;
  onToggleExpanded: () => void;
  onStart: () => void;
  onEdit: () => void;
  onExport: () => void;
  onHistory: () => void;
  onDelete: () => void;
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
}

export function RoutineAccordionCard({
  routine,
  isRunning,
  isExpanded,
  busyAction,
  clockNow,
  onToggleExpanded,
  onStart,
  onEdit,
  onExport,
  onHistory,
  onDelete,
  onMessage,
  onError,
}: RoutineAccordionCardProps) {
  const lastRunLabel = useMemo(() => {
    return formatLastRunLabel(routine.lastRunAt, clockNow);
  }, [clockNow, routine.lastRunAt]);

  async function onOpenLink(link: RoutineLink) {
    try {
      await browser.tabs.create({ url: link.url, active: true });
      onMessage('Opened link in new tab.');
    } catch (error) {
      onError(toErrorMessage(error, 'Failed to open link in new tab.'));
    }
  }

  async function onCopyLink(link: RoutineLink) {
    try {
      await navigator.clipboard.writeText(link.url);
      onMessage('Copied URL.');
    } catch (error) {
      onError(toErrorMessage(error, 'Failed to copy URL.'));
    }
  }

  return (
    <div
      className={`rounded-xl border border-border/70 p-3 ${
        isRunning ? 'border-emerald-500/40 shadow-[inset_3px_0_0_0_rgba(16,185,129,0.7)]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          onClick={onToggleExpanded}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{routine.name}</p>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
              {isRunning && <Badge variant="secondary">Running</Badge>}
              <span>{routine.links.length} links</span>
              <span>{lastRunLabel}</span>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUpIcon className="text-muted-foreground mt-0.5 size-4" />
          ) : (
            <ChevronDownIcon className="text-muted-foreground mt-0.5 size-4" />
          )}
        </button>

        <div className="flex flex-col gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={onStart}
            disabled={busyAction === `start-${routine.id}`}
            aria-label="Run routine"
          >
            <PlayIcon />
          </Button>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <FaviconStrip links={routine.links} />
        <Button type="button" size="xs" variant="outline" onClick={onEdit}>
          Edit
        </Button>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3 border-t border-border/70 pt-3">
          <div className="space-y-1.5">
            {routine.links.map((link, index) => (
              <div
                key={link.id}
                className="flex items-center gap-2 rounded-lg border border-border/70 px-2 py-1.5 text-xs"
              >
                <span className="text-muted-foreground w-4 text-right">{index + 1}</span>
                <FaviconImage url={link.url} sizeClassName="h-4 w-4" />
                <span className="min-w-0 flex-1 truncate">{getDisplayUrl(link.url)}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button type="button" size="icon-xs" variant="ghost" />}>
                    <MoreVerticalIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void onOpenLink(link)}>Open in new tab</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void onCopyLink(link)}>Copy URL</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onHistory}
            >
              History
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onExport}
              disabled={busyAction === `export-routine-${routine.id}`}
            >
              Export
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={onDelete}
              disabled={busyAction === `delete-${routine.id}`}
            >
              Delete routine
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function toErrorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) {
    return value.message;
  }

  return fallback;
}
