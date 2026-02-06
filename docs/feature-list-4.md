# Feature List 4: settings + focus mini-controller + theme split

## Goal
Introduce a practical settings foundation and a focus mini-controller MVP with stable theming: static extension theme for sidebar/popup and adaptive styling for the mini controller only.

## Scope highlights
1. Settings foundation (options page + shared settings model):
- Add dedicated options page entrypoint.
- Add typed `chrome.storage.local` settings model and defaults.
- Add shared settings helpers/hooks used by extension UIs.

2. Focus mini-controller MVP (content script):
- Floating controller pill for focused runner on web pages.
- Core controls: previous, next, open sidebar.
- Right-edge vertical drag with position persistence.
- Enable/disable behavior controlled by settings + focus mode state.

3. Extension integration plumbing:
- Background message handling for controller actions.
- Reuse existing navigation/session flows to keep behavior consistent.
- Keep popup/sidepanel/controller synchronized via session state.

4. Theme behavior split:
- Sidebar and popup stay on static extension theme (`system`, `light`, `dark`).
- Mini controller uses page-adaptive accent style independently.
- Remove adaptive-accent mode from extension-wide settings to reduce complexity and confusion.

5. UX hardening and reliability:
- Move settings access into sidepanel flow.
- Remove duplicate theme toggle controls outside settings.
- Harden controller behavior where storage access can fail in content-script context.
- Add sidepanel open fallback path for controller "Sidebar" action.

## Out of scope
- Full adaptive/chameleon theming for sidebar/popup.
- Complex domain-specific color heuristics and advanced contrast engine.
- Command palette, scheduling, folders, routine history analytics.
- Cross-browser parity work and cloud sync.

## Checklist
- [x] Define Feature List 4 scope and implementation plan.
- [x] Task 1: Add options page and shared settings model/helpers.
- [x] Task 2: Implement focus mini-controller content script MVP.
- [x] Task 3: Add background/controller action bridge and runtime permission flow.
- [x] Task 4: Implement adaptive-accent extraction + domain cache for popup/controller.
- [x] Task 5: Integrate settings controls in sidepanel/popup and finalize docs.
- [x] Task 6: Validate with compile/build and run UX sanity pass.
- [x] Task 7: Apply post-implementation UX/stability fixes from testing feedback.

## Step log
- 2026-02-06: Created `feature-list-4.md` with settings + focus mini-controller scope and task checklist.
- 2026-02-06: Added settings foundation (`lib/settings.ts`, `lib/use-settings.ts`) and new options page entrypoint under `entrypoints/options/*`.
- 2026-02-06: Added focus mini-controller content script (`entrypoints/focus-controller.content.ts`) with drag position persistence and runner controls.
- 2026-02-06: Added background runtime message bridge for controller actions and focus-mode state helpers in session storage.
- 2026-02-06: Added adaptive-accent cache/utilities (`lib/adaptive-accent.ts`) and mini-controller adaptive accent application.
- 2026-02-06: Integrated settings-driven behavior into sidepanel/popup (confirm-before-stop, settings access, default run mode emphasis, focus-mode entry flow).
- 2026-02-06: Simplified theming model to static extension theme + mini-controller-only adaptive styling.
- 2026-02-06: Fixed controller reliability issues in restricted contexts (`browser.storage` fallback handling, bridge response hardening, sidebar-open fallback).
- 2026-02-06: Validated Feature 4 implementation with successful `bun run compile` and `bun run build`.
