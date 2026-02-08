import { FaviconImage } from '@/components/FaviconImage';
import type { RoutineLink } from '@/lib/types';

interface FaviconStripProps {
  links: RoutineLink[]
  max?: number
}

export function FaviconStrip({ links, max = 5 }: FaviconStripProps) {
  const visible = links.slice(0, max);
  const overflow = links.length - max;

  return (
    <div className="flex items-center gap-1">
      {visible.map((link) => (
        <FaviconImage key={link.id} url={link.url} sizeClassName="h-5 w-5" />
      ))}
      {overflow > 0 && (
        <span className="text-muted-foreground ml-0.5 text-xs">+{overflow} more</span>
      )}
    </div>
  );
}
