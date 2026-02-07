# WebRoutines Project Context (Post Feature List 6)

## Why this document exists
This is a current technical brief for WebRoutines after Feature List 6 implementation, so product and planning discussions can happen without re-reading the full repo each time. It includes a condensed history of Feature Lists 1-6 and recent tooling changes.

## 1) Current delivery state
Last major implementation commit:
- `d0e735c` (`2026-02-07`) - Cleanup + UX hardening across editor/history/shortcuts/favicon/CSP flows

Recent milestone commits:
- `b072cac` (`2026-02-07`) - Feature 6 Phase B: history route, stats, and run insights UI
- `cea068a` (`2026-02-07`) - Feature 6 Phase A: tab-group simplification and sidepanel UX overhaul
- `9ad6fe5` (`2026-02-07`) - React Compiler enablement + compiler-aware linting setup

Validation status:
- `bun run lint` passes
- `bun run compile` passes
- `bun run build` passes

## 2) Product snapshot
WebRoutines is a Chrome MV3 extension for running ordered website routines.

Core behavior:
- Users create routines (named URL lists).
- One active runner per routine.
- Multiple routines can run at once.
- Runtime sessions are tab-group only.
- Tab loading supports `eager` and `lazy` modes.

Primary surfaces:
- Sidepanel app (`runner`, `routines`, `editor`, `history`, `settings` views).
- Popup quick controls for active/focused runner.
- Options page (same shared settings model).
- Focus mini-controller (content script pill on web pages when focus mode is active).

## 3) What changed in Feature List 3
Feature 3 focused on practical UX polish without architecture rewrites.

Delivered:
- Runner Home progress indicators and elapsed runtime display.
- Better empty states with direct start/manage actions.
- Routine search and compact/expand link previews (later superseded by Feature 6 card redesign).
- Quick focus action for already-running routines.
- Editor improvements:
  - Single link input accepts one URL, comma-separated URLs, or one-per-line paste.
  - Add button shows parsed URL count when multiple are detected.
  - Duplicate URLs are skipped with user feedback.
  - Inline, in-sidebar confirmation UI before removing a draft link.
- Import/export split:
  - Import remains global.
  - Export is per-routine.
- Accessibility/status polish for sidepanel + popup.

## 4) What changed in Feature List 4
Feature 4 added settings, focus mini-controller, and reliability hardening.

Delivered:
- Typed shared settings model in `chrome.storage.local`.
- Options page entrypoint (`entrypoints/options/*`) using shared settings model/hook.
- Sidepanel in-app settings flow.
- Focus mini-controller content script:
  - Previous/Next controls
  - Return to sidebar action
  - Vertical drag with persisted Y offset
- Background message bridge for controller actions/state sync.
- Theme split:
  - Sidebar/popup/options use static extension theme (`system/light/dark`).
  - Mini-controller uses page-adaptive accent styling only.
- Stability hardening:
  - Safe fallbacks when content-script storage access is restricted.
  - Sidebar-open fallback path in controller flow.

## 5) What changed in Feature List 5
Feature 5 delivered reliability and run-history foundations.

Phase A (cleanup + resilience) shipped:
- Sidepanel decomposition into view components (`views/*`) and shared UI pieces.
- HashRouter routing for sidepanel views.
- Error boundary with recovery card.
- Shared helpers for elapsed time and input target detection.
- Runner lifecycle listeners for tab close and tab reorder.
- Popup elapsed time display.
- Tab-group step restoration inserts tabs in the correct step order.

Phase B (run history foundation) shipped:
- Dexie schema v2 with `runs` and `runEvents` tables.
- Run start/stop + step switch logging.
- `lastRunAt` on routines and recently-run ordering.
- Run finalization on stop, tab close, and group removal.

## 6) What changed in Feature List 6
Feature 6 delivered runtime simplification plus history/stats UI.

Phase A shipped:
- Removed single-tab runtime path from sessions/navigation.
- Added `tabLoadMode` (`eager` / `lazy`) as a setting.
- Updated session model to `tabIds: Array<number | null>` for lazy placeholders.
- Redesigned routines view with accordion cards, favicon strip, and inline actions.
- Added import-from-tabs dialog in editor workflow.
- Reworked settings UIs with shadcn controls.

Phase B shipped:
- Added sidepanel history route: `#/history` and filtered route `#/history?routine=<id>`.
- Added history entry points from runner/routines/popup.
- Added stats summary cards:
  - Total runs
  - Total time
  - Completion rate
