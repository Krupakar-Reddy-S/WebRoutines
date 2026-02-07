import { useMemo } from 'react';

import { Card, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import {
  AppearanceSettingsSection,
  RunnerSettingsSection,
  TabLoadingSettingsSection,
} from '@/features/settings/SettingsFormSections';
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
    </main>
  );
}

export default App;
