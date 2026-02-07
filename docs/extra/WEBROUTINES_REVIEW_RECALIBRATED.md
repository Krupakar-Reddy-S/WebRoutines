# WebRoutines: Recalibrated Review (Hobby Project Framing)

## What changes with this framing

Most of the previous review assumed a product-launch mindset — urgency around Chrome Web Store approval, onboarding funnels, accessibility compliance, feature discipline to "ship and learn." A hobby project has different economics: you're optimizing for craft, learning, and personal utility, not conversion rates.

That said, WebRoutines is already well past typical hobby-project quality. The architecture, test infra, and documentation governance are production-grade. The question is less "what do you need to do" and more "what's worth your time given that this is for you."

---

## What still matters

### The `<all_urls>` permission — still worth fixing

Not because of store review pressure, but because it's the right architecture. Dynamic content script registration with optional permissions is cleaner engineering than a static blanket declaration. It also means the extension genuinely does less when the user doesn't need focus mode. For a hobby project, doing it the right way is its own reward, and it's a good pattern to have in your toolkit.

### The static site changes the onboarding equation entirely

If you're building a landing page + docs site, in-extension onboarding becomes redundant. The site handles "what is this" and "how do I use it." The extension just needs decent empty states (which it already has). The site is also a better place for screenshots, use-case examples, and a quick-start guide than cramming all that into a 320px sidebar.

For the site, a few things that work well for extension landing pages:

- **Hero with a single GIF/video** showing the create → run → navigate flow. 10 seconds, no audio. This communicates more than any copy.
- **3–4 feature cards** (tab groups, focus mode, lazy loading, run history) with one-line descriptions.
- **"Install" button** linking to Chrome Web Store (or a direct `.crx` download if you're not publishing to the store).
- **Docs section** — can be as simple as a single "Getting Started" page and a "Keyboard Shortcuts" reference. MDX or plain markdown rendered with something like Astro, Docusaurus, or even a single HTML page.

No need for analytics, auth, or a blog. Keep it static and fast.

### Deepening test coverage on navigation/session is still the highest-ROI engineering work

This isn't about launch readiness — it's about your own confidence when making changes. `navigation.ts` is the most complex state machine in the project, and right now the only way to verify it works is manual testing in the browser. One refactoring session to extract the state transitions into pure functions + a test suite means you can change navigation logic fearlessly. That's valuable whether you have 0 users or 10,000.

---

## What matters less now

| Previous suggestion | Why it's lower priority |
|---|---|
| In-extension onboarding flow | Static site handles this. Empty states are sufficient in-extension. |
| Chrome Web Store listing assets urgently | Can prepare these whenever you feel like publishing. No rush. |
| Privacy policy page | Still needed for store submission but can be a page on the static site when you build it. |
| CI pipeline | Solo dev with local quality gates. GitHub Actions would take 15 minutes to set up but isn't blocking anything. Do it when you feel like it. |
| Accessibility pass as a blocker | Still good practice, still worth doing, but not gating anything. Do it in a quiet afternoon. |
| Feature discipline / "stop adding features" | The whole point of a hobby project is that you can build what interests you. If command palette sounds fun, build it. If folders sound tedious, skip them. |

---

## What I'd actually suggest next

Given that it's a hobby project with a planned static site, here's what I think is the most satisfying path:

### 1. Build the static site first

This forces you to articulate what WebRoutines *is* in a way that code never does. Writing the landing page copy and docs will surface product clarity: what's the one-sentence pitch? What are the three things that make it different from "just use bookmarks"? This clarity will feed back into the extension itself (better empty states, better settings descriptions, better tooltip copy).

Tech suggestion: Astro with Tailwind. Fast, static, markdown-friendly, and you already know Tailwind. Deploy to GitHub Pages or Cloudflare Pages for free. Total build time: an afternoon.

### 2. Then do the permission refactor

Move focus controller to optional host permissions + dynamic registration. It's a satisfying engineering problem (the WXT content script entrypoint needs to change, the settings toggle gains real side effects, you need to handle the permission-denied case gracefully). It also makes the extension genuinely better — lighter by default, explicit about what it needs.

### 3. Then pick whatever interests you from the backlog

With the site live and the architecture clean, you're in a good spot to work on whatever catches your attention. Some candidates ranked by "fun to build" rather than "business value":

| Feature | Why it might be fun |
|---|---|
| **Command palette (Cmd+K)** | It's a satisfying UI pattern to implement. cmdk + shadcn makes it smooth. Lets you dogfood the extension faster. |
| **Routine duplication** | Tiny implementation, instant gratification. |
| **Import from open tabs** | Genuinely useful for your own workflow. The multi-select checklist UI is a nice component to build. |
| **Per-step skip toggle** | Small addition to the data model, interesting UX question (how to show skipped steps in the runner). |
| **Deeper test coverage** | If you enjoy writing tests, the navigation state machine is a satisfying puzzle to model. |

### 4. Publish to Chrome Web Store whenever it feels ready

No rush. The store listing can happen after the site exists (since the site URL goes in the store description). The permission refactor should happen before submission. Everything else is optional.

---

## The honest assessment

WebRoutines is unusually well-built for a hobby project. The architecture would hold up in a team setting, the quality gates are real, and the feature set is coherent. Most hobby extensions are a single `background.js` with 500 lines of spaghetti. This has module boundaries, typed settings, run history with indexed queries, and a test suite.

The static site is the right next move. It gives the project a public face, forces you to think about it from the outside in, and makes it real in a way that a local dev build never quite does. Everything after that is gravy.

---

*February 2026*
