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
  icp: string | null;
  opportunities: string[];
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
 * Returns true if a line looks like a label/heading rather than actual content.
 * Labels are short lines without sentence-ending punctuation, often used
 * in AI-generated markdown (e.g. "What the company/product is", "What problem it solves").
 */
function isLabelLine(line: string): boolean {
  // Too short and no sentence punctuation → likely a label
  if (line.length < 60 && !/[.!?:,;"]/.test(line)) return true;
  return false;
}

/**
 * Gets the first meaningful paragraph or bullet point from a section.
 * Strips markdown bullet prefixes, skips label-like lines,
 * and keeps only the first logical block.
 */
export function firstParagraphOrBullet(section: string): string | null {
  if (!section) return null;

  const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  // Collect content lines, skipping label-like lines
  const result: string[] = [];
  for (const line of lines) {
    if (line.startsWith("###")) break;
    // Strip bullet prefix
    const cleaned = line.replace(/^[-*]\s+/, "");
    // Skip label-like lines (e.g. "What the company/product is")
    if (isLabelLine(cleaned)) continue;
    result.push(cleaned);
    // For a single paragraph-like answer, stop after first logical block
    if (result.length >= 2) break;
  }

  // Fallback: if all lines were skipped as labels, use the first non-heading line
  if (result.length === 0) {
    for (const line of lines) {
      if (line.startsWith("###")) break;
      const cleaned = line.replace(/^[-*]\s+/, "");
      if (cleaned) return cleaned;
    }
  }

  return result.join(" ").trim() || null;
}

/**
 * Extracts up to `max` concise bullet strings from a markdown section.
 * Strips bullet prefixes, skips label-like lines, and stops at sub-headings.
 */
export function extractBullets(section: string, max = 3): string[] {
  if (!section) return [];
  const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
  const result: string[] = [];
  for (const line of lines) {
    if (line.startsWith("###")) break;
    const cleaned = line.replace(/^[-*]\s+/, "");
    if (isLabelLine(cleaned)) continue;
    if (cleaned) result.push(cleaned);
    if (result.length >= max) break;
  }
  return result;
}

/**
 * Tries multiple heading variants and returns the first matching section content.
 */
function extractFirstMatch(markdown: string, headings: string[]): string | null {
  for (const heading of headings) {
    const section = extractSection(markdown, heading);
    if (section) return section;
  }
  return null;
}

/**
 * Extracts company summary data points from raw markdown content.
 * Resilient to heading variations in AI-generated markdown.
 */
export function parseWorkspaceSummary(
  productMd: string | null,
  marketMd: string | null,
  growthMd: string | null,
): CompanySummaryData {
  const result: CompanySummaryData = {
    productSummary: null,
    targetAudience: null,
    valueProposition: null,
    mainRisk: null,
    topOpportunity: null,
    icp: null,
    opportunities: [],
  };

  try {
    if (productMd) {
      const companySummary = extractFirstMatch(productMd, [
        "Company summary",
        "Product summary",
        "Overview",
        "About",
      ]);
      result.productSummary = companySummary
        ? firstParagraphOrBullet(companySummary)
        : null;

      const targetUsers = extractFirstMatch(productMd, [
        "Target users",
        "Target audience",
        "Ideal customer",
        "ICP",
      ]);
      result.targetAudience = targetUsers
        ? firstParagraphOrBullet(targetUsers)
        : null;

      const positioning = extractFirstMatch(productMd, [
        "Positioning signals",
        "Value proposition",
        "Positioning",
        "Key differentiators",
      ]);
      result.valueProposition = positioning
        ? firstParagraphOrBullet(positioning)
        : null;
    }

    // ICP extraction: prefer MARKET.md, fallback to PRODUCT.md
    if (marketMd) {
      const icpSection = extractFirstMatch(marketMd, [
        "ICP hypotheses",
        "Personas",
        "Ideal customer profile",
        "Target buyer",
      ]);
      result.icp = icpSection ? firstParagraphOrBullet(icpSection) : null;
    }
    if (!result.icp && productMd) {
      const icpFallback = extractFirstMatch(productMd, [
        "Target users",
        "Target audience",
        "Ideal customer",
      ]);
      result.icp = icpFallback ? firstParagraphOrBullet(icpFallback) : null;
    }

    if (growthMd) {
      const risks = extractFirstMatch(growthMd, [
        "Risks and constraints",
        "Risks",
        "Challenges",
        "Threats",
      ]);
      result.mainRisk = risks ? firstParagraphOrBullet(risks) : null;

      const opportunity = extractFirstMatch(growthMd, [
        "Experiment ideas",
        "Strategic summary",
        "Growth opportunities",
        "Opportunities",
        "Next steps",
      ]);
      result.topOpportunity = opportunity
        ? firstParagraphOrBullet(opportunity)
        : null;

      // Opportunities: collect 2-3 sharp bullets from multiple GROWTH.md sections
      const seen = new Set<string>();
      const opps: string[] = [];
      const oppSections = [
        "Strategic summary",
        "Experiment ideas",
        "Channel priorities",
        "Risks and constraints",
      ];
      for (const heading of oppSections) {
        if (opps.length >= 3) break;
        const section = extractSection(growthMd, heading);
        if (!section) continue;
        const bullets = extractBullets(section, 2);
        for (const b of bullets) {
          if (opps.length >= 3) break;
          const key = b.toLowerCase().slice(0, 40);
          if (seen.has(key)) continue;
          seen.add(key);
          opps.push(b);
        }
      }
      result.opportunities = opps;
    }
  } catch (err: unknown) {
    console.error("parseWorkspaceSummary: unexpected error during parsing:", err);
  }

  return result;
}
