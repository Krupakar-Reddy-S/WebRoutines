# Feature List 4: settings + focus mini-controller + adaptive theming MVP

## Goal
Introduce a practical settings foundation and a focus mini-controller MVP, while adding safe adaptive accent theming that feels native to the active website without causing unstable full-theme churn.

## Scope highlights
1. Settings foundation (options page + shared settings model):
- Add dedicated options page entrypoint.
- Add typed `chrome.storage.local` settings model and defaults.
- Add shared settings helpers/hooks used by extension UIs.

2. Focus mini-controller MVP (content script):
- Floating controller pill for focused runner on web pages.
- Core controls: previous, next, stop, open sidepanel.
- Right-edge vertical drag with position persistence.
- Enable/disable behavior controlled by settings + focus mode state.

3. Extension integration plumbing:
- Background message handling for controller actions.
- Reuse existing navigation/session flows to keep behavior consistent.
- Keep popup/sidepanel/controller synchronized via session state.

4. Adaptive theme MVP (safe mode first):
- Add `adaptive-accent` mode (not full chameleon).
- Extract active page color candidates in content script.
- Cache accent per-domain in session storage for smoother updates.
- Apply adaptive accent first to popup + mini-controller.
- Keep sidepanel base theme stable in MVP.

5. Permissions and fallback handling:
- Request host permissions only when needed for focus mode/controller.
- Graceful fallback to static UI if permission is denied.

## Out of scope
- Full chameleon full-palette sidepanel theming.
- Complex domain-specific color heuristics and advanced contrast engine.
- Command palette, scheduling, folders, routine history analytics.
- Cross-browser parity work and cloud sync.

## Checklist
- [x] Define Feature List 4 scope and implementation plan.
- [ ] Task 1: Add options page and shared settings model/helpers.
- [ ] Task 2: Implement focus mini-controller content script MVP.
- [ ] Task 3: Add background/controller action bridge and runtime permission flow.
- [ ] Task 4: Implement adaptive-accent extraction + domain cache for popup/controller.
- [ ] Task 5: Integrate settings controls in sidepanel/popup and finalize docs.
- [ ] Task 6: Validate with compile/build and run UX sanity pass.

## Step log
- 2026-02-06: Created `feature-list-4.md` with settings + focus mini-controller + adaptive-accent MVP scope and task checklist.
