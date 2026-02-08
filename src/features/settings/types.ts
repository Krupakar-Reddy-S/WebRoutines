import type { NavigationShortcuts } from '@/lib/navigation-shortcuts';
import type { AppSettings } from '@/lib/settings';

export interface SettingsFormModel {
  settings: AppSettings;
  onSetStaticTheme: (value: string) => Promise<void> | void;
  onSetTabLoadMode: (value: string) => Promise<void> | void;
  onSetBooleanSetting: (
    key: 'confirmBeforeStop' | 'focusModeEnabled',
    checked: boolean,
  ) => Promise<void> | void;
}

export interface ShortcutSettingsModel {
  navigationShortcuts: NavigationShortcuts;
  onOpenShortcutSettings: () => Promise<void> | void;
}
