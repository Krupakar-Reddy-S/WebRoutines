export async function openChromeShortcutsPage(): Promise<boolean> {
  try {
    await browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
    return true;
  } catch {
    return false;
  }
}
