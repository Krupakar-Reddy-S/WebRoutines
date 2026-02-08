import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { UnsavedChanges } from '@/features/editor/draft';

interface ConfirmDiscardDialogProps {
  open: boolean;
  changes: UnsavedChanges;
  onOpenChange: (open: boolean) => void;
  onStay: () => void;
  onDiscard: () => void;
  summarizeUrlChanges: (urls: string[]) => string;
}

export function ConfirmDiscardDialog({
  open,
  changes,
  onOpenChange,
  onStay,
  onDiscard,
  summarizeUrlChanges,
}: ConfirmDiscardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[20rem]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Discard unsaved changes?</DialogTitle>
          <DialogDescription>
            You have unsaved updates in this routine. Leave now and lose these changes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 rounded-lg border border-border/70 bg-muted/40 p-2 text-xs text-muted-foreground">
          {changes.nameChanged && (
            <p>Name changed.</p>
          )}
          {changes.scheduleChanged && (
            <p>Schedule changed.</p>
          )}
          {changes.addedUrls.length > 0 && (
            <p>
              {`Added ${changes.addedUrls.length} link${changes.addedUrls.length === 1 ? '' : 's'}: ${summarizeUrlChanges(changes.addedUrls)}`}
            </p>
          )}
          {changes.removedUrls.length > 0 && (
            <p>
              {`Removed ${changes.removedUrls.length} link${changes.removedUrls.length === 1 ? '' : 's'}: ${summarizeUrlChanges(changes.removedUrls)}`}
            </p>
          )}
          {changes.orderChanged && (
            <p>Link order changed.</p>
          )}
        </div>
        <DialogFooter className="flex-row gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            className="flex-1"
            variant="outline"
            onClick={onStay}
          >
            Stay here
          </Button>
          <Button
            type="button"
            className="flex-1"
            variant="destructive"
            onClick={onDiscard}
          >
            Discard and leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmRemoveLinkDialogProps {
  open: boolean;
  url: string | null;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmRemoveLinkDialog({
  open,
  url,
  onOpenChange,
  onCancel,
  onConfirm,
}: ConfirmRemoveLinkDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[20rem]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Remove link?</DialogTitle>
          <DialogDescription>
            This removes the link from the routine draft.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-lg border border-border/70 bg-muted/40 p-2 break-all text-xs text-muted-foreground">
          {url}
        </p>
        <DialogFooter className="flex-row gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            className="flex-1"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            variant="destructive"
            onClick={onConfirm}
          >
            Remove link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