- Added grouped run list (`Today`, `Yesterday`, `This week`, `Earlier`) with step progress and run status badges.

Post-Phase-B cleanup shipped (`d0e735c`):
- Editor UX hardening:
  - Unsaved-change leave confirmation with change summary.
  - Enter in add-link field adds links only (explicit save required).
  - Dialog-based link removal and compact, consistent dialog sizing/buttons.
- Navigation shortcuts overhaul:
  - Added extension commands for previous/next step.
  - Removed hardcoded Alt+Shift key listeners from popup/sidepanel.
  - Dynamic shortcut labels surfaced in settings, runner home, and popup.
- History improvements:
  - Routine/status filters moved beside summary header.
  - Added run status filter (`all`, `in progress`, `complete`, `partial`).
  - Added pagination with URL-backed page state.
- Favicon/CSP cleanup:
  - `_favicon` path usage retained for extension rendering.
  - CSP image hosts expanded for Google favicon redirect hosts (`*.gstatic.com`).

Post-commit stabilization (current working tree):
- Focus controller content script hardened to avoid unhandled promise rejections when extension context is invalidated during reload/update.

## 7) Toolchain/runtime updates after Feature 6
Recent tooling commit (`9ad6fe5`) added:
- React Compiler via Vite Babel plugin (`babel-plugin-react-compiler`).
- Compiler-aware linting with ESLint flat config and `eslint-plugin-react-hooks` latest recommended set.
- New scripts:
  - `bun run lint`
  - `bun run lint:fix`

## 8) Tech stack and runtime
- WXT + React + TypeScript + React Router (HashRouter)
- Tailwind v4 + shadcn/ui
- React Compiler enabled in Vite build pipeline
- ESLint flat config with React Hooks/compiler diagnostics
- Dexie/IndexedDB for routines data
- `browser.storage.session` for runner/focus ephemeral state
- `browser.storage.local` for app settings and controller accent cache

Commands:
- `bun install`
- `bun run dev`
- `bun run lint`
- `bun run compile`
- `bun run build`

## 9) Extension architecture (current)
Entrypoints:
- `entrypoints/background.ts`
  - Sidepanel behavior setup
  - Tab-group removal, tab close, and tab reorder listeners
  - Focus controller runtime message bridge
- `entrypoints/sidepanel/App.tsx`
  - Shell + HashRouter routes (`runner`, `routines`, `editor`, `history`, `settings`)
  - Error boundary recovery
- `entrypoints/sidepanel/views/*`
  - `RunnerHomeView`, `RoutinesView`, `EditorView`, `HistoryView`, `SettingsView`
- `entrypoints/popup/App.tsx`
  - Quick controls + open sidepanel settings/history
  - Elapsed time display
- `entrypoints/options/App.tsx`
  - Dedicated options UI wired to shared settings
- `entrypoints/focus-controller.content.ts`
  - Focus mini-controller UI injected on `<all_urls>`

Core libs:
- `lib/routines.ts` - routine CRUD, URL normalization, import/export parsing
- `lib/navigation.ts` - start/stop/navigate + sidepanel open helpers + run history wiring
- `lib/session.ts` - active sessions, focused runner, focus mode, sidepanel view requests
- `lib/settings.ts` - settings schema/defaults/read-write-subscribe
- `lib/use-settings.ts` - React hook for synced settings state
- `lib/run-history.ts` - run tracking (`runs` + `runEvents`)
- `lib/dom.ts` - shared input target detection
- `lib/time.ts` - shared elapsed time formatting
- `lib/url.ts` - favicon URL + compact URL display helpers

## 10) Data model summary
### IndexedDB (`routines`, `runs`, `runEvents`)
```ts
interface Routine {
  id?: number;
  name: string;
  links: Array<{ id: string; url: string; title?: string }>;
  lastRunAt?: number;
  createdAt: number;
  updatedAt: number;
}

interface RoutineRun {
  id?: number;
  routineId: number;
  startedAt: number;
  stoppedAt: number | null;
  stepsCompleted: number;
  totalSteps: number;
  completedFull: boolean;
  mode: 'same-tab' | 'tab-group'; // historical compatibility
  durationMs: number | null;
  stopReason?: 'user-stop' | 'tabs-closed' | 'group-removed' | 'system-stop' | 'unknown';
}

interface RoutineRunEvent {
  id?: number;
  runId: number;
  routineId: number;
  timestamp: number;
  type: 'start' | 'step' | 'stop';
  stepIndex?: number;
}
```

