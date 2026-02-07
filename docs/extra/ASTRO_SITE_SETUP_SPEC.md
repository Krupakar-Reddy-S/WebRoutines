# WebRoutines Static Site — Astro + GitHub Pages Setup Spec

> **Purpose**: This document provides everything needed to scaffold an Astro static site inside the existing WebRoutines Chrome extension repository. It should live in a `/site` subdirectory with its own `package.json` and deploy to GitHub Pages via GitHub Actions.
>
> **Target implementer**: Claude Code (or manual setup). Create a new branch `feat/static-site` from `main` and implement everything described below.

---

## 1. Architecture Overview

```
WebRoutines/                     ← existing extension repo root
├── .github/
│   └── workflows/
│       └── deploy-site.yml      ← NEW: GitHub Actions workflow
├── site/                        ← NEW: Astro project root
│   ├── astro.config.mjs
│   ├── package.json
│   ├── tsconfig.json
│   ├── public/
│   │   ├── favicon.svg
│   │   └── og-image.svg
│   └── src/
│       ├── layouts/
│       │   └── Base.astro       ← shared HTML shell + nav + footer
│       ├── components/
│       │   ├── Nav.astro
│       │   ├── Footer.astro
│       │   └── FeatureCard.astro
│       ├── pages/
│       │   ├── index.astro      ← landing page
│       │   ├── privacy.astro    ← privacy policy
│       │   └── docs/
│       │       └── index.astro  ← docs page (sidebar + sections)
│       └── styles/
│           └── global.css       ← @font-face imports, custom props, base resets
├── src/                         ← existing extension source (unchanged)
├── package.json                 ← existing extension package.json (unchanged)
├── bun.lockb                    ← existing extension lockfile (unchanged)
└── ...
```

**Key principle**: The `/site` directory is a completely independent Astro project. It has its own `package.json`, its own `bun.lockb`, and its own build pipeline. The extension's root `package.json` is untouched.

---

## 2. Initialize the Astro Project

```bash
# From repo root
cd site
bun create astro@latest . -- --template minimal --no-install --no-git
bun install
bun add @astrojs/tailwind tailwindcss
```

Or manually create the files as specified below. Either way, the result should be the structure in section 1.

---

## 3. Astro Configuration

### `site/astro.config.mjs`

```js
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  // IMPORTANT: Update these two values before deploying.
  //
  // If deploying to https://<username>.github.io/<repo-name>/:
  //   site: 'https://<username>.github.io'
  //   base: '/<repo-name>'
  //
  // If deploying to https://<username>.github.io/ (user/org site):
  //   site: 'https://<username>.github.io'
  //   base: '/'          ← or omit entirely
  //
  // If using a custom domain:
  //   site: 'https://webroutines.dev'
  //   base: '/'          ← or omit entirely
  //
  site: 'https://OWNER.github.io',
  base: '/WebRoutines',

  integrations: [tailwind()],

  build: {
    assets: 'assets',       // avoids underscore prefix (GitHub Pages ignores _* dirs)
  },
});
```

> **Note on `base`**: All internal links in Astro components should NOT manually prepend the base. Astro handles it automatically when you use `<a href="/docs/">` in `.astro` files — it rewrites to `/WebRoutines/docs/` at build time. However, `href` values in JavaScript/JSON need manual handling if applicable.

### `site/tsconfig.json`

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### `site/package.json`

```json
{
  "name": "webroutines-site",
  "type": "module",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check"
  },
  "dependencies": {
    "astro": "^5.x",
    "@astrojs/tailwind": "^6.x",
    "tailwindcss": "^4.x"
  }
}
```

> **Important**: Check the latest compatible versions of `astro`, `@astrojs/tailwind`, and `tailwindcss` at install time. The versions above are indicative — `bun create astro` will pull the correct latest.

