/** Specialist metadata for UI display (name, role, icon key, starter suggestions). */
export interface SpecialistMeta {
  name: string;
  role: string;
  icon: string;
  starterSuggestions: [string, string, string];
}

export const SPECIALIST_META: Record<string, SpecialistMeta> = {
  cmo: {
    name: "CMO",
    role: "Top-level marketing lead who routes work, synthesizes across specialists, and helps when you're unsure where to start",
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
