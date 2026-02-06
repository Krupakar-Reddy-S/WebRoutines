import { db } from '@/lib/db';
import { clearActiveSession, getActiveSession, setActiveSession } from '@/lib/session';
import type { NavigationMode, Routine, RoutineSession } from '@/lib/types';

export async function startRoutine(
  routine: Routine,
  mode: NavigationMode,
): Promise<RoutineSession> {
  if (!routine.id) {
    throw new Error('Routine is missing an id. Save it before running.');
  }

  if (routine.links.length === 0) {
    throw new Error('Add at least one link before starting a routine.');
  }

  const session = mode === 'same-tab'
    ? await startInSameTab(routine)
    : await startInTabGroup(routine);

  await setActiveSession(session);
  return session;
}

export async function navigateSessionByOffset(offset: number): Promise<RoutineSession | null> {
  const session = await getActiveSession();

  if (!session) {
    return null;
  }

  const routine = await db.routines.get(session.routineId);

  if (!routine || routine.links.length === 0) {
    await clearActiveSession();
    return null;
  }

  return navigateToIndex(routine, session, session.currentIndex + offset);
}

export async function openCurrentSessionLink(): Promise<RoutineSession | null> {
  const session = await getActiveSession();

  if (!session) {
    return null;
  }

  const routine = await db.routines.get(session.routineId);

  if (!routine || routine.links.length === 0) {
    await clearActiveSession();
    return null;
  }

  return navigateToIndex(routine, session, session.currentIndex);
}

export async function stopActiveRoutine(): Promise<void> {
  await clearActiveSession();
}

export async function openSidePanelForCurrentWindow(): Promise<void> {
  if (!browser.sidePanel?.open) {
    return;
  }

  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });

  if (typeof activeTab?.windowId !== 'number') {
    return;
  }

  await browser.sidePanel.open({ windowId: activeTab.windowId });
}

export async function navigateToIndex(
  routine: Routine,
  session: RoutineSession,
  index: number,
): Promise<RoutineSession> {
  if (routine.links.length === 0) {
    throw new Error('Routine has no links.');
  }

  const targetIndex = clampIndex(index, routine.links.length);
  const nextSession = session.mode === 'same-tab'
    ? await navigateSameTab(routine, session, targetIndex)
    : await navigateTabGroup(routine, session, targetIndex);

  await setActiveSession(nextSession);
  return nextSession;
}

async function startInSameTab(routine: Routine): Promise<RoutineSession> {
  const firstUrl = routine.links[0].url;
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });

  let tabId = activeTab?.id ?? null;

  if (typeof tabId === 'number') {
    try {
      await browser.tabs.update(tabId, { url: firstUrl, active: true });
    } catch {
      tabId = null;
    }
  }

  if (typeof tabId !== 'number') {
    const createdTab = await browser.tabs.create({ url: firstUrl, active: true });
    tabId = createdTab.id ?? null;
  }

  return {
    routineId: routine.id!,
    mode: 'same-tab',
    currentIndex: 0,
    tabId,
    tabGroupId: null,
    tabIds: typeof tabId === 'number' ? [tabId] : [],
    startedAt: Date.now(),
  };
}

async function startInTabGroup(routine: Routine): Promise<RoutineSession> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  const tabIds: number[] = [];

  for (const [index, link] of routine.links.entries()) {
    const createOptions: Record<string, unknown> = {
      url: link.url,
      active: index === 0,
    };

    if (typeof activeTab?.windowId === 'number') {
      createOptions.windowId = activeTab.windowId;
    }

    const createdTab = await browser.tabs.create(createOptions);
    if (typeof createdTab.id === 'number') {
      tabIds.push(createdTab.id);
    }
  }

  let tabGroupId: number | null = null;
  const groupableTabIds = asNonEmpty(tabIds);

  if (groupableTabIds) {
    try {
      tabGroupId = await browser.tabs.group({ tabIds: groupableTabIds });
      await browser.tabGroups.update(tabGroupId, {
        title: routine.name,
        color: 'blue',
        collapsed: false,
      });
    } catch {
      tabGroupId = null;
    }
  }

  return {
    routineId: routine.id!,
    mode: 'tab-group',
    currentIndex: 0,
    tabId: tabIds[0] ?? null,
    tabGroupId,
    tabIds,
    startedAt: Date.now(),
  };
}

async function navigateSameTab(
  routine: Routine,
  session: RoutineSession,
  targetIndex: number,
): Promise<RoutineSession> {
  const targetUrl = routine.links[targetIndex].url;
  let tabId = session.tabId;

  if (typeof tabId === 'number') {
    try {
      await browser.tabs.update(tabId, { url: targetUrl, active: true });
    } catch {
      tabId = null;
    }
  }

  if (typeof tabId !== 'number') {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (typeof activeTab?.id === 'number') {
      tabId = activeTab.id;

      try {
        await browser.tabs.update(tabId, { url: targetUrl, active: true });
      } catch {
        tabId = null;
      }
    }
  }

  if (typeof tabId !== 'number') {
    const createdTab = await browser.tabs.create({ url: targetUrl, active: true });
    tabId = createdTab.id ?? null;
  }

  return {
    ...session,
    currentIndex: targetIndex,
    tabId,
    tabGroupId: null,
    tabIds: typeof tabId === 'number' ? [tabId] : [],
  };
}

async function navigateTabGroup(
  routine: Routine,
  session: RoutineSession,
  targetIndex: number,
): Promise<RoutineSession> {
  const targetUrl = routine.links[targetIndex].url;
  const tabIds = [...session.tabIds];
  let tabId: number | null = tabIds[targetIndex] ?? null;

  if (typeof tabId === 'number') {
    try {
      await browser.tabs.update(tabId, { active: true });
      await browser.tabs.update(tabId, { url: targetUrl });
    } catch {
      tabId = null;
    }
  }

  if (typeof tabId !== 'number') {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    const createOptions: Record<string, unknown> = {
      url: targetUrl,
      active: true,
    };

    if (typeof activeTab?.windowId === 'number') {
      createOptions.windowId = activeTab.windowId;
    }

    const createdTab = await browser.tabs.create(createOptions);
    tabId = createdTab.id ?? null;

    if (typeof tabId === 'number') {
      tabIds[targetIndex] = tabId;

      if (typeof session.tabGroupId === 'number') {
        try {
          await browser.tabs.group({ groupId: session.tabGroupId, tabIds: [tabId] });
        } catch {
          // Ignore group assignment failures and continue with functional navigation.
        }
      }
    }
  }

  return {
    ...session,
    currentIndex: targetIndex,
    tabId,
    tabIds,
  };
}

function asNonEmpty(values: number[]): [number, ...number[]] | null {
  if (values.length === 0) {
    return null;
  }

  return values as [number, ...number[]];
}

function clampIndex(index: number, length: number): number {
  if (index <= 0) {
    return 0;
  }

  if (index >= length - 1) {
    return length - 1;
  }

  return index;
}
