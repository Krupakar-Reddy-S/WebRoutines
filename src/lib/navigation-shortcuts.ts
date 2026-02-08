import { useEffect, useState } from 'react';

export const NAVIGATE_PREVIOUS_COMMAND = 'navigate-previous-step';
export const NAVIGATE_NEXT_COMMAND = 'navigate-next-step';

const NOT_SET_LABEL = 'Not set';

export interface NavigationShortcuts {
  previous: string;
  next: string;
  ready: boolean;
}

export const DEFAULT_NAVIGATION_SHORTCUTS: NavigationShortcuts = {
  previous: NOT_SET_LABEL,
  next: NOT_SET_LABEL,
  ready: false,
};

export function formatNavigationShortcutPair(shortcuts: NavigationShortcuts): string {
  return `${shortcuts.previous} / ${shortcuts.next}`;
}

export async function getNavigationShortcuts(): Promise<NavigationShortcuts> {
  if (!browser.commands?.getAll) {
    return {
      ...DEFAULT_NAVIGATION_SHORTCUTS,
      ready: true,
    };
  }

  const commands = await browser.commands.getAll();
  const byName = new Map(commands.map((command) => [command.name, formatShortcut(command.shortcut)]));

  return {
    previous: byName.get(NAVIGATE_PREVIOUS_COMMAND) ?? NOT_SET_LABEL,
    next: byName.get(NAVIGATE_NEXT_COMMAND) ?? NOT_SET_LABEL,
    ready: true,
  };
}

export function useNavigationShortcuts() {
  const [shortcuts, setShortcuts] = useState<NavigationShortcuts>(DEFAULT_NAVIGATION_SHORTCUTS);

  useEffect(() => {
    let active = true;

    const sync = async () => {
      const latest = await getNavigationShortcuts();
      if (!active) {
        return;
      }

      setShortcuts(latest);
    };

    void sync();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void sync();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return shortcuts;
}

function formatShortcut(rawShortcut: string | undefined): string {
  const value = typeof rawShortcut === 'string' ? rawShortcut.trim() : '';
  return value.length > 0 ? value : NOT_SET_LABEL;
}
