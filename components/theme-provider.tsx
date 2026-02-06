import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { getSettings, setSetting, subscribeToSettings, type StaticTheme } from '@/lib/settings';

export type Theme = StaticTheme;

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const THEME_STORAGE_KEY = 'webroutines-theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }

  return 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(resolveInitialTheme);

  useEffect(() => {
    let active = true;

    void getSettings().then((settings) => {
      if (!active) {
        return;
      }

      setThemeState(settings.staticTheme);
    });

    const unsubscribe = subscribeToSettings((settings) => {
      if (!active) {
        return;
      }

      setThemeState(settings.staticTheme);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const resolvedTheme = resolveRenderedTheme(theme);

    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') {
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(resolveRenderedTheme('system'));
    };

    media.addEventListener('change', listener);

    return () => {
      media.removeEventListener('change', listener);
    };
  }, [theme]);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    void setSetting('staticTheme', nextTheme);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      toggleTheme: () => {
        const rendered = resolveRenderedTheme(theme);
        setTheme(rendered === 'dark' ? 'light' : 'dark');
      },
      setTheme,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}

function resolveRenderedTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
