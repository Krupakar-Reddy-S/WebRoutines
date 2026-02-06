# WebRoutines: Improvements & Feature Roadmap v2

## Document purpose

This is the updated improvements roadmap for WebRoutines, reflecting the current state after Feature Lists 1–4. Each item is categorized as **Definite** (will build), **Maybe** (needs more thought), or **Skip** (not worth it right now). Items already shipped are marked as done.

Reference: `PROJECT_CONTEXT.md` (post Feature List 4 state)

---

## Status legend

| Tag | Meaning |
|-----|---------|
| ✅ DONE | Shipped in Feature List 1–4 |
| 🟢 DEFINITE | Will build — clear value, feasible, no blockers |
| 🟡 MAYBE | Worth considering — needs design clarity or has trade-offs |
| 🔴 SKIP | Not worth it now — low ROI, over-engineered, or premature |

---

## 1. Tab Lifecycle & Session Resilience

This is the most important unsolved problem. When users close tabs, reorder them, or drag them out of groups, the mini-controller and session state get out of sync.

### 1.1 Chrome API reality check

**There is no Chrome API to prevent tab close, prevent tab reorder, or prevent tab ungroup.** These are user-initiated browser-level actions that extensions cannot intercept or block. Here's what the APIs actually offer:

| What you want | API exists? | What you can do instead |
|---|---|---|
| **Prevent tab close** | ❌ No API | `tabs.onRemoved` — react after the fact |
| **Prevent tab reorder** | ❌ No API | `tabs.onMoved` — detect + could call `tabs.move()` to revert, but causes visible flicker |
| **Prevent tab ungroup** | ❌ No API | Check `tab.groupId` on `tabs.onMoved` / `tabs.onUpdated` — detect when a tab leaves the group |
| **Prevent tab close with warning** | ⚠️ Partial | Content script can inject `beforeunload` handler, but requires prior user interaction with the page (Chrome security requirement). Unreliable. |

**Conclusion:** The correct approach is **reactive session healing**, not prevention. Detect changes → update session state → update UI.

### 1.2 🟢 DEFINITE: `tabs.onRemoved` session sync

When a user closes a tab that belongs to an active routine runner, the session must update:

```typescript
// background.ts
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  if (removeInfo.isWindowClosing) return; // whole window closing, skip
  
  const sessions = await getActiveSessions();
  for (const session of sessions) {
    if (session.tabIds.includes(tabId)) {
      // Remove tabId from session
      session.tabIds = session.tabIds.filter(id => id !== tabId);
      
      // If ALL tabs removed → auto-stop the runner
      if (session.tabIds.filter(Boolean).length === 0) {
        await stopSession(session.routineId);
        return;
      }
      
      // If the ACTIVE tab was closed → advance to next available
      if (session.tabId === tabId) {
        const nextTabId = session.tabIds.find(id => id != null);
        if (nextTabId) {
          session.tabId = nextTabId;
          session.currentIndex = session.tabIds.indexOf(nextTabId);
        }
      }
      
      await updateSession(session);
    }
  }
});
```

**Why definite:** Without this, closing any routine tab silently breaks the runner. The mini-controller shows stale step counts, and "next" navigation hits dead tab IDs. This is the #1 reliability issue.

### 1.3 🟢 DEFINITE: `tabs.onMoved` order tracking

When a user drags tabs within a tab group to reorder them, the session's `tabIds` array no longer matches the actual tab order. The mini-controller will show wrong step numbers.

**Approach: Accept the reorder, update session to match.** Don't fight the user — if they reordered tabs, they probably wanted to. Sync the session's `tabIds` array to match the new actual order.

