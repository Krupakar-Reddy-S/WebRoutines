# WebRoutines Adaptive Theming Notes

## Why this note exists
This document evaluates whether WebRoutines should adapt its UI theme to the active website colors (not just light/dark), and outlines a practical implementation direction.

## Short answer
This is not a bad idea. It is technically feasible and can be a strong UX differentiator.

The main risk is not implementation complexity; it is visual instability when users switch between sites with very different palettes.

## Feasibility
In Chrome extensions, content scripts can read DOM/computed styles from the current page and send extracted values to extension UI contexts.

This means we can extract:
- page background color
- page text color
- accent color candidates (links/buttons/meta theme color)
- optional header/nav dominant color

Example approach:
```ts
function extractPageTheme() {
  const bodyStyles = getComputedStyle(document.body);
  const metaTheme = document
    .querySelector('meta[name="theme-color"]')
    ?.getAttribute('content');

  const link = document.querySelector('a');
  const header = document.querySelector('header, nav, [role="banner"]');

  return {
    bgColor: bodyStyles.backgroundColor,
    textColor: bodyStyles.color,
    accentColor: link ? getComputedStyle(link).color : null,
    primaryColor: header ? getComputedStyle(header).backgroundColor : null,
    metaTheme,
  };
}
```

## Where adaptive theming makes sense
- Focus mini-controller (content-script UI on the page): very strong fit.
- Popup (opened for a specific active tab): good fit.

## Where it can feel chaotic
- Persistent sidepanel: can change frequently while users switch tabs/domains.

## Recommended mode model
Use three theme modes in settings:

1. Static (default):
- Light / Dark / System
- Stable and predictable.

2. Adaptive accent (recommended smart mode):
- Keep stable base theme (light or dark).
- Adapt only accent variables (primary, focus ring, selected highlights) from active site.
- Gives "native to page" feeling without full recolor flicker.

3. Full chameleon (experimental):
- Full palette adaptation from page.
- Best for focus mini-controller.
- Optional/opt-in for sidepanel.

## Stability controls
- Cache extracted accent per domain in `chrome.storage.session`.
- Apply cached value immediately on revisits.
- Re-extract asynchronously to refresh stale values.
- Smooth transitions (`200-350ms`) for accent changes.
- Clamp low-contrast colors before applying (basic accessibility guardrail).

## Suggested technical shape
- Content script:
  - Extract theme tokens from active page.
  - Send tokens to background/extension contexts.
- Shared theming mapper:
  - Convert extracted colors to extension CSS variables.
  - Apply contrast and saturation bounds.
- Settings:
  - `themeMode`: `static | adaptive-accent | chameleon`
  - `staticTheme`: `light | dark | system`
  - `adaptiveEnabledIn`: `popup | mini-controller | sidepanel`

## Known constraints
- `<all_urls>` host permission impacts install trust messaging.
- Some sites have dynamic/inconsistent styles and noisy color surfaces.
- Sidepanel might appear visually unstable under aggressive full adaptation.

## Product recommendation
Phase this feature:

1. Ship adaptive accent first (popup + mini-controller target).
2. Keep sidepanel on static base theme initially.
3. Add full chameleon as an explicit experimental toggle later.

This preserves UX stability while still delivering a distinctive "blends with site" effect.

