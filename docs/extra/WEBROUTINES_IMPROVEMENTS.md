# WebRoutines: UI/UX Improvements & Feature Roadmap

## Document purpose

This document proposes UI/UX improvements, new features, and architectural enhancements for WebRoutines. All proposals are designed to be compatible with the current stack (WXT + React + Dexie + session-based multi-runner tab-group model) and are organized by implementation effort.

---

## 1. Focus Mode: Floating Mini-Controller

### The idea

When a user starts a runner and wants to browse through their routine without the sidebar eating screen space, they can enter **Focus Mode**. The sidebar closes (via `window.close()` from the sidepanel or the newer `chrome.sidePanel.close()` API available in Chrome 141+), and a small floating control pill is injected into every page the user visits via a content script.

### How it works technically

The floating controller is a **content script UI** injected into the active tab using WXT's `createShadowRootUi`. Shadow DOM isolates styles completely — the host page's CSS cannot break the controller, and the controller's styles cannot leak into the page. The content script communicates with the service worker via `chrome.runtime.sendMessage` to trigger navigation actions, and listens for session state changes via `chrome.storage.onChanged`.

```
User clicks "Focus Mode" in sidebar
  → Sidebar writes { focusMode: true } to chrome.storage.session
  → Sidebar calls window.close() (or chrome.sidePanel.close)
  → Background detects focusMode change
  → Content script (already injected on all URLs) sees focusMode = true
  → Content script mounts the floating pill via createShadowRootUi
  → User interacts with pill → messages go to background → navigation happens
  → User clicks "Expand" on pill → background opens sidePanel → focusMode = false
  → Content script unmounts the pill
```

### Visual design: the floating pill

The controller should feel like a **media mini-player** — compact, unobtrusive, and always accessible. Think Spotify's floating player or YouTube's PiP controls.

**Default state (collapsed pill):**
```
┌─────────────────────────────────────────┐
│  ◀  │  Step 3 of 7 · Morning News  │ ▶  │  ⬜  │
└─────────────────────────────────────────┘
         ~320px wide, ~40px tall
```

- `◀` / `▶` — Previous / Next step
- Center label — current step number, routine name (truncated)
- `⬜` — Expand button (re-opens sidebar, exits focus mode)

**Expanded state (on hover or tap of center area):**
```
┌────────────────────────────────────────────────┐
│  Morning News Routine          3/7    ─  ⬜  ✕ │
│ ─────────────────────────────────────────────── │
│  ◀ Previous  │  ● Current: TechCrunch  │  Next ▶│
│ ─────────────────────────────────────────────── │
│  ○ ○ ● ○ ○ ○ ○       step dots                 │
└────────────────────────────────────────────────┘
          ~360px wide, ~120px tall
```

- Step dots for quick jump-to-step
- Current URL label (shows page title or domain)
- Minimize (`─`) shrinks back to pill
- Expand (`⬜`) opens sidebar
- Close (`✕`) stops the runner entirely (with confirmation)

### Position and dragging behavior

- **Default position**: Bottom-right corner, 16px from edges
- **Constrained to right edge only**: The pill can be dragged vertically along the right edge of the viewport but cannot move to the left side or center. This keeps it predictable and out of the way of page content.
- **Implementation**: Use `mousedown`/`mousemove`/`mouseup` (no library needed for single-axis drag). Store the Y offset in `chrome.storage.session` so it persists across page navigations within the same session.
- **Z-index**: `2147483647` (max) to stay above all page content
- **Responsive**: On narrow viewports (<600px), the pill auto-collapses to just the nav arrows and a dot indicator

### Content script entrypoint (WXT)

```
entrypoints/
  focus-controller.content/
    index.tsx          # defineContentScript + createShadowRootUi
    FocusPill.tsx      # React component for the pill
    styles.css         # Scoped styles (injected into shadow DOM)
```

Key WXT configuration:
```typescript
export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',   // styles go into shadow DOM only
  runAt: 'document_idle',
  async main(ctx) {
    // Only mount if focus mode is active
    const { focusMode } = await chrome.storage.session.get('focusMode');
    if (!focusMode) {
      // Listen for focus mode activation
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'session' && changes.focusMode?.newValue) {
          mountPill(ctx);
        }
      });
      return;
    }
    mountPill(ctx);
  }
});
```

