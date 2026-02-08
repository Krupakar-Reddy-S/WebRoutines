import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeftIcon, GripVerticalIcon, PlusIcon, SettingsIcon, XIcon } from 'lucide-react';
import { type DragEvent, type FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from 'react';

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
import { ConfirmDiscardDialog, ConfirmRemoveLinkDialog } from '@/features/editor/dialogs';
import { computeUnsavedChanges, parseDraftInputUrls, summarizeUrlChanges } from '@/features/editor/draft';
import { reorderDraftLinksById } from '@/features/editor/drag';
import { db } from '@/lib/db';
import {
  createRoutine,
  createRoutineLink,
  updateRoutine,
} from '@/lib/routines';
import { formatDateLabel, formatDateTimeLabel, formatLastRunLabel } from '@/lib/time';
import type { RoutineLink } from '@/lib/types';
import { getDisplayUrl } from '@/lib/url';

type LeaveTarget = 'routines' | 'settings';

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
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [initialName, setInitialName] = useState('');
  const [initialLinks, setInitialLinks] = useState<RoutineLink[]>([]);
  const [draggingLinkId, setDraggingLinkId] = useState<string | null>(null);
  const [dropTargetLinkId, setDropTargetLinkId] = useState<string | null>(null);
  const [confirmLinkRemovalId, setConfirmLinkRemovalId] = useState<string | null>(null);
  const [confirmDiscardTarget, setConfirmDiscardTarget] = useState<LeaveTarget | null>(null);
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
    setInitialName(routine.name);
    setInitialLinks(routine.links.map((link) => ({ ...link })));
    setNewLinkInput('');
    setDraggingLinkId(null);
    setDropTargetLinkId(null);
    setConfirmLinkRemovalId(null);
    setConfirmDiscardTarget(null);
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

  const unsavedChanges = useMemo(
    () => computeUnsavedChanges({
      routineId,
      loadedRoutineId,
      initialName,
      initialLinks,
      currentName: name,
      draftLinks,
    }),
    [draftLinks, initialLinks, initialName, loadedRoutineId, name, routineId],
  );

  const metadataText = useMemo(() => {
    if (!routine?.lastRunAt) {
      return 'Last run: Never run';
    }

    return `Last run: ${formatLastRunLabel(routine.lastRunAt, clockNow)} (${formatDateTimeLabel(routine.lastRunAt)})`;
  }, [clockNow, routine?.lastRunAt]);

  const metadataSubText = useMemo(() => {
    if (!routine) {
      return `${draftLinks.length} links`;
    }

    return `${draftLinks.length} links · Created ${formatDateLabel(routine.createdAt)}`;
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

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 60_000);

    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!unsavedChanges.hasChanges) {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [unsavedChanges.hasChanges]);

  async function onSaveRoutine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (!submitter || submitter.dataset.action !== 'save-routine') {
      return;
    }

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

  function onLinkInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onAddDraftLink();
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

  function openNavigationTarget(target: LeaveTarget) {
    if (target === 'routines') {
      onOpenRoutines();
      return;
    }

    onOpenSettings();
  }

  function requestNavigateAway(target: LeaveTarget) {
    if (unsavedChanges.hasChanges) {
      setConfirmDiscardTarget(target);
      return;
    }

    openNavigationTarget(target);
  }

  function onConfirmDiscardAndLeave() {
    if (!confirmDiscardTarget) {
      return;
    }

    const target = confirmDiscardTarget;
    setConfirmDiscardTarget(null);
    openNavigationTarget(target);
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

    setDraftLinks((previous) => reorderDraftLinksById(previous, draggingLinkId, targetLinkId));

    setDropTargetLinkId(null);
  }

  function resetEditor() {
    setName('');
    setNewLinkInput('');
    setDraftLinks([]);
    setInitialName('');
    setInitialLinks([]);
    setDraggingLinkId(null);
    setDropTargetLinkId(null);
    setConfirmLinkRemovalId(null);
    setConfirmDiscardTarget(null);
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
      <ConfirmDiscardDialog
        open={confirmDiscardTarget !== null}
        changes={unsavedChanges}
        summarizeUrlChanges={summarizeUrlChanges}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDiscardTarget(null);
          }
        }}
        onStay={() => setConfirmDiscardTarget(null)}
        onDiscard={onConfirmDiscardAndLeave}
      />
      <ConfirmRemoveLinkDialog
        open={pendingDraftRemovalLink !== null}
        url={pendingDraftRemovalLink?.url ?? null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmLinkRemovalId(null);
          }
        }}
        onCancel={() => setConfirmLinkRemovalId(null)}
        onConfirm={() => {
          if (!pendingDraftRemovalLink) {
            return;
          }
          onConfirmRemoveDraftLink(pendingDraftRemovalLink.id);
        }}
      />

      <Card size="sm">
        <CardHeader>
          <div>
            <CardTitle>{routineId ? 'Edit Routine' : 'New Routine'}</CardTitle>
            <CardDescription className="space-y-0.5">
              <p>{metadataSubText}</p>
              <p>{metadataText}</p>
            </CardDescription>
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => requestNavigateAway('routines')}>
                <ArrowLeftIcon />
                Back to routines
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => requestNavigateAway('settings')}>
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
                onKeyDown={onLinkInputKeyDown}
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
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-3">
              <Button type="button" variant="outline" onClick={() => requestNavigateAway('routines')}>
                Cancel
              </Button>
              <Button type="submit" data-action="save-routine" disabled={busyAction === 'save-routine'}>
                {routineId ? 'Save changes' : 'Create routine'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

function toErrorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) {
    return value.message;
  }

  return fallback;
}
