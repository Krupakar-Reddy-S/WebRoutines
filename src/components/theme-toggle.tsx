import { MoonIcon, SunIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = document.documentElement.classList.contains('dark');

  return (
    <Button type="button" variant="outline" size="sm" onClick={toggleTheme}>
      {isDark ? <SunIcon /> : <MoonIcon />}
      {theme === 'system' ? 'System' : isDark ? 'Light' : 'Dark'}
    </Button>
  );
}
