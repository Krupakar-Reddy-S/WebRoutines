# Feature List 7: Modularity + Data Performance Foundation

## Goal
Ship a non-breaking internal architecture and data-path upgrade in three phases:
- Phase A: implement modularity refactor and history/import performance hardening.
- Phase B: implement automated testing stack.
- Phase C: implement documentation cleanup.

## Phase split (as requested)

### Phase A (in progress): Original Plan Phases 2 + 4
Scope:
1. Modularity refactor without behavior changes.
2. History query/data access performance hardening.
3. Import batching and transactional safety improvements.

Planned work:
- [x] Extract shared focused-runner resolver used by sidepanel, popup, and background.
- [x] Extract shared settings form sections consumed by options and sidepanel settings pages.
- [x] Introduce clearer module boundaries:
  - `core/` for pure domain logic.
  - `adapters/browser/` for browser API adapters.
  - `features/*` for feature-specific query/render helpers.
- [x] Split large feature files by responsibility:
  - History view into query/filter/presentation modules.
  - Editor view into draft/dialog/drag modules.
  - Focus controller into bridge/ui/accent modules.
- [x] Replace history full-table loading with indexed and page-window queries.
- [x] Add Dexie indexes for history queries by routine/date path.
- [x] Convert routine import to batched transactional writes with progress-safe error handling.
- [x] Validate with `bun run lint`, `bun run compile`, and `bun run build`.

### Phase B (pending): Original Plan Phase 3
Scope:
1. Add automated unit/component/e2e tests and CI gates.

Planned work:
- [ ] Add Vitest unit test setup.
- [ ] Add React Testing Library component tests.
- [ ] Add Playwright extension e2e setup (persistent Chromium context).
- [ ] Add deterministic extension id strategy for e2e-only builds.
- [ ] Add CI workflow gates: lint, compile, test:unit, test:component, build, test:e2e.

### Phase C (pending): Docs Cleanup (Original Plan Phase 1 docs item only)
Scope:
1. Update documentation to match runtime behavior.

Planned work:
- [ ] Update `README.md` and `docs/PRD.md` for current behavior.
- [ ] Add docs governance rule: keep `README.md` and `docs/PRD.md` in sync with behavior PRs.

## Constraints
- Keep runtime behavior backward compatible.
- Keep legacy `same-tab` read compatibility for old session/run data only.
- Avoid destructive migrations.

## Step log
- 2026-02-07: Created Feature List 7 with requested phase order (A = 2+4, B = 3, C = docs cleanup only).
- 2026-02-07: Completed Phase A modularity extraction (focused runner resolver, shared settings sections, editor/history/focus-controller modular splits).
- 2026-02-07: Completed Phase A data-path hardening (indexed history pagination query path, Dexie v3 index update, transactional batched routine import).
- 2026-02-07: Revalidated Phase A with successful `bun run lint`, `bun run compile`, and `bun run build`.
