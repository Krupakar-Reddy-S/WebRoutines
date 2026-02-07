import { ArrowLeftIcon } from 'lucide-react';

import { openChromeShortcutsPage } from '@/adapters/browser/extension-pages';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AppearanceSettingsSection,
  KeyboardShortcutsSection,
  RunnerSettingsSection,
  TabLoadingSettingsSection,
} from '@/features/settings/SettingsFormSections';
import { setSettingsPatch } from '@/lib/settings';
import { useNavigationShortcuts } from '@/lib/navigation-shortcuts';
import { useSettings } from '@/lib/use-settings';

interface SettingsViewProps {
  onOpenRunner: () => void;
}

export function SettingsView({ onOpenRunner }: SettingsViewProps) {
  const { settings } = useSettings();
  const navigationShortcuts = useNavigationShortcuts();

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

  async function onOpenShortcutSettings() {
    await openChromeShortcutsPage();
  }

  return (
    <>
      <Card size="sm">
        <CardHeader>
          <div>
            <div>
              <CardTitle>Settings</CardTitle>
              <CardDescription>Configure behavior and theme preferences.</CardDescription>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onOpenRunner}>
                <ArrowLeftIcon />
                Back to runner
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <AppearanceSettingsSection
        settings={settings}
        onSetStaticTheme={onSetStaticTheme}
      />

      <TabLoadingSettingsSection
        settings={settings}
        onSetTabLoadMode={onSetTabLoadMode}
      />

      <RunnerSettingsSection
        settings={settings}
        onSetBooleanSetting={onSetBooleanSetting}
      />

      <KeyboardShortcutsSection
        navigationShortcuts={navigationShortcuts}
        onOpenShortcutSettings={onOpenShortcutSettings}
      />
    </>
  );
}