### Considerations and gotchas

- **Permission impact**: Content scripts on `<all_urls>` triggers the "Read and change all your data on all websites" permission warning. This is a significant UX cost. Consider making Focus Mode an opt-in feature that requests `host_permissions` via `chrome.permissions.request()` at runtime only when the user first activates it.
- **Shadow DOM + Tailwind**: Tailwind CSS works inside shadow DOM when using WXT's `cssInjectionMode: 'ui'`. The styles are automatically scoped to the shadow root.
- **Portal/popover issue**: Any tooltips or dropdowns inside the pill must render within the shadow DOM boundary, not in `document.body`. Use the `PortalTargetContext` pattern from WXT's FAQ.
- **Page performance**: The content script should be lightweight. Lazy-mount the React component only when focus mode is active. When inactive, the content script is just a tiny event listener (~1KB).

---

## 2. Settings & Options Page

### What belongs in settings vs. the sidepanel

**Rule of thumb**: If a setting changes how the extension *behaves* across all routines, it goes in Settings. If it's about managing a specific routine or runner, it stays in the sidepanel.

### Settings page content

Create a dedicated options page (`entrypoints/options/`) accessible from:
- A gear icon in the sidepanel header
- The extension's "Options" link in `chrome://extensions`
- The popup's overflow menu

**Proposed settings categories:**

