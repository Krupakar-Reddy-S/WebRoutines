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
          variant={index === currentIndex ? 'outline' : 'outline'}
          size="sm"
          className={`w-full justify-start ${index === currentIndex ? 'border-brand bg-brand/10 text-brand font-semibold' : ''}`}
          onClick={() => onJump(index)}
          disabled={disabled}
        >
          <span className={index === currentIndex ? 'text-brand' : isLoaded ? 'text-brand/60' : 'text-muted-foreground/50'}>{session.loadMode === 'lazy' && !isLoaded ? '○' : '●'}</span> {index + 1}. {link.url}
        </Button>
          );
        })()
      ))}
    </div>
  );
}
