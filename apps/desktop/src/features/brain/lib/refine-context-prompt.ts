/**
 * Builds a read-on-demand prompt for the product-marketing-context skill
 * that guides the agent to identify gaps in workspace context files.
 */

const REFINABLE_SECTIONS = new Set(["product", "market", "growth"]);

const SECTION_LABELS: Record<string, string> = {
  product: "Product",
  market: "Market",
  growth: "Growth",
};

const SECTION_FILES: Record<string, string> = {
  product: "PRODUCT.md",
  market: "MARKET.md",
  growth: "GROWTH.md",
};

export function isRefinableSection(sectionId: string): boolean {
  return REFINABLE_SECTIONS.has(sectionId);
}

export function buildRefineContextPrompt(sectionId: string): string {
  const label = SECTION_LABELS[sectionId] ?? sectionId;
  const file = SECTION_FILES[sectionId] ?? `${sectionId.toUpperCase()}.md`;

  return [
    "Read the skill file at ./skills/marketing/product-marketing-context/SKILL.md.",
    `Then read the workspace context files: PRODUCT.md, MARKET.md, and GROWTH.md.`,
    `Focus especially on the ${label} context (${file}).`,
    "Identify what sections are missing, incomplete, or could be improved.",
    "Walk me through filling the gaps conversationally — ask one question at a time.",
  ].join("\n");
}

export function buildRefineContextLabel(sectionId: string): string {
  const label = SECTION_LABELS[sectionId] ?? sectionId;
  return `Refine ${label.toLowerCase()} context`;
}

export function buildRefineContextActionId(sectionId: string): string {
  return `refine-${sectionId}-context`;
}
