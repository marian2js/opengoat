export interface SpecialistKnowledgeHints {
  domain: string;
  extractionHints: string[];
}

const SPECIALIST_KNOWLEDGE_MAP: Record<string, SpecialistKnowledgeHints> = {
  cmo: {
    domain: "Strategic marketing leadership and cross-functional coordination",
    extractionHints: [
      "Strategic priorities and focus areas decided",
      "Cross-functional coordination decisions",
      "Specialist routing preferences",
      "Marketing direction and budget allocation decisions",
    ],
  },
  "market-intel": {
    domain: "Competitor research, community intelligence, and customer language",
    extractionHints: [
      "Competitor findings (names, positioning, pricing, weaknesses)",
      "Community intelligence (where ICP hangs out, engagement patterns)",
      "Customer language patterns and phrases",
      "Market gaps and opportunities identified",
    ],
  },
  positioning: {
    domain: "Messaging, differentiation, and value propositions",
    extractionHints: [
      "Messaging decisions and chosen one-liners",
      "Differentiation angles selected",
      "Value proposition refinements",
      "ICP-specific framing decisions",
    ],
  },
  "website-conversion": {
    domain: "Website conversion optimization and page performance",
    extractionHints: [
      "Conversion insights and page performance findings",
      "CTA decisions and copy selections",
      "Hero section choices made",
      "Trust element and social proof decisions",
    ],
  },
  "seo-aeo": {
    domain: "Search visibility and answer-engine optimization",
    extractionHints: [
      "Target queries and keyword decisions",
      "Ranking opportunities identified",
      "Schema and structured data decisions",
      "Content wedge priorities",
    ],
  },
  distribution: {
    domain: "Launches, communities, directories, and distribution channels",
    extractionHints: [
      "Channel performance findings",
      "Launch learnings and what worked",
      "Community engagement findings",
      "Directory and listing decisions",
    ],
  },
  content: {
    domain: "Content strategy, editorial planning, and content production",
    extractionHints: [
      "Content strategy decisions",
      "Editorial angles and topics chosen",
      "Repurposing patterns that work",
      "Content format and channel preferences",
    ],
  },
  outbound: {
    domain: "Direct outreach, cold email, and messaging sequences",
    extractionHints: [
      "Outreach learnings and what resonated",
      "Segment-angle effectiveness findings",
      "Reply rate insights and patterns",
      "Subject line and copy decisions",
    ],
  },
};

export function getKnowledgeHints(
  specialistId: string,
): SpecialistKnowledgeHints | undefined {
  return SPECIALIST_KNOWLEDGE_MAP[specialistId];
}
