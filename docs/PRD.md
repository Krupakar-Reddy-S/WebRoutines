# WebRoutines PRD (Current)

## Product scope
WebRoutines is a Chrome MV3 side panel extension for repeat, ordered website workflows.

Current user capabilities:
- Create, edit, delete, import, and export routines.
- Store ordered routine links with drag/drop editing and import-from-tabs flow.
- Run routines in tab-group mode only (one active runner per routine, multiple routines concurrently).
- Choose tab loading strategy:
  - `eager`: open all tabs at routine start.
  - `lazy`: open tabs progressively during navigation.
- Navigate focused runner from side panel and popup (previous, next, jump, open current, stop).
- Enter focus mode with compact on-page mini-controller.
- View history in side panel with filters, grouping, and summary stats.

## Problem statement
Users who revisit the same sets of pages daily need a faster, deterministic way to reopen and navigate those pages without manual tab and URL management.

## Goals
- Reduce friction in repeat browsing workflows.
- Keep routine controls available from side panel and popup.
- Keep all data local and resilient.
- Preserve runner continuity across extension UI lifecycles.

## Non-goals
- Cross-browser support (Chrome only for now).
- Cloud sync/accounts.
- Scheduling/reminders.
- Recommendation or auto-curated link sets.

## Constraints and defaults
- Browser target: Chrome MV3.
- Persistent data: IndexedDB via Dexie.
- Active session state: `chrome.storage.session`.
- Settings: `chrome.storage.local`.
- Default settings:
  - `staticTheme: "system"`
  - `tabLoadMode: "eager"`
  - `confirmBeforeStop: true`
  - `focusModeEnabled: true`

## Technical architecture
- Build/runtime: WXT + Bun.
- UI: React + TypeScript.
- Routing: HashRouter in side panel.
- Module boundaries:
  - `core/`: pure domain logic.
  - `adapters/browser/`: wrappers for browser-specific behavior.
  - `features/*`: feature-level query/model/presentation logic.
  - `entrypoints/*`: extension runtime surfaces (background, sidepanel, popup, options, content script).

Permissions in manifest:
- `storage`, `tabGroups`, `unlimitedStorage`, `favicon`
- host permissions: `<all_urls>`

## Data model

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
- `focusModeActive` (boolean)

### Routine session record
- `routineId` (number)
- `mode` (`tab-group`)
- `loadMode` (`eager` | `lazy`)
- `currentIndex` (number)
- `tabId` (number | null)
- `tabGroupId` (number | null)
- `tabIds` (`Array<number | null>`)
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
- `mode` (`same-tab` | `tab-group`) (legacy read-compat retained)
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
- `tabLoadMode` (`eager` | `lazy`)
- `confirmBeforeStop` (boolean, strict normalized)
- `focusModeEnabled` (boolean, strict normalized)

## UX surfaces
- Side panel:
  - Runner Home (default): active runner list + focused controls + focus mode entry.
  - Routines: routine management and start flows.
  - Editor: create/edit routine.
  - History: run stats + filtered grouped run list.
  - Settings: appearance/tab-loading/runner/shortcut settings.
- Popup:
  - Focused runner controls and quick navigation to side panel history/settings.
- Focus controller:
  - Compact page overlay controls while focus mode is active.

## Quality strategy (local, current)
- Required verification before phase-level commits:
  - `bun run lint`
  - `bun run compile`
  - `bun run test`
  - `bun run build`
- Local e2e path:
  - `bun run test:e2e:install` (one-time machine setup)
  - `bun run test:e2e`

## Documentation policy
- `README.md` + `docs/PRD.md` are runtime behavior source-of-truth docs.
- Behavior changes must update both in the same PR.
- Feature-level execution logs belong in `docs/feature-list-*.md`.
- `docs/extra/` is for external research/context and is not authoritative for runtime behavior.

## Progress log
- 2026-02-06: Core MVP implementation completed (foundation, data, side panel, runner, popup, validation).
- 2026-02-06: Features 2-5 completed (multi-runner model, UX refinements, settings/focus mode, history data pipeline).
- 2026-02-07: Feature 6 completed (tab-group-only runtime, eager/lazy load strategy, history UI/stats route).
- 2026-02-07: Feature 7 Phase A completed (modularity and performance refactor).
- 2026-02-07: Feature 7 Phase B completed (unit/component/e2e local testing stack).
- 2026-02-07: Feature 7 Phase C docs cleanup started (README/PRD sync + AGENTS.md governance).
