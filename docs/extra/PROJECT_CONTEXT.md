# WebRoutines Project Context (Post Feature List 7)

## Why this document exists
This is a single-file technical context packet intended for second-opinion AI chats and design reviews.
It is written so someone can reason about WebRoutines without loading the full repository.

## Current delivery state
Latest milestone commits:
- `7f12d9c` - Phase C docs cleanup: added `AGENTS.md`, synced `README.md` and `docs/PRD.md`, updated Feature List 7 status.
- `9270b9e` - Phase B local testing stack: Vitest unit/component + Playwright extension e2e scaffold and scripts.
- `aa19134` - Phase A modularity + performance refactor and runtime stability fixes.

Current local quality baseline:
- `bun run lint` passes
- `bun run compile` passes
- `bun run test` passes
- `bun run build` passes
- `bun run test:e2e` passes (after one-time `bun run test:e2e:install`)

## Product snapshot
WebRoutines is a Chrome MV3 extension for running ordered daily website routines.

Core runtime behavior:
- Tab-group-only execution (`mode: 'tab-group'` for active sessions).
- One active runner per routine, multiple routines can run concurrently.
- Tab loading strategies:
  - `eager`: create all routine tabs at start.
  - `lazy`: create tabs progressively as user navigates.
- Main controls from sidepanel and popup: previous, next, jump, open-current, stop.
- Focus mode mini-controller appears on web pages for active focused runner navigation.
- Local run history with filters and summary stats.

Main surfaces:
- Sidepanel app: `Runner Home`, `Routines`, `Editor`, `History`, `Settings`.
- Popup quick controls for the focused runner.
- Options page using shared settings form model.
- Focus controller content script on `<all_urls>`.

## Feature List 7 detailed context (A/B/C)

### Phase A (completed): modularity + data performance + runtime fixes
Intent:
- Reduce coupling and large-file complexity.
- Improve history query behavior as run volume grows.
- Harden session/focus/stop behavior with no product regressions.

Delivered architecture refactor:
- Extracted focused-runner resolution to `core/runner/focus.ts` and reused it across background, sidepanel, and popup.
- Extracted settings form sections into reusable feature module consumed by sidepanel settings and options page.
- Established clearer module boundaries:
  - `core/` for pure logic.
  - `adapters/browser/` for browser-specific wrappers.
  - `features/*` for feature-centric logic and UI splits.
- Split heavy files by responsibility:
  - History split into query/filtering/presentation/types modules.
  - Editor split into draft parsing, drag reorder, and dialogs modules.
  - Focus controller split into bridge/ui/accent modules.

Delivered performance/data-path changes:
- History flow moved away from full-table UI-layer filtering to query service with pagination and filter-aware selection.
- Dexie schema updated with index support for efficient history queries (`[routineId+startedAt]` and related usage path).
- Routine import flow updated to transactional batched writes with stronger validation/error handling.

Delivered runtime hardening and UX correctness in same phase:
- Focus controller stabilization against extension-context invalidation/reload issues.
- Stop flow consistency improvements (single-stop semantics and better stop-state cleanup).
- Focus mode behavior aligned with current expectations (default enabled setting and runner/focus state consistency).
- Runner cleanup behavior aligned with tab-group deletion lifecycle.

Validation performed for Phase A:
- `bun run lint`
- `bun run compile`
- `bun run build`

### Phase B (completed): local testing stack (CI intentionally deferred)
Intent:
- Add reliable local verification gates before future commits/releases.
- Cover pure logic, component behavior, and extension runtime smoke path.

Delivered test/tooling setup:
- Added scripts in `package.json`:
  - `test`, `test:unit`, `test:component`, `test:watch`, `test:e2e:build`, `test:e2e:install`, `test:e2e`.
- Added Vitest configuration split:
  - `vitest.unit.config.ts`
  - `vitest.component.config.ts`
  - shared alias config in `vitest.shared.ts`
- Added React Testing Library setup for component tests (`tests/component/setup.ts`).
- Added Playwright extension config + fixtures for loading `.output/chrome-mv3` in persistent Chromium context.
- Added deterministic extension-id strategy for e2e test builds via test-only manifest `key` in `wxt.config.ts` when `WEBROUTINES_E2E=1`.
- Added ignore rules for test artifacts (`test-results`, `playwright-report`).

