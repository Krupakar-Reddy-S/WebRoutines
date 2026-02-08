import { useEffect, useState } from 'react';

import { DEFAULT_SETTINGS, getSettings, subscribeToSettings, type AppSettings } from '@/lib/settings';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    void getSettings().then((next) => {
      if (!active) {
        return;
      }

      setSettings(next);
      setReady(true);
    });

    const unsubscribe = subscribeToSettings((next) => {
      if (!active) {
        return;
      }

      setSettings(next);
      setReady(true);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return {
    settings,
    ready,
  };
}

