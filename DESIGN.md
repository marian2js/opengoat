# Design System — OpenGoat

## Product Context
- **What this is:** A desktop platform for building hierarchical organizations of AI agents that coordinate work across multiple tools (Claude Code, Codex, Cursor, GitHub Copilot CLI, Lovable, and more).
- **Who it's for:** Developers and technical operators who orchestrate AI agents across codebases and tools.
- **Space/industry:** AI agent orchestration / developer tools. Peers: CrewAI, AutoGen Studio, LangGraph Studio, Linear (as a UX benchmark).
- **Project type:** Desktop app (Tauri) with sidebar-first layout, task boards, chat interface, and knowledge management.

## Aesthetic Direction
- **Direction:** Refined Industrial
- **Decoration level:** Intentional — subtle noise texture overlay for depth, surface elevation via shadows rather than heavy borders. No gratuitous decoration.
- **Mood:** Mission control, not SaaS dashboard. Confident, precise, warm. The kind of tool you trust to run things while you focus on strategy. Irreverent name, serious function.
- **Reference sites:** Linear (discipline, density, acid accent), Raycast (dark-first, command-driven), Alma (elegant restraint)

## Typography
- **Display/Hero:** Satoshi (700, 800) — Geometric sans with warmth and personality. Stands out from the Inter/Geist/Poppins crowd. Confident without being flashy.
- **Body:** DM Sans (400, 500, 600, 700) — Exceptionally readable at small sizes, great x-height, pairs naturally with Satoshi.
- **UI/Labels:** DM Sans (500, 600) — Same as body for consistency.
- **Data/Tables:** DM Sans with `font-feature-settings: "tnum" 1` — Tabular figures for aligned numbers.
- **Code:** JetBrains Mono (400, 500, 600) — Developer tool standard. Used for code blocks, agent configs, status labels, and monospace metadata captions.
- **Loading:** Satoshi from Fontshare CDN (`api.fontshare.com`), DM Sans and JetBrains Mono from Bunny Fonts CDN (`fonts.bunny.net`).
- **Scale:**
  - 48px / 800 — Page hero (rare, dashboard welcome only)
  - 32px / 700 — Section hero
  - 22px / 700 — Section title
  - 18px / 600 — Subsection heading
  - 15px / 500 — Body text (primary reading size)
  - 13px / 400-500 — Secondary text, descriptions, UI labels
  - 11px / 500-600 — Monospace captions, badges, metadata (uppercase + tracking)
  - 10px / 600 — Section labels (mono, uppercase, 0.1em tracking, primary color)

## Color
- **Approach:** Restrained with a bold accent. Color is rare and meaningful — the teal accent does all the heavy lifting against warm neutrals.
- **Primary (light):** `#0D9488` / `oklch(0.58 0.12 175)` — Electric teal. Distinctive in the AI space (everyone uses purple). Reads as "alive" and "intelligent."
- **Primary (dark):** `#2DD4BF` / `oklch(0.78 0.14 175)` — Brighter teal for dark surfaces.
- **Primary hover (light):** `#0F766E`
- **Primary hover (dark):** `#5EEAD4`
- **Primary subtle (light):** `#CCFBF1` — Tinted backgrounds for badges, highlights.
- **Primary subtle (dark):** `rgba(45, 212, 191, 0.12)` — Transparent overlay for dark mode.
- **Primary ghost:** `rgba(13, 148, 136, 0.08)` (light) / `rgba(45, 212, 191, 0.06)` (dark) — Hover states, ghost buttons.
- **Neutrals:** Warm-tinted grays throughout. NOT cool blue-grays.
  - Light: `#faf9f7` (bg) → `#f5f3f0` (sidebar) → `#ffffff` (elevated) → `#f3f1ee` (sunken) → `#e8e5e0` (border) → `#1a1714` (fg)
  - Dark: `#141210` (bg) → `#110f0d` (sidebar) → `#1e1b18` (elevated) → `#0e0d0b` (sunken) → `rgba(255,255,255,0.07)` (border) → `#e8e4de` (fg)
- **Semantic:**
  - Success: `#16a34a` (light) / `#4ade80` (dark) — Agent completed, tests passing
  - Warning: `#d97706` (light) / `#fbbf24` (dark) — Rate limits, pending review
  - Error: `#dc2626` (light) / `#f87171` (dark) — Failed tasks, connection lost
  - Info: `#2563eb` (light) / `#60a5fa` (dark) — Queued, informational
