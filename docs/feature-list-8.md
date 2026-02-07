# Feature List 8: Static Landing + Docs Site

## Goal
Ship a plain static website foundation in `/site` for landing and docs content, with no additional build system and no runtime extension changes.

## Scope
1. Add GitHub Pages-ready static files under `site/`.
2. Add landing page, docs page (including shortcuts reference), and privacy page using self-contained HTML.
3. Add placeholder media assets for hero/icon/OG usage.
4. Update repository docs to reference the static site surface.

## Out of scope
- Astro/Next.js/Docusaurus adoption.
- GitHub Actions or other deploy automation.
- Chrome Web Store listing changes.
- Extension runtime/permission/data-model changes.

## Constraints
- Use Tailwind via CDN script in each page.
- Use relative links only across site pages.
- Keep site framework-free and build-free.
- Keep install CTA as disabled placeholder for now.
- Deployment setup is intentionally deferred in this phase.

## Checklist
- [x] Create `site/index.html` landing page with hero, feature cards, docs CTA, and disabled install CTA.
- [x] Create docs page:
  - [x] `site/docs/index.html` (includes getting started + keyboard shortcuts section).
- [x] Create `site/privacy.html` privacy one-pager.
- [x] Create placeholder assets:
  - [x] `site/assets/hero-placeholder.svg`
  - [x] `site/assets/icon-placeholder-128.svg`
  - [x] `site/assets/og-placeholder.svg`
- [x] Update `README.md` with static site section and deploy deferral note.
- [x] Update `docs/PRD.md` with external docs/landing surface note and no-runtime-change clarification.
- [x] Run verification gates: `bun run lint`, `bun run compile`, `bun run test`, `bun run build`.

## Acceptance criteria
1. `/site` exists with landing, docs (with shortcuts coverage), and privacy pages.
2. All pages are plain HTML using Tailwind CDN only.
3. Placeholder assets load from `site/assets`.
4. Site navigation links are relative and consistent.
5. Install CTA is present and disabled as a placeholder.
6. `README.md` and `docs/PRD.md` reflect the static site surface.
7. Required Bun verification gates pass.

## Step log
- 2026-02-07: Created Feature 8 plan doc and scoped static site to plain HTML/CSS with Tailwind CDN.
- 2026-02-07: Added `/site` landing, docs, shortcuts, changelog, privacy pages and placeholder SVG assets.
- 2026-02-07: Updated `README.md` and `docs/PRD.md` to document the static site surface with deployment intentionally deferred.
- 2026-02-07: Ran verification gates (`lint`, `compile`, `test`, `build`) for phase completion.
- 2026-02-07: Revised site structure: merged shortcuts into `site/docs/index.html`, removed standalone changelog/shortcuts pages, and switched layouts to full-width/full-height wrappers.
- 2026-02-07: Upgraded docs page to a sidebar-driven static docs experience with richer sections (routine/runner/settings/shortcuts/local-first) and single-section switching (selected section only).
- 2026-02-07: Refined landing layout for cleaner visual hierarchy and expanded privacy page into structured policy sections (data inventory, lifecycle, permissions rationale, update policy).
