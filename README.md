# WebRoutines

WebRoutines is a Chrome MV3 side panel extension for running daily website routines in a fixed order.

## Stack
- WXT + React + TypeScript
- Bun package manager/runtime
- Dexie + IndexedDB for routine persistence
- `browser.storage.session` for active routine runner state

## Development
```bash
bun install
bun run dev
```

## Build
```bash
bun run compile
bun run build
```

Build output is generated in `.output/chrome-mv3`.

## Load in Chrome
1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select `/Users/krupakar/Documents/Stuff/WebRoutines/.output/chrome-mv3`.

## Current MVP features
- Create, edit, delete routines with ordered links.
- Run routines in same-tab mode or tab-group mode.
- Navigate routine steps from side panel (previous, next, jump, open current, stop).
- Control active routine from popup when side panel is minimized.
