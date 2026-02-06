# WebRoutines Project Context (Post Feature List 3 + 4)

## Why this document exists
This is a current technical brief for WebRoutines after Feature List 3 and Feature List 4 implementation, so product/planning discussions can happen without re-reading the full repo each time.

## 1) Current delivery state
Last major implementation commit:
- `87a51f7` (`2026-02-06`) - finalizes Feature List 4 settings + focus controller changes

Recent milestone commits:
- `b534b02` - Feature 3 chores (per-routine export + streamlined link input UX)
- `dc91639` - Feature 3 docs/validation completion
- `bcbfe18` - Feature 4 planning docs and adaptive theming notes

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

## 5) Tech stack and runtime
- WXT + React + TypeScript
- Tailwind v4 + shadcn/ui
- Dexie/IndexedDB for routines data
- `browser.storage.session` for runner/focus ephemeral state
- `browser.storage.local` for app settings and controller accent cache

Commands:
- `bun install`
- `bun run dev`
- `bun run compile`
- `bun run build`

## 6) Extension architecture (current)
Entrypoints:
- `entrypoints/background.ts`
  - Sidepanel behavior setup
  - Tab-group cleanup listener
  - Focus controller runtime message bridge
- `entrypoints/sidepanel/App.tsx`
  - Main app UI and internal view switching
- `entrypoints/popup/App.tsx`
  - Quick controls + open sidepanel/settings
- `entrypoints/options/App.tsx`
  - Dedicated options UI wired to shared settings
- `entrypoints/focus-controller.content.ts`
  - Focus mini-controller UI injected on `<all_urls>`

Core libs:
- `lib/routines.ts` - routine CRUD, URL normalization, import/export parsing
- `lib/navigation.ts` - start/stop/navigate + sidepanel open helpers
- `lib/session.ts` - active sessions, focused runner, focus mode, sidepanel view requests
- `lib/settings.ts` - settings schema/defaults/read-write-subscribe
- `lib/use-settings.ts` - React hook for synced settings state
- `lib/adaptive-accent.ts` - adaptive accent extraction/cache utilities used by controller

## 7) Data model summary
### IndexedDB (`routines`)
```ts
interface Routine {
  id?: number;
  name: string;
  links: Array<{ id: string; url: string; title?: string }>;
  createdAt: number;
  updatedAt: number;
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

## 8) Permissions and APIs
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

## 9) Known limitations
- Sidepanel is still a single large `App.tsx` (no router decomposition yet).
- No automated unit/integration test suite yet.
- No routine history analytics, scheduling, folders, or sharing.
- No omnibox/new-tab integrations.
- Focus controller intentionally kept minimal (no expanded/detailed mode).

## 10) Improvements doc alignment (done vs pending)
Reference doc: `docs/extra/WEBROUTINES_IMPROVEMENTS.md`

Substantially done already:
- Focus mini-controller MVP exists (compact pill + sidebar return + drag/persist).
- Settings foundation and options page exist.
- Theme system now has stable extension theming and adaptive mini-controller behavior.
- Runner Home and editor got practical UX upgrades (Feature 3).

Still pending from improvements doc:
- Sidepanel router migration (`HashRouter`) and page/component decomposition.
- Rich routine cards (favicon strip, richer metadata).
- Tab lifecycle resilience listeners (`tabs.onRemoved`, `tabs.onUpdated` divergence handling).
- Routine history/stats schema and UI.
- Folders/categories.
- Command palette.
- Omnibox/new-tab integrations.
- Sharing flows (markdown/link/QR).
- Per-step config (notes/skip/auto-advance).
- Onboarding flow.
- Error boundary/recovery framework.

## 11) Pragmatic next explorations (added for future planning)
Suggested to explore next (in this order):
1. Sidepanel decomposition + lightweight routing:
   - Split `entrypoints/sidepanel/App.tsx` into view components first.
   - Add route-style state only after component split to reduce migration risk.
2. Session resilience hardening:
   - Implement `tabs.onRemoved` sync into sessions.
   - Add minimal `tabs.onUpdated` divergence marker (without heavy UI first pass).
3. Routine metadata upgrades with low schema risk:
   - Add optional `lastRunAt`.
   - Show better "recently used" ordering in routines view.
4. Command palette in sidepanel:
   - Start routine, focus routine, stop routine, open settings.
5. History MVP:
   - Add `runs` table with start/stop timestamps and completion status.
   - Keep UI simple (recent runs + completion rate).

Nice-to-have but lower priority for now:
- Folders/categories
- Sharing/QR workflows
- Omnibox/new-tab overrides
- Per-step auto-advance and notes

