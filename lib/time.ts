export function formatElapsed(startedAt: number, now: number): string {
  const elapsedMs = Math.max(0, now - startedAt);
  const totalMinutes = Math.floor(elapsedMs / 60_000);

  if (totalMinutes < 1) {
    return 'just now';
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

const RELATIVE_TIME_UNITS = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
] as const;

export function formatRelativeTime(timestamp: number, now: number): string {
  const elapsedMs = Math.max(0, now - timestamp);

  if (elapsedMs < 60_000) {
    return 'just now';
  }

  for (const { unit, ms } of RELATIVE_TIME_UNITS) {
    if (elapsedMs < ms) {
      continue;
    }

    const value = Math.floor(elapsedMs / ms);
    return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
  }

  return 'just now';
}

export function formatLastRunLabel(lastRunAt: number | undefined, now: number): string {
  if (typeof lastRunAt !== 'number') {
    return 'Never run';
  }

  return formatRelativeTime(lastRunAt, now);
}

export function formatDateLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTimeLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
