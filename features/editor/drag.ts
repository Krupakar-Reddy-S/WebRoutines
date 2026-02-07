import type { RoutineLink } from '@/lib/types';

export function reorderDraftLinksById(
  links: RoutineLink[],
  sourceLinkId: string,
  targetLinkId: string,
): RoutineLink[] {
  if (sourceLinkId === targetLinkId) {
    return links;
  }

  const fromIndex = links.findIndex((link) => link.id === sourceLinkId);
  const toIndex = links.findIndex((link) => link.id === targetLinkId);

  if (fromIndex < 0 || toIndex < 0) {
    return links;
  }

  const next = [...links];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
