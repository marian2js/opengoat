# OpenGoat — Claude Code Guidelines

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Key Design Rules
- Primary color is emerald (#34D399 dark / #059669 light), not teal/purple/blue
- Fonts: General Sans (display), Instrument Sans (body), JetBrains Mono (code)
- Dark mode uses cold-neutral zinc base (#09090B), not warm brown
- Dashboard is action-first: stats row + 2-column action card grid, company summary compressed
- Board uses compact list view with status dots, NOT kanban cards
- Accent color used sparingly (5-10% of UI surface), not on every element
- No noise textures or grain overlays. Depth via shadow and surface contrast only.
- Action labels must be concrete and outcome-based (not vague verbs)
