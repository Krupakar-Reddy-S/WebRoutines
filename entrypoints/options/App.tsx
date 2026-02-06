import { useMemo } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { setSettingsPatch } from '@/lib/settings';
import { useSettings } from '@/lib/use-settings';

function App() {
  const { settings, ready } = useSettings();

  const statusText = useMemo(() => {
    if (!ready) {
      return 'Loading settings...';
    }

    return 'Settings update instantly and apply across extension pages.';
  }, [ready]);

  async function onSetStaticTheme(value: string) {
    if (value !== 'light' && value !== 'dark' && value !== 'system') {
      return;
    }

    await setSettingsPatch({ staticTheme: value });
  }

  async function onSetDefaultRunMode(value: string) {
    if (value !== 'same-tab' && value !== 'tab-group') {
      return;
    }

    await setSettingsPatch({ defaultRunMode: value });
  }

  async function onSetBooleanSetting(
    key:
      | 'confirmBeforeStop'
      | 'focusModeEnabled',
    checked: boolean,
  ) {
    await setSettingsPatch({ [key]: checked });
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-4 bg-background p-4 text-foreground">
      <Card size="sm">
        <CardHeader>
          <CardTitle>WebRoutines Settings</CardTitle>
          <CardDescription>{statusText}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Core runner behavior across sidepanel, popup, and focus controller.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Default run mode</span>
            <select
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              value={settings.defaultRunMode}
              onChange={(event) => void onSetDefaultRunMode(event.target.value)}
            >
              <option value="tab-group">Tab group</option>
              <option value="same-tab">Single tab</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.confirmBeforeStop}
              onChange={(event) => void onSetBooleanSetting('confirmBeforeStop', event.target.checked)}
            />
            Confirm before stop actions
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.focusModeEnabled}
              onChange={(event) => void onSetBooleanSetting('focusModeEnabled', event.target.checked)}
            />
            Enable focus mini-controller mode
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose the extension theme for sidepanel and popup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Theme</span>
            <select
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              value={settings.staticTheme}
              onChange={(event) => void onSetStaticTheme(event.target.value)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </CardContent>
      </Card>
    </main>
  );
}

export default App;
