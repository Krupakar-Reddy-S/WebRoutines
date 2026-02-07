export function getFaviconUrl(url: string, size: number = 32): string {
  try {
    const pageUrl = encodeURIComponent(new URL(url).toString());
    return `chrome-extension://${browser.runtime.id}/_favicon/?pageUrl=${pageUrl}&size=${size}`;
  } catch {
    return '';
  }
}

export function getDisplayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${host}${path}`;
  } catch {
    return url;
  }
}
