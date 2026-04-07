/** Specialist metadata for UI display (name, role, icon key, starter suggestions). */
export interface SpecialistMeta {
  name: string;
  role: string;
  /** Outcome-focused "best for" statement shown on dashboard cards. */
  bestAt: string;
  /** Concrete output noun-phrases this specialist helps produce. */
  produces: string[];
  icon: string;
  starterSuggestions: [string, string, string];
}

export const SPECIALIST_META: Record<string, SpecialistMeta> = {
  cmo: {
    name: "CMO",
    role: "Top-level marketing lead who routes work, synthesizes across specialists, and helps when you're unsure where to start",
    bestAt: "Best for prioritizing your next move, coordinating specialists, and getting cross-channel strategy",
    produces: ["Marketing priorities", "Cross-channel strategy", "Specialist coordination"],
    icon: "brain",
    starterSuggestions: [
      "What's the highest-leverage marketing move for my company right now?",
      "Which specialist should I start with?",
      "Summarize opportunities across all marketing channels.",
    ],
  },
  "market-intel": {
    name: "Market Intel",
    role: "Competitor, community, customer-voice, and market-research specialist",
    bestAt: "Best for competitor research, community mapping, and understanding customer language",
    produces: ["Competitor maps", "Community targets", "Customer language analysis"],
    icon: "search",
    starterSuggestions: [
      "Map my competitor landscape and find messaging gaps.",
      "Which communities does my ICP hang out in?",
      "Analyze customer language from reviews and forums.",
    ],
  },
  positioning: {
    name: "Positioning",
    role: "Sharpens how the company should be framed, differentiated, and messaged",
    bestAt: "Best for one-liners, differentiation angles, and ICP-specific messaging",
    produces: ["Value props", "One-liners", "Category framing"],
    icon: "target",
    starterSuggestions: [
      "Sharpen my one-liner to stand out from competitors.",
      "Write 3 differentiation angles for my ICP.",
      "Compare my messaging against top competitors.",
    ],
  },
  "website-conversion": {
    name: "Website Conversion",
    role: "Improves the website's ability to convert visitors into users or customers",
    bestAt: "Best for homepage hero rewrites, CTA optimization, and conversion audits",
    produces: ["Hero rewrites", "CTA rewrites", "Conversion audits"],
    icon: "layout",
    starterSuggestions: [
      "Rewrite my homepage hero with 3 variants.",
      "Audit my site's trust signals and CTAs.",
      "Identify the top conversion blockers on my site.",
    ],
  },
  "seo-aeo": {
    name: "SEO/AEO",
    role: "Owns search visibility and answer-engine visibility",
    bestAt: "Best for search wedges, comparison pages, and AI-answer opportunities",
    produces: ["Search wedges", "Comparison pages", "Answer-engine opportunities"],
    icon: "globe",
    starterSuggestions: [
      "Find my best SEO quick wins by effort vs. impact.",
      "Which comparison pages should I build?",
      "How visible is my product in AI answer engines?",
    ],
  },
  distribution: {
    name: "Distribution",
    role: "Owns launches, communities, directories, and founder-led distribution",
    bestAt: "Best for Product Hunt launches, community posts, and channel strategy",
    produces: ["Launch packs", "Community targets", "Launch sequencing"],
    icon: "megaphone",
    starterSuggestions: [
      "Create a Product Hunt launch pack.",
      "Which channels should I prioritize for launch?",
      "Build a launch sequencing plan.",
    ],
  },
  content: {
    name: "Content",
    role: "Owns ongoing founder-led and product-led content production",
    bestAt: "Best for founder-led content ideas, editorial briefs, and repurposing plans",
    produces: ["Content ideas", "Editorial briefs", "Repurposing plans"],
    icon: "pen-tool",
    starterSuggestions: [
      "Generate 10 founder-led content ideas with hooks.",
      "Create an editorial brief for my top content angle.",
      "Build a repurposing plan for one pillar post.",
    ],
  },
  outbound: {
    name: "Outbound",
    role: "Owns direct outreach and messaging sequences",
    bestAt: "Best for cold email sequences, subject lines, and segment-specific outreach",
    produces: ["Cold outreach sequences", "Subject lines", "Outreach angles"],
    icon: "send",
    starterSuggestions: [
      "Draft a 3-email cold outreach sequence.",
      "Write subject line variants for my ICP.",
      "Map my outreach segments to pain points.",
    ],
  },
};

export function getSpecialistMeta(id: string): SpecialistMeta | undefined {
  return SPECIALIST_META[id];
}

/** Per-specialist color tokens for visual differentiation across the UI. */
export interface SpecialistColorConfig {
  iconBg: string;
  iconText: string;
  chipBorder: string;
  hoverBorder: string;
  hoverIconBg: string;
  hoverIconText: string;
  dotColor: string;
  /** Filled icon background on chat starter prompt hover (group-hover/starter). */
  starterHoverIconBg: string;
}

