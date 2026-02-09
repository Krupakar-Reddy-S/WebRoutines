import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { formatNavigationShortcutPair } from '@/lib/navigation-shortcuts';

import type { SettingsFormModel, ShortcutSettingsModel } from '@/features/settings/types';

export function AppearanceSettingsSection({
  settings,
  onSetStaticTheme,
}: Pick<SettingsFormModel, 'settings' | 'onSetStaticTheme'>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Choose the extension theme for sidepanel and popup.</CardDescription>
      </CardHeader>
      <CardContent>
        <Label className="mb-1.5 block" htmlFor="theme-select">Theme</Label>
        <Select
          value={settings.staticTheme}
          onValueChange={(value) => {
            if (typeof value === 'string') {
              void onSetStaticTheme(value);
            }
          }}
        >
          <SelectTrigger id="theme-select" className="w-full">
            <SelectValue>{getThemeLabel(settings.staticTheme)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

export function TabLoadingSettingsSection({
  settings,
  onSetTabLoadMode,
}: Pick<SettingsFormModel, 'settings' | 'onSetTabLoadMode'>) {
  return (
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
          <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 transition-colors ${settings.tabLoadMode === 'eager' ? 'border-brand bg-brand/5' : 'border-border/70'}`}>
            <RadioGroupItem value="eager" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Load all tabs at once</span>
              <span className="text-muted-foreground text-xs">Opens every link when you start a routine.</span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 transition-colors ${settings.tabLoadMode === 'lazy' ? 'border-brand bg-brand/5' : 'border-border/70'}`}>
            <RadioGroupItem value="lazy" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Load tabs as you navigate</span>
              <span className="text-muted-foreground text-xs">Creates tabs one-by-one as you move forward.</span>
            </span>
          </label>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

export function RunnerSettingsSection({
  settings,
  onSetBooleanSetting,
}: Pick<SettingsFormModel, 'settings' | 'onSetBooleanSetting'>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Runner</CardTitle>
        <CardDescription>Safety and focus behavior.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Confirm before stopping</p>
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
            <p className="text-sm font-medium">Enable focus mini-controller</p>
            <p className="text-muted-foreground text-xs">Allow the floating controller on web pages.</p>
          </div>
          <Switch
            checked={settings.focusModeEnabled}
            onCheckedChange={(checked) => void onSetBooleanSetting('focusModeEnabled', Boolean(checked))}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function KeyboardShortcutsSection({
  navigationShortcuts,
  onOpenShortcutSettings,
}: ShortcutSettingsModel) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Keyboard Shortcuts</CardTitle>
        <CardDescription>Edit extension shortcuts from Chrome shortcut settings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Current navigation shortcuts: {formatNavigationShortcutPair(navigationShortcuts)}
        </p>
        <div className="rounded-lg border border-border/70 p-2 text-xs">
          <p><span className="font-medium">Previous step:</span> {navigationShortcuts.previous}</p>
          <p className="mt-1"><span className="font-medium">Next step:</span> {navigationShortcuts.next}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void onOpenShortcutSettings()}>
          Open shortcut settings
        </Button>
      </CardContent>
    </Card>
  );
}

function getThemeLabel(value: 'light' | 'dark' | 'system'): string {
  if (value === 'light') {
    return 'Light';
  }

  if (value === 'dark') {
    return 'Dark';
  }

  return 'System';
}
