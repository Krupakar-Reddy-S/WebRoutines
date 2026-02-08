# WebRoutines

WebRoutines is a Chrome MV3 extension for running daily website routines from a persistent side panel.

## Current product behavior
- Tab-group-only runtime: active sessions use `tab-group` mode (legacy `same-tab` is read-compat only for old stored records).
- One active runner per routine, with multiple routines allowed concurrently.
- Tab loading strategies:
  - `eager`: open all routine tabs at start.
  - `lazy`: open tabs as you navigate.
- Runner controls from side panel + popup:
  - Previous, next, jump to step, open current, stop.
  - Focused runner switching.
- Focus mode mini-controller on web pages (first tab of the focused runner group).
- Local run history with filters and summary stats (runs, total time, completion rate).
- Import/export JSON backups, import-from-open-tabs, and drag/drop routine editing.

## Stack
- WXT + React + TypeScript
- Bun package manager/runtime
- shadcn/ui (base-nova preset) + Tailwind CSS v4
- Dexie + IndexedDB for persistent routine/run data
- `browser.storage.session` for active runner state
- `browser.storage.local` for app settings

## Extension source layout
- Extension runtime source lives under `src/`:
  - `src/core`, `src/adapters`, `src/features`, `src/entrypoints`, `src/components`, `src/lib`
- Extension static assets are in `src/public/`.

## Local development
```bash
bun install
bun run dev
```

## Verification commands
```bash
bun run lint
bun run compile
bun run test
bun run build
```

For extension e2e:
```bash
bun run test:e2e:install
bun run test:e2e
```

## Build and load
```bash
bun run build
```

Load `.output/chrome-mv3` in `chrome://extensions` with Developer mode enabled.

## Static site
- Path: `astro-site/`
- Purpose: static landing/docs/privacy pages for project-facing documentation.
- Stack: Astro.
- Deployment: GitHub Pages via `.github/workflows/astro.yml`.

## Docs map
- `docs/PRD.md`: current product + architecture source of truth.
- `docs/feature-list-*.md`: phased implementation history/plans.
- `docs/chrome-store-readiness.md`: pre-publish checklist and status tracking for Chrome Web Store readiness.
- `docs/extra/`: optional external/reference context for AI chat and research; not authoritative runtime source of truth.
- `astro-site/`: external landing/docs surface (non-extension runtime).

## Docs governance
Behavior changes must update `README.md` and `docs/PRD.md` in the same PR.
