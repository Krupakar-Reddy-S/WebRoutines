import {
  refreshAdaptiveAccentForHost,
  resolveControllerStyleTokens,
} from '@/features/focus-controller/accent';
import {
  isExtensionContextInvalidError,
  isRuntimeContextAvailable,
  sendFocusControllerMessage,
} from '@/features/focus-controller/bridge';
import { escapeHtml, FOCUS_CONTROLLER_STYLES } from '@/features/focus-controller/ui';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, getSettings, type AppSettings } from '@/lib/settings';

const CONTROLLER_Y_KEY = 'focusControllerYOffset';
const CONTROLLER_FALLBACK_SETTINGS: AppSettings = {
  ...DEFAULT_SETTINGS,
  focusModeEnabled: true,
};

interface FocusControllerState {
  focusModeActive: boolean;
  focusedSession: {
    routineId: number;
    currentIndex: number;
  } | null;
  focusedRoutine: {
    name: string;
    linksCount: number;
    currentUrl: string | null;
  } | null;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  async main() {
    if (window.top !== window) {
      return;
    }

    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadowRoot.append(container);

    const style = document.createElement('style');
    style.textContent = FOCUS_CONTROLLER_STYLES;
    shadowRoot.append(style);

    let state: FocusControllerState | null = null;
    let busy = false;
    let controllerNotice: string | null = null;
    let yOffset = await getStoredYOffset();
    let settings = await safeGetSettings();
    let currentAccent: string | null = null;
    let extensionContextInvalid = false;
    let disposed = false;
    let pollIntervalId: number | null = null;

    let dragStartY = 0;
    let dragStartOffset = 0;
    let dragging = false;

    function disposeController() {
      if (disposed) {
        return;
      }

      disposed = true;
      if (pollIntervalId !== null) {
        window.clearInterval(pollIntervalId);
        pollIntervalId = null;
      }

      browser.storage?.onChanged?.removeListener(storageListener);
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
      window.removeEventListener('resize', onResize);
    }

    function stopPolling() {
      if (pollIntervalId === null) {
        return;
      }

      window.clearInterval(pollIntervalId);
      pollIntervalId = null;
    }

    function startPolling() {
      if (pollIntervalId !== null || extensionContextInvalid || disposed) {
        return;
      }

      pollIntervalId = window.setInterval(() => {
        if (!isRuntimeContextAvailable()) {
          markExtensionContextInvalid();
          return;
        }

        void refresh().catch(() => {
          // Guard against unhandled rejections from background/context teardown.
        });
      }, 1500);
    }

    function markExtensionContextInvalid() {
      extensionContextInvalid = true;
      busy = false;
      state = null;
      controllerNotice = null;
      stopPolling();
      disposeController();
      render();
    }

    function shouldRender(): boolean {
      if (!state?.focusModeActive || !state.focusedSession || !state.focusedRoutine) {
        return false;
      }

      return settings.focusModeEnabled;
    }

    function mount() {
      if (!host.isConnected) {
        document.documentElement.append(host);
      }
    }

    function unmount() {
      if (host.isConnected) {
        host.remove();
      }
    }

    function render() {
      if (!shouldRender()) {
        unmount();
        container.innerHTML = '';
        return;
      }

      startPolling();
      mount();

      const focusedSession = state!.focusedSession!;
      const focusedRoutine = state!.focusedRoutine!;
      const step = Math.min(focusedSession.currentIndex + 1, focusedRoutine.linksCount);
      const title = focusedRoutine.name;

      container.innerHTML = `
        <div class="webroutines-pill" style="top:${Math.round(yOffset)}px">
          <div class="webroutines-row">
            <button class="webroutines-btn" data-action="prev" ${busy ? 'disabled' : ''}>◀</button>
            <div class="webroutines-title" data-action="drag">
              <strong>${escapeHtml(title)}</strong>
              <span>Step ${step}/${focusedRoutine.linksCount}</span>
            </div>
            <button class="webroutines-btn" data-action="next" ${busy ? 'disabled' : ''}>▶</button>
            <button class="webroutines-btn webroutines-btn--return" data-action="open-panel" ${busy ? 'disabled' : ''}>Sidebar</button>
          </div>
          ${controllerNotice ? `<div style="margin-top:6px;color:rgba(255,255,255,0.82);font-size:11px;">${escapeHtml(controllerNotice)}</div>` : ''}
        </div>
      `;

      const root = container.querySelector<HTMLElement>('.webroutines-pill');
      if (!root) {
        return;
      }

      const styleTokens = resolveControllerStyleTokens(currentAccent);
      root.style.setProperty('--wr-accent', styleTokens.accent);
      root.style.setProperty('--wr-on-accent', styleTokens.onAccent);
      root.style.setProperty('--wr-surface', styleTokens.surface);
      root.style.setProperty('--wr-text', styleTokens.text);
      root.style.setProperty('--wr-muted', styleTokens.muted);
      root.style.setProperty('--wr-border', styleTokens.border);
      root.style.setProperty('--wr-btn-bg', styleTokens.buttonBackground);
      root.style.setProperty('--wr-btn-border', styleTokens.buttonBorder);
      root.style.setProperty('--wr-btn-text', styleTokens.buttonText);

      const prevButton = root.querySelector<HTMLButtonElement>('[data-action="prev"]');
      const nextButton = root.querySelector<HTMLButtonElement>('[data-action="next"]');
      const openButton = root.querySelector<HTMLButtonElement>('[data-action="open-panel"]');
      const dragHandle = root.querySelector<HTMLElement>('[data-action="drag"]');

      prevButton?.addEventListener('click', () => {
        void performAction({ type: 'focus-controller:navigate', offset: -1 });
      });
      nextButton?.addEventListener('click', () => {
        void performAction({ type: 'focus-controller:navigate', offset: 1 });
      });
      openButton?.addEventListener('click', () => {
        void performAction({ type: 'focus-controller:open-sidepanel' });
      });

      dragHandle?.addEventListener('mousedown', onDragStart);
    }

    async function performAction(message: unknown) {
      if (extensionContextInvalid) {
        return;
      }

      if (!isRuntimeContextAvailable()) {
        markExtensionContextInvalid();
        return;
      }

      busy = true;
      controllerNotice = null;
      render();

      try {
        const response = await sendFocusControllerMessage<FocusControllerState>(message);
        if (response === null) {
          markExtensionContextInvalid();
          return;
        }

        if (response?.ok && response.state) {
          state = response.state;
        } else if (response?.error) {
          controllerNotice = response.error;
        } else {
          controllerNotice = 'Action failed. Try opening sidepanel from extension icon.';
        }

        settings = await safeGetSettings();
      } catch (error) {
        if (isExtensionContextInvalidError(error)) {
          markExtensionContextInvalid();
          return;
        }

        controllerNotice = 'Unable to contact extension controller.';
      } finally {
        busy = false;
        render();
      }
    }

    function onDragStart(event: MouseEvent) {
      dragging = true;
      dragStartY = event.clientY;
      dragStartOffset = yOffset;
      event.preventDefault();
    }

    function onDragMove(event: MouseEvent) {
      if (!dragging) {
        return;
      }

      const delta = event.clientY - dragStartY;
      yOffset = clampYOffset(dragStartOffset + delta);
      render();
    }

    function onDragEnd() {
      if (!dragging) {
        return;
      }

      dragging = false;
      void setStoredYOffset(yOffset);
    }

    async function refresh() {
      if (extensionContextInvalid) {
        return;
      }

      if (!isRuntimeContextAvailable()) {
        markExtensionContextInvalid();
        return;
      }

      try {
        settings = await safeGetSettings();
        await refreshAdaptiveAccent();

        const response = await sendFocusControllerMessage<FocusControllerState>({
          type: 'focus-controller:get-state',
        });
        if (response === null) {
          markExtensionContextInvalid();
          return;
        }

        if (response?.ok && response.state) {
          state = response.state;
          controllerNotice = null;
        } else {
          state = null;
          if (response?.error) {
            controllerNotice = response.error;
          }
        }
      } catch (error) {
        if (isExtensionContextInvalidError(error)) {
          markExtensionContextInvalid();
          return;
        }

        state = null;
        controllerNotice = 'Unable to contact extension controller.';
      } finally {
        render();
      }
    }

    async function refreshAdaptiveAccent() {
      currentAccent = await refreshAdaptiveAccentForHost();
    }

    const storageListener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (
      changes,
      areaName,
    ) => {
      if (!isRuntimeContextAvailable()) {
        markExtensionContextInvalid();
        return;
      }

      if (areaName === 'local' && CONTROLLER_Y_KEY in changes) {
        const nextY = changes[CONTROLLER_Y_KEY]?.newValue;
        if (typeof nextY === 'number') {
          yOffset = clampYOffset(nextY);
          render();
        }
      }

      if (areaName === 'session') {
        if (
          'activeSessions' in changes
          || 'focusedRoutineId' in changes
          || 'focusModeActive' in changes
        ) {
          void refresh().catch(() => {
            // Guard against unhandled rejections from background/context teardown.
          });
        }
      }

      if (areaName === 'local' && SETTINGS_STORAGE_KEY in changes) {
        void refresh().catch(() => {
          // Guard against unhandled rejections from background/context teardown.
        });
      }
    };

    function onResize() {
      yOffset = clampYOffset(yOffset);
      render();
    }

    browser.storage?.onChanged?.addListener(storageListener);
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('resize', onResize);
    startPolling();

    await refresh().catch(() => {
      // Ignore initial refresh failure in restricted/invalidation scenarios.
    });
  },
});

function clampYOffset(value: number): number {
  const viewportHeight = Math.max(window.innerHeight, 0);
  const max = Math.max(24, viewportHeight - 56);
  return Math.min(Math.max(16, value), max);
}

async function getStoredYOffset(): Promise<number> {
  try {
    const record = await browser.storage.local.get(CONTROLLER_Y_KEY);
    const raw = record[CONTROLLER_Y_KEY];
    return typeof raw === 'number'
      ? clampYOffset(raw)
      : clampYOffset(window.innerHeight - 84);
  } catch {
    return clampYOffset(window.innerHeight - 84);
  }
}

async function setStoredYOffset(value: number): Promise<void> {
  try {
    await browser.storage.local.set({ [CONTROLLER_Y_KEY]: value });
  } catch {
    // Ignore storage failures in restricted contexts.
  }
}

async function safeGetSettings(): Promise<AppSettings> {
  try {
    return await getSettings();
  } catch {
    return CONTROLLER_FALLBACK_SETTINGS;
  }
}
