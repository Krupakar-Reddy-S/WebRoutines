import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { chromium, expect, test as base, type BrowserContext } from '@playwright/test';

interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
}

function resolveExtensionPath(): string {
  const configuredPath = process.env.WEBROUTINES_EXTENSION_PATH ?? '.output/chrome-mv3';
  return path.resolve(process.cwd(), configuredPath);
}

function resolveChromiumExecutablePath(): string {
  const root = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  const candidateDirs = fs.existsSync(root)
    ? fs.readdirSync(root).filter((entry) => entry.startsWith('chromium-')).sort().reverse()
    : [];

  for (const dir of candidateDirs) {
    const base = path.join(root, dir);
    const executableCandidates = [
      path.join(base, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
      path.join(base, 'chrome-mac', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
    ];

    for (const executablePath of executableCandidates) {
      if (fs.existsSync(executablePath)) {
        return executablePath;
      }
    }
  }

  throw new Error('Chromium executable not found. Run "bun run test:e2e:install" first.');
}

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, runFixture) => {
    const extensionPath = resolveExtensionPath();
    if (!fs.existsSync(extensionPath)) {
      throw new Error(
        `Extension build not found at "${extensionPath}". Run "bun run test:e2e:build" first.`,
      );
    }

    const executablePath = resolveChromiumExecutablePath();
    const headless = process.env.WEBROUTINES_E2E_HEADLESS === '1';
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webroutines-e2e-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      executablePath,
      headless,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
      viewport: { width: 1280, height: 800 },
    });

    try {
      await runFixture(context);
    } finally {
      await context.close();
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  },

  extensionId: async ({ context }, runFixture) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    const extensionId = new URL(serviceWorker.url()).host;
    await runFixture(extensionId);
  },
});

export { expect };
