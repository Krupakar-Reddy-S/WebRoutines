import {
  getAdaptiveAccentForHost,
  getReadableForeground,
  normalizeCssColor,
  setAdaptiveAccentForHost,
} from '@/lib/adaptive-accent';

export interface ControllerStyleTokens {
  accent: string;
  onAccent: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  buttonBackground: string;
  buttonBorder: string;
  buttonText: string;
}

export async function refreshAdaptiveAccentForHost(): Promise<string | null> {
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

export function resolveControllerStyleTokens(accent: string | null): ControllerStyleTokens {
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
