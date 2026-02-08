# WebRoutines: Post–Feature List 7 Review & Suggestions

## Assessment summary

WebRoutines is in a strong position architecturally and functionally. The core product loop — create routines, run them in tab groups, track history — works end to end. Feature List 7 did the right thing at the right time: it stopped adding features and invested in modularity, testing infrastructure, and documentation governance. Most projects at this stage have the opposite problem (features outrunning quality), so the discipline here is notable.

The project is **feature-complete for a v1.0** but **not yet release-complete**. The gap between those two things is what this document addresses.

---

## What's genuinely strong

### Architecture decisions that will age well

The `core/` → `adapters/browser/` → `features/` boundary is a real architectural separation, not just folder reorganization. Pure logic in `core/`, browser-specific wrappers isolated in `adapters/`, and feature-centric modules that compose both. This means:

- Unit tests can cover `core/` without mocking browser APIs.
- Browser adapter changes (e.g., if Firefox MV3 ever becomes viable) stay contained.
- Feature modules can be understood in isolation.

### Tab-group-only simplification

Removing same-tab mode was the highest-leverage decision in the project's history. It eliminated an entire class of conditional logic in navigation, session management, and every UI surface. The eager/lazy loading replacement is a much better axis of configurability — it gives users a real choice (resource usage vs. convenience) instead of a confusing mode toggle that affected everything differently.

### Run history with query-layer pagination

Moving history filtering from full-table UI-layer scans to a query service with indexed Dexie lookups was the right call. Most extension projects hit a wall at ~500 records when they realize they've been loading everything into React state. The `[routineId+startedAt]` compound index means this will scale to thousands of runs without degradation.

### Testing infrastructure details

Two details stand out as unusually thoughtful:

- **Deterministic extension ID via test-only manifest `key`** — this means Playwright tests hit a stable `chrome-extension://` URL instead of a random one per build. Most extension test setups break here.
- **Split Vitest configs** (unit vs. component) — unit tests run fast without JSDOM overhead, component tests get the DOM environment they need. Clean separation.

### AGENTS.md as a quality contract

Having a machine-readable governance doc that specifies the verification sequence (`lint → compile → test → build`) means any AI-assisted implementation session can be held to the same standard. This is a practical solution to the "AI wrote code that doesn't compile" problem.

---

## What I'd flag

### 1. `<all_urls>` host permission is a Chrome Web Store blocker

This is the single most important issue for release readiness.

**The problem:** Chrome Web Store has increasingly strict review policies for broad host permissions. Extensions requesting `<all_urls>` trigger manual review, require detailed justification, and are frequently rejected or delayed. Google's stated policy is that extensions should request the minimum permissions necessary.

**Why it exists:** The focus mini-controller content script needs to inject on any page the user visits during a routine. This legitimately requires broad host access.

**Possible mitigations:**

| Approach | Trade-off |
|---|---|
| **Optional host permissions** | Declare `<all_urls>` as `optional_host_permissions` in the manifest. Request it at runtime only when the user enables focus mode. The extension works without it; focus mode becomes an opt-in that triggers a permission prompt. Cleanest path for store approval. |
| **`activeTab` + declarative content scripts** | Use `activeTab` permission (granted per user interaction) combined with `scripting.executeScript()` to inject the controller only when the user clicks the extension icon or uses a keyboard shortcut. Doesn't cover automatic injection on tab switch, which is the whole point of focus mode. Probably too limiting. |
| **Justify in store listing** | Keep `<all_urls>` but write a detailed justification in the Chrome Web Store review notes and privacy policy. May work, but adds review friction and can delay publishing by weeks. |

**Recommendation:** Optional host permissions is the right path. Focus mode already has an enable/disable toggle — wire it to `chrome.permissions.request()` when the user turns it on. If the user never enables focus mode, the extension never asks for broad access. This is exactly the pattern Google recommends.

**Implementation sketch:**

```typescript
// When user enables focus mode in settings
async function enableFocusMode(): Promise<boolean> {
  const granted = await chrome.permissions.request({
    origins: ['<all_urls>']
  });

  if (granted) {
    await updateSetting('focusModeEnabled', true);
    // Register content script dynamically
    await chrome.scripting.registerContentScripts([{
      id: 'focus-controller',
      matches: ['<all_urls>'],
      js: ['focus-controller.js'],
      runAt: 'document_idle',
    }]);
    return true;
  }

  return false; // User denied — don't enable
}

// When user disables focus mode
async function disableFocusMode() {
  await updateSetting('focusModeEnabled', false);
  await chrome.scripting.unregisterContentScripts({ ids: ['focus-controller'] });
  // Optionally: chrome.permissions.remove({ origins: ['<all_urls>'] });
}
```

This changes the focus controller from a statically declared content script to a dynamically registered one. WXT supports this pattern but it means the content script entrypoint declaration needs adjustment.

