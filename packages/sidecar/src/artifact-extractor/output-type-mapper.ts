import type { ArtifactType } from "@opengoat/core";

/**
 * Static lookup from specialist outputType string to ArtifactType.
 * Keys are normalized to lowercase.
 */
const OUTPUT_TYPE_MAP: Record<string, ArtifactType> = {
  // CMO
  "prioritized recommendations": "strategy_note",
  "cross-functional plans": "strategy_note",
  "combined specialist summaries": "report",
  "marketing direction briefs": "research_brief",

  // Market Intel
  "competitor messaging matrix": "matrix",
  "community shortlist": "dataset_list",
  "customer-language themes": "research_brief",
  "market brief": "research_brief",
  "launch-surface recommendations": "dataset_list",

  // Positioning
  "one-liners": "copy_draft",
  "value propositions": "copy_draft",
  "differentiation angles": "copy_draft",
  "icp-specific messaging": "copy_draft",
  "comparison narratives": "copy_draft",

  // Website Conversion
  "hero rewrite bundle": "copy_draft",
  "cta options": "copy_draft",
  "trust/proof suggestions": "checklist",
  "page-level recommendations": "page_outline",
  "landing-page improvements": "page_outline",

  // SEO/AEO
  "seo opportunity map": "matrix",
  "content wedge recommendations": "dataset_list",
  "comparison-page opportunities": "dataset_list",
  "schema suggestions": "checklist",
  "ai-answer visibility notes": "report",

  // Distribution
  "product hunt launch pack": "launch_pack",
  "launch checklist": "checklist",
  "community-post angles": "copy_draft",
  "channel recommendations": "strategy_note",
  "launch sequencing plan": "content_calendar",

  // Content
  "content ideas": "dataset_list",
  "post outlines": "page_outline",
  "editorial briefs": "research_brief",
  "repurposing plans": "content_calendar",
  "post variations": "copy_draft",

  // Outbound
  "cold email sequences": "email_sequence",
  "subject lines": "copy_draft",
  "segment-angle maps": "matrix",
  "founder outreach drafts": "email_sequence",
  "partnership outreach drafts": "email_sequence",
};

export function mapOutputTypeToArtifactType(outputType: string): ArtifactType | null {
  const key = outputType.toLowerCase().trim();
  return OUTPUT_TYPE_MAP[key] ?? null;
}
