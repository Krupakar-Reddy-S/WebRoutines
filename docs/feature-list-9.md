# Feature List 9: Foundation Intelligence + Full Action Timeline

## Goal
Ship foundation intelligence enhancements without adding new permissions:
1. Day-of-week routine scheduling.
2. Session notes and a dedicated history run-detail view.
3. Per-step active time analytics.
4. Full chronological action timeline for each run.

## Phase plan

### Phase A — Scheduling foundation
Scope:
- Add routine day-of-week schedule model.
- Add schedule editing in routine editor.
- Add routines list ordering: today-scheduled first, unscheduled second, other-day scheduled last.
- Add schedule support in import/export payloads.

Checklist:
- [x] `Routine.schedule` types added and normalized.
- [x] Routine CRUD/import/export supports schedule.
- [x] Editor schedule day toggles implemented.
- [x] Routine list ordering + today badge implemented.
- [x] Verification gates passed.

Local checks:
1. Create routines for today/unscheduled/other-day and verify ordering.
2. Edit schedule and verify list reorders immediately.
3. Export/import JSON and verify schedule roundtrip.
4. Confirm start/stop runner behavior unchanged.

### Phase B — Action timeline + notes + run detail
Scope:
- Add `runActionEvents` table and timeline logging helpers.
- Add navigation/system action logging.
- Add per-step notes on active runs.
- Add dedicated run detail route and UI.

Checklist:
- [x] `runActionEvents` schema/type/query path implemented.
- [x] Navigation and system lifecycle actions logged.
- [x] Step notes persisted and rendered.
- [x] History run-detail route implemented.
- [x] Verification gates passed.

Local checks:
1. Run routine with next/previous/jump/open-current and verify event order.
2. Add notes across steps and verify run-scoped persistence.
3. Trigger user-stop and system-stop flows and verify stop timeline entries.
4. Verify list-to-detail and back navigation.

### Phase C — Active time analytics + step sync
Scope:
- Track active tab time by step while runner is active.
- Sync current step when user manually activates routine tabs.
- Record step-sync timeline events.
- Render step-time breakdown in run detail.
- Add average run time card in history summary.

Checklist:
- [x] Step time accumulation implemented and persisted.
- [x] Manual tab activation sync implemented.
- [x] Step-sync events logged.
- [x] History detail shows time breakdown.
- [x] History summary shows average run time.
- [x] Verification gates passed.

Local checks:
1. Verify different dwell times produce expected relative step-time bars.
2. Manually activate earlier routine tab and verify step-sync + timeline event.
3. Switch focus away/back and verify timing pause/resume.
4. Verify stop flows flush timing before finalization.

## Verification gates (required per phase)
- `bun run lint`
- `bun run compile`
- `bun run test`
- `bun run build`
- `bun run test:e2e`

## Execution log
- 2026-02-08: Feature List 9 phase plan created.
- 2026-02-08: Phase A completed (schedule model, editor toggles, list ordering, backup schedule support) with passing lint/compile/test/build/test:e2e.
- 2026-02-08: Phase B completed (action timeline table + logging, step notes in runner, history run-detail route/view) with passing lint/compile/test/build/test:e2e.
- 2026-02-08: Phase C completed (active step timers + manual tab step sync + history avg time/time-breakdown) with passing lint/compile/test/build/test:e2e.
- 2026-02-08: Phase D completed (unified brand color, sidebar accent pass, globe icon, LP color/favicon update) with passing lint/compile/build.
- 2026-02-10: Phase E completed (schema consolidation, stop dialog analytics, focused runner progress bar) with passing lint/compile/test/build/test:e2e.

### Phase D — UI/UX polish, unified brand color, and extension icon

Scope:
- Unify brand accent color to `#52C972` across extension sidebar and landing page.
- Apply Supabase-style neutral gray scale for backgrounds/borders.
- Apply brand accent highlights across all sidebar views and components.
- Design and ship new globe-with-arrows extension icon and LP favicon.

Changes:

**Extension theme (`src/entrypoints/shared/styles.css`)**
- Replaced default shadcn OKLCH neutrals with Supabase-style gray scale (#121212 bg, #171717 card, etc.).
- Set brand accent to `#52C972` (dark primary/ring/brand) and `#09673F` (light primary/ring).
- Added extended palette tokens: `--brand`, `--brand-dim`, `--brand-glow`, `--fg-muted`, `--fg-faint`, `--surface-raised`, `--surface-border`.

**Sidebar UI accent pass (12 component/view files)**
- `EditorView`: day picker highlights selected days with brand accent; link index badges use brand tint.
- `StepList`: current step gets brand border/bg/text; step dots color-coded by state.
- `ActiveRunnerCard`: focused state uses brand border/bg; progress bar uses brand color.
- `RunnerHomeView`: note status color-coded (brand for saved, destructive for error); focus mode box uses brand glow.
- `EmptyState`: border/bg switched to brand tint.
- `HistoryView`: date group headers use brand; completion stat card gets success variant.
- `HistoryRunDetailView`: status badges, time breakdown bars, action source badges, step note labels all use brand.
- `presentation.tsx (StatCard/RunHistoryCard)`: replaced hardcoded emerald-500 with brand; added StatCard `variant` prop.
- `SettingsFormSections`: selected radio options get brand border/bg.
- `MessageBanner`: success variant uses brand glow; error variant uses destructive tint.
- `RecoveryCard`: error title uses destructive color.

**Extension icon (`src/public/icon/`)**
- Designed new globe SVG: two arc segments forming the circumference with single outer-side barb arrowheads via SVG `<marker orient="auto">`, internal lat/long lines clipped to inner circle, tilted -15deg.
- Tightened viewBox from `0 0 128 128` to `24 24 80 80` and increased stroke widths for small-size visibility.
- Increased internal globe line opacities (0.55–0.65) for better readability at small sizes.
- Generated PNGs at 16/32/48/96/128 from the SVG source.

**Landing page (`astro-site/`)**
- Updated `global.css` accent vars from `#34d399`/`#059669` to `#52C972`/`#09673F`.
- Set `--c-accent: #52C972` in both dark and light themes for consistent green across modes.
- Replaced all `#34d399` and `rgba(52,211,153,...)` references in `hero-flow.svg`, `og-placeholder.svg`, `HeroFlow.astro`, and `Base.astro`.
- Replaced old `icon-placeholder-128.svg` favicon/logo references with new `favicon.svg` (transparent globe) in `Base.astro` and `Nav.astro`.
- Changed GitHub and theme toggle nav icons from muted to always-visible (`text-fg`).

Checklist:
- [x] Extension sidebar theme unified to `#52C972` brand accent.
- [x] Brand accent applied across all sidebar views/components.
- [x] New globe icon SVG designed with auto-oriented arrowhead markers.
- [x] Extension icon PNGs generated at all required sizes.
- [x] LP accent color updated to `#52C972` across CSS and all SVG assets.
- [x] LP accent consistent across light/dark themes.
- [x] LP favicon and nav logo replaced with new globe SVG.
- [x] LP nav icon visibility improved.
- [x] Extension and LP both build cleanly.

### Phase E — Schema consolidation, stop dialog analytics, runner polish

Scope:
- Consolidate duplicate event schemas: retire legacy `runEvents` table in favour of `runActionEvents`.
- Enhance stop confirmation dialog with useful run analytics.
- Add progress bar to focused runner section.

Changes:

**Schema consolidation (`src/lib/run-history.ts`, `src/lib/navigation.ts`, `src/entrypoints/background.ts`, `src/lib/types.ts`, `src/lib/db.ts`)**
- Removed `logRunEvent()` private function and all calls (wrote to legacy `runEvents` table).
- Removed exported `logStepChange()` function and all call sites — data already captured by `logRunNavigationAction` and `logRunStepSyncAction`.
- Updated `finalizeRun()` to derive `maxStepIndex` from `runActionEvents.toStepIndex` instead of `runEvents.stepIndex`.
- Removed `RoutineRunEventType` type and `RoutineRunEvent` interface from types.
- Removed `runEvents` table property from Dexie class (schema strings kept for migration chain).
- Simplified `logStepChangeForSession()` in background — early-returns when no sync action needed.

**Stop dialog analytics (`src/components/StopRunnerDialog.tsx`, `src/entrypoints/sidepanel/views/RunnerHomeView.tsx`, `src/entrypoints/popup/App.tsx`)**
- Added `completionPercent`, `notesCount`, `activeTimeLabel` props to `StopRunnerDialog`.
- Stop dialog now shows progress bar, completion %, tracked active time, and step notes count.
- Both sidepanel RunnerHomeView and popup App query the run record and compute analytics for the dialog.

**Focused runner progress bar (`src/entrypoints/sidepanel/views/RunnerHomeView.tsx`)**
- Added slim brand-colored progress bar below the step counter in the focused runner section.

Checklist:
- [x] Legacy `runEvents` writes removed; `finalizeRun` uses `runActionEvents`.
- [x] `logStepChange` function and all call sites removed.
- [x] Legacy types (`RoutineRunEventType`, `RoutineRunEvent`) removed.
- [x] Stop dialog shows progress bar, completion %, active time, notes count.
- [x] Focused runner section has visual progress bar.
- [x] Verification gates passed (lint/compile/test/build/test:e2e).