```typescript
chrome.tabs.onMoved.addListener(async (tabId, moveInfo) => {
  const sessions = await getActiveSessions();
  for (const session of sessions) {
    if (!session.tabIds.includes(tabId)) continue;
    if (session.mode !== 'tab-group' || !session.tabGroupId) continue;
    
    // Query actual tab order from Chrome
    const groupTabs = await chrome.tabs.query({ groupId: session.tabGroupId });
    const orderedIds = groupTabs
      .sort((a, b) => a.index - b.index)
      .map(t => t.id!);
    
    // Update session to match reality
    session.tabIds = orderedIds;
    session.currentIndex = orderedIds.indexOf(session.tabId!);
    await updateSession(session);
  }
});
```

**Why definite:** This is cheap to implement and prevents the controller from showing wrong step positions. No user-visible side effects.

### 1.4 🟡 MAYBE: `tabs.onDetached` ungroup detection

When a user drags a tab out of a tab group:
1. `tabs.onDetached` fires (tab leaves the window context briefly)
2. `tabs.onAttached` fires (tab re-enters, possibly in a different group or ungrouped)

OR if they just drag within the same window to ungroup:
1. `tabs.onMoved` fires with updated position
2. The tab's `groupId` changes to `TAB_GROUP_ID_NONE`

We could detect this and mark the step as "detached" in the session.

**Trade-off:** This adds complexity for a rare user action. The simpler approach is: if the tab is no longer in our group, treat it like a removed tab. The user deliberately ungrouped it.

**Verdict:** Maybe. Implement only if the `onRemoved` + `onMoved` handlers don't cover it naturally.

### 1.5 🟡 MAYBE: `tabs.onUpdated` URL divergence detection

When a user navigates away from the expected URL in a routine tab (e.g., they click a link on the page and end up somewhere else), the tab no longer shows what the routine expected.

```typescript
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;
  
  const sessions = await getActiveSessions();
  for (const session of sessions) {
    const tabIndex = session.tabIds.indexOf(tabId);
    if (tabIndex === -1) continue;
    
    // Compare actual URL to expected routine URL
    const routine = await getRoutineById(session.routineId);
    const expectedUrl = routine?.links[tabIndex]?.url;
    if (expectedUrl && !urlMatches(changeInfo.url, expectedUrl)) {
      // Mark this step as "diverged" in session
      session.divergedSteps = session.divergedSteps || [];
      if (!session.divergedSteps.includes(tabIndex)) {
        session.divergedSteps.push(tabIndex);
      }
      await updateSession(session);
    }
  }
});
```

**Trade-off:** This is useful for power users but adds complexity. The visual indicator ("this tab navigated away from the routine URL") needs UI work. Also, URL matching is tricky — redirects, hash changes, query params.

**Verdict:** Maybe for v1. A lightweight version (just tracking the boolean) without heavy UI could land with the `onRemoved`/`onMoved` work.

### 1.6 🔴 SKIP: Auto-revert tab reorder via `tabs.move()`

Technically possible: when `onMoved` fires for a routine tab, immediately call `tabs.move()` to put it back where it was.

**Why skip:**
- Causes visible tab flicker (tab jumps back)
- Fights the user — if they deliberately reordered, this is hostile UX
- Can cause infinite loops if the move triggers another `onMoved` event
- No extension in the Chrome Web Store does this for good reason

### 1.7 🔴 SKIP: `beforeunload` injection to warn on tab close

Content script could inject a `beforeunload` handler on routine tabs to show "Are you sure you want to leave?" when the user closes the tab.

**Why skip:**
- Requires prior user interaction with the page (Chrome security requirement since ~2019). If the user hasn't clicked anything on the page, the dialog is silently suppressed.
- Annoying UX — users expect Ctrl+W to close tabs instantly.
- The `unload` event is being deprecated across Chrome (rollout ongoing through 2026).
- The reactive `onRemoved` approach is cleaner and doesn't nag users.

---

## 2. Sidepanel Architecture

### 2.1 🟢 DEFINITE: Component decomposition

Split `App.tsx` into focused components. This is the single biggest code quality improvement available.

