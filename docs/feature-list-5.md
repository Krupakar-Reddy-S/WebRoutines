# Feature List 5: sidepanel decomposition + runner resilience + run history foundation

## Goal
Ship Tier 1 reliability and foundation work: break up the sidepanel App into view components, harden runner session tracking against tab changes, and prepare for run-history data capture (data only, no UI yet).

## Scope highlights
Phase A (cleanup + resilience):
1. Sidepanel decomposition into view components, shared UI pieces, and error boundary recovery.
2. Runner lifecycle listeners for tab close and tab reorder.
3. Popup elapsed time using shared time formatting utilities.
4. HashRouter-based sidepanel routing for future view expansion.

Phase B (run history foundation):
1. Add runs + runEvents Dexie tables.
2. Start/stop + step switch logging.
3. lastRunAt routine field and “recently run” ordering.

## Out of scope
- Any run history UI or stats dashboards.
- HashRouter migration or new sidepanel routes.
- Command palette, folders, templates, sharing, scheduling.

## Checklist
Phase A:
- [x] Split sidepanel App into views and shared components.
- [x] Add error boundary + recovery card.
- [x] Add shared DOM/time helpers.
- [x] Add tab close and tab reorder session sync.
- [x] Add popup elapsed time display.
- [x] Add HashRouter routing for sidepanel views.

Phase B:
- [x] Add runs + runEvents tables and types.
- [x] Log run start/stop + step switches.
- [x] Add lastRunAt and recency ordering.

## Step log
- 2026-02-06: Created Feature List 5 with Phase A/Phase B scope split.
- 2026-02-06: Implemented Phase A sidepanel decomposition, error boundary, shared helpers, tab lifecycle listeners, and popup elapsed time.
- 2026-02-06: Added HashRouter routing for sidepanel views.
- 2026-02-06: Implemented Phase B run history tables, run logging, and lastRunAt ordering.
