# Design System — OpenGoat

## Product Context
- **What this is:** A desktop platform for building hierarchical organizations of AI agents that coordinate work across multiple tools (Claude Code, Codex, Cursor, GitHub Copilot CLI, Lovable, and more).
- **Who it's for:** Developers and technical operators who orchestrate AI agents across codebases and tools.
- **Space/industry:** AI agent orchestration / developer tools. Peers: CrewAI, AutoGen Studio, LangGraph Studio, Linear (as a UX benchmark).
- **Project type:** Desktop app (Tauri) with sidebar-first layout, task boards, chat interface, and knowledge management.

## Aesthetic Direction
- **Direction:** Signal Black
- **Decoration level:** Minimal. No noise textures, no grain overlays. Depth via subtle shadow and stark surface elevation only. Every visual element earns its place.
- **Mood:** Precision instrument, not SaaS dashboard. The feeling of opening a well-made tool where everything is in its place. Confident, sharp, focused. Irreverent name, serious function.
- **Reference sites:** Linear (discipline, density, monochrome base), Raycast (dark-first, premium restraint), Vercel (typography, clean surfaces)

## Typography
- **Display/Hero:** General Sans (700, 800) — Geometric sans with warmth and personality. Available from Fontshare. The personality that Satoshi was supposed to bring, actually loaded and rendered.
- **Body:** Instrument Sans (400, 500, 600, 700) — Pristine at small sizes, excellent x-height, modern. Clean without being sterile.
- **UI/Labels:** Instrument Sans (500, 600) — Same as body for consistency.
- **Data/Tables:** Instrument Sans with `font-feature-settings: "tnum" 1` — Tabular figures for aligned numbers.
- **Code:** JetBrains Mono (400, 500, 600) — Developer tool standard. Used for code blocks, agent configs, status labels, and monospace metadata captions.
- **Loading:** General Sans from Fontshare CDN (`api.fontshare.com`), Instrument Sans and JetBrains Mono from Google Fonts (`fonts.googleapis.com`).
- **Scale:**
  - 48px / 800 — Page hero (rare, dashboard welcome only). General Sans, letter-spacing: -0.03em.
  - 32px / 700 — Section hero. General Sans, letter-spacing: -0.02em.
  - 22px / 700 — Section title. General Sans, letter-spacing: -0.01em.
  - 18px / 600 — Subsection heading. Instrument Sans.
  - 15px / 500 — Body text (primary reading size). Instrument Sans.
  - 13px / 400-500 — Secondary text, descriptions, UI labels. Instrument Sans.
  - 11px / 500-600 — Monospace captions, badges, metadata (uppercase + tracking). JetBrains Mono.
  - 10px / 600 — Section labels (mono, uppercase, 0.1em tracking, accent color). JetBrains Mono.

## Color
- **Approach:** Restrained with electric accent. Nearly monochrome base. Color is rare and meaningful — the emerald accent creates focal points, not ambient glow. Use accent on only 5-10% of the UI surface.
- **Primary (light):** `#059669` (emerald-600) — Deep, saturated emerald. Reads clearly on white/light surfaces.
- **Primary (dark):** `#34D399` (emerald-400) — Electric emerald. Pops on near-black. Vivid without being neon.
- **Primary hover (light):** `#047857` (emerald-700)
- **Primary hover (dark):** `#6EE7B7` (emerald-300)
- **Primary subtle (light):** `rgba(5, 150, 105, 0.08)` — Ghost backgrounds for badges, highlights.
- **Primary subtle (dark):** `rgba(52, 211, 153, 0.08)` — Transparent overlay for dark mode.
- **Neutrals:** Cold-neutral zinc scale. NOT warm-tinted. Clean and precise.
  - Light: `#FAFAFA` (bg) → `#F4F4F5` (sidebar/sunken) → `#FFFFFF` (elevated) → `#E4E4E7` (hover) → `#D4D4D8` (border) → `#09090B` (fg)
  - Dark: `#09090B` (bg) → `#0F0F11` (sidebar) → `#18181B` (elevated) → `#27272A` (hover) → `rgba(255,255,255,0.06)` (border) → `#FAFAFA` (fg)
- **Text hierarchy (dark):** `#FAFAFA` (primary) → `#A1A1AA` (secondary) → `#71717A` (muted)
- **Text hierarchy (light):** `#09090B` (primary) → `#71717A` (secondary) → `#A1A1AA` (muted)
- **Semantic:**
  - Success: `#16a34a` (light) / `#4ade80` (dark) — Agent completed, tests passing
  - Warning: `#d97706` (light) / `#fbbf24` (dark) — Rate limits, pending review
  - Error: `#dc2626` (light) / `#f87171` (dark) — Failed tasks, connection lost
  - Info: `#2563eb` (light) / `#60a5fa` (dark) — Queued, informational
- **Dark mode strategy:** Cold-neutral zinc base (`#09090B` not `#141210`). Surface elevation via stark lightness jumps — cards must be obviously elevated, not muddy. Elevation ladder: sidebar (0.06) → background (0.04) → elevated (0.10) → hover (0.17). Border at 6% white opacity — barely visible, clean.

## Spacing
- **Base unit:** 4px
- **Density:** Varies by view (see Layout section)
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

