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
}

export function StopRunnerDialog({
  open,
  onOpenChange,
  onConfirm,
  busy = false,
  routineLabel,
  stepLabel,
  elapsedLabel,
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

        <div className="rounded-lg border border-border/70 bg-muted/40 p-2 text-xs text-muted-foreground">
          <p><span className="font-medium text-foreground">Routine:</span> {routineLabel}</p>
          <p className="mt-1"><span className="font-medium text-foreground">Progress:</span> {stepLabel}</p>
          <p className="mt-1"><span className="font-medium text-foreground">Elapsed:</span> {elapsedLabel}</p>
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
