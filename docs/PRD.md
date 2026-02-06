# WebRoutines PRD (Current)

## Product scope (current)
WebRoutines is a Chrome MV3 side panel extension for daily, ordered website reading workflows.

A user can:
- Create routines.
- Add an ordered sequence of links to each routine.
- Start a routine in one of two modes:
  - Single-tab group mode: one dedicated tab in a dedicated group navigates through the sequence.
  - Multi-tab group mode: all routine links open as tabs in a dedicated group under the routine name.
- Navigate forward/backward through the routine sequence from:
  - The side panel (full controls).
  - A minimized popup (quick controls when side panel is not open).
- Enter focus mode to use a compact on-page mini-controller.
- Run multiple routines concurrently, with one active runner per routine.
- Review run history data (stored locally; UI pending).

Current product constraints:
- Browser target: Chrome only (no cross-browser support yet).
- Storage: IndexedDB only for persistent data, implemented with Dexie.
- Session state: `chrome.storage.session` for active routine/tab/index state so controls remain consistent across side panel/popup lifecycle.
- Settings stored in `chrome.storage.local`.

## Problem statement
People who read multiple static pages daily (blogs, docs, newsletters, dashboards) need a lightweight way to revisit them in a consistent order without manually opening/searching each URL every day.

## Goals
- Reduce friction for repeat daily browsing sequences.
- Keep UI always reachable via side panel.
- Keep quick navigation reachable via popup when side panel is minimized.
- Preserve routine data locally and robustly with IndexedDB.

## Non-goals (current)
- Cross-browser compatibility.
- Cloud sync/account system.
- Recommendation engine/auto-discovery of links.
- Complex scheduling or reminders.
- Full run history analytics UI (data exists, UI pending).

## Technical decisions (current)
- Build system: WXT (MV3 extension tooling), Bun package manager/runtime.
- UI: React + TypeScript in side panel and popup.
- Data: Dexie over IndexedDB.
- Architecture: smart side panel + thin background worker.
- Routing strategy: HashRouter for side panel views.
- Permissions: `sidePanel`, `storage`, `tabGroups`, `unlimitedStorage`, host permissions `<all_urls>`.

## Data model (current)

### Routine
- `id` (number, auto)
- `name` (string)
- `links` (array of `{ id: string; url: string; title?: string }`)
- `lastRunAt` (number, optional)
- `createdAt` (number)
- `updatedAt` (number)

### Active runner state (`chrome.storage.session`)
- `activeSessions` (array of routine sessions)
- `focusedRoutineId` (number | null)

### Routine session record
- `routineId` (number)
- `mode` (`same-tab` | `tab-group`)
- `currentIndex` (number)
- `tabId` (number | null)
- `tabGroupId` (number | null)
- `tabIds` (number[])
- `startedAt` (number)
- `runId` (number | undefined)

### Routine run record (`runs`)
- `id` (number, auto)
- `routineId` (number)
- `startedAt` (number)
- `stoppedAt` (number | null)
- `stepsCompleted` (number)
- `totalSteps` (number)
- `completedFull` (boolean)
- `mode` (`same-tab` | `tab-group`)
- `durationMs` (number | null)
- `stopReason` (`user-stop` | `tabs-closed` | `group-removed` | `system-stop` | `unknown`)

### Routine run event (`runEvents`)
- `id` (number, auto)
- `runId` (number)
- `routineId` (number)
- `timestamp` (number)
- `type` (`start` | `step` | `stop`)
- `stepIndex` (number | undefined)

### App settings (`chrome.storage.local`)
- `staticTheme` (`system` | `light` | `dark`)
- `defaultRunMode` (`same-tab` | `tab-group`)
- `confirmBeforeStop` (boolean)
- `focusModeEnabled` (boolean)

## UX outline (current)
- Side panel:
  - Runner Home (default): focused runner controls + active runner list.
  - Routines page: routine listing, start, delete, import/export.
  - Routine editor page: dedicated create/edit flow with ordered links.
  - Settings page: theme + default run mode + focus mode toggle.
- Popup (minimized controls):
  - Shows focused routine + current step.
  - Previous / next / stop / open side panel actions.
  - Quick "next runner" focus switch.
- Focus mini-controller (optional):
  - Compact pill on web pages with prev/next + sidebar controls.

## Task checklist (original MVP)
- [x] Task 1: Bootstrap extension foundation from research stack (WXT + MV3 + side panel + popup + background setup).
- [x] Task 2: Add Dexie database schema, repositories, and session storage helpers.
- [x] Task 3: Build side panel routine CRUD UI (create, list, delete, edit basic links).
- [x] Task 4: Build routine runner (same tab + tab group launch, prev/next navigation).
- [x] Task 5: Build popup minimized controls synced to active session.
- [x] Task 6: Run build/type validation and polish docs.

## Progress log
- 2026-02-06: PRD initialized with MVP scope, architecture choices, and implementation checklist.
- 2026-02-06: Task 1 completed with WXT/Bun bootstrap, MV3 manifest setup, side panel permission wiring, and thin background side panel behavior configuration.
- 2026-02-06: Task 2 completed with Dexie setup, routine schema/CRUD helpers, URL parsing utilities, and session state storage/subscribe helpers.
- 2026-02-06: Task 3 completed with side panel UI for creating, editing, deleting, and listing routines from IndexedDB.
- 2026-02-06: Task 4 completed with routine runner behavior for same-tab and tab-group modes plus previous/next/jump navigation.
- 2026-02-06: Task 5 completed with minimized popup controls for previous/next/open-current/stop plus one-click side panel open.
- 2026-02-06: Task 6 completed with successful `bun run compile` and `bun run build`, plus README setup/build/load instructions.
- 2026-02-06: Feature 2 updates started: session model moved to multi-runner state with focused routine and per-routine runner ownership.
- 2026-02-06: Feature 2 updates: sidepanel split into Runner Home / Routines / Editor views for cleaner routine management UX.
- 2026-02-06: Feature 2 updates: runner lifecycle refined so runner stop/delete closes runner-owned tabs and group removal auto-clears session.
- 2026-02-06: Feature 3 updates: Runner Home polished with per-runner progress, elapsed runtime display, and better empty-state CTA.
- 2026-02-06: Feature 3 updates: routine management improved with search, compact link previews, and quick focus action for active runners.
- 2026-02-06: Feature 3 updates: editor now supports bulk URL paste and clearer drag/drop reorder affordances.
- 2026-02-06: Feature 3 updates: status/live-region accessibility improved and validated with successful `bun run compile` and `bun run build`.
- 2026-02-06: Feature 4 updates: settings model + options page, focus mini-controller, adaptive accent split, and stability hardening.
- 2026-02-06: Feature 5 Phase A: sidepanel decomposition, HashRouter routing, error boundary, and runner resilience improvements.
- 2026-02-06: Feature 5 Phase B: run history foundation (`runs`, `runEvents`), run logging, and `lastRunAt` ordering.
