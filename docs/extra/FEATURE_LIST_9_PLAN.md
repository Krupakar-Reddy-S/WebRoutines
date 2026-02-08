# Feature List 8: Browsing Intelligence Layer

> Post–FL7. Builds on WebRoutines' unique advantage: it already knows which sites you visit, in what order, how long you spend, and whether you finish.

---

## 8A — Per-Routine Time Analytics

**What**: Track how long you actively spend on each tab during a routine run, then surface that data in the History view.

**Why it fits**: WebRoutines already records run duration and step completion. This deepens that from "you ran this routine for 14 minutes" to "you spent 6 minutes on HN, 4 on TechCrunch, 2 on Reddit, and skipped The Verge." No other tool does per-site time tracking within a user-defined browsing sequence.

**How it works**:
- When a runner is active, track which tab is focused and for how long. Use `chrome.tabs.onActivated` to detect tab switches within the routine's tab group.
- Store per-step durations as part of the run record: `stepTimes: [{ url, seconds }]`.
- When a user views a completed run in History, show a simple horizontal bar breakdown — each step as a proportional colored segment with the site favicon and time label.

**What it looks like in the UI**:
- **History → Run detail**: Below the existing step dots, add a "Time breakdown" section. Each step gets a row: favicon + domain + bar + duration label. Longest step gets a subtle highlight.
- **History → Stats cards**: Add "Avg. routine time" card alongside existing total runs / completion rate. When filtered to a single routine, show trend: "↑ 3 min vs last week avg."
- **No new views or routes** — this slots into existing History surfaces.

**What changes in the data layer**:
- Extend the `runs` table schema: add `stepTimes: Array<{ stepIndex: number, activeSeconds: number }>`.
- Background script maintains a simple timer: on `tabs.onActivated`, if the activated tab belongs to an active runner, stop the previous step's timer and start the new one. On runner stop, flush accumulated times into the run record.

**Scope**: ~Medium. New background timer logic + History UI additions. No new permissions needed.

---

## 8B — Reading Position Memory

**What**: Auto-save scroll position per URL per routine. When you re-run the routine tomorrow, each tab restores to where you left off last time.

**Why it fits**: If you read a long dashboard or news feed daily, you want to pick up where you stopped — not start from the top every time. Extensions like "Keep Track" do this generically for any page, but they lack routine context. WebRoutines can scope it: "restore position only when visiting this URL as part of this routine."

**How it works**:
- When a runner is active and the user scrolls a routine tab, debounce-save the scroll Y percentage (not pixels — pages reflow) for that routine+URL pair.
- Store in IndexedDB: `scrollPositions` table keyed by `routineId + normalizedUrl → scrollY (0–100)`.
- On next routine run, after a tab finishes loading, inject a tiny content script that scrolls to the saved position.
- Requires `scripting` permission (already needed for focus controller) to inject the scroll-restore snippet.

**What it looks like in the UI**:
- **Invisible by default** — scroll restore just happens automatically, no UI needed for the happy path.
- **Settings toggle**: "Restore scroll position" (on/off, default on). One line in the Settings view.
- **Optional subtle indicator**: When a tab is restored to a saved position, briefly flash a small pill on the focus controller or step dot: "Resumed from 68%". Fades after 2 seconds.

**Scope**: ~Small-Medium. Content script injection for scroll save/restore + new IndexedDB table. Minimal UI surface.

---

## 8C — Page Change Detection

**What**: Before starting a routine, show which sites have changed since the last run. Optionally skip unchanged sites.

**Why it fits**: This is the single most-requested feature in the "morning coffee" browsing pattern. If you have 8 sites in your morning routine and only 3 have new content, you want to know that upfront and optionally run only those 3. No tab manager or session tool does this.

**How it works — the simple version first**:
- After a routine run completes, snapshot a lightweight fingerprint of each page. Two approaches, in order of simplicity:
  1. **HTTP HEAD request**: Store `Last-Modified` and `Content-Length` headers per URL. Before next run, re-check headers. If either changed → mark as "updated." Very fast, no page rendering, but many sites don't set useful headers.
  2. **Content hash**: After each tab loads during a routine run, extract `document.body.innerText.length` and a simple hash (first 500 chars + last 500 chars + total length). Compare on next run's pre-check. More reliable but requires a quick background fetch or content script.
- Start with approach 1 (HEAD requests). Fall back to "unknown" for sites that don't cooperate. Graduate to approach 2 later.

**What it looks like in the UI**:
- **Pre-run dashboard**: When the user taps "Run" on a routine, instead of immediately launching, show a brief interstitial card (1-2 seconds while checking):
  ```
  Morning News  ·  3 of 7 sites updated
  ● TechCrunch    — Updated
  ● Hacker News   — Updated  
  ○ The Verge     — No change
  ○ Reddit/tech   — No change
  ● Product Hunt  — Updated
  ○ ArsTechnica   — No change
  ○ Lobsters      — No change

  [ Run all ]  [ Run updated only ]
  ```
