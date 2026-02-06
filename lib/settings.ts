import type { NavigationMode } from '@/lib/types';

export const SETTINGS_STORAGE_KEY = 'appSettings';

export type StaticTheme = 'light' | 'dark' | 'system';

export interface AppSettings {
  staticTheme: StaticTheme;
  defaultRunMode: NavigationMode;
  confirmBeforeStop: boolean;
  focusModeEnabled: boolean;
}

type PartialSettings = Partial<AppSettings>;

interface SettingsStorageRecord {
  [SETTINGS_STORAGE_KEY]?: PartialSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  staticTheme: 'system',
  defaultRunMode: 'tab-group',
  confirmBeforeStop: true,
  focusModeEnabled: false,
};

export async function getSettings(): Promise<AppSettings> {
  const record = (await browser.storage.local.get(SETTINGS_STORAGE_KEY)) as SettingsStorageRecord;
  const normalized = normalizeSettings(record[SETTINGS_STORAGE_KEY]);

  if (!areSettingsEqual(record[SETTINGS_STORAGE_KEY], normalized)) {
    await browser.storage.local.set({ [SETTINGS_STORAGE_KEY]: normalized });
  }

  return normalized;
}

export async function setSettingsPatch(patch: PartialSettings): Promise<AppSettings> {
  const current = await getSettings();
  const next = normalizeSettings({ ...current, ...patch });
  await browser.storage.local.set({ [SETTINGS_STORAGE_KEY]: next });
  return next;
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<AppSettings> {
  return setSettingsPatch({ [key]: value } as Pick<AppSettings, K>);
}

export function subscribeToSettings(callback: (settings: AppSettings) => void): () => void {
  const listener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (
    changes,
    areaName,
  ) => {
    if (areaName !== 'local' || !(SETTINGS_STORAGE_KEY in changes)) {
      return;
    }

    const next = normalizeSettings(changes[SETTINGS_STORAGE_KEY]?.newValue as PartialSettings | undefined);
    callback(next);
  };

  browser.storage.onChanged.addListener(listener);

  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}

function normalizeSettings(value: PartialSettings | undefined): AppSettings {
  const staticTheme = (
    value?.staticTheme === 'light'
    || value?.staticTheme === 'dark'
    || value?.staticTheme === 'system'
  )
    ? value.staticTheme
    : DEFAULT_SETTINGS.staticTheme;
  const defaultRunMode = (value?.defaultRunMode === 'same-tab' || value?.defaultRunMode === 'tab-group')
    ? value.defaultRunMode
    : DEFAULT_SETTINGS.defaultRunMode;

  return {
    staticTheme,
    defaultRunMode,
    confirmBeforeStop: value?.confirmBeforeStop ?? DEFAULT_SETTINGS.confirmBeforeStop,
    focusModeEnabled: value?.focusModeEnabled ?? DEFAULT_SETTINGS.focusModeEnabled,
  };
}

function areSettingsEqual(left: PartialSettings | undefined, right: AppSettings): boolean {
  if (!left) {
    return false;
  }

  return (
    left.staticTheme === right.staticTheme
    && left.defaultRunMode === right.defaultRunMode
    && left.confirmBeforeStop === right.confirmBeforeStop
    && left.focusModeEnabled === right.focusModeEnabled
  );
}
