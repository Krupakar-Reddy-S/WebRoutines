import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeftIcon, SettingsIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  formatDuration,
  getStatusFilterLabel,
  groupRowsByDate,
  parsePage,
  parseRoutineFilter,
  parseStatusFilter,
} from '@/features/history/filtering';
import { RunHistoryCard, StatCard } from '@/features/history/presentation';
import { queryHistoryRows, queryRoutineFilterOptions } from '@/features/history/query';

const RUNS_PAGE_SIZE = 20;

interface HistoryViewProps {
  onOpenRunner: () => void;
  onOpenSettings: () => void;
}

export function HistoryView({
  onOpenRunner,
  onOpenSettings,
}: HistoryViewProps) {
  const navigate = useNavigate();
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

  const historyData = useLiveQuery(
    async () => queryHistoryRows({
      routineId: selectedRoutineId,
      statusFilter: selectedStatusFilter,
      page: currentPage,
      pageSize: RUNS_PAGE_SIZE,
      clockNow,
    }),
    [selectedRoutineId, selectedStatusFilter, currentPage, clockNow],
  );

  const routineFilterOptions = useLiveQuery(
    async () => queryRoutineFilterOptions(),
    [],
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

  const totalRows = historyData?.totalRows ?? 0;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalRows / RUNS_PAGE_SIZE)),
    [totalRows],
  );

  const safeCurrentPage = useMemo(
    () => Math.min(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const rows = useMemo(
    () => historyData?.rows ?? [],
    [historyData?.rows],
  );

  const groupedRows = useMemo(
    () => groupRowsByDate(rows, clockNow),
    [clockNow, rows],
  );

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 30_000);

    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (safeCurrentPage === currentPage) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    if (safeCurrentPage <= 1) {
      nextParams.delete('page');
    } else {
      nextParams.set('page', String(safeCurrentPage));
    }

    setSearchParams(nextParams);
  }, [currentPage, safeCurrentPage, searchParams, setSearchParams]);

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

  function onOpenRunDetails(runId: number) {
    navigate(`/history/run/${runId}`);
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

  const isLoading = historyData === undefined;

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
              value={String(historyData?.stats.totalRuns ?? 0)}
            />
            <StatCard
              label="Total time"
              value={formatDuration(historyData?.stats.totalDurationMs ?? 0)}
            />
            <StatCard
              label="Completion"
              value={`${historyData?.stats.completionRate ?? 0}%`}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
          <CardDescription>
            {totalRows} run{totalRows === 1 ? '' : 's'} found
            {` · Page ${safeCurrentPage} of ${totalPages}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading run history...</p>
          )}

          {!isLoading && totalRows === 0 && (
            <p className="text-sm text-muted-foreground">No run history yet. Start a routine to build history.</p>
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
                    onOpenRunDetails={onOpenRunDetails}
                  />
                ))}
              </div>
            </section>
          ))}

          {totalRows > RUNS_PAGE_SIZE && (
            <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-2">
              <p className="text-xs text-muted-foreground">
                Showing {(safeCurrentPage - 1) * RUNS_PAGE_SIZE + 1}
                -
                {Math.min(safeCurrentPage * RUNS_PAGE_SIZE, totalRows)}
                {` of ${totalRows}`}
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
