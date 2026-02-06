# Feature List 6: UI/UX Overhaul + Tab Loading Simplification

## Goal
Ship Phase A polish and model simplification: remove dual run-mode complexity, improve routine/editor/settings UX, and standardize sidepanel interactions with shadcn-based components.

## Scope highlights
Phase A (implemented):
1. Remove single-tab runner mode and standardize on tab groups.
2. Add tab loading strategies (`eager` / `lazy`) with settings control.
3. Redesign routines list as compact accordion cards with favicon previews.
4. Improve editor workflow for links and tab imports.
5. Align header/button ordering and placement across sidepanel pages.
6. Replace routine deletion browser confirm with shadcn dialog.
7. Ensure shadcn CLI installs into repo-local component paths.

Phase B (next):
1. History + stats view (`#/history`) on top of Feature List 5 run tracking.

## Out of scope (for this phase)
- History/stats UI implementation (Phase B).
- Scheduling/automation features.
- Cloud sync/cross-device features.

## Checklist
Phase A:
- [x] Remove `same-tab` runtime path from runner/session flows.
- [x] Add `tabLoadMode` settings model (`eager` / `lazy`) and defaults.
- [x] Implement lazy placeholder tab mapping (`tabIds: (number | null)[]`) with safe normalization.
- [x] Update background tab lifecycle handling for lazy mode mapping.
- [x] Remove start-mode picker in routines; start directly from settings mode.
- [x] Rework routines UI to accordion card model with inline link actions.
- [x] Add favicon utilities and shared favicon components.
- [x] Add editor import-from-tabs dialog and metadata improvements.
- [x] Update settings UIs (sidepanel/options) to tab loading radio controls via shadcn components.
- [x] Align header actions below subtitle and keep navigation-first ordering.
- [x] Replace routine delete `window.confirm` with shadcn dialog in routines view.
- [x] Validate with `bun run compile` and `bun run build`.

Phase B:
- [ ] Add history route/view.
- [ ] Add stats cards and routine filter.
- [ ] Add run list groups and status chips.

## Implementation notes (Phase A)
- `RoutineSession` now uses tab-group only with per-session `loadMode`.
- New runs still write `mode: 'tab-group'` for history compatibility.
- Routines card behavior:
  - Run button in card header.
  - Favicon strip shows first 5 and `+X more`.
  - Fallback favicon is a globe emoji (`🌐`) badge.
  - `Edit` is on the same row as favicon strip to keep cards compact.
- Editor behavior:
  - Add-link input first, then `Add` + `Import from tabs` in one row, then helper text.
  - Editor delete action removed (routine deletion handled from routines list).
- Deletion behavior:
  - Routine delete now uses a shadcn `Dialog` confirmation.
- Header consistency:
  - Action buttons appear below description text.
  - Back/manage navigation action appears before settings action.
- shadcn CLI path resolution:
  - `tsconfig.json` overrides local aliases so `bunx --bun shadcn@latest add ...` installs in repo, not parent directory.

## Files touched (high level)
- Runner/session/settings/history model:
  - `lib/types.ts`
  - `lib/settings.ts`
  - `lib/session.ts`
  - `lib/navigation.ts`
  - `lib/run-history.ts`
  - `entrypoints/background.ts`
- Sidepanel views/components:
  - `entrypoints/sidepanel/views/RunnerHomeView.tsx`
  - `entrypoints/sidepanel/views/RoutinesView.tsx`
  - `entrypoints/sidepanel/views/EditorView.tsx`
  - `entrypoints/sidepanel/views/SettingsView.tsx`
  - `entrypoints/sidepanel/components/StepList.tsx`
  - `entrypoints/sidepanel/components/ActiveRunnerCard.tsx`
- New shared components/helpers:
  - `components/RoutineAccordionCard.tsx`
  - `components/ImportFromTabsDialog.tsx`
  - `components/FaviconStrip.tsx`
  - `components/FaviconImage.tsx`
  - `components/ui/accordion.tsx`
  - `components/ui/checkbox.tsx`
  - `components/ui/dialog.tsx`
  - `components/ui/dropdown-menu.tsx`
  - `components/ui/radio-group.tsx`
  - `components/ui/select.tsx`
  - `components/ui/switch.tsx`
  - `lib/url.ts`
- Settings/options + config:
  - `entrypoints/options/App.tsx`
  - `tsconfig.json`
  - `wxt.config.ts`

## Step log
- 2026-02-06: Phase A implementation started from plan in `docs/extra/FEATURE_LIST_6_PLAN.md`.
- 2026-02-06: Removed single-tab execution path and switched runtime to tab-group model.
- 2026-02-06: Added eager/lazy tab-loading mode with settings and lazy placeholder tab mapping.
- 2026-02-06: Rebuilt routines and editor UIs with new accordion/import/favicons flow.
- 2026-02-06: Standardized settings controls to shadcn components.
- 2026-02-06: Fixed shadcn CLI target path by overriding local aliases in `tsconfig.json`.
- 2026-02-06: Applied UX refinements from review (compact cards, header ordering, dialog-based delete).
- 2026-02-06: Revalidated with successful `bun run compile` and `bun run build`.
