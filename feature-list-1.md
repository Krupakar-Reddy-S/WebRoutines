# Feature List 1: shadcn/ui foundation + workflow upgrades

## Goal
Adopt the latest shadcn/ui-style modular component setup in this WXT extension with a basic light/dark theme, then ship:
1. Drag-and-drop link reordering in the routine editor.
2. Routine import/export JSON backup.
3. Keyboard shortcuts for previous/next routine navigation.

## Research references
- shadcn/ui install docs (current): https://ui.shadcn.com/docs/installation
- shadcn CLI options (`init --help` and `create --help`): https://ui.shadcn.com/docs/cli
- shadcn Vite setup (Tailwind v4 + alias expectations): https://ui.shadcn.com/docs/installation/vite
- shadcn dark mode docs (Vite): https://ui.shadcn.com/docs/dark-mode/vite
- WXT Tailwind integration (vite plugin via WXT config): https://wxt.dev/guide/essentials/frontend-frameworks.html#tailwind-css

## Setup decisions (from docs)
- Use Tailwind v4 with `@tailwindcss/vite` plugin configured through WXT's `vite` config callback.
- Use shadcn-style CSS variables + `dark` class strategy.
- Keep modular UI under `components/ui/*`.
- Keep theme state with a small React context provider and localStorage persistence.
- Use Bun for dependency installation and scripts.

## Checklist
- [x] Gather current official docs and configuration references.
- [x] Install and configure Tailwind v4 + shadcn base setup for WXT.
- [x] Add modular shadcn UI components and migrate sidepanel/popup UI to use them.
- [x] Add basic light/dark mode toggle and persistence.
- [ ] Add drag-and-drop link reordering in routine editor.
- [ ] Add import/export JSON backup for routines.
- [ ] Add keyboard shortcuts for previous/next routine step.
- [ ] Validate with compile/build and update docs.

## Config and integration notes
- `components.json` is configured with style `base-nova`, neutral base color, and CSS path `entrypoints/shared/styles.css`.
- WXT config now injects Tailwind via `@tailwindcss/vite` plugin for all extension entrypoints.
- Shared theme tokens and base layer are centralized in `entrypoints/shared/styles.css` and imported by sidepanel + popup main entry files.
- `ThemeProvider` applies `light`/`dark` class on `document.documentElement` and persists to localStorage key `webroutines-theme`.

## Step log
- 2026-02-06: Created `feature-list-1.md` and recorded initial references, decisions, and checklist.
- 2026-02-06: Ran user-provided shadcn create preset command in `/tmp` to capture official base-nova scaffold details for safe integration into existing WXT repo.
- 2026-02-06: Added shadcn dependencies, Tailwind v4/WXT integration, and shadcn registry config (`components.json`).
- 2026-02-06: Ran `shadcn add` for foundational UI components and migrated sidepanel/popup UI to modular shadcn components.
- 2026-02-06: Added basic light/dark theme toggle and persistence for extension pages.
