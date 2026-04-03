/** Specialist metadata for UI display (name, role, icon key). */
export interface SpecialistMeta {
  name: string;
  role: string;
  icon: string;
}

export const SPECIALIST_META: Record<string, SpecialistMeta> = {
  cmo: {
    name: "CMO",
    role: "Top-level marketing lead who routes work, synthesizes across specialists, and helps when you're unsure where to start",
    icon: "brain",
  },
  "market-intel": {
    name: "Market Intel",
    role: "Competitor, community, customer-voice, and market-research specialist",
    icon: "search",
  },
  positioning: {
    name: "Positioning",
    role: "Sharpens how the company should be framed, differentiated, and messaged",
    icon: "target",
  },
  "website-conversion": {
    name: "Website Conversion",
    role: "Improves the website's ability to convert visitors into users or customers",
    icon: "layout",
  },
  "seo-aeo": {
    name: "SEO/AEO",
    role: "Owns search visibility and answer-engine visibility",
    icon: "globe",
  },
  distribution: {
    name: "Distribution",
    role: "Owns launches, communities, directories, and founder-led distribution",
    icon: "megaphone",
  },
  content: {
    name: "Content",
    role: "Owns ongoing founder-led and product-led content production",
    icon: "pen-tool",
  },
  outbound: {
    name: "Outbound",
    role: "Owns direct outreach and messaging sequences",
    icon: "send",
  },
};

export function getSpecialistMeta(id: string): SpecialistMeta | undefined {
  return SPECIALIST_META[id];
}
