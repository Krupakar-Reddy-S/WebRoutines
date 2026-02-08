import { Button } from '@/components/ui/button';
import type { RoutineLink, RoutineSession } from '@/lib/types';

interface StepListProps {
  routineId: number;
  links: RoutineLink[];
  session: RoutineSession;
  currentIndex: number;
  busyAction: string | null;
  onJump: (index: number) => void;
}

export function StepList({ routineId, links, session, currentIndex, busyAction, onJump }: StepListProps) {
  return (
    <div className="space-y-2">
      {links.map((link, index) => (
        (() => {
          const isLoaded = session.loadMode === 'eager' || typeof session.tabIds[index] === 'number';
          const disabled = busyAction === `jump-${routineId}-${index}` || !isLoaded;

          return (
        <Button
          key={link.id}
          type="button"
          variant={index === currentIndex ? 'secondary' : 'outline'}
          size="sm"
          className="w-full justify-start"
          onClick={() => onJump(index)}
          disabled={disabled}
        >
          {session.loadMode === 'lazy' && !isLoaded ? '○' : '●'} {index + 1}. {link.url}
        </Button>
          );
        })()
      ))}
    </div>
  );
}
