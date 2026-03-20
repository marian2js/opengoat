/**
 * Extracts a company summary from workspace markdown files.
 *
 * The bootstrap prompts generate PRODUCT.md, MARKET.md, and GROWTH.md
 * with predictable heading structures. This utility pulls out the 5 key
 * data points needed for the Dashboard company summary card.
 */

export interface CompanySummaryData {
  productSummary: string | null;
  targetAudience: string | null;
  valueProposition: string | null;
  mainRisk: string | null;
  topOpportunity: string | null;
}

/**
 * Extracts the text content under a given markdown `##` heading.
 * Returns the content between the matched heading and the next `##` (or end of file).
 * Strips leading/trailing whitespace and bullet prefixes for the first item.
 */
export function extractSection(markdown: string, heading: string): string | null {
  // Match ## heading (case-insensitive, allowing optional trailing text)
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^##\\s+${escapedHeading}[^\\n]*\\n((?:(?!^##\\s).)*)`,
    "ims",
  );
  const match = pattern.exec(markdown);
  if (!match?.[1]) return null;

  const content = match[1].trim();
  if (!content) return null;
  return content;
}

/**
 * Gets the first meaningful paragraph or bullet point from a section.
 * Strips markdown bullet prefixes and keeps only the first logical block.
 */
export function firstParagraphOrBullet(section: string): string | null {
  if (!section) return null;

  const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  // Collect lines until we hit an empty conceptual gap or a new sub-heading
  const result: string[] = [];
  for (const line of lines) {
    if (line.startsWith("###")) break;
    // Strip bullet prefix
    const cleaned = line.replace(/^[-*]\s+/, "");
    result.push(cleaned);
    // For a single paragraph-like answer, stop after first logical block
    if (result.length >= 3) break;
  }

  return result.join(" ").trim() || null;
}

/**
 * Extracts the 5 company summary data points from raw markdown content.
 */
export function parseWorkspaceSummary(
  productMd: string | null,
  _marketMd: string | null,
  growthMd: string | null,
): CompanySummaryData {
  const result: CompanySummaryData = {
    productSummary: null,
    targetAudience: null,
    valueProposition: null,
    mainRisk: null,
    topOpportunity: null,
  };

  if (productMd) {
    // Product summary from "## Company summary"
    const companySummary = extractSection(productMd, "Company summary");
    result.productSummary = companySummary
      ? firstParagraphOrBullet(companySummary)
      : null;

    // Target audience from "## Target users"
    const targetUsers = extractSection(productMd, "Target users");
    result.targetAudience = targetUsers
      ? firstParagraphOrBullet(targetUsers)
      : null;

    // Value proposition from "## Positioning signals"
    const positioning = extractSection(productMd, "Positioning signals");
    result.valueProposition = positioning
      ? firstParagraphOrBullet(positioning)
      : null;
  }

  if (growthMd) {
    // Main risk from "## Risks and constraints"
    const risks = extractSection(growthMd, "Risks and constraints");
    result.mainRisk = risks ? firstParagraphOrBullet(risks) : null;

    // Top opportunity from "## Experiment ideas" or "## Strategic summary"
    const experiments = extractSection(growthMd, "Experiment ideas");
    const strategic = extractSection(growthMd, "Strategic summary");
    const opportunitySource = experiments ?? strategic;
    result.topOpportunity = opportunitySource
      ? firstParagraphOrBullet(opportunitySource)
      : null;
  }

  return result;
}
