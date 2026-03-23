# OpenGoat — Claude Code Guidelines

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Key Design Rules
- Primary color is teal, not purple/blue/amber
- Fonts: Satoshi (display), DM Sans (body), JetBrains Mono (code)
- Dark mode uses warm undertones (#141210), not cold blue-black
- Dashboard is action-first: stats + action cards hero, company summary compressed
- Board uses compact list view with status dots, NOT kanban cards
- Action labels must be concrete and outcome-based (not vague verbs)