**Current state:** `App.tsx` handles all view switching, state, and rendering in one file.

**Target structure:**
```
entrypoints/sidepanel/
  App.tsx                    # Shell + view switching + providers
  views/
    RunnerHomeView.tsx       # Active runners, focused runner controls
    RoutinesView.tsx         # Routine list + management
    EditorView.tsx           # Create/edit routine
    SettingsView.tsx         # Settings (already partially exists)
  components/
    ActiveRunnerCard.tsx
    RoutineCard.tsx
    StepProgressBar.tsx
    EmptyState.tsx
```

**Why definite:** Every future feature (history, command palette, etc.) is harder to add while `App.tsx` is monolithic. This is pure code organization with zero feature change.

### 2.2 🟡 MAYBE: HashRouter migration

Replace the current component-state view switching with `react-router-dom` `HashRouter`.

```
#/                    → Runner Home
#/routines            → Routine list
#/routines/new        → Editor (create)
#/routines/:id/edit   → Editor (edit)
#/settings            → Settings
```

**Benefits:** URL-based state survives sidepanel close/reopen within a browser session. Back/forward navigation. Deep linking.

**Trade-off:** Adds `react-router-dom` dependency (~15KB). The current state-based switching works fine. Router migration is a non-trivial refactor that touches every view.

**Verdict:** Maybe. Do the component decomposition first (2.1). If the state-based switching starts causing issues with more views, add routing. Don't add it preemptively.

### 2.3 🟡 MAYBE: State management upgrade (reducer pattern)

Replace scattered `useState` + storage reads with a `useReducer` or lightweight state machine.

```typescript
type RunnerAction =
  | { type: 'START_ROUTINE'; routine: Routine; mode: RunMode }
  | { type: 'STOP_ROUTINE'; routineId: number }
  | { type: 'NAVIGATE'; routineId: number; offset: number }
  | { type: 'FOCUS'; routineId: number }
  | { type: 'SESSION_CHANGED'; sessions: RoutineSession[] };
```

**Trade-off:** More structured but also more boilerplate for a relatively simple app. The current approach works.

**Verdict:** Maybe. Revisit after component decomposition reveals whether state management is actually a pain point.

### 2.4 🟢 DEFINITE: Error boundary / recovery

Wrap views in React error boundaries so a crash in one view doesn't blank out the entire sidepanel.

```tsx
<ErrorBoundary fallback={<RecoveryCard onReset={() => setView('runner')} />}>
  <CurrentView />
</ErrorBoundary>
```

**Why definite:** Tiny effort, prevents total UI blackouts. Especially important since the sidepanel can't be force-refreshed easily by users.

---

## 3. Routine Run History & Stats

### 3.1 🟢 DEFINITE: Basic run tracking schema

Add a `runs` table in Dexie to record every routine execution:

```typescript
interface RoutineRun {
  id?: number;
  routineId: number;
  startedAt: number;
  stoppedAt: number | null;
  stepsCompleted: number;      // how many steps the user visited
  totalSteps: number;          // total steps in the routine at time of run
  completedFull: boolean;      // reached the last step
  mode: 'same-tab' | 'tab-group';
  durationMs: number | null;   // stoppedAt - startedAt
}
```

```typescript
// Dexie migration
this.version(2).stores({
  routines: '++id,name,createdAt,updatedAt',
  runs: '++id,routineId,startedAt'
});
```

**Write on start:** Create a `RoutineRun` with `stoppedAt: null` when a runner starts.
**Write on stop:** Update with `stoppedAt`, `stepsCompleted`, `completedFull`, `durationMs`.

**Why definite:** This is the foundation for every stats feature. Without it, WebRoutines has no memory of past usage. The schema is tiny and the write operations (start + stop) are minimal.

### 3.2 🟢 DEFINITE: `lastRunAt` on routines

Add an optional `lastRunAt: number` field to the `Routine` interface. Update it every time a runner starts for that routine.

