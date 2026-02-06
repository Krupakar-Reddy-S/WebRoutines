import { handleRunnerGroupRemoved } from '@/lib/session';

async function configureSidePanelAction() {
  if (!browser.sidePanel?.setPanelBehavior) {
    return;
  }

  await browser.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true,
  });
}

function attachRunnerLifecycleListeners() {
  if (!browser.tabGroups?.onRemoved) {
    return;
  }

  browser.tabGroups.onRemoved.addListener((group) => {
    const groupId = resolveGroupId(group);

    if (typeof groupId !== 'number') {
      return;
    }

    void handleRunnerGroupRemoved(groupId);
  });
}

function resolveGroupId(group: unknown): number | null {
  if (typeof group === 'number') {
    return group;
  }

  if (!group || typeof group !== 'object') {
    return null;
  }

  const candidate = group as { id?: unknown };

  return typeof candidate.id === 'number' ? candidate.id : null;
}

export default defineBackground(() => {
  void configureSidePanelAction();
  attachRunnerLifecycleListeners();

  browser.runtime.onInstalled.addListener(() => {
    void configureSidePanelAction();
  });
});
