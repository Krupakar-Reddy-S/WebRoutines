import { useMemo } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
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

  async function onSetTabLoadMode(value: string) {
    if (value !== 'eager' && value !== 'lazy') {
      return;
    }

    await setSettingsPatch({ tabLoadMode: value });
  }

  async function onSetBooleanSetting(
    key: 'confirmBeforeStop' | 'focusModeEnabled',
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
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose the extension theme for sidepanel and popup.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label className="mb-1.5 block" htmlFor="options-theme-select">Theme</Label>
          <Select
            value={settings.staticTheme}
            onValueChange={(value) => {
              if (typeof value === 'string') {
                void onSetStaticTheme(value);
              }
            }}
          >
            <SelectTrigger id="options-theme-select" className="w-full">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tab Loading</CardTitle>
          <CardDescription>Choose how tabs are created when a routine starts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <RadioGroup
            value={settings.tabLoadMode}
            onValueChange={(value) => {
              if (typeof value === 'string') {
                void onSetTabLoadMode(value);
              }
            }}
          >
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/70 p-2">
              <RadioGroupItem value="eager" className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">Load all tabs at once</span>
                <span className="text-muted-foreground text-xs">Opens every link when you start a routine.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/70 p-2">
              <RadioGroupItem value="lazy" className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">Load tabs as you navigate</span>
                <span className="text-muted-foreground text-xs">Creates tabs one-by-one as you move forward.</span>
              </span>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runner</CardTitle>
          <CardDescription>Safety and focus behavior.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Confirm before stop actions</p>
              <p className="text-muted-foreground text-xs">Show confirmation before stop actions.</p>
            </div>
            <Switch
              checked={settings.confirmBeforeStop}
              onCheckedChange={(checked) => void onSetBooleanSetting('confirmBeforeStop', Boolean(checked))}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Enable focus mini-controller mode</p>
              <p className="text-muted-foreground text-xs">Allow the floating focus controller.</p>
            </div>
            <Switch
              checked={settings.focusModeEnabled}
              onCheckedChange={(checked) => void onSetBooleanSetting('focusModeEnabled', Boolean(checked))}
            />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default App;
