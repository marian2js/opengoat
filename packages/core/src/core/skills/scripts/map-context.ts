/**
 * Replaces `.agents/product-marketing-context.md` references with
 * PRODUCT.md, MARKET.md, GROWTH.md references for OpenGoat compatibility.
 */

// Patterns to match the context-loading preamble in marketingskills
const CONTEXT_PATTERNS = [
  // Pattern 1: Multi-line "If .agents/... exists ..." paragraph
  /If [`']?\.agents\/product-marketing-context\.md[`']?\s+exists\s*\(or\s+[`']?\.claude\/product-marketing-context\.md[`']?\s*\n?\s*in older setups\)\s*,\s*read it before asking questions\./gi,
  // Pattern 2: Single-line variant
  /If [`']?\.agents\/product-marketing-context\.md[`']?\s+exists[^.]*,\s*read it before asking questions\./gi,
  // Pattern 3: Direct reference without the "if exists" wrapper
  /If [`']?\.claude\/product-marketing-context\.md[`']?\s+exists[^.]*,\s*read it before asking questions\./gi,
];

const REPLACEMENT =
  "Read the workspace context files — PRODUCT.md, MARKET.md, and GROWTH.md — before\nasking questions. These contain the product, market, and growth context for this company.\nUse that context and only ask for information not already covered.";

/**
 * Replaces context-loading preamble references in a skill's body content.
 * Only modifies the context paragraph — all other content stays untouched.
 */
export function mapContext(content: string): string {
  let result = content;
  for (const pattern of CONTEXT_PATTERNS) {
    result = result.replace(pattern, REPLACEMENT);
  }
  // Also replace simple inline file references
  result = result.replace(
    /`\.agents\/product-marketing-context\.md`/g,
    "PRODUCT.md, MARKET.md, and GROWTH.md",
  );
  result = result.replace(
    /`\.claude\/product-marketing-context\.md`/g,
    "PRODUCT.md, MARKET.md, and GROWTH.md",
  );
  return result;
}