**Benefits:**
- Sort routines by "recently used" in the routines view
- Show "Last run 2h ago" on routine cards
- Zero-cost: one field update per run start

### 3.3 🟡 MAYBE: History view in sidepanel

A dedicated view showing:
- Recent runs (last 20) with routine name, timestamp, duration, completion status
- Per-routine stats: total runs, average completion rate, total time spent
- Streak tracking: consecutive days with at least one run

**Trade-off:** Useful for engaged users but adds a whole new view. The data foundation (3.1 + 3.2) should come first, then the UI can follow when the sidepanel decomposition (2.1) makes adding views easy.

**Verdict:** Maybe for now. Build the schema (definite), defer the UI.

### 3.4 🟡 MAYBE: Stats on routine cards

Show run count, completion rate, and last run time directly on routine cards in the routines view:

```
┌──────────────────────────────────────────────────┐
│  🌅 Morning News                              ▶  │
│  7 sites · 23 runs · 87% completion · 2h ago     │
└──────────────────────────────────────────────────┘
```

**Verdict:** Maybe. Depends on 3.1 landing first. The card redesign (see 5.1) would be a natural place to add this.

---

## 4. Settings & Configuration

### 4.1 ✅ DONE: Core settings model

Shipped in Feature List 4:
- `staticTheme`: system / light / dark
- `defaultRunMode`: same-tab / tab-group
- `confirmBeforeStop`: boolean
- `focusModeEnabled`: boolean
- Options page, sidepanel settings view, popup settings flow

### 4.2 🟡 MAYBE: Additional settings

Settings that were proposed but not yet shipped:

| Setting | Priority | Notes |
|---------|----------|-------|
| Tab group color picker | 🟡 Maybe | Chrome has 8 fixed colors. Nice touch but low impact. |
| Auto-close tabs on stop | 🟡 Maybe | Currently tab-group mode already manages this. Useful for same-tab mode edge cases. |
| Auto-enter focus mode on run start | 🟡 Maybe | Power user feature. Requires focus mode to be well-tested first. |
| Compact mode (reduced padding) | 🔴 Skip | Over-engineered for a sidebar. Tailwind handles density fine. |
| Keyboard shortcut display | 🟡 Maybe | Show current bindings + link to `chrome://extensions/shortcuts`. Low effort. |

### 4.3 🟡 MAYBE: Per-routine default run mode

Allow overriding the global `defaultRunMode` per routine. Some routines make sense in same-tab (sequential reading), others in tab-group (reference dashboards).

```typescript
interface Routine {
  // ... existing
  preferredMode?: 'same-tab' | 'tab-group'; // null = use global default
}
```

**Verdict:** Maybe. Useful but adds decision complexity for users. The global default + override-at-start-time covers most cases.

---

## 5. UI/UX Enhancements

### 5.1 🟡 MAYBE: Routine card redesign (favicon strip, richer metadata)

```
┌──────────────────────────────────────────────────┐
│  Morning News                              ▶  ⋮  │
│  7 sites · Last run 2h ago                       │
│                                                  │
│  [🌐][🌐][🌐][🌐][🌐] +2                       │
│                                                  │
│  [▶ Run]  [✎ Edit]                  🟢 Running  │
└──────────────────────────────────────────────────┘
```

**New elements:**
- Favicon strip (first ~5 URLs via `https://www.google.com/s2/favicons?domain=...&sz=32`)
- Last run timestamp (requires 3.2)
- Running indicator badge
- Quick-run button

**Trade-off:** Richer cards but requires favicon fetching (network requests, caching, fallbacks for sites without favicons). The current cards work fine functionally.

**Verdict:** Maybe. `lastRunAt` is low-hanging fruit. Favicon strip is polish — nice for v2 but not essential.

### 5.2 ✅ DONE: Runner Home improvements

