const ADAPTIVE_ACCENT_CACHE_KEY = 'adaptiveAccentByHost';

type AccentCache = Record<string, string>;

export async function getAdaptiveAccentCache(): Promise<AccentCache> {
  const record = await browser.storage.local.get(ADAPTIVE_ACCENT_CACHE_KEY);
  const value = record[ADAPTIVE_ACCENT_CACHE_KEY];

  if (!value || typeof value !== 'object') {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const normalized: AccentCache = {};

  for (const [host, color] of entries) {
    if (typeof color !== 'string') {
      continue;
    }

    const normalizedColor = normalizeCssColor(color);
    if (normalizedColor) {
      normalized[host] = normalizedColor;
    }
  }

  return normalized;
}

export async function setAdaptiveAccentForHost(host: string, color: string): Promise<void> {
  const normalizedColor = normalizeCssColor(color);
  if (!normalizedColor) {
    return;
  }

  const cache = await getAdaptiveAccentCache();
  cache[host] = normalizedColor;

  await browser.storage.local.set({
    [ADAPTIVE_ACCENT_CACHE_KEY]: cache,
  });
}

export async function getAdaptiveAccentForHost(host: string): Promise<string | null> {
  const cache = await getAdaptiveAccentCache();
  return cache[host] ?? null;
}

export function extractHostFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

export function normalizeCssColor(value: string): string | null {
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  const hex = parseHexColor(raw);
  if (hex) {
    return rgbToCss(hex);
  }

  const rgb = parseRgbColor(raw);
  if (rgb) {
    return rgbToCss(rgb);
  }

  return null;
}

export function getReadableForeground(accentColor: string): string {
  const rgb = parseHexColor(accentColor) ?? parseRgbColor(accentColor);
  if (!rgb) {
    return 'rgb(255, 255, 255)';
  }

  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  return luminance > 0.6 ? 'rgb(20, 20, 23)' : 'rgb(255, 255, 255)';
}

export function applyAdaptiveAccentToDocument(accentColor: string | null): void {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;

  if (!accentColor) {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--ring');
    root.style.removeProperty('--primary-foreground');
    return;
  }

  const normalized = normalizeCssColor(accentColor);
  if (!normalized) {
    return;
  }

  root.style.setProperty('--primary', normalized);
  root.style.setProperty('--ring', normalized);
  root.style.setProperty('--primary-foreground', getReadableForeground(normalized));
}

function parseHexColor(value: string): [number, number, number] | null {
  const hex = value.startsWith('#') ? value.slice(1) : value;
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }

  if (hex.length === 3 || hex.length === 4) {
    const r = Number.parseInt(hex[0] + hex[0], 16);
    const g = Number.parseInt(hex[1] + hex[1], 16);
    const b = Number.parseInt(hex[2] + hex[2], 16);
    return [r, g, b];
  }

  if (hex.length === 6 || hex.length === 8) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return [r, g, b];
  }

  return null;
}

function parseRgbColor(value: string): [number, number, number] | null {
  const match = value.match(
    /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})(?:\s*[,/]\s*[0-9.]+)?\s*\)$/i,
  );

  if (!match) {
    return null;
  }

  const r = clampColorNumber(Number.parseInt(match[1], 10));
  const g = clampColorNumber(Number.parseInt(match[2], 10));
  const b = clampColorNumber(Number.parseInt(match[3], 10));
  return [r, g, b];
}

function clampColorNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(255, Math.max(0, Math.round(value)));
}

function rgbToCss([r, g, b]: [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`;
}
