# AGENTS.md - WebRoutines Working Rules

This file defines project-specific rules for AI agents and contributors working in this repository.

## 1) Tooling and commands
- Use Bun for package management and scripts.
- Do not mix package managers (`npm`, `pnpm`, `yarn`) in this repo.
- Standard commands:
  - `bun install`
  - `bun run dev`
  - `bun run lint`
  - `bun run compile`
  - `bun run test`
  - `bun run build`
  - `bun run test:e2e` (when e2e coverage is relevant)

## 2) Phase workflow (feature-list driven)
When implementing a phase from `docs/feature-list-*.md`:
1. Update or create the feature-list file with explicit phase scope/checklist.
2. Implement the phase.
3. Run verification gates before commit:
   - `bun run lint`
   - `bun run compile`
   - `bun run test`
   - `bun run build`
4. If phase includes extension runtime or navigation flow changes, also run:
   - `bun run test:e2e` (after `bun run test:e2e:install` if needed)
5. Commit only after required gates pass.

## 3) Repo modularity conventions
- Keep pure domain logic in `core/`.
- Keep browser/runtime wrappers in `adapters/browser/`.
- Keep feature-specific query/model/presentation logic in `features/*`.
- Keep runtime entry surfaces in `entrypoints/*`.
- Use `lib/` for shared runtime utilities and storage/data helpers.
- Prefer extraction over file growth: split large view files by responsibility.

## 4) Testing conventions
- Unit tests: `tests/unit/**` for pure logic.
- Component tests: `tests/component/**` with React Testing Library + jsdom.
- E2E tests: `tests/e2e/**` with Playwright loading `.output/chrome-mv3`.
- Keep tests deterministic and local-data driven.
- Avoid network dependency in tests unless explicitly required.

## 5) Documentation maintenance
- `README.md` + `docs/PRD.md` are source-of-truth docs for current behavior.
- Any runtime behavior change must update both in the same PR.
- `docs/feature-list-*.md` tracks phased implementation and execution logs.
- `docs/extra/` is for external context/research and AI chat support.
  - Purpose: provide background/context without requiring full repo ingestion.
  - Constraint: do not treat `docs/extra/` as authoritative runtime spec.

## 6) Commit and quality policy
- No phase-level commit before verification gates pass.
- Keep commits scoped by phase.
- Include concise commit messages that reference phase and intent.