#### General
| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| Default run mode | Toggle: `Single tab` / `Tab group` | `Tab group` | Pre-selects mode when starting a routine |
| Auto-close tabs on stop | Toggle | `On` | Whether stopping a runner closes its tabs |
| Confirm before stopping | Toggle | `On` | Show confirmation dialog before stop |
| Tab group color | Color picker (Chrome's 8 colors) | `blue` | Default color for new tab groups |

#### Focus Mode
| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| Enable Focus Mode | Toggle | `Off` | Requests `<all_urls>` permission on first enable |
| Pill position | Dropdown: `Bottom right` / `Top right` | `Bottom right` | Default anchor corner |
| Auto-enter focus mode | Toggle | `Off` | Automatically enter focus mode when starting a runner |
| Show step dots | Toggle | `On` | Show/hide the dot indicators in expanded pill |

#### Keyboard Shortcuts
| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| Previous step | Key combo display | `Alt+Shift+Left` | Links to `chrome://extensions/shortcuts` |
| Next step | Key combo display | `Alt+Shift+Right` | Links to `chrome://extensions/shortcuts` |

Note: Chrome extension keyboard shortcuts can only be changed at `chrome://extensions/shortcuts`. The settings page should display current bindings and link there.

#### Data & Backup
| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| Export all routines | Button | — | Triggers JSON download |
| Import routines | Button | — | Opens file picker |
| Clear all data | Button (danger) | — | Deletes all routines and sessions with confirmation |
| Storage usage | Display | — | Shows IndexedDB usage stats |

#### Appearance
| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| Theme | Toggle: `Light` / `Dark` / `System` | `System` | Currently only light/dark; add system detection |
| Compact mode | Toggle | `Off` | Reduces padding/spacing in sidepanel for smaller screens |

### Implementation

- **Storage**: Use `chrome.storage.local` for settings (not IndexedDB). Settings are small key-value pairs and `chrome.storage.local` is synchronous-feeling and doesn't need Dexie.
- **Options page in WXT**: Add `entrypoints/options/index.html` and `entrypoints/options/main.tsx`. WXT auto-generates the manifest entry.
- **Manifest**: Add `options_ui: { page: 'options.html', open_in_tab: true }` via `wxt.config.ts`.
- **Settings hook**: Create a `useSettings()` hook that reads from `chrome.storage.local` and subscribes to changes, so both the sidepanel and options page stay in sync.

```typescript
// lib/settings.ts
export interface Settings {
  defaultRunMode: 'same-tab' | 'tab-group';
  autoCloseTabs: boolean;
  confirmBeforeStop: boolean;
  tabGroupColor: chrome.tabGroups.ColorEnum;
  focusModeEnabled: boolean;
  pillPosition: 'bottom-right' | 'top-right';
  autoFocusMode: boolean;
  showStepDots: boolean;
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultRunMode: 'tab-group',
  autoCloseTabs: true,
  confirmBeforeStop: true,
  tabGroupColor: 'blue',
  focusModeEnabled: false,
  pillPosition: 'bottom-right',
  autoFocusMode: false,
  showStepDots: true,
  theme: 'system',
  compactMode: false,
};
```

---

## 3. Sidepanel UI/UX Improvements

### 3.1 Proper view routing

**Current**: Component-state-based view switching (`runner` / `routines` / `editor`) inside a single `App.tsx`.

**Proposed**: Use `react-router-dom` with `HashRouter` (required for extension pages). This enables browser-style back/forward, deep linking, and cleaner code splitting.

```
#/                    → Runner Home (default)
#/routines            → Routine list & management
#/routines/new        → Editor (create)
#/routines/:id/edit   → Editor (edit)
#/settings            → Settings (inline or opens options page)
```

Benefits:
- Each view becomes its own component file (splitting the monolithic `App.tsx`)
- URL-based state survives sidepanel close/reopen within the same browser session
- Enables animated transitions between views using `framer-motion` or CSS transitions

### 3.2 Routine cards redesign

**Current**: Flat list showing routine name and links.

**Proposed**: Richer cards with at-a-glance information:

```
┌─────────────────────────────────────────────────┐
│  🌅 Morning News                    ▶ ≡  ⋮    │
│  7 sites · Last run 2h ago · ~12 min            │
│                                                  │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ +2                   │
│  │TH│ │TC│ │HN│ │RE│ │YT│                       │
│  └──┘ └──┘ └──┘ └──┘ └──┘                       │
│                                                  │
│  [▶ Run]  [✎ Edit]                  🟢 Running  │
└─────────────────────────────────────────────────┘
```

New elements:
- **Favicon strip**: Show favicons of the first ~5 URLs as small icons. Fetch via `https://www.google.com/s2/favicons?domain=example.com&sz=32`.
- **Last run timestamp**: Store `lastRunAt` in the Routine record.
- **Estimated duration**: Optional user-set estimate or auto-calculated from history.
- **Running indicator**: Green dot/badge when routine has an active session.
- **Quick-run button**: Single-click to run with default mode.
- **Context menu** (`⋮`): Edit, Duplicate, Delete, Export single routine.

### 3.3 Runner Home improvements

**Current**: Basic list of active runners with Focus/Stop actions.

**Proposed additions**:

- **Progress bar per runner**: Visual indicator of how far through the routine they are (step 3/7 = ~43%).
- **Elapsed time**: Show how long the runner has been active.
- **Quick-switch tabs**: Clicking a runner name activates its tab group in Chrome.
- **Drag to reorder**: If multiple runners are active, allow reordering the list (priority order for keyboard shortcuts).
- **Empty state**: When no runners are active, show a friendly illustration and "Start a routine" CTA that links to the routines view.

### 3.4 Editor improvements

- **URL validation preview**: When adding a URL, show a small preview card with favicon and page title (fetched via a lightweight HEAD request or Google's favicon API).
- **Bulk add**: Accept multiple URLs at once (paste a list, one per line).
- **Duplicate detection**: Warn when adding a URL that's already in the routine.
- **URL groups/sections**: Allow optional section headers within a routine (e.g., "News sites", "Social media", "Work dashboards") without affecting the flat URL list used for navigation.
- **Import from open tabs**: Button that reads all tabs in the current window and lets the user select which to add.

### 3.5 Onboarding flow

For first-time users (detect via `chrome.storage.local` flag):

1. Welcome card explaining the concept
2. "Create your first routine" guided flow
3. Quick tutorial on running and controlling routines
4. Prompt to set keyboard shortcuts

---

## 4. New Feature Ideas

### 4.1 Routine scheduling / time-of-day suggestions

Not full automation (Chrome extensions can't reliably schedule future actions), but:

- **Time tags**: Tag routines as "Morning", "Afternoon", "Evening", "Weekly".
- **Smart ordering**: The Runner Home shows routines suggested for the current time of day.
- **Reminder badge**: Extension icon shows a badge number at routine's tagged time.

```typescript
interface Routine {
  // ... existing fields
  schedule?: {
    tags: ('morning' | 'afternoon' | 'evening' | 'weekly')[];
    preferredTime?: string;  // "09:00" — for display only
    days?: number[];         // 0-6 for weekly routines
  };
}
```

Use `chrome.alarms` to set a daily check that updates the badge:
```typescript
chrome.alarms.create('routineSuggestion', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'routineSuggestion') {
    // Check if any routines match current time window
    // Update badge count
  }
});
```

### 4.2 Routine history and stats

Track basic usage data locally:

```typescript
interface RoutineRun {
  id?: number;
  routineId: number;
  startedAt: number;
  stoppedAt: number | null;
  stepsVisited: number[];     // indices visited
  completedFull: boolean;     // reached last step
  mode: 'same-tab' | 'tab-group';
}
```

Add a `runs` table in Dexie. Display in the routine detail view:
- Total runs count
- Average completion rate
- Most recent runs with timestamps
- Streak tracking (consecutive days with a run)

### 4.3 Quick-start from new tab or omnibox

- **New tab override** (optional, via settings): Replace the new tab page with a dashboard showing today's suggested routines and one-click start buttons.
- **Omnibox integration**: Type `wr ` in the address bar to search and start routines. Uses the `chrome.omnibox` API.

```typescript
// background.ts
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  const matches = routines.filter(r =>
    r.name.toLowerCase().includes(text.toLowerCase())
  );
  suggest(matches.map(r => ({
    content: r.name,
    description: `Run: ${r.name} (${r.links.length} sites)`
  })));
});

chrome.omnibox.onInputEntered.addListener(async (text) => {
  const routine = routines.find(r => r.name === text);
  if (routine) await startRoutine(routine, settings.defaultRunMode);
});
```

### 4.4 Routine sharing

Allow users to share routines via:
- **Copy as shareable link**: Generate a `data:` URL or custom URL scheme that encodes the routine as base64 JSON.
- **Copy as markdown**: Generate a formatted markdown list for sharing in docs/chats.
- **QR code**: Generate a QR code containing the routine JSON for phone-to-desktop transfer.

### 4.5 Per-step configuration

Allow optional per-link settings:

```typescript
interface RoutineLink {
  id: string;
  url: string;
  title?: string;
  // New optional fields:
  waitSeconds?: number;      // Auto-advance after N seconds
  openIn?: 'same' | 'new';  // Override run mode for this link
  notes?: string;            // Personal notes shown in runner
  skipInRun?: boolean;       // Temporarily skip without deleting
}
```

- **Auto-advance timer**: "Spend 30 seconds on this page, then auto-navigate to next." Shows a countdown in the runner controls and the focus pill.
- **Per-link notes**: Displayed in the runner as a small reminder (e.g., "Check the Q3 dashboard tab").
- **Skip toggle**: Grey out a link without removing it. Useful for temporarily excluding sites.

### 4.6 Tab awareness and session resilience

Improve session accuracy by tracking tab lifecycle events:

```typescript
// background.ts — add these listeners

// When a runner-owned tab is closed by the user
chrome.tabs.onRemoved.addListener((tabId) => {
  // Remove tabId from matching session's tabIds array
  // If all tabs removed, auto-stop the runner
});

// When a runner-owned tab navigates away from expected URL
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    // Check if tab still matches expected routine URL
    // If user navigated away, mark step as "diverged"
    // Show visual indicator in runner controls
  }
});

// When tab group is collapsed/expanded by user
chrome.tabGroups.onUpdated.addListener((group) => {
  // Sync collapsed state to session for UI display
});
```

This addresses the known limitation of sparse `tabIds` and makes sessions self-healing.

### 4.7 Routine folders/categories

For users with many routines:

```typescript
interface RoutineFolder {
  id?: number;
  name: string;
  color?: string;
  sortOrder: number;
}

interface Routine {
  // ... existing fields
  folderId?: number;  // null = uncategorized
}
```

Display as collapsible sections in the routines list. Keep it simple — no nesting beyond one level.

### 4.8 Command palette

Add a keyboard-driven command palette (Cmd+K / Ctrl+K) in the sidepanel:

- Search routines by name
- Quick-start any routine
- Jump to settings
- Stop all runners
- Toggle theme

Use shadcn's `Command` component (built on cmdk).

---

## 5. Technical Improvements

### 5.1 Component decomposition

Split `App.tsx` into:

```
entrypoints/sidepanel/
  App.tsx                    # Router shell + providers
  layouts/
    SidepanelLayout.tsx      # Header + theme toggle + back navigation
  pages/
    RunnerHomePage.tsx        # Active runners + focused runner controls
    RoutinesPage.tsx          # Routine list + management actions
    EditorPage.tsx            # Create/edit routine form
  components/
    ActiveRunnerCard.tsx      # Single runner in the active list
    FocusedRunnerControls.tsx # Navigation controls for focused runner
    RoutineCard.tsx           # Single routine in the list
    StepProgressBar.tsx       # Visual step indicator
    EmptyState.tsx            # Friendly empty states
```

### 5.2 State management upgrade

Replace scattered `useState` + `chrome.storage` reads with a lightweight state machine or reducer pattern:

```typescript
type RunnerAction =
  | { type: 'START_ROUTINE'; routine: Routine; mode: RunMode }
  | { type: 'STOP_ROUTINE'; routineId: number }
  | { type: 'NAVIGATE'; routineId: number; offset: number }
  | { type: 'FOCUS'; routineId: number }
  | { type: 'SESSION_CHANGED'; sessions: RoutineSession[] }
  | { type: 'ENTER_FOCUS_MODE' }
  | { type: 'EXIT_FOCUS_MODE' };
```

This makes state transitions explicit, testable, and easier to debug.

### 5.3 Error boundary and recovery

Add React error boundaries around each page/view. If a view crashes, show a recovery UI instead of a blank sidepanel:

```typescript
<ErrorBoundary fallback={<RecoveryCard onReset={() => navigate('/')} />}>
  <RunnerHomePage />
</ErrorBoundary>
```

### 5.4 Accessibility

- Add `aria-label` attributes to all icon-only buttons
- Ensure keyboard navigation works through the runner controls
- Add `role="status"` to live-updating elements (step counter, timer)
- Test with screen readers (the sidepanel is a standard HTML page, so ARIA works normally)

---

## 6. Implementation Priority

### Phase 1: Foundation (Low effort, high impact)
1. Split `App.tsx` into components (no new features, just organization)
2. Add HashRouter for view navigation
3. Create Settings page with basic options
4. Add `useSettings()` hook
5. Improve routine cards with favicons and running badges
6. Add tab event listeners (`onRemoved`, `onUpdated`) for session resilience

### Phase 2: Power features (Medium effort)
7. Focus Mode floating pill (content script + shadow DOM)
8. Routine history tracking
9. Command palette (Cmd+K)
10. Per-step configuration (auto-advance, notes, skip)
11. Bulk URL add and "import from open tabs"

### Phase 3: Polish (Medium-high effort)
12. Routine scheduling / time suggestions
13. Routine folders
14. Omnibox integration
15. Onboarding flow
16. Routine sharing (copy link, markdown, QR)

### Phase 4: Future
17. Cross-browser support (Firefox sidebar_action)
18. Cloud sync via custom backend or Dexie Cloud
19. New tab override page
20. Streak tracking and gamification

---

## 7. Migration Safety Notes

All proposals are **additive** — they don't require changing existing data schemas, just extending them with optional fields. The Dexie migration path is straightforward:

```typescript
// Current
this.version(1).stores({
  routines: '++id,name,createdAt,updatedAt'
});

// After Phase 1-2
this.version(2).stores({
  routines: '++id,name,folderId,createdAt,updatedAt',
  runs: '++id,routineId,startedAt',
  folders: '++id,name,sortOrder'
});
```

Settings use a separate `chrome.storage.local` namespace, so they're completely independent of the Dexie schema.

The Focus Mode content script is conditionally mounted — it does nothing unless focus mode is active, so there's zero performance impact on users who don't enable it.

---

*Last updated: February 2026*
