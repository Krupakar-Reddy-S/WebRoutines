import { ArrowLeftIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { setSettingsPatch } from '@/lib/settings';
import { useSettings } from '@/lib/use-settings';

interface SettingsViewProps {
  onOpenRunner: () => void;
}

export function SettingsView({ onOpenRunner }: SettingsViewProps) {
  const { settings } = useSettings();

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
    key: 'confirmBeforeStop' | 'focusModeEnabled',
    checked: boolean,
  ) {
    await setSettingsPatch({ [key]: checked });
  }

  return (
    <>
      <Card size="sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Settings</CardTitle>
              <CardDescription>Configure behavior and theme preferences.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onOpenRunner}>
                <ArrowLeftIcon />
                Back to runner
              </Button>
            </div>
          </div>
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
    </>
  );
}