### `site/tailwind.config.mjs`

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#111113',
          raised: '#1a1a1d',
          border: '#2a2a2e',
        },
        accent: {
          DEFAULT: '#34d399',
          dim: '#059669',
          glow: 'rgba(52,211,153,0.08)',
        },
        fg: {
          DEFAULT: '#ededef',
          muted: '#8b8b8e',
          faint: '#5a5a5d',
        },
        base: '#050506',
      },
    },
  },
  plugins: [],
};
```

> **Tailwind v4 note**: If using Tailwind v4 (which is CSS-first config), the config approach changes. Check the `@astrojs/tailwind` integration docs at install time. If v4, define the design tokens in `src/styles/global.css` using `@theme` instead of `tailwind.config.mjs`. The color values and font families stay the same.

---

## 4. Design System

### Fonts (Google Fonts via `<link>` in Base layout)

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=DM+Sans:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

### Color Palette

| Token          | Value                       | Usage                              |
|--------------- |---------------------------- |----------------------------------- |
| `base`         | `#050506`                   | Page background                    |
| `surface`      | `#111113`                   | Cards, panels                      |
| `surface-raised` | `#1a1a1d`                | Code blocks, elevated elements     |
| `surface-border` | `#2a2a2e`                | All borders                        |
| `fg`           | `#ededef`                   | Primary text                       |
| `fg-muted`     | `#8b8b8e`                   | Secondary text, descriptions       |
| `fg-faint`     | `#5a5a5d`                   | Tertiary text, timestamps          |
| `accent`       | `#34d399` (emerald-400)     | Links, highlights, active states   |
| `accent-dim`   | `#059669`                   | Hover states, borders              |

### Typography Scale

- **Page titles**: `font-display text-4xl font-700` (landing) / `text-2xl font-700` (docs sections)
- **Section labels**: `text-xs font-mono uppercase tracking-[0.15em] text-accent`
- **Body text**: `font-body text-sm text-fg-muted leading-relaxed`
- **Code inline**: `font-mono text-xs bg-surface-raised px-1.5 py-0.5 rounded`
- **Nav links**: `text-sm text-fg-muted hover:text-fg`

---

## 5. Page Content & Structure

### 5a. Landing Page (`site/src/pages/index.astro`)

**Constraint**: Must fit in one viewport — no scroll. Use `h-screen overflow-hidden` on the root container.

**Layout (top to bottom, flex column)**:
1. **Nav bar** — logo + icon, links to Docs / Privacy / GitHub
2. **Hero section** (centered, flex-1 to fill space):
   - Pill badge: `Local-first · Chrome MV3`
   - H1: `Build a routine once.` / `Run it daily in seconds.` (second line in accent color)
   - Subtitle: ~1 sentence describing what WebRoutines does
   - Two CTAs: `Install — coming soon` (disabled button) + `Read the docs →` (link to /docs)
3. **Feature cards** — 4 cards in a row (`grid-cols-4` on lg, `grid-cols-2` on sm):
   - **Tab-group runners**: "Each routine runs in its own Chrome tab group. Multiple routines can run at once."
   - **Eager or lazy loading**: "Open all tabs at once, or load them one at a time as you navigate forward."
   - **Focus controller**: "Compact prev/next controls float on any page while you're in a routine."
   - **Run history**: "Track every run with duration, completion rate, and per-routine stats."
4. **Footer** — copyright + "All data stays in your browser"

**Animations**: Staggered fade-up on hero elements (CSS keyframes, no JS needed). Feature cards get a hover border-color transition to accent.

### 5b. Docs Page (`site/src/pages/docs/index.astro`)

**Layout**: Sidebar (fixed left, 260px) + scrollable content area. Sidebar sticky on desktop, floating button + overlay on mobile.

**Sidebar sections** (these are anchor links to sections in the content area):
1. Getting started
2. Routines
3. Runners
4. Tab loading modes
5. Focus mode
6. Run history
7. Settings
8. Keyboard shortcuts
9. Import & export
10. Data & storage

**Sidebar behavior**:
- Active section highlighted (emerald background) based on scroll position
- Click scrolls smoothly to section
- Mobile: hamburger FAB bottom-right opens fullscreen overlay nav

**Content for each section** (summarized — see the reference HTML files for full prose):

