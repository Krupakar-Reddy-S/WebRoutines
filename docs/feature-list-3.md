# Feature List 3: simple sidepanel UX polish

## Goal
Ship low-complexity UI/UX improvements that make routine running and management smoother without introducing new architecture, new permissions, or schema-heavy features.

## Scope highlights
1. Runner Home polish:
- Progress visualization per active runner.
- Elapsed runtime visibility.
- Better empty state with direct CTA.
2. Routines list usability:
- Search routines by name.
- Collapse long link lists with optional expand.
- Quick focus action for already-running routines.
3. Editor quality-of-life:
- Bulk URL paste (one URL per line).
- Clearer drag/drop feedback while reordering.
4. Feedback and accessibility polish:
- Auto-clear transient success feedback.
- Improve status semantics and icon-control labels.

## Out of scope
- Focus mode floating controller/content script.
- Settings/options page and `chrome.storage.local` settings model.
- Router migration or large component decomposition refactor.
- New schema features (history/stats/scheduling/folders/per-step config).
- Omnibox/new-tab/command palette/sharing features.

## Checklist
- [x] Define Feature List 3 scope and implementation plan.
- [ ] Task 1: Runner Home progress + elapsed time + empty-state CTA.
- [ ] Task 2: Routines search + compact link previews + focus action.
- [ ] Task 3: Editor bulk URL add + drag/drop affordance polish.
- [ ] Task 4: Feedback/accessibility polish in sidepanel/popup.
- [ ] Task 5: docs finalization + compile/build validation checkpoint.

## Step log
- 2026-02-06: Created `feature-list-3.md` with approved simple UX scope and task checklist.
