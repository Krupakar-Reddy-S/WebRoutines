import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface StopRunnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy?: boolean;
  routineLabel: string;
  stepLabel: string;
  elapsedLabel: string;
  completionPercent: number;
  notesCount: number;
  activeTimeLabel: string | null;
}

export function StopRunnerDialog({
  open,
  onOpenChange,
  onConfirm,
  busy = false,
  routineLabel,
  stepLabel,
  elapsedLabel,
  completionPercent,
  notesCount,
  activeTimeLabel,
}: StopRunnerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[22rem]" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Stop runner?</DialogTitle>
          <DialogDescription>
            This will stop the active run and close tabs owned by this runner.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-lg border border-border/70 bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <p><span className="font-medium text-foreground">Routine:</span> {routineLabel}</p>

          <div>
            <div className="flex items-baseline justify-between">
              <p><span className="font-medium text-foreground">Progress:</span> {stepLabel}</p>
              <span className="tabular-nums">{completionPercent}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          <p><span className="font-medium text-foreground">Elapsed:</span> {elapsedLabel}</p>
          {activeTimeLabel && (
            <p><span className="font-medium text-foreground">Active time:</span> {activeTimeLabel}</p>
          )}
          {notesCount > 0 && (
            <p><span className="font-medium text-foreground">Notes:</span> {notesCount} step {notesCount === 1 ? 'note' : 'notes'}</p>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            className="flex-1"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            variant="destructive"
            disabled={busy}
            onClick={onConfirm}
          >
            Stop runner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
