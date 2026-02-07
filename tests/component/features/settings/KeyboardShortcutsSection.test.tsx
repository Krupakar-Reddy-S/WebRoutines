import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { KeyboardShortcutsSection } from '@/features/settings/SettingsFormSections';

describe('KeyboardShortcutsSection', () => {
  it('renders shortcut labels and invokes settings opener', async () => {
    const user = userEvent.setup();
    const onOpenShortcutSettings = vi.fn(async () => {});

    render(
      <KeyboardShortcutsSection
        navigationShortcuts={{
          previous: 'Alt+Shift+Left',
          next: 'Alt+Shift+Right',
          ready: true,
        }}
        onOpenShortcutSettings={onOpenShortcutSettings}
      />,
    );

    expect(screen.getByText('Current navigation shortcuts: Alt+Shift+Left / Alt+Shift+Right')).toBeInTheDocument();
    expect(screen.getByText('Previous step:')).toBeInTheDocument();
    expect(screen.getByText('Next step:')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open shortcut settings' }));
    expect(onOpenShortcutSettings).toHaveBeenCalledTimes(1);
  });
});
