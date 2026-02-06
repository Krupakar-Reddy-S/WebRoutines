import { Button } from '@/components/ui/button';
import type { RoutineLink } from '@/lib/types';

interface StepListProps {
  routineId: number;
  links: RoutineLink[];
  currentIndex: number;
  busyAction: string | null;
  onJump: (index: number) => void;
}

export function StepList({ routineId, links, currentIndex, busyAction, onJump }: StepListProps) {
  return (
    <div className="space-y-2">
      {links.map((link, index) => (
        <Button
          key={link.id}
          type="button"
          variant={index === currentIndex ? 'secondary' : 'outline'}
          size="sm"
          className="w-full justify-start"
          onClick={() => onJump(index)}
          disabled={busyAction === `jump-${routineId}-${index}`}
        >
          {index + 1}. {link.url}
        </Button>
      ))}
    </div>
  );
}