### Session storage (`browser.storage.session`)
```ts
interface RoutineSession {
  routineId: number;
  mode: 'tab-group';
  loadMode: 'eager' | 'lazy';
  currentIndex: number;
  tabId: number | null;
  tabGroupId: number | null;
  tabIds: Array<number | null>;
  startedAt: number;
  runId?: number;
}
```

Session keys:
- `activeSessions`
- `focusedRoutineId`
- `focusModeActive`
- `requestedSidepanelView`
- legacy migration key: `activeSession`

### Local settings (`browser.storage.local`)
```ts
interface AppSettings {
  staticTheme: 'light' | 'dark' | 'system';
  tabLoadMode: 'eager' | 'lazy';
  confirmBeforeStop: boolean;
  focusModeEnabled: boolean;
}
```

## 11) Permissions and APIs
Current effective MV3 permissions:
- `storage`
- `tabGroups`
- `unlimitedStorage`
- `sidePanel`
- host permissions: `<all_urls>` (for content script + focus controller behavior)

Main APIs used:
- `browser.sidePanel.*`
- `browser.tabs.*`
- `browser.tabGroups.*`
- `browser.storage.local`
- `browser.storage.session`
- `browser.storage.onChanged`

## 12) Known limitations
- No automated unit/integration test suite yet.
- No scheduling, folders, or sharing.
- No omnibox/new-tab integrations.
- Focus controller intentionally kept minimal (no expanded/detailed mode).

## 13) Feature list history (1-6)
Feature List 1 (UI foundation + workflow upgrades):
- Adopted shadcn-style component base + Tailwind v4 setup.
- Added light/dark theme toggle and persistence.
- Added drag/drop link reordering, import/export JSON backups, and runner hotkeys.

Feature List 2 (runner-first UX + multi-runner lifecycle):
- Runner Home as primary surface with separate routines/editor pages.
- Multi-runner session model: one runner per routine, many routines concurrently.
- Tab-group ownership for single/multi modes with stop/delete semantics.
- Popup controls aligned with focused runner.

Feature List 3 (sidepanel UX polish):
- Runner Home progress + elapsed time + empty states.
- Search/previews/focus actions in routines list (later refined in Feature 6).
- Editor bulk URL paste and clearer drag/drop feedback.
- Accessibility + transient feedback polish.

Feature List 4 (settings + focus controller + theme split):
- Typed settings model in local storage + dedicated options page.
- Focus mini-controller content script with previous/next + sidebar.
- Adaptive accent only for controller; static theme for extension surfaces.
- Stability hardening around controller/storage and settings flow.

Feature List 5 (decomposition + resilience + history foundation):
- Sidepanel split into views/components + HashRouter routes.
- Error boundary + recovery card + shared time/input helpers.
- Runner resilience: tab close/reorder sync + ordered tab restoration.
- Run history foundation: runs/runEvents tables, start/stop/step logging, `lastRunAt`.

Feature List 6 (runtime simplification + history/stats UI):
- Removed single-tab runtime path and added `tabLoadMode` (`eager`/`lazy`).
- Redesigned routines/editor/settings UX around shadcn components.
- Added history route, stats cards, routine filter, grouped run insights, and popup history entry point.

## 14) Improvements doc alignment (done vs pending)
Reference doc: `docs/extra/WEBROUTINES_IMPROVEMENTS_V2.md`

Substantially done already:
- Focus mini-controller MVP exists (compact pill + sidebar return + drag/persist).
- Settings foundation and options page exist.
- Theme split is in place (static extension theme + adaptive controller).
- Rich routine cards and favicon strip are shipped.
- Routine history/stats UI is shipped.
- Error boundary/recovery framework is shipped.

Still pending from improvements doc:
- Additional tab divergence/resilience signals (`tabs.onUpdated` drift handling).
- Folders/categories.
- Command palette.
- Omnibox/new-tab integrations.
- Sharing flows (markdown/link/QR).
- Per-step config (notes/skip/auto-advance).
- Onboarding flow.

## 15) Pragmatic next explorations
Suggested next (in order):
1. Session resilience hardening:
   - Add minimal `tabs.onUpdated` divergence marker.
2. Command palette in sidepanel:
   - Start routine, focus routine, stop routine, open settings/history.
3. Structured organization:
   - Folders/categories + lightweight grouping UX.
4. Per-step intelligence:
   - Notes/skip/optional auto-advance for advanced workflows.
