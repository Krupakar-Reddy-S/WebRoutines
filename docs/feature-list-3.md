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
- [x] Task 1: Runner Home progress + elapsed time + empty-state CTA.
- [x] Task 2: Routines search + compact link previews + focus action.
- [x] Task 3: Editor bulk URL add + drag/drop affordance polish.
- [x] Task 4: Feedback/accessibility polish in sidepanel/popup.
- [x] Task 5: docs finalization + compile/build validation checkpoint.

## Step log
- 2026-02-06: Created `feature-list-3.md` with approved simple UX scope and task checklist.
- 2026-02-06: Added Runner Home progress bars, elapsed-runtime labels, and an empty-state CTA to start routines faster.
- 2026-02-06: Added routine search, expandable/collapsed long link previews, and quick focus action for already-running routines.
- 2026-02-06: Added bulk URL paste in the editor and improved drag/drop reorder feedback with clear target highlighting.
- 2026-02-06: Added transient status auto-clear and improved live-region accessibility semantics for sidepanel and popup feedback.
- 2026-02-06: Finalized Feature 3 docs and validated with successful `bun run compile` and `bun run build`.

## Chore follow-ups (post Feature 3)
- [x] Keep routine import as global action, but move export to per-routine action.
- [x] Remove separate bulk-link input and support multi-link paste directly in the main link input.
- [x] Support comma-separated and line-separated URL paste in the main link input.
- [x] Show parsed-link count in the add button label (for pasted multi-link input).
- [x] Add in-sidebar confirmation UI before removing a draft routine link.

### Chore notes
- 2026-02-06: Export is now routine-scoped from each routine card; import remains a global routines action.
- 2026-02-06: Editor link input now accepts single or multiple links in one field and displays detected add-count.
- 2026-02-06: Added inline confirmation panel in editor before removing a link via the `X` action.