Shipped in Feature Lists 3–4:
- Progress indicators per runner
- Elapsed runtime display
- Quick focus action
- Empty states with direct start/manage actions

### 5.3 ✅ DONE: Editor improvements

Shipped in Feature List 3:
- Single input accepts URLs, comma-separated, or one-per-line paste
- Parsed URL count display
- Duplicate detection and skip
- Inline confirmation before removing links

### 5.4 🟡 MAYBE: Import from open tabs

Button in the editor that reads all tabs in the current window and lets the user select which to add:

```typescript
const handleImportFromTabs = async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const urls = tabs
    .filter(t => t.url && !t.url.startsWith('chrome://'))
    .map(t => ({ url: t.url!, title: t.title }));
  // Show selection UI
};
```

**Verdict:** Maybe. Genuinely useful feature but needs a multi-select UI component. Good candidate for a future feature list.

### 5.5 🔴 SKIP: URL groups/sections within routines

Optional section headers within a routine ("News sites", "Social media", "Work dashboards") without affecting the flat URL list for navigation.

**Why skip:** Adds schema complexity (mixed list of URLs and section headers) for unclear benefit. Users who need grouping should use separate routines. Folders/categories (see 7.1) solve organization at the routine level instead.

---

## 6. Focus Mode & Mini-Controller

### 6.1 ✅ DONE: Focus mini-controller MVP

Shipped in Feature List 4:
- Previous/Next controls
- Return to sidebar action
- Vertical drag with persisted Y offset
- Shadow DOM style isolation
- Background message bridge

### 6.2 ✅ DONE: Adaptive accent theming

Shipped in Feature List 4:
- Mini-controller uses page-adaptive accent styling
- Sidebar/popup/options use static extension theme

### 6.3 🟡 MAYBE: Expanded controller state

The original improvements doc proposed an expanded state with step dots, current URL label, and minimize/expand/close buttons:

```
┌────────────────────────────────────────────────┐
│  Morning News Routine          3/7    —  ⬜  ✕ │
│  ◀ Previous  │  ● Current: TechCrunch  │ Next ▶│
│  ○ ○ ● ○ ○ ○ ○       step dots                 │
└────────────────────────────────────────────────┘
```

**Trade-off:** More information but takes up more screen space. The current compact pill is intentionally minimal. Step dots are useful for routines with many steps but add visual weight.

**Verdict:** Maybe. The compact pill works well. An expanded state could be triggered by a click/hover, but it needs careful design to not feel invasive. Revisit based on user feedback.

### 6.4 🟡 MAYBE: Controller integration with run history

When history tracking (3.1) is in place, the controller could show a small progress indicator that reflects "you usually spend X minutes on this step" or "you're 70% through this routine".

**Verdict:** Maybe, but only after history is live and has data.

---

## 7. New Feature Proposals

### 7.1 🟡 MAYBE: Routine folders/categories

For users with many routines:

```typescript
interface RoutineFolder {
  id?: number;
  name: string;
  color?: string;
  sortOrder: number;
}

interface Routine {
  // ... existing
  folderId?: number;  // null = uncategorized
}
```

**Trade-off:** Useful at scale (10+ routines) but most users probably have 3–5 routines. Adds a new Dexie table and collapsible sections UI.

**Verdict:** Maybe. Premature until user base grows. A simpler approach: just add search/filter in the routines view (already done in Feature List 3).

### 7.2 🟡 MAYBE: Command palette (Cmd+K)

Keyboard-driven command palette in the sidepanel using shadcn's `Command` component:

- Search routines by name
- Quick-start any routine
- Focus a running routine
- Stop all runners
- Jump to settings
- Toggle theme

**Trade-off:** Power user feature. Adds `cmdk` dependency. Great for keyboard-heavy users but the sidepanel is small and most actions are 1–2 clicks away already.

**Verdict:** Maybe. Would be genuinely nice but not urgent. Good candidate once the sidepanel decomposition (2.1) is done.

