# Feature List 2: runner-first UX + grouped multi-runner lifecycle

## Goal
Restructure sidepanel UX around a runner-first home and dedicated routine management pages, while upgrading runner lifecycle behavior so every runner is isolated in tab groups and multiple routines can run concurrently.

## Scope highlights
1. Split sidepanel into dedicated views:
- Runner home (default)
- Routines management list page
- Routine create/edit page
2. Support one active runner per routine (no duplicate runner for same routine).
3. Support multiple active runners across different routines at the same time.
4. Run both modes inside tab groups:
- Single-tab runner: one tab in a dedicated group, reused across steps.
- Multi-tab runner: one tab per routine link in dedicated group.
5. Make runner stop/delete semantics explicit:
- Stop destroys runner-owned tabs and ends runner.
- Deleting active routine also stops and destroys its runner tabs.
- If a runner group is removed manually, corresponding runner session closes.
6. In multi-tab mode, navigation should activate existing tabs without forcing URL rewrite refresh.

## Implementation decisions
- Runner identity is routine-scoped: at most one active runner per routine id.
- Starting an already-running routine does not create duplicates; UI routes/focuses that existing runner.
- Active runner state is multi-session in `browser.storage.session` (array of routine sessions + focused routine id).
- Runner ownership is tracked through `tabGroupId` + runner tab ids so non-runner tabs are not modified.

## Checklist
- [x] Define Feature List 2 scope, decisions, and delivery sequence.
- [x] Task 1: add multi-runner session model + background lifecycle listeners.
- [x] Task 2: rework navigation layer for grouped single/multi modes and per-routine runners.
- [x] Task 3: split sidepanel into runner home, routines page, and routine editor page.
- [ ] Task 4: update popup to work with focused runner in multi-runner state.
- [ ] Task 5: docs update + compile/build validation checkpoint.

## Step log
- 2026-02-06: Created `feature-list-2.md` with agreed scope and task breakdown.
- 2026-02-06: Implemented multi-runner session state in `browser.storage.session` with focused routine tracking and single-runner compatibility wrappers.
- 2026-02-06: Added background `tabGroups.onRemoved` listener to automatically close runner sessions when runner groups are removed.
- 2026-02-06: Refactored navigation to enforce one runner per routine, allow multi-routine concurrent runners, and return `alreadyRunning` on start attempts.
- 2026-02-06: Switched single mode to dedicated single-tab group and changed multi mode navigation to activate existing tabs without URL rewrite refresh.
- 2026-02-06: Added per-routine stop/destroy flows that close runner-owned tabs before removing runner session state.
- 2026-02-06: Rebuilt sidepanel UX into three views (Runner Home, Routines, Editor) so routine management is separated from day-to-day runner controls.
- 2026-02-06: Added active-runner focus switching and per-routine runner actions from Runner Home while keeping hotkeys on the focused runner.
