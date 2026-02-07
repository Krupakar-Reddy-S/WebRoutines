import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, getSettings, setSettingsPatch } from '@/lib/settings';

interface BrowserStorageState {
  [SETTINGS_STORAGE_KEY]?: unknown;
}

function installBrowserStorageMock(initialSettings: unknown) {
  const state: BrowserStorageState = {
    [SETTINGS_STORAGE_KEY]: initialSettings,
  };

  const get = vi.fn(async (key: string) => ({
    [key]: state[key as keyof BrowserStorageState],
  }));
  const set = vi.fn(async (patch: BrowserStorageState) => {
    Object.assign(state, patch);
  });

  vi.stubGlobal('browser', {
    storage: {
      local: {
        get,
        set,
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  });

  return { get, set, state };
}

describe('settings normalization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('coerces corrupted persisted values to defaults', async () => {
    const { set } = installBrowserStorageMock({
      staticTheme: 'dark',
      tabLoadMode: 'lazy',
      confirmBeforeStop: 'yes',
      focusModeEnabled: 1,
    });

    const settings = await getSettings();

    expect(settings).toEqual({
      staticTheme: 'dark',
      tabLoadMode: 'lazy',
      confirmBeforeStop: DEFAULT_SETTINGS.confirmBeforeStop,
      focusModeEnabled: DEFAULT_SETTINGS.focusModeEnabled,
    });
    expect(set).toHaveBeenCalledWith({
      [SETTINGS_STORAGE_KEY]: settings,
    });
  });

  it('applies patch updates on top of normalized settings', async () => {
    const { state } = installBrowserStorageMock({
      staticTheme: 'system',
      tabLoadMode: 'eager',
      confirmBeforeStop: 'invalid',
      focusModeEnabled: false,
    });

    const updated = await setSettingsPatch({
      confirmBeforeStop: false,
    });

    expect(updated).toEqual({
      staticTheme: 'system',
      tabLoadMode: 'eager',
      confirmBeforeStop: false,
      focusModeEnabled: false,
    });
    expect(state[SETTINGS_STORAGE_KEY]).toEqual(updated);
  });
});
