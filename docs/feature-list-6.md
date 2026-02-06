# Feature List 6: UI/UX Overhaul + History and Stats

## Goal
Ship the post-Feature-5 UX upgrade in two phases:
- Phase A: simplify runtime model and refresh sidepanel UX.
- Phase B: expose run history and usage stats UI on top of existing run-tracking data.

## Scope highlights
Phase A (implemented):
1. Remove single-tab execution path and standardize sessions to tab groups.
2. Add tab loading strategies (`eager` and `lazy`) as the replacement for default run mode.
3. Redesign routines list as compact accordion cards with favicon strip and inline actions.
4. Refresh editor flow (metadata line, import-from-tabs dialog, improved link workflow).
5. Standardize header action layout/order and settings controls with shadcn components.

Phase B (implemented):
1. Add sidepanel history route (`#/history`) and filtered route (`#/history?routine=<id>`).
2. Add history navigation entry points in runner/routines/popup surfaces.
3. Add stats summary cards (total runs, total time, completion rate).
4. Add routine filter dropdown synced with URL search params.
5. Add grouped run list (Today, Yesterday, This week, Earlier) with step progress and status badges.

## Out of scope
- Scheduling and reminders.
- Cloud sync/cross-device data.
- Advanced analytics beyond core run stats.

## Phase A checklist
- [x] Remove `same-tab` runtime path from navigation/session model.
- [x] Add `tabLoadMode` setting (`eager`/`lazy`) and defaults.
- [x] Support lazy placeholder mapping with `tabIds: (number | null)[]`.
- [x] Update tab lifecycle handling for lazy-mode mapping stability.
- [x] Remove mode picker from routine start flow.
- [x] Rebuild routines view around accordion cards and favicon previews.
- [x] Add `ImportFromTabsDialog` and favicon helpers in editor/routines surfaces.
- [x] Migrate settings UIs to shadcn radio/switch/select controls.
- [x] Apply consistent sidepanel header action layout and ordering.
- [x] Replace routine delete browser confirm with shadcn dialog in routines view.
- [x] Validate with `bun run compile` and `bun run build`.

## Phase B details

### B1. Route and navigation
- Added route: `#/history`.
- Added filtered route support via query param: `#/history?routine=<id>`.
- Added sidepanel navigation entry points:
  - Runner Home header: `History` button.
  - Routines header: `History` button.
  - Routines accordion card action: per-routine `History` button (opens filtered history).
- Added popup quick-open for history by setting `requestedSidepanelView = 'history'` and opening sidepanel.

### B2. History data model usage
History UI reads from Feature List 5 tables:
- `runs`
- `runEvents` (already used indirectly by stored run fields)

Primary query behavior in history view:
1. Load runs ordered by `startedAt` descending.
2. Apply optional routine filter from URL query param.
3. Resolve routine names via `routines.bulkGet()`.
4. Render rows with graceful fallback labels when routine records are missing.

### B3. Stats summary cards
History summary cards compute from the currently filtered run set:
- `Total runs`: count of matching runs.
- `Total time`: sum of resolved run durations.
- `Completion rate`: percentage of runs where `completedFull === true`.

Duration resolution logic:
- Prefer stored `durationMs`.
- Fallback to `stoppedAt - startedAt`.
- For active runs (`stoppedAt === null`), use `now - startedAt`.

### B4. Routine filter behavior
- Filter UI uses shadcn `Select`.
- Options include `All routines` + routines that have at least one run.
- Selected filter value syncs to URL search params.
- Deep-linking works (opening `#/history?routine=<id>` pre-filters results).

### B5. Run list and grouping
History rows are grouped by started date bucket:
- `Today`
- `Yesterday`
- `This week`
- `Earlier`

Each run card shows:
- Routine name (clicking sets routine filter).
- Start time of day.
- Step progress dots with truncation for long routines.
- `stepsCompleted/totalSteps`.
- Duration label or `In progress`.
- Completion badge (`Complete`, `Partial`, or `In progress`).
- Optional stop-reason line for non-user stop reasons.

### B6. Phase B checklist
- [x] Add `/history` sidepanel route and view.
- [x] Add routine filter with URL sync.
- [x] Add grouped run list with progress/status.
- [x] Add summary stats cards.
- [x] Add navigation entry points to history (runner/routines/popup).
- [x] Validate with `bun run compile` and `bun run build`.

## Files touched (Phase B)
- `entrypoints/sidepanel/views/HistoryView.tsx`
- `entrypoints/sidepanel/App.tsx`
- `entrypoints/sidepanel/views/RunnerHomeView.tsx`
- `entrypoints/sidepanel/views/RoutinesView.tsx`
- `components/RoutineAccordionCard.tsx`
- `entrypoints/popup/App.tsx`
- `lib/session.ts`

## Step log
- 2026-02-06: Implemented Phase A model simplification and sidepanel UX overhaul.
- 2026-02-06: Added history route and core stats/list UI for Phase B.
- 2026-02-06: Wired filter query-param behavior and per-routine history deep-linking.
- 2026-02-06: Added popup history entry point via requested sidepanel view.
- 2026-02-06: Revalidated Feature 6 with successful compile/build.