export const SPECIALIST_COLORS: Record<string, SpecialistColorConfig> = {
  cmo: {
    iconBg: "bg-emerald-500/10 dark:bg-emerald-400/10",
    iconText: "text-emerald-600 dark:text-emerald-400",
    chipBorder: "border-emerald-500/15 dark:border-emerald-400/10",
    hoverBorder: "hover:border-emerald-500/30 dark:hover:border-emerald-400/25",
    hoverIconBg: "group-hover/chip:bg-emerald-500/[0.06]",
    hoverIconText: "group-hover/chip:text-emerald-600 dark:group-hover/chip:text-emerald-400",
    dotColor: "bg-emerald-500/40",
    starterHoverIconBg: "group-hover/starter:bg-emerald-500 dark:group-hover/starter:bg-emerald-500",
  },
  "market-intel": {
    iconBg: "bg-amber-500/10 dark:bg-amber-400/10",
    iconText: "text-amber-600 dark:text-amber-400",
    chipBorder: "border-amber-500/15 dark:border-amber-400/10",
    hoverBorder: "hover:border-amber-500/30 dark:hover:border-amber-400/25",
    hoverIconBg: "group-hover/chip:bg-amber-500/[0.06]",
    hoverIconText: "group-hover/chip:text-amber-600 dark:group-hover/chip:text-amber-400",
    dotColor: "bg-amber-500/40",
    starterHoverIconBg: "group-hover/starter:bg-amber-500 dark:group-hover/starter:bg-amber-500",
  },
  positioning: {
    iconBg: "bg-violet-500/10 dark:bg-violet-400/10",
    iconText: "text-violet-600 dark:text-violet-400",
    chipBorder: "border-violet-500/15 dark:border-violet-400/10",
    hoverBorder: "hover:border-violet-500/30 dark:hover:border-violet-400/25",
    hoverIconBg: "group-hover/chip:bg-violet-500/[0.06]",
    hoverIconText: "group-hover/chip:text-violet-600 dark:group-hover/chip:text-violet-400",
    dotColor: "bg-violet-500/40",
    starterHoverIconBg: "group-hover/starter:bg-violet-500 dark:group-hover/starter:bg-violet-500",
  },
  "website-conversion": {
    iconBg: "bg-sky-500/10 dark:bg-sky-400/10",
    iconText: "text-sky-600 dark:text-sky-400",
    chipBorder: "border-sky-500/15 dark:border-sky-400/10",
    hoverBorder: "hover:border-sky-500/30 dark:hover:border-sky-400/25",
    hoverIconBg: "group-hover/chip:bg-sky-500/[0.06]",
    hoverIconText: "group-hover/chip:text-sky-600 dark:group-hover/chip:text-sky-400",
    dotColor: "bg-sky-500/40",
    starterHoverIconBg: "group-hover/starter:bg-sky-500 dark:group-hover/starter:bg-sky-500",
  },
  "seo-aeo": {
    iconBg: "bg-blue-500/10 dark:bg-blue-400/10",
    iconText: "text-blue-600 dark:text-blue-400",
    chipBorder: "border-blue-500/15 dark:border-blue-400/10",
    hoverBorder: "hover:border-blue-500/30 dark:hover:border-blue-400/25",
    hoverIconBg: "group-hover/chip:bg-blue-500/[0.06]",
    hoverIconText: "group-hover/chip:text-blue-600 dark:group-hover/chip:text-blue-400",
    dotColor: "bg-blue-500/40",
    starterHoverIconBg: "group-hover/starter:bg-blue-500 dark:group-hover/starter:bg-blue-500",
  },
  distribution: {
    iconBg: "bg-teal-500/10 dark:bg-teal-400/10",
    iconText: "text-teal-600 dark:text-teal-400",
    chipBorder: "border-teal-500/15 dark:border-teal-400/10",
    hoverBorder: "hover:border-teal-500/30 dark:hover:border-teal-400/25",
    hoverIconBg: "group-hover/chip:bg-teal-500/[0.06]",
    hoverIconText: "group-hover/chip:text-teal-600 dark:group-hover/chip:text-teal-400",
    dotColor: "bg-teal-500/40",
    starterHoverIconBg: "group-hover/starter:bg-teal-500 dark:group-hover/starter:bg-teal-500",
  },
  content: {
    iconBg: "bg-rose-500/10 dark:bg-rose-400/10",
    iconText: "text-rose-600 dark:text-rose-400",
    chipBorder: "border-rose-500/15 dark:border-rose-400/10",
    hoverBorder: "hover:border-rose-500/30 dark:hover:border-rose-400/25",
    hoverIconBg: "group-hover/chip:bg-rose-500/[0.06]",
    hoverIconText: "group-hover/chip:text-rose-600 dark:group-hover/chip:text-rose-400",
    dotColor: "bg-rose-500/40",
    starterHoverIconBg: "group-hover/starter:bg-rose-500 dark:group-hover/starter:bg-rose-500",
  },
  outbound: {
    iconBg: "bg-orange-500/10 dark:bg-orange-400/10",
    iconText: "text-orange-600 dark:text-orange-400",
    chipBorder: "border-orange-500/15 dark:border-orange-400/10",
    hoverBorder: "hover:border-orange-500/30 dark:hover:border-orange-400/25",
    hoverIconBg: "group-hover/chip:bg-orange-500/[0.06]",
    hoverIconText: "group-hover/chip:text-orange-600 dark:group-hover/chip:text-orange-400",
    dotColor: "bg-orange-500/40",
    starterHoverIconBg: "group-hover/starter:bg-orange-500 dark:group-hover/starter:bg-orange-500",
  },
};

const DEFAULT_COLORS: SpecialistColorConfig = SPECIALIST_COLORS.cmo!;

export function getSpecialistColors(id: string): SpecialistColorConfig {
  return SPECIALIST_COLORS[id] ?? DEFAULT_COLORS;
}
