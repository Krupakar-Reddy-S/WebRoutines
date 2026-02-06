import { db } from '@/lib/db';
import type { Routine, RoutineLink } from '@/lib/types';

export interface RoutineInput {
  name: string;
  links: RoutineLink[];
}

export function parseLinksFromText(rawLinks: string): RoutineLink[] {
  const uniqueUrls = new Set<string>();

  return rawLinks
    .split(/\r?\n/)
    .map((line) => normalizeUrl(line))
    .filter((url): url is string => Boolean(url))
    .filter((url) => {
      if (uniqueUrls.has(url)) {
        return false;
      }

      uniqueUrls.add(url);
      return true;
    })
    .map((url) => ({
      id: createId(),
      url,
    }));
}

export function linksToEditorText(links: RoutineLink[]): string {
  return links.map((link) => link.url).join('\n');
}

export async function listRoutines(): Promise<Routine[]> {
  return db.routines.orderBy('updatedAt').reverse().toArray();
}

export async function createRoutine(input: RoutineInput): Promise<number> {
  const now = Date.now();

  return db.routines.add({
    name: input.name.trim(),
    links: input.links,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateRoutine(id: number, input: RoutineInput): Promise<void> {
  await db.routines.update(id, {
    name: input.name.trim(),
    links: input.links,
    updatedAt: Date.now(),
  });
}

export async function deleteRoutine(id: number): Promise<void> {
  await db.routines.delete(id);
}

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();

    if (protocol !== 'http:' && protocol !== 'https:') {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
