# Feature List 7: Modularity + Data Performance Foundation

## Goal
Ship a non-breaking internal architecture and data-path upgrade in three phases:
- Phase A: implement modularity refactor and history/import performance hardening.
- Phase B: implement automated testing stack.
- Phase C: implement documentation cleanup.

## Phase split (as requested)

### Phase A (completed): Original Plan Phases 2 + 4
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

### Phase B (completed): Original Plan Phase 3
Scope:
1. Add automated unit/component/e2e tests for local development workflows.

Planned work:
- [x] Add Vitest unit test setup.
- [x] Add React Testing Library component tests.
- [x] Add Playwright extension e2e setup (persistent Chromium context).
- [x] Add deterministic extension id strategy for e2e-only builds.
- [x] Add local test scripts: `test`, `test:unit`, `test:component`, `test:e2e`, `test:watch`.
- [x] Defer CI workflow gates until publish hardening phase.

### Phase C (completed): Docs Cleanup (Original Plan Phase 1 docs item only)
Scope:
1. Update documentation to match runtime behavior.

Planned work:
- [x] Update `README.md` and `docs/PRD.md` for current behavior.
- [x] Add docs governance rule: keep `README.md` and `docs/PRD.md` in sync with behavior PRs.
- [x] Add repository `AGENTS.md` with Bun/testing/docs/modularity guardrails.

## Constraints
- Keep runtime behavior backward compatible.
- Keep legacy `same-tab` read compatibility for old session/run data only.
- Avoid destructive migrations.

## Step log
- 2026-02-07: Created Feature List 7 with requested phase order (A = 2+4, B = 3, C = docs cleanup only).
- 2026-02-07: Completed Phase A modularity extraction (focused runner resolver, shared settings sections, editor/history/focus-controller modular splits).
- 2026-02-07: Completed Phase A data-path hardening (indexed history pagination query path, Dexie v3 index update, transactional batched routine import).
- 2026-02-07: Revalidated Phase A with successful `bun run lint`, `bun run compile`, and `bun run build`.
- 2026-02-07: Started Phase B local testing setup (Vitest unit/component + Playwright e2e scaffold; CI explicitly deferred).
- 2026-02-07: Completed Phase B local test stack with passing `bun run lint`, `bun run compile`, `bun run test`, and `bun run test:e2e`.
- 2026-02-07: Completed Phase C docs cleanup (`README.md`, `docs/PRD.md`) and added `AGENTS.md` governance rules.
