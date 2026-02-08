import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RecoveryCardProps {
  onReset: () => void;
}

export function RecoveryCard({ onReset }: RecoveryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Something went wrong</CardTitle>
        <CardDescription>Reset the view to recover the sidepanel UI.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" onClick={onReset}>
          Return to Runner Home
        </Button>
      </CardContent>
    </Card>
  );
}
