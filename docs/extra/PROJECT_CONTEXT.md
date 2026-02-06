# WebRoutines Project Context (Post Feature List 5)

## Why this document exists
This is a current technical brief for WebRoutines after Feature List 5 implementation, so product/planning discussions can happen without re-reading the full repo each time. It also includes a condensed history of Feature Lists 1–5 for quick handoff to new collaborators or AI tooling.

## 1) Current delivery state
Last major implementation commit:
- `f5cfd1c` (`2026-02-06`) - Feature List 5 Phase B: run history foundation

Recent milestone commits:
- `4b6154a` - Feature List 5 Phase A: sidepanel split + routing + runner resilience
- `87a51f7` - Feature List 4: settings + focus mini-controller + theme split

Validation status:
- `bun run compile` passes
- `bun run build` passes

## 2) Product snapshot
WebRoutines is a Chrome MV3 extension for running ordered website routines.

Core behavior:
- Users create routines (named URL lists).
- One active runner per routine.
- Multiple routines can run at once.
- Runner supports `same-tab` and `tab-group` modes.

Primary surfaces:
- Sidepanel app (`runner`, `routines`, `editor`, `settings` views).
- Popup quick controls for active/focused runner.
- Options page (same settings model, open from Chrome extensions page).
- Focus mini-controller (content script pill on web pages when focus mode is active).

## 3) What changed in Feature List 3
Feature 3 focused on low-complexity UX polish without architecture rewrites.

Delivered:
- Runner Home progress indicators and elapsed runtime display.
- Better empty states with direct start/manage actions.
- Routine search and compact/expand link previews.
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
Feature 4 added settings + focus-mode controller + reliability hardening.

Delivered:
- Typed shared settings model in `chrome.storage.local`:
  - `staticTheme`: `system | light | dark`
  - `defaultRunMode`: `same-tab | tab-group`
  - `confirmBeforeStop`: boolean
  - `focusModeEnabled`: boolean
- Options page entrypoint (`entrypoints/options/*`) using same settings model/hook.
- Sidepanel in-app settings view and popup settings open flow into sidepanel settings.
- Focus mini-controller content script:
  - Previous/Next controls
  - Return to sidebar action
  - Vertical drag with persisted Y offset
- Background message bridge for controller actions/state sync.
- Theme split (finalized after iteration):
  - Sidebar/popup/options use static extension theme (`system/light/dark`).
  - Mini-controller uses page-adaptive accent styling only.
- Stability hardening:
  - Safe fallbacks when content-script storage access is restricted.
  - Sidebar-open fallback path in controller flow.

## 5) What changed in Feature List 5
Feature 5 delivered Tier 1 reliability + foundation work.

Phase A (cleanup + resilience) shipped:
- Sidepanel decomposition into view components (`views/*`) and shared UI pieces.
- HashRouter routing for sidepanel views.
- Error boundary with recovery card.
- Shared helpers for elapsed time and input target detection.
- Runner lifecycle listeners for tab close and tab reorder.
- Popup elapsed time display.
- Tab-group step restoration now inserts new tabs in the correct step order.

Phase B (run history foundation) shipped:
- Dexie schema v2 with `runs` and `runEvents` tables.
- Run start/stop + step switch logging.
- `lastRunAt` on routines and “recently run” ordering.
- Run finalization on stop, tab close, and group removal.

## 6) Tech stack and runtime
- WXT + React + TypeScript + React Router (HashRouter)
- Tailwind v4 + shadcn/ui
- Dexie/IndexedDB for routines data
- `browser.storage.session` for runner/focus ephemeral state
- `browser.storage.local` for app settings and controller accent cache

Commands:
- `bun install`
- `bun run dev`
- `bun run compile`
- `bun run build`

## 7) Extension architecture (current)
Entrypoints:
- `entrypoints/background.ts`
  - Sidepanel behavior setup
  - Tab-group removal, tab close, and tab reorder listeners
  - Focus controller runtime message bridge
- `entrypoints/sidepanel/App.tsx`
  - Shell + HashRouter routes
  - Error boundary recovery
- `entrypoints/sidepanel/views/*`
  - `RunnerHomeView`, `RoutinesView`, `EditorView`, `SettingsView`
- `entrypoints/popup/App.tsx`
  - Quick controls + open sidepanel/settings
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
- `lib/adaptive-accent.ts` - adaptive accent extraction/cache utilities used by controller
- `lib/run-history.ts` - run tracking (runs + run events)
- `lib/dom.ts` - shared input target detection
- `lib/time.ts` - shared elapsed time formatting

## 8) Data model summary
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
  mode: 'same-tab' | 'tab-group';
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
  mode: 'same-tab' | 'tab-group';
  currentIndex: number;
  tabId: number | null;
  tabGroupId: number | null;
  tabIds: number[];
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
  defaultRunMode: 'same-tab' | 'tab-group';
  confirmBeforeStop: boolean;
  focusModeEnabled: boolean;
}
```

## 9) Permissions and APIs
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

## 10) Known limitations
- No automated unit/integration test suite yet.
- No routine history analytics UI yet (data only).
- No scheduling, folders, or sharing.
- No omnibox/new-tab integrations.
- Focus controller intentionally kept minimal (no expanded/detailed mode).

## 11) Feature list history (1–5)
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
- Routine search, compact/expand link previews, quick focus action.
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

## 12) Improvements doc alignment (done vs pending)
Reference doc: `docs/extra/WEBROUTINES_IMPROVEMENTS_V2.md`

Substantially done already:
- Focus mini-controller MVP exists (compact pill + sidebar return + drag/persist).
- Settings foundation and options page exist.
- Theme system now has stable extension theming and adaptive mini-controller behavior.
- Runner Home and editor got practical UX upgrades (Feature 3).

Still pending from improvements doc:
- Rich routine cards (favicon strip, richer metadata).
- Tab lifecycle resilience listeners (`tabs.onUpdated` divergence handling).
- Routine history/stats UI.
- Folders/categories.
- Command palette.
- Omnibox/new-tab integrations.
- Sharing flows (markdown/link/QR).
- Per-step config (notes/skip/auto-advance).
- Onboarding flow.
- Error boundary/recovery framework.

## 13) Pragmatic next explorations (added for future planning)
Suggested to explore next (in this order):
1. Session resilience hardening:
   - Add minimal `tabs.onUpdated` divergence marker (without heavy UI first pass).
2. Routine history UI:
   - Recent runs list + completion stats.
3. Command palette in sidepanel:
   - Start routine, focus routine, stop routine, open settings.
4. Routine card enrichment:
   - Favicon strip + last run metadata.

Nice-to-have but lower priority for now:
- Folders/categories
- Sharing/QR workflows
- Omnibox/new-tab overrides
- Per-step auto-advance and notes
