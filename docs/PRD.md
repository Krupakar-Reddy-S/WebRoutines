# WebRoutines PRD (MVP)

## Product scope (initial)
WebRoutines is a Chrome MV3 side panel extension for daily, ordered website reading workflows.

A user can:
- Create routines.
- Add an ordered sequence of links to each routine.
- Start a routine in one of two modes:
  - Same tab mode: the current active tab navigates through the sequence.
  - Tab group mode: all routine links open as tabs grouped under the routine name.
- Navigate forward/backward through the routine sequence from:
  - The side panel (full controls).
  - A minimized popup (quick controls when side panel is not open).

For MVP:
- Browser target: Chrome only (no cross-browser support yet).
- Storage: IndexedDB only for persistent data, implemented with Dexie.
- Session state: `chrome.storage.session` for active routine/tab/index state so controls remain consistent across side panel/popup lifecycle.

## Problem statement
People who read multiple static pages daily (blogs, docs, newsletters, dashboards) need a lightweight way to revisit them in a consistent order without manually opening/searching each URL every day.

## Goals
- Reduce friction for repeat daily browsing sequences.
- Keep UI always reachable via side panel.
- Keep quick navigation reachable via popup when side panel is minimized.
- Preserve routine data locally and robustly with IndexedDB.

## Non-goals (MVP)
- Cross-browser compatibility.
- Cloud sync/account system.
- Recommendation engine/auto-discovery of links.
- Complex scheduling or reminders.

## Technical decisions (based on research)
- Build system: WXT (MV3 extension tooling), Bun package manager/runtime.
- UI: React + TypeScript in side panel and popup.
- Data: Dexie over IndexedDB.
- Architecture: smart side panel + thin background worker.
- Routing strategy: single-page style in side panel without browser history dependency.
- Permissions: minimal initial permissions (`sidePanel`, `storage`, `tabGroups`), avoid broad `tabs` permission in MVP.

## Data model (MVP)

### Routine
- `id` (number, auto)
- `name` (string)
- `links` (array of `{ id: string; url: string; title?: string }`)
- `createdAt` (number)
- `updatedAt` (number)

### Active session (`chrome.storage.session`)
- `routineId` (number)
- `mode` (`same-tab` | `tab-group`)
- `currentIndex` (number)
- `tabId` (number | null)
- `tabGroupId` (number | null)
- `tabIds` (number[])
- `startedAt` (number)

## UX outline (MVP)
- Side panel:
  - Routine list.
  - Create/edit routine form (name + multiline URLs).
  - Start routine (same tab / tab group).
  - Runner controls: previous, next, jump to link, open current.
- Popup (minimized controls):
  - Shows active routine + current step.
  - Previous / next / open side panel actions.

## Task checklist
- [x] Task 1: Bootstrap extension foundation from research stack (WXT + MV3 + side panel + popup + background setup).
- [x] Task 2: Add Dexie database schema, repositories, and session storage helpers.
- [x] Task 3: Build side panel routine CRUD UI (create, list, delete, edit basic links).
- [x] Task 4: Build routine runner (same tab + tab group launch, prev/next navigation).
- [x] Task 5: Build popup minimized controls synced to active session.
- [ ] Task 6: Run build/type validation and polish docs.

## Progress log
- 2026-02-06: PRD initialized with MVP scope, architecture choices, and implementation checklist.
- 2026-02-06: Task 1 completed with WXT/Bun bootstrap, MV3 manifest setup, side panel permission wiring, and thin background side panel behavior configuration.
- 2026-02-06: Task 2 completed with Dexie setup, routine schema/CRUD helpers, URL parsing utilities, and session state storage/subscribe helpers.
- 2026-02-06: Task 3 completed with side panel UI for creating, editing, deleting, and listing routines from IndexedDB.
- 2026-02-06: Task 4 completed with routine runner behavior for same-tab and tab-group modes plus previous/next/jump navigation.
- 2026-02-06: Task 5 completed with minimized popup controls for previous/next/open-current/stop plus one-click side panel open.
