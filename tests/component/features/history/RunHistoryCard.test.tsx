import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RunHistoryCard } from '@/features/history/presentation';
import type { HistoryRow } from '@/features/history/types';

const sampleRow: HistoryRow = {
  run: {
    id: 1,
    routineId: 42,
    startedAt: Date.parse('2026-02-06T12:00:00.000Z'),
    stoppedAt: Date.parse('2026-02-06T12:10:00.000Z'),
    stepsCompleted: 3,
    totalSteps: 5,
    completedFull: false,
    mode: 'tab-group',
    durationMs: 600_000,
    stopReason: 'group-removed',
  },
  routine: {
    id: 42,
    name: 'Morning checks',
    links: [],
    createdAt: 1,
    updatedAt: 1,
  },
};

describe('RunHistoryCard', () => {
  it('renders run metadata and stop reason', () => {
    render(
      <RunHistoryCard
        row={sampleRow}
        clockNow={Date.parse('2026-02-06T12:20:00.000Z')}
        onFilterRoutine={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Morning checks' })).toBeInTheDocument();
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(screen.getByText('Partial')).toBeInTheDocument();
    expect(screen.getByText('Stop reason: group removed')).toBeInTheDocument();
  });

  it('calls onFilterRoutine when routine name is clicked', async () => {
    const user = userEvent.setup();
    const onFilterRoutine = vi.fn();

    render(
      <RunHistoryCard
        row={sampleRow}
        clockNow={Date.parse('2026-02-06T12:20:00.000Z')}
        onFilterRoutine={onFilterRoutine}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Morning checks' }));
    expect(onFilterRoutine).toHaveBeenCalledWith(42);
  });
});
