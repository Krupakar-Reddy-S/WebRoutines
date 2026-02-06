import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeftIcon, GripVerticalIcon, PlusIcon, SettingsIcon, XIcon } from 'lucide-react';
import { type DragEvent, type FormEvent, useEffect, useMemo, useState } from 'react';

import { FaviconImage } from '@/components/FaviconImage';
import { ImportFromTabsDialog } from '@/components/ImportFromTabsDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/db';
import {
  createRoutine,
  createRoutineLink,
  normalizeRoutineUrl,
  updateRoutine,
} from '@/lib/routines';
import type { RoutineLink } from '@/lib/types';
import { getDisplayUrl } from '@/lib/url';

interface EditorViewProps {
  routineId: number | null;
  onOpenSettings: () => void;
  onOpenRoutines: () => void;
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
}

export function EditorView({
  routineId,
  onOpenSettings,
  onOpenRoutines,
  onMessage,
  onError,
}: EditorViewProps) {
  const [name, setName] = useState('');
  const [newLinkInput, setNewLinkInput] = useState('');
  const [draftLinks, setDraftLinks] = useState<RoutineLink[]>([]);
  const [draggingLinkId, setDraggingLinkId] = useState<string | null>(null);
  const [dropTargetLinkId, setDropTargetLinkId] = useState<string | null>(null);
  const [confirmLinkRemovalId, setConfirmLinkRemovalId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [loadedRoutineId, setLoadedRoutineId] = useState<number | null>(null);
  const [importTabsDialogOpen, setImportTabsDialogOpen] = useState(false);

  const routine = useLiveQuery(
    async () => (routineId ? (await db.routines.get(routineId)) ?? null : null),
    [routineId],
  );

  useEffect(() => {
    if (!routineId) {
      if (loadedRoutineId !== null) {
        resetEditor();
      }
      return;
    }

    if (routine === null) {
      onError('Routine not found.');
      return;
    }

    if (!routine) {
      return;
    }

    if (loadedRoutineId === routineId) {
      return;
    }

    setName(routine.name);
    setDraftLinks(routine.links.map((link) => ({ ...link })));
    setNewLinkInput('');
    setDraggingLinkId(null);
    setDropTargetLinkId(null);
    setConfirmLinkRemovalId(null);
    setImportTabsDialogOpen(false);
    setLoadedRoutineId(routineId);
  }, [loadedRoutineId, routine, routineId, onError]);

  const parsedDraftInputUrls = useMemo(
    () => parseDraftInputUrls(newLinkInput),
    [newLinkInput],
  );

  const pendingDraftRemovalLink = useMemo(
    () => draftLinks.find((link) => link.id === confirmLinkRemovalId) ?? null,
    [confirmLinkRemovalId, draftLinks],
  );

  const metadataText = useMemo(() => {
    if (!routine) {
      return `${draftLinks.length} links`;
    }

    const createdText = new Date(routine.createdAt).toLocaleDateString();
    const lastRunText = routine.lastRunAt
      ? new Date(routine.lastRunAt).toLocaleString()
      : 'Never';

    return `${draftLinks.length} links · Created ${createdText} · Last run ${lastRunText}`;
  }, [draftLinks.length, routine]);

  useEffect(() => {
    if (!confirmLinkRemovalId) {
      return;
    }

    if (draftLinks.some((link) => link.id === confirmLinkRemovalId)) {
      return;
    }

    setConfirmLinkRemovalId(null);
  }, [confirmLinkRemovalId, draftLinks]);

  async function onSaveRoutine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError(null);
    onMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      onError('Routine name is required.');
      return;
    }

    if (draftLinks.length === 0) {
      onError('Add at least one valid http/https link.');
      return;
    }

    setBusyAction('save-routine');

    try {
      if (routineId) {
        await updateRoutine(routineId, { name: trimmedName, links: draftLinks });
        onMessage('Routine updated.');
      } else {
        await createRoutine({ name: trimmedName, links: draftLinks });
        onMessage('Routine created.');
      }

      resetEditor();
      onOpenRoutines();
    } catch (saveError) {
      onError(toErrorMessage(saveError, 'Failed to save routine.'));
    } finally {
      setBusyAction(null);
    }
  }

  function onAddDraftLink() {
    onError(null);
    onMessage(null);

    if (parsedDraftInputUrls.length === 0) {
      onError('Enter valid http/https URLs (comma-separated or one per line).');
      return;
    }

    const existingUrls = new Set(draftLinks.map((link) => link.url));
    const urlsToAdd = parsedDraftInputUrls.filter((url) => !existingUrls.has(url));

    if (urlsToAdd.length === 0) {
      onError('All provided links already exist in this routine.');
      return;
    }

    setDraftLinks((previous) => [...previous, ...urlsToAdd.map((url) => createRoutineLink(url))]);
    setNewLinkInput('');
    const skippedCount = parsedDraftInputUrls.length - urlsToAdd.length;
    onMessage(
      skippedCount > 0
        ? `Added ${urlsToAdd.length} link${urlsToAdd.length === 1 ? '' : 's'} (${skippedCount} duplicates skipped).`
        : `Added ${urlsToAdd.length} link${urlsToAdd.length === 1 ? '' : 's'}.`,
    );
  }

  async function onAddImportedUrls(urls: string[]) {
    onError(null);
    onMessage(null);

    const existingUrls = new Set(draftLinks.map((link) => link.url));
    const urlsToAdd = urls.filter((url) => !existingUrls.has(url));

    if (urlsToAdd.length === 0) {
      onError('Selected tabs are already in this routine.');
      return;
    }

    setDraftLinks((previous) => [...previous, ...urlsToAdd.map((url) => createRoutineLink(url))]);

    const skippedCount = urls.length - urlsToAdd.length;
    onMessage(
      skippedCount > 0
        ? `Imported ${urlsToAdd.length} tab${urlsToAdd.length === 1 ? '' : 's'} (${skippedCount} duplicates skipped).`
        : `Imported ${urlsToAdd.length} tab${urlsToAdd.length === 1 ? '' : 's'}.`,
    );
  }

  function onConfirmRemoveDraftLink(linkId: string) {
    setDraftLinks((previous) => previous.filter((link) => link.id !== linkId));
    setConfirmLinkRemovalId(null);
    onMessage('Link removed from routine draft.');
  }

  function onDragStartLink(event: DragEvent<HTMLDivElement>, linkId: string) {
    setDraggingLinkId(linkId);
    setDropTargetLinkId(linkId);
    event.dataTransfer.effectAllowed = 'move';
  }

  function onDragEnterLink(event: DragEvent<HTMLDivElement>, targetLinkId: string) {
    event.preventDefault();

    if (!draggingLinkId || draggingLinkId === targetLinkId) {
      return;
    }

    setDropTargetLinkId(targetLinkId);
  }

  function onDragOverLink(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function onDropLink(event: DragEvent<HTMLDivElement>, targetLinkId: string) {
    event.preventDefault();

    if (!draggingLinkId || draggingLinkId === targetLinkId) {
      setDropTargetLinkId(null);
      return;
    }

    setDraftLinks((previous) => {
      const fromIndex = previous.findIndex((link) => link.id === draggingLinkId);
      const toIndex = previous.findIndex((link) => link.id === targetLinkId);

      if (fromIndex < 0 || toIndex < 0) {
        return previous;
      }

      const next = [...previous];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });

    setDropTargetLinkId(null);
  }

  function resetEditor() {
    setName('');
    setNewLinkInput('');
    setDraftLinks([]);
    setDraggingLinkId(null);
    setDropTargetLinkId(null);
    setConfirmLinkRemovalId(null);
    setImportTabsDialogOpen(false);
    setLoadedRoutineId(null);
  }

  return (
    <>
      <ImportFromTabsDialog
        open={importTabsDialogOpen}
        existingUrls={draftLinks.map((link) => link.url)}
        onOpenChange={setImportTabsDialogOpen}
        onAddUrls={onAddImportedUrls}
      />

      <Card size="sm">
        <CardHeader>
          <div>
            <CardTitle>{routineId ? 'Edit Routine' : 'New Routine'}</CardTitle>
            <CardDescription>{metadataText}</CardDescription>
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onOpenRoutines}>
                <ArrowLeftIcon />
                Back to routines
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
        <CardContent className="pt-6">
          <form className="space-y-3" onSubmit={onSaveRoutine}>
            <div className="space-y-1.5">
              <Label htmlFor="routine-name">Name</Label>
              <Input
                id="routine-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Morning Reads"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="routine-link">Add link</Label>
              <Input
                id="routine-link"
                value={newLinkInput}
                onChange={(event) => setNewLinkInput(event.target.value)}
                placeholder="https://example.com/blog, https://news.ycombinator.com"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={onAddDraftLink}>
                  <PlusIcon />
                  {parsedDraftInputUrls.length > 0 ? `Add (${parsedDraftInputUrls.length})` : 'Add'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setImportTabsDialogOpen(true)}>
                  Import from tabs
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste one or more URLs here. Supported formats: comma-separated or one URL per line.
              </p>
            </div>

            <div className="space-y-2">
              {draftLinks.length === 0 && (
                <p className="text-xs text-muted-foreground">No links yet. Add your first link above.</p>
              )}

              {draftLinks.map((link, index) => (
                <div
                  key={link.id}
                  draggable
                  onDragStart={(event) => onDragStartLink(event, link.id)}
                  onDragEnter={(event) => onDragEnterLink(event, link.id)}
                  onDragOver={onDragOverLink}
                  onDrop={(event) => onDropLink(event, link.id)}
                  onDragEnd={() => {
                    setDraggingLinkId(null);
                    setDropTargetLinkId(null);
                  }}
                  className={`flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5 transition-colors ${
                    dropTargetLinkId === link.id && draggingLinkId !== link.id
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border/70'
                  } ${
                    draggingLinkId === link.id ? 'opacity-70' : ''
                  }`}
                >
                  <GripVerticalIcon className="size-4 text-muted-foreground" />
                  <Badge variant="secondary">{index + 1}</Badge>
                  <FaviconImage url={link.url} sizeClassName="h-4 w-4" />
                  <p className="flex-1 truncate text-xs text-muted-foreground">{getDisplayUrl(link.url)}</p>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="outline"
                    onClick={() => setConfirmLinkRemovalId(link.id)}
                    aria-label="Remove link"
                  >
                    <XIcon />
                  </Button>
                </div>
              ))}

              {pendingDraftRemovalLink && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2">
                  <p className="text-xs font-medium text-destructive">Remove this link from the routine?</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{pendingDraftRemovalLink.url}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="xs"
                      variant="destructive"
                      onClick={() => onConfirmRemoveDraftLink(pendingDraftRemovalLink.id)}
                    >
                      Remove link
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => setConfirmLinkRemovalId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-3">
              <Button type="button" variant="outline" onClick={onOpenRoutines}>
                Cancel
              </Button>
              <Button type="submit" disabled={busyAction === 'save-routine'}>
                {routineId ? 'Save changes' : 'Create routine'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

function parseDraftInputUrls(rawInput: string): string[] {
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

function toErrorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) {
    return value.message;
  }

  return fallback;
}
