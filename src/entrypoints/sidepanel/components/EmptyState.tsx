import type { ReactNode } from 'react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-brand/30 bg-brand-glow p-3">
      {title && <p className="text-sm font-medium">{title}</p>}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
