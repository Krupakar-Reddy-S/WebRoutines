import {
  getAdaptiveAccentForHost,
  getReadableForeground,
  normalizeCssColor,
  setAdaptiveAccentForHost,
} from '@/lib/adaptive-accent';
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

interface FocusControllerResponse {
  ok: boolean;
  error?: string;
  state?: FocusControllerState;
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
    style.textContent = `
      :host { all: initial; }
      .webroutines-pill {
        --wr-accent: rgb(99, 102, 241);
        --wr-on-accent: rgb(255, 255, 255);
        --wr-surface: rgba(24, 24, 27, 0.92);
        --wr-text: rgb(250, 250, 250);
        --wr-muted: rgba(255, 255, 255, 0.8);
        --wr-border: rgba(255, 255, 255, 0.24);
        --wr-btn-bg: rgba(255, 255, 255, 0.08);
        --wr-btn-border: rgba(255, 255, 255, 0.24);
        --wr-btn-text: rgb(250, 250, 250);
        position: fixed;
        right: 16px;
        top: 120px;
        z-index: 2147483647;
        width: fit-content;
        max-width: min(252px, calc(100vw - 24px));
        border: 1px solid var(--wr-border);
        border-radius: 999px;
        padding: 8px;
        box-sizing: border-box;
        background: var(--wr-surface);
        color: var(--wr-text);
        backdrop-filter: blur(8px);
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: 12px;
        box-shadow: 0 0 0 1px rgba(17, 24, 39, 0.25), 0 8px 30px rgba(17, 24, 39, 0.35);
      }
      .webroutines-row {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .webroutines-title {
        flex: 1 1 auto;
        min-width: 56px;
        max-width: 108px;
        cursor: ns-resize;
        user-select: none;
      }
      .webroutines-title strong {
        line-height: 1.15;
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .webroutines-title span {
        color: var(--wr-muted);
      }
      .webroutines-btn {
        border: 1px solid var(--wr-btn-border);
        background: var(--wr-btn-bg);
        color: var(--wr-btn-text);
        border-radius: 999px;
        height: 28px;
        min-width: 28px;
        padding: 0 8px;
        font-size: 12px;
        line-height: 1;
        cursor: pointer;
      }
      .webroutines-btn--return {
        min-width: 64px;
      }
      .webroutines-btn:disabled {
        opacity: 0.45;
        cursor: default;
      }
    `;
    shadowRoot.append(style);

    let state: FocusControllerState | null = null;
    let busy = false;
    let controllerNotice: string | null = null;
    let yOffset = await getStoredYOffset();
    let settings = await safeGetSettings();
    let currentAccent: string | null = null;

    let dragStartY = 0;
    let dragStartOffset = 0;
    let dragging = false;

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
      busy = true;
      controllerNotice = null;
      render();

      const response = normalizeControllerResponse(
        await browser.runtime.sendMessage(message),
      );

      if (response?.ok && response.state) {
        state = response.state;
      } else if (response?.error) {
        controllerNotice = response.error;
      } else {
        controllerNotice = 'Action failed. Try opening sidepanel from extension icon.';
      }

      settings = await safeGetSettings();
      busy = false;
      render();
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
      settings = await safeGetSettings();
      await refreshAdaptiveAccent();

      const response = normalizeControllerResponse(
        await browser.runtime.sendMessage({ type: 'focus-controller:get-state' }),
      );
      if (response?.ok && response.state) {
        state = response.state;
        controllerNotice = null;
      } else {
        state = null;
        if (response?.error) {
          controllerNotice = response.error;
        }
      }

      render();
    }

    async function refreshAdaptiveAccent() {
      currentAccent = await refreshAdaptiveAccentForHost();
    }

    const storageListener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (
      changes,
      areaName,
    ) => {
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
          void refresh();
        }
      }

      if (areaName === 'local' && SETTINGS_STORAGE_KEY in changes) {
        void refresh();
      }
    };

    browser.storage.onChanged.addListener(storageListener);
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('resize', () => {
      yOffset = clampYOffset(yOffset);
      render();
    });

    // Fallback polling keeps controller in sync even if session change events are not exposed.
    window.setInterval(() => {
      void refresh();
    }, 1500);

    await refresh();
  },
});

async function refreshAdaptiveAccentForHost(): Promise<string | null> {
  const host = window.location.hostname;
  if (!host) {
    return null;
  }

  const extracted = extractAccentFromPage();
  if (extracted) {
    try {
      await setAdaptiveAccentForHost(host, extracted);
    } catch {
      // Ignore storage failures in restricted contexts.
    }
    return extracted;
  }

  try {
    return await getAdaptiveAccentForHost(host);
  } catch {
    return null;
  }
}

function extractAccentFromPage(): string | null {
  const metaTheme = document
    .querySelector('meta[name="theme-color"]')
    ?.getAttribute('content');

  const highPriorityCandidates = [
    metaTheme,
    getElementStyleValue('a', 'color'),
    getElementStyleValue('button', 'backgroundColor'),
    getElementStyleValue('[role="button"]', 'backgroundColor'),
    getElementStyleValue('header', 'backgroundColor'),
    getElementStyleValue('nav', 'backgroundColor'),
    getElementStyleValue('[class*="btn"]', 'backgroundColor'),
    getElementStyleValue('[class*="primary"]', 'backgroundColor'),
  ];

  for (const candidate of highPriorityCandidates) {
    if (!candidate) {
      continue;
    }

    const normalized = normalizeCssColor(candidate);
    if (!normalized || !isUsefulAccentColor(normalized)) {
      continue;
    }

    return normalized;
  }

  const fallbackCandidates = [
    metaTheme,
    getComputedStyle(document.body).color,
    getComputedStyle(document.documentElement).color,
    getComputedStyle(document.body).backgroundColor,
    getComputedStyle(document.documentElement).backgroundColor,
  ];

  for (const candidate of fallbackCandidates) {
    if (!candidate) {
      continue;
    }

    const normalized = normalizeCssColor(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function getElementStyleValue(selector: string, property: 'color' | 'backgroundColor'): string | null {
  const element = document.querySelector(selector);
  if (!element) {
    return null;
  }

  const value = getComputedStyle(element)[property];
  return value || null;
}

function isUsefulAccentColor(value: string): boolean {
  const match = value.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
  if (!match) {
    return true;
  }

  const r = Number.parseInt(match[1], 10);
  const g = Number.parseInt(match[2], 10);
  const b = Number.parseInt(match[3], 10);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  // Avoid near-grayscale and extremely dark/light tones that do not read as accents.
  return chroma >= 14 && luminance >= 0.12 && luminance <= 0.9;
}

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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');
}

function normalizeControllerResponse(value: unknown): FocusControllerResponse | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<FocusControllerResponse>;
  if (typeof candidate.ok !== 'boolean') {
    return null;
  }

  return {
    ok: candidate.ok,
    error: typeof candidate.error === 'string' ? candidate.error : undefined,
    state: candidate.state ?? undefined,
  };
}

function resolveControllerStyleTokens(accent: string | null) {
  const adaptiveAccent = accent ?? 'rgb(99, 102, 241)';
  const onAccent = getReadableForeground(adaptiveAccent);

  return {
    accent: adaptiveAccent,
    onAccent,
    surface: 'rgba(24, 24, 27, 0.92)',
    text: 'rgb(250, 250, 250)',
    muted: 'rgba(255, 255, 255, 0.8)',
    border: adaptiveAccent,
    buttonBackground: `color-mix(in srgb, ${adaptiveAccent} 22%, transparent)`,
    buttonBorder: adaptiveAccent,
    buttonText: onAccent,
  };
}