- The check happens in parallel (all HEAD requests fire at once), so it's fast — typically under 1 second.
- "Run updated only" creates a temporary filtered routine for that session (doesn't modify the saved routine).
- If the user doesn't want the interstitial, a setting "Check for changes before run" (on/off) controls it.

**What changes in the data layer**:
- New IndexedDB table: `pageFingerprints` keyed by `routineId + normalizedUrl → { lastModified, contentLength, lastChecked }`.
- Background script function: `checkForChanges(routine) → Promise<Array<{ url, changed: boolean | 'unknown' }>>`.

**Scope**: ~Medium. Network requests + new pre-run UI flow + IndexedDB table. Needs `fetch` from background script (no new permissions for HEAD requests to arbitrary URLs since they're user-defined routine URLs, but may need `host_permissions` or use `offscreen` document).

**Permission note**: HEAD requests to arbitrary URLs from a background script require host permissions. This is the same `<all_urls>` discussion from the FL7 review — use optional host permissions, request at routine-run time if not already granted. If denied, skip the change check gracefully and just run normally.

---

## 8D — Session Notes (Lightweight Annotations)

**What**: While running a routine, let the user jot a quick note per step. After the run, all notes are collected into a "session summary" viewable in History.

**Why it fits**: This is NOT a full annotation/highlighting tool (that's scope creep). It's a simple text field — "what did I notice on this page?" — that gets timestamped and attached to the run record. The value is in the aggregation: after your morning routine, you have a structured log of what mattered across all your sites, without switching to a separate note app.

**How it works**:
- In the side panel's runner view, below the step navigation controls, add a collapsible "Note" text area. One per step. Auto-saves on blur/debounce.
- Notes are stored as part of the run record: `stepNotes: Array<{ stepIndex: number, note: string }>`.
- Empty notes are not stored.

**What it looks like in the UI**:
- **Runner view (side panel)**: Below the step dots and nav buttons, a subtle text area with placeholder "Note for this step..." — collapsed to a single line by default, expands on focus. Small and unobtrusive — doesn't change the runner layout unless the user engages with it.
- **History → Run detail**: If a run has notes, show a "Notes" section below time breakdown. Each note displayed as: favicon + domain + note text + timestamp. 
- **Export**: "Copy session notes" button on the run detail view — copies all notes as markdown:
  ```
  ## Morning News — Feb 8, 2026
  - **TechCrunch**: New funding round for AI startup, check later
  - **HN**: Thread on Rust async patterns — bookmark
  - **Product Hunt**: Nothing interesting today
  ```
- This markdown export is the lightweight PKM bridge — users paste into Obsidian, Notion, whatever they use. No API integration needed.

**Scope**: ~Small. Text input in runner view + storage extension + History display. No new permissions.

---

## 8E — Day-of-Week Scheduling

**What**: Let users assign routines to specific days. The routines list highlights "today's routines" and dims the rest.

**Why it fits**: This is the core feature of the extinct "Morning Coffee" extension that thousands of users miss. A user's Monday routine (standup prep + sprint board + JIRA) differs from their Saturday routine (news + Reddit + YouTube subscriptions). Currently all routines are equal in the list — there's no concept of "this one is for today."

**How it works**:
- Each routine gets an optional `schedule` field: `{ days: Set<0|1|2|3|4|5|6> }` where 0 = Sunday. If empty/undefined, the routine is "anytime" (no scheduling, current behavior).
- The routines list view sorts scheduled-for-today routines to the top with a subtle "Today" badge. Non-today scheduled routines get dimmed but remain accessible (user might want to run them out of schedule).

**What it looks like in the UI**:
- **Routine editor**: Below the links list, a "Schedule" section with 7 day-of-week toggle pills: `M T W T F S S`. Tap to toggle. All off = "anytime." Visual treatment: selected days are accent-filled, unselected are outline-only.
- **Routines list view**: 
  - Section header: "Today — Tuesday" showing routines scheduled for today (or unscheduled ones that were run recently).
  - Scheduled-for-other-days routines appear below, slightly dimmed, no section header needed.
  - A routine card scheduled for today gets a small calendar-dot indicator next to the name.
- **No notifications or auto-launch** — this is purely organizational sorting + visual affordance. The user still manually taps "Run."

**What changes in the data layer**:
- Extend routine schema: `schedule?: { days: number[] }`.
- Routines list query adds a sort comparator: today-scheduled first, then by lastRunAt.

**Scope**: ~Small. Schema addition + editor UI + list sorting logic. No new permissions.

---

## Implementation Order

```
8E  Day-of-Week Scheduling     ← smallest, highest daily UX impact
8A  Per-Routine Time Analytics  ← enriches existing History, medium effort  
8D  Session Notes               ← small, pairs with History enrichment
8B  Reading Position Memory     ← invisible quality-of-life upgrade
8C  Page Change Detection       ← most complex, most impressive, do last
```

**Rationale**: Start with 8E because it's tiny and immediately changes how the routines list feels — it goes from "a flat list of bookmarks" to "today's browsing plan." Then 8A enriches the History view (which is already built). 8D adds notes to the same History surface. 8B is invisible infrastructure. 8C is the marquee feature but needs the most work and permission negotiation, so it comes last when everything else is stable.

---

## What This Does NOT Include (Deliberately)

- **AI summaries / digest generation** — requires API calls or local LLM, too complex for now. The session notes + markdown export covers 80% of the value with 5% of the effort.
- **Smart reordering** — interesting but needs behavioral data collected over weeks first. Let time analytics (8A) accumulate data before building on top of it.
- **Data extraction / scraping** — powerful but architecturally heavy and permission-intensive. Revisit after v1.0 store launch.
- **Routine sharing / templates** — needs users first. Build export/import polish instead.
- **Timers, todos, habit tracking** — saturated, undifferentiated, doesn't leverage WebRoutines' unique data.