### 7.3 🟡 MAYBE: Omnibox integration

Type `wr ` in the address bar to search and start routines:

```typescript
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  const matches = routines.filter(r =>
    r.name.toLowerCase().includes(text.toLowerCase())
  );
  suggest(matches.map(r => ({
    content: r.name,
    description: `Run: ${r.name} (${r.links.length} sites)`
  })));
});
```

**Trade-off:** Adds the `omnibox` permission. Nice discovery mechanism but requires users to know the `wr` keyword exists.

**Verdict:** Maybe. Low implementation effort but unclear discoverability. Depends on onboarding (see 7.7).

### 7.4 🔴 SKIP: Routine scheduling / time-of-day suggestions

Time tags ("Morning", "Afternoon"), smart ordering, reminder badges via `chrome.alarms`.

**Why skip:** Over-engineered for the current product scope. Users can just... open the extension when they want to run a routine. The badge/alarm system adds complexity with minimal value. If scheduling becomes important, it's a v2 feature.

### 7.5 🔴 SKIP: Routine sharing (link/markdown/QR)

Copy as shareable link, markdown list, or QR code.

**Why skip:** No clear user need yet. The import/export JSON flow covers backup. Sharing implies a receiving mechanism (import from link/QR) which adds significant complexity. Revisit if WebRoutines gets a web presence or community.

### 7.6 🟡 MAYBE: Per-step configuration

Optional per-link settings:

```typescript
interface RoutineLink {
  // ... existing
  waitSeconds?: number;      // Auto-advance after N seconds
  notes?: string;            // Personal notes shown in runner
  skipInRun?: boolean;       // Temporarily skip without deleting
}
```

**Most useful:** `skipInRun` (toggle a link off without deleting it) and `notes` (reminders like "Check the Q3 tab").

**Least useful:** `waitSeconds` (auto-advance timer). Adds timer UI complexity to both the runner and the mini-controller. Most users will want to control their own pace.

**Verdict:** Maybe. `skipInRun` is the highest-value piece and could ship standalone.

### 7.7 🟡 MAYBE: Onboarding flow

First-time experience:
1. Welcome card explaining the concept
2. "Create your first routine" guided flow
3. Quick tutorial on running and controlling
4. Prompt to set keyboard shortcuts

**Verdict:** Maybe. Important for Chrome Web Store distribution but not for development velocity right now. Should be planned when approaching public launch.

### 7.8 🔴 SKIP: New tab override page

Replace the new tab page with a dashboard showing suggested routines.

**Why skip:** Tab override extensions are controversial — users dislike when extensions replace their new tab. Adds the `chrome_url_overrides` permission which is invasive. The omnibox or command palette serve a similar purpose with less friction.

### 7.9 🔴 SKIP: Cross-browser support (Firefox)

Firefox's `sidebarAction` API is completely incompatible with Chrome's `sidePanel`. Would require conditional code paths, separate manifest entries, and potentially different UI paradigms.

**Why skip:** Chrome is the primary target. Firefox market share for extensions doesn't justify the engineering cost right now. Revisit if/when the product has traction.

### 7.10 🔴 SKIP: Cloud sync / Dexie Cloud

Backend sync for routines across devices.

**Why skip:** Requires a backend, authentication, conflict resolution, and ongoing infrastructure costs. Way too early. The JSON export/import flow covers cross-device transfer for now.

---

## 8. Product-Level Feature Ideas (New)

These are higher-level product features that go beyond the original improvements doc.

### 8.1 🟢 DEFINITE: Routine run insights dashboard

Combine history tracking (3.1) with a simple analytics view that gives users visibility into their browsing habits:

**Metrics to surface:**
- **Total routines run** (all time + this week)
- **Total time spent** in routines (derived from run durations)
- **Completion rate** per routine (% of runs where all steps were visited)
- **Most-used routines** (ranked by run count)
- **Average routine duration** vs. number of steps
- **Usage heatmap** — which days of the week / times of day routines are most used

