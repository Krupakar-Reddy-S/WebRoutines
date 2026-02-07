import { db } from '@/lib/db';
import type { Routine, RoutineLink } from '@/lib/types';

export interface RoutineInput {
  name: string;
  links: RoutineLink[];
}

interface BackupLinkRecord {
  url?: unknown;
  title?: unknown;
}

interface BackupRoutineRecord {
  name?: unknown;
  links?: unknown;
}

interface BackupRootRecord {
  version?: unknown;
  exportedAt?: unknown;
  routines?: unknown;
}

export function parseLinksFromText(rawLinks: string): RoutineLink[] {
  const uniqueUrls = new Set<string>();

  return rawLinks
    .split(/\r?\n/)
    .map((line) => normalizeRoutineUrl(line))
    .filter((url): url is string => Boolean(url))
    .filter((url) => {
      if (uniqueUrls.has(url)) {
        return false;
      }

      uniqueUrls.add(url);
      return true;
    })
    .map((url) => createRoutineLink(url));
}

export function linksToEditorText(links: RoutineLink[]): string {
  return links.map((link) => link.url).join('\n');
}

export function normalizeRoutineUrl(value: string): string | null {
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

export function createRoutineLink(url: string, title?: string): RoutineLink {
  return {
    id: createId(),
    url,
    title,
  };
}

export async function listRoutines(): Promise<Routine[]> {
  const routines = await db.routines.toArray();

  return routines.sort((left, right) => {
    const leftStamp = left.lastRunAt ?? left.updatedAt;
    const rightStamp = right.lastRunAt ?? right.updatedAt;
    return rightStamp - leftStamp;
  });
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

export async function importRoutines(routineInputs: RoutineInput[]): Promise<number> {
  if (routineInputs.length === 0) {
    return 0;
  }

  let createdCount = 0;

  await db.transaction('rw', db.routines, async () => {
    for (const input of routineInputs) {
      const name = input.name.trim();
      const links = input.links;

      if (!name || !Array.isArray(links) || links.length === 0) {
        throw new Error('Import contains an invalid routine entry.');
      }

      const now = Date.now();
      await db.routines.add({
        name,
        links,
        createdAt: now,
        updatedAt: now,
      });
      createdCount += 1;
    }
  });

  return createdCount;
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

export async function setRoutineLastRunAt(id: number, timestamp: number): Promise<void> {
  await db.routines.update(id, {
    lastRunAt: timestamp,
  });
}

export function createRoutineBackupPayload(routines: Routine[]) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    routines: routines.map((routine) => ({
      name: routine.name,
      links: routine.links.map((link) => ({
        url: link.url,
        title: link.title,
      })),
    })),
  };
}

export function parseRoutineBackup(rawJson: string): RoutineInput[] {
  const parsed = JSON.parse(rawJson) as unknown;
  const root = normalizeBackupRoot(parsed);

  if (root.routines.length === 0) {
    throw new Error('Backup file contains no routines.');
  }

  const inputs: RoutineInput[] = [];

  for (const routineRecord of root.routines) {
    const parsedRoutine = parseBackupRoutine(routineRecord);
    if (!parsedRoutine) {
      continue;
    }

    inputs.push(parsedRoutine);
  }

  if (inputs.length === 0) {
    throw new Error('No valid routines found in backup file.');
  }

  return inputs;
}

function parseBackupRoutine(record: BackupRoutineRecord): RoutineInput | null {
  const name = typeof record.name === 'string' ? record.name.trim() : '';

  if (!name) {
    return null;
  }

  const linksSource = Array.isArray(record.links) ? record.links : [];
  const dedupe = new Set<string>();
  const links: RoutineLink[] = [];

  for (const source of linksSource) {
    if (typeof source === 'string') {
      const url = normalizeRoutineUrl(source);
      if (!url || dedupe.has(url)) {
        continue;
      }

      dedupe.add(url);
      links.push(createRoutineLink(url));
      continue;
    }

    if (!source || typeof source !== 'object') {
      continue;
    }

    const typedSource = source as BackupLinkRecord;
    const urlValue = typeof typedSource.url === 'string' ? typedSource.url : '';
    const url = normalizeRoutineUrl(urlValue);

    if (!url || dedupe.has(url)) {
      continue;
    }

    dedupe.add(url);
    links.push(createRoutineLink(url, typeof typedSource.title === 'string' ? typedSource.title : undefined));
  }

  if (links.length === 0) {
    return null;
  }

  return {
    name,
    links,
  };
}

function normalizeBackupRoot(input: unknown): { routines: BackupRoutineRecord[] } {
  if (Array.isArray(input)) {
    return {
      routines: input.filter(isObject) as BackupRoutineRecord[],
    };
  }

  if (!isObject(input)) {
    throw new Error('Backup JSON must be an object or array.');
  }

  const root = input as BackupRootRecord;

  if (Array.isArray(root.routines)) {
    return {
      routines: root.routines.filter(isObject) as BackupRoutineRecord[],
    };
  }

  throw new Error('Backup JSON is missing a routines array.');
}

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