Delivered initial test coverage:
- Unit tests:
  - URL normalization and backup parsing (`lib/routines`).
  - Settings normalization/coercion behavior (`lib/settings`).
  - Focused runner resolver behavior (`core/runner/focus`).
  - History filter/duration/status helpers (`features/history/filtering`).
- Component tests:
  - History run card rendering and filter callback behavior.
  - Settings shortcut section rendering and action trigger.
- E2E smoke:
  - Extension sidepanel loads and runner home is visible.

Phase B constraint decision:
- No CI workflow added yet by request; local-first scripts established for now.

Validation performed for Phase B:
- `bun run lint`
- `bun run compile`
- `bun run test`
- `bun run test:e2e`

### Phase C (completed): docs and governance sync
Intent:
- Remove documentation drift from runtime behavior.
- Create stable working rules for future AI-assisted implementation.

Delivered:
- Added repository-level `AGENTS.md` with rules for:
  - Bun-only tooling usage.
  - Required verification sequence before phase-level commits (`lint -> compile -> test -> build`, with `test:e2e` when relevant).
  - Module boundaries and testing conventions.
  - Documentation governance and purpose of `docs/extra`.
- Updated `README.md` to current runtime behavior and commands.
- Updated `docs/PRD.md` to current product/architecture/data model reality.
- Updated `docs/feature-list-7.md` to mark all phases complete.

## Current architecture map
Entrypoints:
- `entrypoints/background.ts` - sidepanel behavior wiring, runner lifecycle listeners, focus-controller messaging.
- `entrypoints/sidepanel/App.tsx` + `entrypoints/sidepanel/views/*` - sidepanel shell/routes/views.
- `entrypoints/popup/App.tsx` - focused runner quick controls.
- `entrypoints/options/*` - options page using shared settings sections.
- `entrypoints/focus-controller.content.ts` - page-level mini-controller host.

Key modules:
- `core/runner/focus.ts` - focused session resolution logic.
- `features/history/*` - history query/filtering/presentation/types.
- `features/editor/*` - draft/drag/dialog responsibilities.
- `features/settings/*` - shared settings form model/components.
- `features/focus-controller/*` - bridge/ui/accent logic.
- `adapters/browser/extension-pages.ts` - browser adapter helpers.
- `lib/*` - data/session/navigation/settings/time/utilities.

## Data model summary
IndexedDB (`lib/db.ts`):
- `routines`
- `runs`
- `runEvents`

Session state (`browser.storage.session`):
- `activeSessions`
- `focusedRoutineId`
- `focusModeActive`
- `requestedSidepanelView`
- legacy migration compatibility key: `activeSession`

Local settings (`browser.storage.local`):
- `staticTheme: 'system' | 'light' | 'dark'`
- `tabLoadMode: 'eager' | 'lazy'`
- `confirmBeforeStop: boolean` (strict normalization)
- `focusModeEnabled: boolean` (strict normalization)

## Quality and operations
Required local verification sequence for meaningful changes:
1. `bun run lint`
2. `bun run compile`
3. `bun run test`
4. `bun run build`

When extension runtime flow is touched, additionally run:
- `bun run test:e2e`

## Documentation policy (authoritative vs reference)
Authoritative behavior docs:
- `README.md`
- `docs/PRD.md`

Execution planning/log docs:
- `docs/feature-list-*.md`

Reference/secondary context docs (non-authoritative):
- `docs/extra/*`
- Purpose: external research notes and reusable AI-chat context without full-repo ingestion.

## Known constraints and pending decisions
- Browser target remains Chrome MV3 only.
- CI pipeline intentionally deferred (local scripts are active gate for now).
- Manifest permission minimization is not yet finalized; currently retains broad host permission for focus-controller behavior.

## Copy/paste handoff block for external AI second opinions
Use this exact summary when asking another model for architecture or product feedback:

"WebRoutines is a Chrome MV3 extension with sidepanel/popup/options/content-script surfaces. Runtime is tab-group-only with eager/lazy tab loading and one active runner per routine (multiple routines can run concurrently). Feature List 7 is complete: Phase A refactored architecture into core/adapters/features and improved history/import performance; Phase B added local test stack (Vitest unit+component, Playwright extension e2e with deterministic test key, no CI yet); Phase C synced docs and added AGENTS governance (Bun-only, required lint/compile/test/build before phase commits). Persistent data uses Dexie (routines/runs/runEvents), sessions use browser.storage.session, settings use browser.storage.local with strict normalization. Current baseline passes lint/compile/test/build and local e2e." 
