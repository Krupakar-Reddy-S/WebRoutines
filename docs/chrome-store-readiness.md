# Chrome Store Readiness Checklist

This checklist tracks all work that should be completed before Chrome Web Store submission.

Status legend:
- `Not started`
- `In progress`
- `Done`

## 1) Permissions minimization
Status: `Not started`

- [ ] Move broad origins from `host_permissions` to optional host permissions flow.
- [ ] Implement runtime permission request/denial UX for focus mode enablement.
- [ ] Dynamically register/unregister focus content script based on granted permission.
- [ ] Add fallback behavior when permission is denied/revoked.
- [ ] Update manifest/docs/privacy wording to match final permission model.

## 2) Accessibility pass
Status: `Not started`

- [ ] Add missing `aria-label` on icon-only controls across sidepanel/popup/focus controller.
- [ ] Verify keyboard-only navigation across core flows (create, run, navigate, stop, history, settings).
- [ ] Ensure meaningful live-region updates for changing runtime status messages.
- [ ] Run contrast checks for primary status and action states in light/dark themes.
- [ ] Complete one screen-reader smoke pass on main flows and document findings.

## 3) Store listing assets and copy
Status: `Not started`

- [ ] Prepare extension icon assets per store requirements.
- [ ] Capture and curate store screenshots for core flows.
- [ ] Draft short description and detailed listing copy.
- [ ] Finalize category/tags and support links.

## 4) Privacy policy and support details
Status: `In progress`

- [x] Publish privacy page in site docs (`astro-site/src/pages/privacy.astro`).
- [ ] Replace placeholder contact email with final support contact.
- [ ] Confirm privacy text matches shipped behavior and permissions.
- [ ] Add final public support issue/contact destination.

## 5) Pre-submit verification
Status: `Not started`

Manual:
- [ ] Verify install/load in Chrome stable with fresh profile.
- [ ] Validate focus mode behavior across representative websites.
- [ ] Validate routine/session recovery behavior after tab/group mutations.

Automated/local:
- [ ] `bun run lint`
- [ ] `bun run compile`
- [ ] `bun run test`
- [ ] `bun run build`
- [ ] `bun run test:e2e`

Release checks:
- [ ] Confirm `README.md` and `docs/PRD.md` reflect current behavior.
- [ ] Confirm no placeholder text or temporary debug logs remain.
