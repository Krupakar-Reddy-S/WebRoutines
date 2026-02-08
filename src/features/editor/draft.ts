import { normalizeRoutineUrl } from '@/lib/routines';
import type { RoutineLink, RoutineScheduleDay } from '@/lib/types';
import { getDisplayUrl } from '@/lib/url';

export interface UnsavedChanges {
  hasChanges: boolean;
  nameChanged: boolean;
  scheduleChanged: boolean;
  addedUrls: string[];
  removedUrls: string[];
  orderChanged: boolean;
}

export interface UnsavedChangesInput {
  routineId: number | null;
  loadedRoutineId: number | null;
  initialName: string;
  initialLinks: RoutineLink[];
  initialScheduleDays: RoutineScheduleDay[];
  currentName: string;
  draftLinks: RoutineLink[];
  currentScheduleDays: RoutineScheduleDay[];
}

export function computeUnsavedChanges({
  routineId,
  loadedRoutineId,
  initialName,
  initialLinks,
  initialScheduleDays,
  currentName,
  draftLinks,
  currentScheduleDays,
}: UnsavedChangesInput): UnsavedChanges {
  if (routineId && loadedRoutineId !== routineId) {
    return {
      hasChanges: false,
      nameChanged: false,
      scheduleChanged: false,
      addedUrls: [],
      removedUrls: [],
      orderChanged: false,
    };
  }

  const trimmedInitialName = initialName.trim();
  const trimmedCurrentName = currentName.trim();
  const nameChanged = trimmedInitialName !== trimmedCurrentName;

  const initialUrls = initialLinks.map((link) => link.url);
  const draftUrls = draftLinks.map((link) => link.url);
  const initialSet = new Set(initialUrls);
  const draftSet = new Set(draftUrls);
  const addedUrls = draftUrls.filter((url) => !initialSet.has(url));
  const removedUrls = initialUrls.filter((url) => !draftSet.has(url));
  const sameMembers = addedUrls.length === 0 && removedUrls.length === 0 && initialUrls.length === draftUrls.length;
  const orderChanged = sameMembers && draftUrls.some((url, index) => url !== initialUrls[index]);
  const sortedInitialSchedule = [...initialScheduleDays].sort((left, right) => left - right);
  const sortedCurrentSchedule = [...currentScheduleDays].sort((left, right) => left - right);
  const scheduleChanged = sortedInitialSchedule.length !== sortedCurrentSchedule.length
    || sortedInitialSchedule.some((day, index) => day !== sortedCurrentSchedule[index]);

  return {
    hasChanges: nameChanged || scheduleChanged || addedUrls.length > 0 || removedUrls.length > 0 || orderChanged,
    nameChanged,
    scheduleChanged,
    addedUrls,
    removedUrls,
    orderChanged,
  };
}

export function parseDraftInputUrls(rawInput: string): string[] {
  const segments = rawInput
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  const dedupe = new Set<string>();
  const urls: string[] = [];

  for (const segment of segments) {
    const normalizedUrl = normalizeRoutineUrl(segment);
    if (!normalizedUrl || dedupe.has(normalizedUrl)) {
      continue;
    }

    dedupe.add(normalizedUrl);
    urls.push(normalizedUrl);
  }

  return urls;
}

export function summarizeUrlChanges(urls: string[]): string {
  const preview = urls.slice(0, 2).map((url) => getDisplayUrl(url)).join(', ');
  if (urls.length <= 2) {
    return preview;
  }

  return `${preview} +${urls.length - 2} more`;
}
