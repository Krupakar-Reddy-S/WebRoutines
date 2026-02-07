import { test, expect } from './fixtures';

test('loads sidepanel shell and runner home', async ({ context, extensionId }) => {
  const page = await context.newPage();

  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await expect(page.getByText('Runner Home')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manage routines' })).toBeVisible();
});