## Layout
- **Approach:** Grid-disciplined, sidebar-first
- **Grid:** Sidebar (220px collapsed to icon) + fluid main content
- **Max content width:** 1000px (tighter than previous 1200px — better reading measure, more focused)
- **Border radius:** Hierarchical — sm: 4px (badges, small chips), md: 8px (buttons, inputs, inner cards), lg: 12px (cards, panels, modals), full: 9999px (pills, avatars, status dots)
- **Density tiers by view:**
  - **Dashboard:** Comfortable density. Stats row at top (4-column grid). Action cards in a 2-column grid (NOT single-column scroll). Company context as a compact header strip. Actions are the hero — front and center. Insights and board summary below the fold.
  - **Board:** Compact density. Tight rows, subtle status badges, monospace metadata. Linear-style issue list: calm, dense, software-like. No kanban cards. Status via small colored dots + uppercase mono badges. Metadata inline and subtle.
  - **Brain:** Compact density. Dense knowledge sections, collapsible panels, clear section labels. Content-forward.
  - **Agents:** Compact density. Agent list as tight table/list with status indicators, tool badges, and inline metrics. Not large cards.
  - **Chat:** Standard density. Generous line-height for messages. Code blocks and tool outputs compact within messages.
  - **Connections / Settings:** Standard density. Form-based views with clear grouping.

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension. Desktop app context means no network latency theater (no skeleton screens for <100ms loads, no artificial delays).
- **Easing:** Enter: ease-out (elements arriving), Exit: ease-in (elements leaving), Move: ease-in-out (repositioning)
- **Duration:** Micro: 50-80ms (hover states, toggles), Short: 100-150ms (button press, badge appear), Medium: 200-300ms (panel slide, card enter), Long: 300-500ms (page transitions, sidebar collapse)
- **Rules:**
  - Respect `prefers-reduced-motion` — collapse all animations to 0.01ms.
  - No bounce, no overshoot, no playful easing. Snappy and precise.
  - Sidebar collapse/expand: 200ms ease-in-out.
  - Card hover: 100ms ease-out. translateY(-1px) + subtle shadow increase. Border shifts to accent at 25% opacity.
  - No noise texture animations, no grain overlays, no ambient glow effects.

## UI Copy Principles
- **Action labels must be concrete and outcome-based.** Not "Run action" → "Run competitor analysis." Not "View results" → "View analysis report." Not "Adjust something" → "Show 2 bolder variants."
- **Status labels are monospace uppercase.** DONE, IN PROGRESS, REVIEW, BLOCKED, QUEUED. Short, scannable.
- **Section labels are monospace uppercase with accent color.** `QUICK ACTIONS`, `RECENT TASKS`, `AGENT LIBRARY`.
- **No marketing copy in the app.** No "Built for teams" or "Powered by AI." The UI speaks through function, not slogans.

## Key Design Rules
- Primary color is emerald, not teal/purple/blue
- Fonts: General Sans (display), Instrument Sans (body), JetBrains Mono (code)
- Dark mode uses cold-neutral zinc base (#09090B), not warm brown
- Dashboard is action-first: stats row + 2-column action card grid hero, company summary compressed
- Board uses compact list view with status dots, NOT kanban cards
- Accent color used sparingly — only 5-10% of UI surface. Not on every section label and border.
- No noise textures, no grain overlays. Depth via shadow and surface contrast only.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-23 | Initial design system created | Created by /design-consultation based on competitive research (Alma, Flowise, CrewAI, Linear, Raycast) and product context |
| 2026-03-23 | Teal primary over purple/blue | Every AI tool uses purple/blue. Teal is distinctive, reads as "alive" not "corporate" |
| 2026-03-23 | Warm dark mode (#141210) | Conventional cold blue-black is harsh for extended use. Warm darks are more inviting |
| 2026-03-23 | Density tiers by view | Dashboard = comfortable (action-first), Board/Brain/Agents = compact (Linear-style density), Chat = standard |
| 2026-03-24 | **Signal Black redesign** | Full aesthetic overhaul. Old system looked like stock shadcn with a teal variable swap — murky surfaces, monotone accent, Satoshi never loaded |
| 2026-03-24 | Cold-neutral zinc base over warm | Warm undertones (#141210) made the UI feel muddy, not warm. Cold zinc (#09090B) provides sharper contrast and cleaner surfaces. Linear, Raycast, Vercel all use cold darks for dev tools |
| 2026-03-24 | Electric emerald over teal | Teal was too muted against warm backgrounds and was used everywhere. Emerald (#34D399) is brighter, more vivid, and used sparingly (5-10% of surface) to create focal points |
| 2026-03-24 | General Sans + Instrument Sans | Satoshi was never loading (no CDN import). General Sans provides the same geometric personality from Fontshare. Instrument Sans replaces DM Sans with better small-size rendering |
| 2026-03-24 | Kill noise texture | The surface-noise overlay added nothing visible. Removed in favor of clean surfaces with stark elevation contrast |
| 2026-03-24 | 2-column action grid | Single-column dashboard was a scroll pit with 9 sections. 2-column grid for action cards reduces scrolling and adds visual variety |
| 2026-03-24 | Max width 1000px (from 1200px) | Tighter reading measure, more focused content. 1200px spread content too thin |