1. **Getting started**: What WebRoutines is, 5-step install from source (clone → bun install → bun run build → chrome://extensions dev mode → load unpacked .output/chrome-mv3 → pin + open side panel). Note about `bun run dev` for development.

2. **Routines**: Ordered list of URLs as a repeatable workflow. Creating (side panel → + button → name + URLs), editing (expand card → drag reorder → overflow menu per link → full editor). URL normalization note. Favicon strip preview on cards.

3. **Runners**: Active routine session = runner. Tab group created, controls: prev/next/jump/stop. Multiple runners at once, one focused at a time. Session resilience (tab closed → session updates, all tabs closed → runner stops).

4. **Tab loading modes**: Eager (default, all tabs at start) vs Lazy (first tab only, subsequent on navigate, persist once loaded). Side-by-side comparison cards.

5. **Focus mode**: Floating pill controller on web pages. Features: prev/next, return to side panel, vertical drag repositioning, page-adaptive accent color. Shadow DOM injection. Enable/disable from settings.

6. **Run history**: Every run tracked (start time, duration, steps completed, completion status, stop reason). History view with stats cards (total runs, total time, completion rate). Filter by routine.

7. **Settings**: Theme (system/light/dark), tab loading (eager/lazy), confirm before stopping (on/off), focus mode (on/off). Each as a card with setting name, accepted values, and description.

8. **Keyboard shortcuts**: Table with Action / Shortcut / Behavior columns. Previous step: `Alt+Shift+←`. Next step: `Alt+Shift+→`. Customizable via `chrome://extensions/shortcuts`.

9. **Import & export**: Per-routine export (JSON with name, links, metadata). Global import from Routines view. Duplicate detection.

10. **Data & storage**: Local-first. Three storage layers: IndexedDB/Dexie (routines, run history — persistent), session storage (active runners — ephemeral), local storage (settings — persistent). Uninstall warning.

### 5c. Privacy Page (`site/src/pages/privacy.astro`)

**Layout**: Single centered column (max-w-3xl), scrollable.

**Sections**:
1. **Header**: Lock icon + "Privacy Policy" + "Last updated February 2026"
2. **TL;DR callout** (accent-bordered card): "All data stays local. No servers, no accounts, no analytics, no tracking."
3. **What data is stored**: 4 cards — routine definitions (IndexedDB), run history (IndexedDB), settings (Chrome local storage), session state (session storage, clears on browser close)
4. **What WebRoutines does not do**: List with ✕ markers — no external transmission, no analytics/telemetry, no accounts, no page content reading, no ads
5. **Permissions and why**: Table — `storage`, `sidePanel`, `tabGroups`, `unlimitedStorage`, `host permissions` (for focus mode only)
6. **Data lifecycle**: 3 cards — "You create it" / "You control it" / "You remove it"
7. **This website**: Static site on GitHub Pages, no cookies, no analytics, only Google Fonts + Tailwind CSS CDN as external loads
8. **Contact**: Placeholder email `[your-email@example.com]` and link to repo issues
9. **Policy updates**: Versioned with repo, changes tracked in same commit

---

## 6. Shared Components

### `Base.astro` (layout)

```astro
---
interface Props {
  title: string;
  description?: string;
  ogImage?: string;
}

const { title, description = 'WebRoutines — run your daily browsing on autopilot.', ogImage = '/og-image.svg' } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <meta property="og:image" content={ogImage} />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=DM+Sans:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  </head>
  <body class="bg-base font-body text-fg antialiased">
    <slot />
  </body>
</html>
```

### `Nav.astro`

Props: `activePage: 'home' | 'docs' | 'privacy'`

Renders the shared nav bar. Active page gets `text-accent bg-accent/8`, others get `text-fg-muted hover:text-fg hover:bg-surface`.

### `Footer.astro`

Simple centered footer: `© 2026 WebRoutines · All data stays in your browser`

### `FeatureCard.astro`

Props: `title: string`, `description: string`, `icon: string` (SVG path or slot)

Renders a single feature card with icon container, title, and description.

---

## 7. Static Assets

### `site/public/favicon.svg`

The refresh-arrow loop icon (emerald on dark rounded rect). See the `icon-placeholder-128.svg` from the reference files.

### `site/public/og-image.svg`

1200×630 OG image with the WebRoutines logo, tagline, and feature tags. See `og-placeholder.svg` from the reference files.

---

## 8. GitHub Actions Workflow

### `.github/workflows/deploy-site.yml`

```yaml
name: Deploy Site to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'site/**'
      - '.github/workflows/deploy-site.yml'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

# Only allow one deployment at a time
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install, build, and upload site
        uses: withastro/action@v5
        with:
          path: ./site
          package-manager: bun@latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**Key details**:
- `path: ./site` tells the action where the Astro project lives
- `package-manager: bun@latest` ensures bun is used (auto-detected from `bun.lockb` anyway, but explicit is safer)
- `paths` filter: only triggers on changes to `site/` or the workflow file itself — extension code changes don't redeploy the site
- **GitHub repo setting required**: Go to Settings → Pages → Source → select "GitHub Actions"

---

## 9. GitHub Pages Setup (Manual Steps)

After the workflow file is merged to `main`:

1. Go to the GitHub repo → **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions** (not "Deploy from a branch")
3. Push a change to `site/` on `main` to trigger the first deployment
4. The site will be available at `https://<username>.github.io/WebRoutines/`

### Custom Domain (Optional, Later)

1. Add a `site/public/CNAME` file containing the domain (e.g., `webroutines.dev`)
2. Update `astro.config.mjs`: set `site: 'https://webroutines.dev'` and remove `base` (or set to `/`)
3. Configure DNS with your domain provider (CNAME record pointing to `<username>.github.io`)

---

## 10. Local Development

```bash
cd site
bun install        # first time only
bun run dev        # starts dev server at http://localhost:4321
bun run build      # production build to site/dist/
bun run preview    # preview production build locally
```

The extension development (`bun run dev` from repo root) and site development (`bun run dev` from `site/`) are completely independent and don't interfere with each other.

---

## 11. .gitignore Addition

Add to the repo root `.gitignore` (or create `site/.gitignore`):

```
# Astro site
site/node_modules/
site/dist/
site/.astro/
```

---

## 12. Reference HTML Files

The content, structure, and design for all three pages has been prototyped as static HTML files. These should be used as the source of truth for:

- Exact copy and section structure
- Visual design (colors, spacing, typography)
- Component breakdown

The reference files are:
- `index.html` → landing page
- `docs/index.html` → docs page
- `privacy.html` → privacy policy

These are available in the project files or can be downloaded from the Claude conversation outputs. Convert the HTML into Astro components, extracting shared elements (nav, footer, design tokens) into the layout and component files.

---

## 13. Implementation Checklist

```
Branch: feat/static-site (from main)

Setup:
  [ ] Create site/ directory
  [ ] Initialize Astro project with bun
  [ ] Install @astrojs/tailwind
  [ ] Configure astro.config.mjs (site, base, integrations)
  [ ] Configure tailwind (colors, fonts)
  [ ] Add Google Fonts links to Base layout

Pages:
  [ ] Create Base.astro layout (head, fonts, meta)
  [ ] Create Nav.astro component (shared nav with active state)
  [ ] Create Footer.astro component
  [ ] Create index.astro (landing — single viewport, no scroll)
  [ ] Create docs/index.astro (sidebar + 10 sections + scroll tracking)
  [ ] Create privacy.astro (single column, all sections)

Assets:
  [ ] Add favicon.svg to public/
  [ ] Add og-image.svg to public/

Deployment:
  [ ] Create .github/workflows/deploy-site.yml
  [ ] Add site/ entries to .gitignore
  [ ] Verify bun run build succeeds locally
  [ ] Verify bun run preview renders correctly

Post-merge:
  [ ] Enable GitHub Pages → Source → GitHub Actions in repo settings
  [ ] Trigger first deployment
  [ ] Verify live site at https://<username>.github.io/WebRoutines/
  [ ] Update astro.config.mjs site/base values if repo name differs
```

---

## 14. Notes for Claude Code

- **Do NOT modify** anything outside of `site/` and `.github/workflows/deploy-site.yml`. The extension codebase is untouched.
- **Branch**: Create and work on `feat/static-site`. Do not push to `main` directly.
- **Bun**: The extension already uses bun. The site also uses bun. They have separate `node_modules` and lockfiles.
- **Tailwind version**: Check what `@astrojs/tailwind` currently supports. If it requires Tailwind v3, use v3 config format. If it supports v4, use CSS-first config. The design tokens (colors, fonts) are the same either way.
- **Testing**: Run `cd site && bun run build` to verify. Then `bun run preview` and check all three pages in browser.
- **Content accuracy**: The docs page content describes the extension as it exists post–Feature List 7. All features mentioned (tab groups, eager/lazy loading, focus mode, run history, import/export) are implemented.
