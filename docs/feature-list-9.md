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
