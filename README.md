# WebRoutines

WebRoutines is a Chrome MV3 side panel extension for running daily website routines in a fixed order.

## Stack
- WXT + React + TypeScript
- Bun package manager/runtime
- shadcn/ui (base-nova preset) + Tailwind v4
- Dexie + IndexedDB for routine persistence
- `browser.storage.session` for multi-runner session state + focused runner

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
- Runner-first sidepanel UX with dedicated views:
- Runner Home (default)
- Routines page
- Routine Editor page
- Create, edit, delete routines with ordered links.
- Drag-and-drop reorder links directly in the routine editor.
- Run routines in grouped modes:
- Single-tab group mode (one reusable tab per routine runner)
- Multi-tab group mode (one tab per link)
- One active runner per routine; multiple routine runners can run concurrently.
- Navigate focused routine steps from side panel (previous, next, jump, open current, stop).
- Control focused runner from popup when side panel is minimized, including quick runner switching.
- Stopping a runner or deleting an active routine closes runner-owned tabs.
- If a runner tab group is removed manually, the corresponding runner session auto-clears.
- Import/export routine backups as JSON.
- Keyboard shortcuts for navigation: `Alt+Shift+Left` and `Alt+Shift+Right`.
- Light/dark theme toggle in side panel and popup.
- Runner Home shows per-runner progress + elapsed runtime, with quick CTA when no runners are active.
- Routines page includes routine-name search, compact link previews, and quick focus for running routines.
- Routine editor supports bulk URL paste (one URL per line) and improved drag/drop reorder feedback.
- Side panel and popup status messages now auto-clear and use improved ARIA live-region semantics.