---

### 2. Test coverage is infrastructure-rich but coverage-thin

The testing stack is solid. The actual coverage isn't.

**What's covered:**
- URL normalization, backup parsing (lib/routines) — utility functions
- Settings normalization (lib/settings) — utility functions
- Focused runner resolver (core/runner/focus) — pure logic
- History filter/duration helpers — pure logic
- One component test (history run card)
- One e2e smoke test (sidepanel loads)

**What's not covered (and is the riskiest code):**

| Module | Risk level | Why it matters |
|---|---|---|
| `lib/navigation.ts` | **High** | Tab creation, group management, step navigation, lazy loading — the most complex state machine in the project. Bugs here cause lost tabs, orphaned groups, or broken sessions. |
| `lib/session.ts` | **High** | Session read/write/update with `browser.storage.session`. Race conditions between multiple open surfaces (sidepanel + popup + background) are the most common source of bugs in multi-surface extensions. |
| `background.ts` event handlers | **High** | `tabs.onRemoved`, `tabs.onMoved`, `tabGroups.onRemoved` — reactive handlers that modify session state. If these fail silently, sessions become stale. |
| `lib/run-history.ts` (write paths) | **Medium** | Run start/stop/finalization. If the stop path throws, `stoppedAt` stays null and stats are wrong. |
| Editor draft management | **Medium** | Draft parsing, URL deduplication, drag reorder state. Bugs here cause data loss (user adds URLs, they don't persist). |

**Suggestion:** Before adding more features, invest one focused session into testing `navigation.ts` and `session.ts`. These don't need browser APIs to test if the logic is properly separated — mock the `chrome.tabs.*` calls and verify the state machine transitions. The `core/` extraction pattern from Phase A makes this possible. If navigation logic is still coupled to Chrome APIs, extracting it into a testable pure function layer would be a high-value refactor.

---

### 3. No first-run or onboarding experience

The extension installs. The user opens the sidepanel. They see an empty runner home. Now what?

This is the single biggest product gap for a public release. Power users will figure it out. Everyone else will uninstall within 60 seconds.

**Minimum viable onboarding:**

A single "Welcome" card on the runner home empty state that guides the user through creating their first routine:

```
┌─────────────────────────────────────────────┐
│  👋 Welcome to WebRoutines                   │
│                                              │
│  Create your first routine to get started.   │
│  A routine is a list of websites you visit   │
│  regularly — news sites, work tools, social  │
│  feeds, whatever your daily flow looks like. │
│                                              │
│  [Create my first routine →]                 │
│                                              │
│  ─ or try a starter ─                        │
│                                              │
│  [Morning News]  [Dev Daily]  [Social Check] │
└─────────────────────────────────────────────┘
```

The starter templates are just pre-filled routines (5–7 popular URLs each) that the user can customize. They're JSON objects bundled with the extension, not fetched from anywhere.

**After first routine is created:** The welcome card disappears permanently (track via a `hasCompletedOnboarding` flag in `chrome.storage.local`). The runner home shows the normal empty state with "Start a routine" actions.

**Cost:** Small. One new component, one storage flag, 2–3 preset JSON files. But it transforms the first-launch experience.

---

### 4. Accessibility hasn't been addressed

This was marked as "DEFINITE" in the improvements roadmap (Tier 2) but hasn't been implemented. For a Chrome Web Store listing, accessibility isn't just good practice — it affects review outcomes and user ratings.

**Minimum pass:**

| Area | What to do |
|---|---|
| Icon-only buttons | Add `aria-label` to every button that has only an icon (play, stop, previous, next, expand, settings gear, etc.). |
| Live regions | Add `role="status"` or `aria-live="polite"` to: elapsed time display, step counter, running/stopped state indicators. |
| Keyboard navigation | Ensure all interactive elements are reachable via Tab key. Routine cards, accordion expand/collapse, link list items. Test by navigating the entire sidepanel with keyboard only. |
| Focus management | When a sheet/dialog opens, focus moves to it. When it closes, focus returns to the trigger element. Shadcn components mostly handle this, but verify. |
| Color contrast | Verify status badges (green/amber/red) meet WCAG AA contrast ratios against their backgrounds. The muted tones in light mode are sometimes borderline. |
| Screen reader testing | One pass with VoiceOver (macOS) or NVDA (Windows) through the main flows: create routine, start routine, navigate steps, stop routine, view history. |

**Cost:** Small to medium. Most of this is adding attributes to existing elements, not new components. The keyboard navigation and screen reader testing take the most time but surface real usability issues.

---

### 5. Background script error resilience

Error boundary exists in the sidepanel (React), but the background script — the most critical runtime component — has no equivalent safety net.

If a `tabs.onRemoved` handler throws (e.g., because session state is unexpectedly shaped), the error is swallowed silently. The session becomes stale, and the user sees a "running" indicator for a routine that has no actual tabs.

**Suggestion:** Wrap every event listener callback in the background script with a try-catch that logs the error and attempts graceful degradation:

```typescript
// Pattern for all background event handlers
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  handleTabRemoved(tabId, removeInfo).catch((err) => {
    console.error('[WebRoutines] tabs.onRemoved handler failed:', err);
    // Optionally: attempt to clean up the session that references this tabId
  });
});
```

This is 15 minutes of work and prevents the worst failure mode (silent state corruption).

---

### 6. Privacy policy for Chrome Web Store

Chrome Web Store requires a privacy policy URL for any extension that accesses user data or uses host permissions. WebRoutines stores routine URLs, run history, and (with focus mode) injects scripts on any page.

**What you need:** A simple privacy policy page hosted somewhere (GitHub Pages, a single HTML file on any hosting). Content:

- WebRoutines stores all data locally in your browser (IndexedDB and chrome.storage).
- No data is transmitted to any server.
- No analytics, telemetry, or tracking.
- The `<all_urls>` permission (if using optional permissions) is used solely to display the focus mode navigation controller on web pages during active routine runs.
- No personal information is collected, stored externally, or shared.

This can literally be a single-page markdown file rendered via GitHub Pages. Takes 10 minutes to write, 5 minutes to deploy.

---

## Where the project sits on the product lifecycle

```
[Build]  →  [Stabilize]  →  [Release prep]  →  [Publish]  →  [Grow]
  ✓            ✓              ← you are here
```

Feature Lists 1–6 were the Build phase. Feature List 7 was the Stabilize phase. The project is now at the Release Prep inflection point.

The danger at this stage is continuing to add features (command palette, folders, sharing, per-step config) instead of doing the unglamorous work that gets the extension into users' hands. Every feature added before v1.0 is published is a feature that will never be validated by real usage.

---

## Suggested next phase: Release Prep (Feature List 8)

Organized by priority, not by implementation order:

### Must-do before Chrome Web Store submission

| Item | Effort | Notes |
|---|---|---|
| Permission minimization (optional host permissions for focus controller) | Medium | Largest single change. Requires dynamic content script registration, focus mode toggle wiring, and testing the permission grant/revoke flow. |
| Privacy policy page | Tiny | Single markdown/HTML page on GitHub Pages. |
| Chrome Web Store listing assets | Small | 128×128 icon, 1280×800 screenshots (3–5), short description, detailed description. |
| Store listing description copy | Small | Feature summary, use cases, privacy note. |
| Background script error wrapping | Tiny | Try-catch in all event listener callbacks. |

### Should-do for a good v1.0 launch

| Item | Effort | Notes |
|---|---|---|
| First-run onboarding card | Small | Welcome card + 2–3 starter routine templates. |
| Accessibility pass | Small–Medium | aria-labels, keyboard nav, live regions, one screen reader test. |
| Deepen test coverage (navigation + session) | Medium | Unit tests for the state machine in navigation.ts. Mock chrome.tabs API, verify session transitions. |
| CI pipeline (GitHub Actions) | Small | `lint → compile → test → build` on push/PR. The scripts already exist, just needs a workflow YAML. |

### Nice-to-have for launch polish

| Item | Effort | Notes |
|---|---|---|
| Keyboard shortcuts documentation | Tiny | Show current bindings in settings, link to `chrome://extensions/shortcuts`. |
| Routine duplication | Tiny | One-click duplicate. Trivial implementation, genuine user convenience. |
| Export history as JSON | Tiny | Add to settings data section. |

### Explicitly defer past v1.0

| Item | Why defer |
|---|---|
| Command palette | Power user feature. Zero value without users to be "power" users. |
| Folders/categories | Premature until users have 10+ routines. |
| Per-step config (skip/notes/auto-advance) | Adds complexity to the editor and runner. Validate need first. |
| Sharing (links/QR/markdown) | No distribution channel yet — sharing what, to whom? |
| Omnibox integration | Low discoverability. Won't move the needle on adoption. |
| Cross-browser (Firefox) | Chrome first. Firefox MV3 sidebar API is incompatible anyway. |
| Cloud sync | Requires backend infrastructure. Way too early. |

---

## A note on feature discipline going forward

The improvements roadmap (v2) listed ~40 items across categories. Feature Lists 1–7 shipped the most impactful ones: multi-runner, tab groups, focus controller, settings, history tracking, architectural cleanup, testing. What remains is mostly polish and power-user features.

The temptation now is to keep polishing internally. But the most valuable feedback comes from real users, and real users require a published extension. Every hour spent on command palettes before launch is an hour not spent on the 15-minute fixes that actual users will request in the first week.

The suggested path: ship a clean v1.0 with the must-do items above, then let real usage data drive the next feature list instead of the improvements doc.

---

*Written: February 2026*
*Context: Post Feature List 7 (A/B/C complete), pre-release*
