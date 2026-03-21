---
id: 0020-polish-insights-card-hover-and-interactivity
title: "Insight cards have no hover state — feel static compared to interactive action cards"
parent: null
deps: []
split: false
depth: 0
planned: true
executed: true
---

## Problem

The action cards above have clear interactive affordances: border color transitions on hover (`hover:border-primary/40`), background transitions (`hover:bg-accent/40`), cursor pointer, title color change, and icon badge fill. The insight/opportunity cards below have none of these. They sit as static-looking containers. The action link inside (`text-[11px]`) has a hover state, but the card itself does not. This makes the Insights section feel inert and less polished compared to the action cards section above.

## Current state

Screenshot: `.project/initiatives/v2-skills-integration/dogfood-output/screenshots/019-suggested-insights-scrolled.png`

Insight cards are styled as `rounded-lg border border-border/50 bg-card/60 px-4 py-3` with no hover transitions. Hovering over them produces no visual change except on the small action link.

## Design score

- **States & Feedback**: 6/10 — no hover state on insight cards, feels static
- **Visual Hierarchy**: 6/10 — action link is too small and low-contrast, buried at bottom

## What good looks like

Insight cards should feel clickable/interactive:
- Add subtle hover transition: `hover:border-primary/30 hover:bg-card/80 transition-all duration-150 cursor-pointer`
- Make the entire card clickable (triggers the related action), not just the tiny link at the bottom
- Increase action link font size from `text-[11px]` to `text-xs` for better readability

## Implementation guidance

In `apps/desktop/src/features/dashboard/components/OpportunityCard.tsx`:
1. Line 23 — Add hover styles to the card container: change `border border-border/50 bg-card/60` to `border border-border/50 bg-card/60 transition-all duration-150 hover:border-primary/30 hover:bg-card/80 cursor-pointer group/insight`
2. Make the card itself clickable by wrapping in a click handler or using the action link's click for the whole card
3. Line 51 — Change action link from `text-[11px]` to `text-xs` for the primary action link

## Acceptance criteria

- [x] Hovering over an insight card produces a visible border and/or background change
- [x] The card feels interactive and clickable, consistent with action cards above
- [x] Action link text is at least `text-xs` (12px) for readability
- [x] Transitions are smooth (150ms duration)
- [x] Works in both light and dark modes

## Handoff

### What was done
- Added hover styles to OpportunityCard container: `hover:border-primary/30 hover:bg-card/80 transition-all duration-150 cursor-pointer group/insight`
- Made the entire card clickable with an `onClick` handler that delegates to the related action (run or view results)
- Added `group-hover/insight:text-primary` on the title for coordinated hover color transition matching ActionCardItem pattern
- Changed action link font size from `text-[11px]` to `text-xs` on both "View results" and action link buttons
- Added `role="button"`, `tabIndex={0}`, and `onKeyDown` handler for accessibility (resolved react-doctor warnings)
- Added `stopPropagation` on inner action buttons to prevent double-firing with card click

### Tests written
- `opportunity-card-hover.test.ts` — 7 unit tests covering: hover border transition, hover background transition, cursor-pointer, transition duration, text-xs (no text-[11px]), card onClick handler, group/insight class

### Deviations from plan
- Added accessibility attributes (`role="button"`, `tabIndex={0}`, `onKeyDown`) not in the original plan — needed to pass react-doctor lint (100/100)
- Added `group-hover/insight:text-primary` on the title for better hover coordination matching action card patterns

### Concerns
None

### Files changed
- `apps/desktop/src/features/dashboard/components/OpportunityCard.tsx` — main implementation
- `apps/desktop/src/features/dashboard/components/opportunity-card-hover.test.ts` — new test file
- `.project/initiatives/v2-skills-integration/tasks/0020-polish-insights-card-hover-and-interactivity.md` — task file
