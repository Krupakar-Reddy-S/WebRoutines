import { Card, CardContent } from '@/components/ui/card';

interface MessageBannerProps {
  variant: 'error' | 'message';
  message: string;
}

export function MessageBanner({ variant, message }: MessageBannerProps) {
  const className = variant === 'error' ? 'border-destructive/30' : 'border-primary/30';
  const role = variant === 'error' ? 'alert' : 'status';
  const ariaLive = variant === 'error' ? 'assertive' : 'polite';
  const textClassName = variant === 'error' ? 'text-destructive' : 'text-primary';

  return (
    <Card size="sm" className={className}>
      <CardContent role={role} aria-live={ariaLive}>
        <p className={`text-sm ${textClassName}`}>{message}</p>
      </CardContent>
    </Card>
  );
}