- **Dark mode strategy:** Warm undertones (`#141210` not `#0a0a0f`). Surface elevation via lightness steps (0.10 → 0.125 → 0.165 → 0.19). Reduce accent saturation ~10% for eye comfort. Apple proved warm darks work for tools you spend hours in.

## Spacing
- **Base unit:** 4px
- **Density:** Varies by view (see Layout section)
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

## Layout
- **Approach:** Grid-disciplined, sidebar-first
- **Grid:** Sidebar (220px collapsed to icon) + fluid main content
- **Max content width:** 1200px
- **Border radius:** Hierarchical — sm: 4px (badges, small chips), md: 8px (buttons, inputs, inner cards), lg: 12px (cards, panels, modals), full: 9999px (pills, avatars, status dots)
- **Density tiers by view:**
  - **Dashboard:** Comfortable density. Action cards with breathing room, stats at a glance. Company context as a compact header strip (domain + agent count), NOT a content block. Action cards are the hero — front and center. Insights and board summary below the fold.
  - **Board:** Compact density. Tight rows, subtle status badges, monospace metadata. Think Linear's issue list: calm, dense, software-like. No Trello-style kanban cards or visual noise. Status via small colored dots + uppercase mono badges. Metadata (assignee, dates, priority) inline and subtle.
  - **Brain:** Compact density. Dense knowledge sections, collapsible panels, clear section labels. Content-forward — the knowledge itself is the UI.
  - **Agents:** Compact density. Agent list as a tight table/list with status indicators, tool badges, and inline metrics. Not large cards.
  - **Chat:** Standard density. Conversation needs vertical breathing room. Messages have generous line-height. Code blocks and tool outputs are compact within messages.
  - **Connections / Settings:** Standard density. Form-based views with clear grouping.

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension. Desktop app context means no network latency theater (no skeleton screens for <100ms loads, no artificial delays).
- **Easing:** Enter: ease-out (elements arriving), Exit: ease-in (elements leaving), Move: ease-in-out (repositioning)
- **Duration:** Micro: 50-80ms (hover states, toggles), Short: 100-150ms (button press, badge appear), Medium: 200-300ms (panel slide, card enter), Long: 300-500ms (page transitions, sidebar collapse)
- **Rules:**
  - Respect `prefers-reduced-motion` — collapse all animations to 0.01ms.
  - No bounce, no overshoot, no playful easing. Snappy and precise.
  - Sidebar collapse/expand: 200ms ease-in-out.
  - Card hover: 100ms (transform + shadow only, no color animation on the card itself).
  - Action card hover: 2px teal top-border fade-in, subtle translateY(-1px).

## UI Copy Principles
- **Action labels must be concrete and outcome-based.** Not "Run action" → "Run competitor analysis." Not "View results" → "View analysis report." Not "Adjust something" → "Show 2 bolder variants."
- **Status labels are monospace uppercase.** DONE, IN PROGRESS, REVIEW, BLOCKED, QUEUED. Short, scannable.
- **Section labels are monospace uppercase with primary color.** `01 — TYPOGRAPHY`, `QUICK ACTIONS`, `RECENT TASKS`.
- **No marketing copy in the app.** No "Built for teams" or "Powered by AI." The UI speaks through function, not slogans.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-23 | Initial design system created | Created by /design-consultation based on competitive research (Alma, Flowise, CrewAI, Linear, Raycast) and product context |
| 2026-03-23 | Teal primary over purple/blue | Every AI tool uses purple/blue. Teal is distinctive, reads as "alive" not "corporate," and creates visual tension against warm neutrals |
| 2026-03-23 | Satoshi + DM Sans over Geist | Geist is fine but generic (stock shadcn). Satoshi has geometric personality; DM Sans is more readable at small sizes |
| 2026-03-23 | Warm dark mode (#141210) | Conventional cold blue-black (#0a0a0f) is harsh for extended use. Warm darks are more inviting — proven by Apple's design language |
| 2026-03-23 | Density tiers by view | Dashboard = comfortable (action-first), Board/Brain/Agents = compact (Linear-style density), Chat = standard (conversation needs air) |
| 2026-03-23 | Action-first Dashboard | Dashboard leads with stats + action cards, company context compressed to header strip. Users see "what can I do now" not "read this summary" |
| 2026-03-23 | No kanban cards on Board | Board uses calm list view with status dots + mono badges. Matches V3 board spec. Trello-style cards add visual noise without information gain |