**Implementation:** All derived from the `runs` table. No new data collection needed beyond 3.1.

**UI:** A "Stats" tab or section in the sidepanel, showing key metrics as simple cards + one small chart (usage over time via recharts or a simple bar chart). Keep it lightweight — this isn't a full analytics dashboard.

**Why definite:** This is the feature that makes users feel like WebRoutines is more than a simple URL launcher. Seeing "You've run your Morning News routine 47 times this month, averaging 8 minutes" creates stickiness and a sense of progress. Very low incremental effort on top of the history schema.

### 8.2 🟡 MAYBE: Routine templates / presets

Ship a small library of starter routines that new users can install:

- **Morning News**: 5–7 popular news sites
- **Social Media Check**: Twitter, Reddit, LinkedIn, YouTube, etc.
- **Developer Morning**: GitHub, HN, Dev.to, Stack Overflow
- **Financial Markets**: Bloomberg, Reuters, Yahoo Finance, etc.

**Implementation:** JSON presets bundled with the extension. "Browse templates" button in the routines view → select → installs as a new routine the user can customize.

**Why maybe:** Good for onboarding and discoverability but adds maintenance burden (links go stale). Could be a simple JSON file that's easy to update.

### 8.3 🟡 MAYBE: Routine "quick resume"

When a user closes the browser with active runners, offer to resume where they left off on next browser start:

- On runner start, write a `pendingResume` entry to `chrome.storage.local` (survives browser restart, unlike `chrome.storage.session`)
- On extension install/startup event, check for `pendingResume`
- Show a toast/banner: "You had Morning News running (step 4/7). Resume?"

**Trade-off:** Requires careful state management to not show stale resume prompts. The runner's tab state is lost on browser close, so "resume" means starting fresh from the last step index, not recovering the exact tabs.

### 8.4 🟡 MAYBE: Bulk routine management

When users accumulate many routines:
- Multi-select routines for bulk delete / bulk export
- Drag-to-reorder routines in the list (persist sort order)
- "Archive" a routine (hide from main list without deleting)

**Verdict:** Maybe. Useful at scale but premature for early product.

### 8.5 🟡 MAYBE: Routine duplication

One-click duplicate a routine. Useful when users want a variation of an existing routine (e.g., "Morning News" → "Weekend Morning News" with fewer sites).

**Implementation:** Trivially simple — read routine, strip ID, add " (Copy)" to name, write new routine.

**Verdict:** Maybe leaning toward definite. Extremely low effort, genuine utility.

### 8.6 🟢 DEFINITE: Session elapsed time in popup

The popup shows active runners but doesn't show how long they've been running. Adding elapsed time (derived from `session.startedAt`) gives users quick context without opening the sidepanel.

**Why definite:** Tiny effort, immediately useful for the popup surface.

---

## 9. Technical Improvements

### 9.1 ✅ DONE: Settings model + hook

`lib/settings.ts`, `lib/use-settings.ts`, `chrome.storage.local` backing. Shipped in Feature List 4.

### 9.2 ✅ DONE: Focus controller content script

`entrypoints/focus-controller.content.ts` with shadow DOM, drag persistence, background bridge. Shipped in Feature List 4.

### 9.3 ✅ DONE: Adaptive accent extraction

`lib/adaptive-accent.ts` for controller styling. Shipped in Feature List 4.

### 9.4 🟢 DEFINITE: Accessibility pass

- Add `aria-label` to all icon-only buttons across sidepanel, popup, and controller
- Add `role="status"` to live-updating elements (step counter, elapsed time)
- Ensure keyboard navigation works through runner controls
- Test with screen readers

**Why definite:** Low effort, significant impact for users with accessibility needs. Should be done as part of any major UI work.

### 9.5 🟡 MAYBE: Automated test suite

No tests exist currently. Options:

- **Unit tests**: Vitest for utility functions (`lib/routines.ts`, `lib/navigation.ts`, `lib/settings.ts`)
- **Component tests**: React Testing Library for key components
- **E2E tests**: Playwright with Chrome extension support for full flows

**Trade-off:** Tests are always good but also always deferred in early-stage projects. The compile + build checks catch type errors.

**Verdict:** Maybe. Start with unit tests for the core libs when doing a refactoring pass. E2E can wait.

---

## 10. Implementation Priority (Updated)

### Tier 1: Ship next (reliability + foundation)

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1.2 | `tabs.onRemoved` session sync | Small | Critical — fixes broken sessions |
| 1.3 | `tabs.onMoved` order tracking | Small | High — fixes controller step mismatch |
| 2.1 | Sidepanel component decomposition | Medium | High — enables all future UI work |
| 2.4 | Error boundary / recovery | Small | Medium — prevents blank sidepanel |
| 3.1 | Run history schema + write-on-start/stop | Small | High — foundation for stats |
| 3.2 | `lastRunAt` on routines | Tiny | Medium — enables "recently used" sort |
| 8.6 | Session elapsed time in popup | Tiny | Medium — popup usability |

### Tier 2: Build when ready (product depth)

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 8.1 | Routine run insights/stats view | Medium | High — stickiness + engagement |
| 7.2 | Command palette (Cmd+K) | Medium | Medium — power user delight |
| 5.1 | Routine card redesign (favicons, stats) | Medium | Medium — visual polish |
| 7.6 | Per-step skip toggle | Small | Medium — practical flexibility |
| 8.5 | Routine duplication | Tiny | Medium — convenience |
| 9.4 | Accessibility pass | Small | Medium — correctness |

### Tier 3: Consider later (nice-to-have)

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 2.2 | HashRouter migration | Medium | Low-medium |
| 5.4 | Import from open tabs | Small-medium | Medium |
| 7.1 | Routine folders | Medium | Low until 10+ routines |
| 7.3 | Omnibox integration | Small | Low-medium |
| 7.7 | Onboarding flow | Medium | High at launch time |
| 8.2 | Routine templates | Small | Medium at launch time |
| 8.3 | Quick resume after restart | Medium | Medium |
| 8.4 | Bulk routine management | Medium | Low until many routines |

### Not building

| # | Item | Reason |
|---|------|--------|
| 1.6 | Auto-revert tab reorder | Hostile UX, causes flicker |
| 1.7 | `beforeunload` injection | Unreliable, nagging, being deprecated |
| 5.5 | URL sections in routines | Use separate routines instead |
| 7.4 | Scheduling / time suggestions | Over-engineered |
| 7.5 | Sharing (link/markdown/QR) | No clear need yet |
| 7.8 | New tab override | Invasive, controversial |
| 7.9 | Firefox support | Wrong time |
| 7.10 | Cloud sync | Way too early |

---

## 11. Migration Safety

All proposals remain additive. Dexie migration path:

```typescript
// Current (Feature List 1-4)
this.version(1).stores({
  routines: '++id,name,createdAt,updatedAt'
});

// After Tier 1 work
this.version(2).stores({
  routines: '++id,name,createdAt,updatedAt',  // + optional lastRunAt field
  runs: '++id,routineId,startedAt'             // new table
});

// After Tier 2 (if folders ship)
this.version(3).stores({
  routines: '++id,name,folderId,createdAt,updatedAt',
  runs: '++id,routineId,startedAt',
  folders: '++id,name,sortOrder'
});
```

Settings continue to use `chrome.storage.local`, completely independent of Dexie.

Session state in `chrome.storage.session` gains optional fields:
- `divergedSteps?: number[]` (if 1.5 ships)
- No other session schema changes needed for Tier 1.

---

*Updated: February 2026, post Feature List 4*
