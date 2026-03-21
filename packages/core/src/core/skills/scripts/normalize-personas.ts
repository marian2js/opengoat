/**
 * Normalizes agency-agents persona files for OpenClaw compatibility.
 * - Converts filenames to lowercase-hyphenated slug
 * - Adds/rewrites `name:` as lowercase-hyphenated
 * - Adds `description:` field from persona role line
 * - Drops unsupported keys (tools, color, emoji, vibe)
 */

import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";

const UNSUPPORTED_KEYS = new Set(["tools", "color", "emoji", "vibe"]);

/** Mapping from selected persona source files to their output slugs */
export const PERSONA_SOURCE_MAP: Record<string, string> = {
  "marketing/marketing-seo-specialist.md": "seo-specialist",
  "marketing/marketing-growth-hacker.md": "growth-hacker",
  "marketing/marketing-content-creator.md": "content-creator",
  "marketing/marketing-reddit-community-builder.md": "reddit-community-builder",
  "marketing/marketing-social-media-strategist.md": "social-media-strategist",
  "design/design-brand-guardian.md": "brand-guardian",
  "testing/testing-reality-checker.md": "reality-checker",
  "sales/sales-outbound-strategist.md": "outbound-strategist",
  "design/design-ux-researcher.md": "ux-researcher",
};

/**
 * Extracts a description from the persona body content.
 * Looks for the first substantive paragraph line (not a heading).
 */
export function extractDescription(body: string): string {
  const lines = body.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("---")) continue;
    // Return first substantive line, truncated to ~120 chars
    const desc = trimmed.length > 120 ? trimmed.slice(0, 117) + "..." : trimmed;
    return desc;
  }
  return "Specialized agent persona";
}

/**
 * Normalizes a persona file content, applying slug-based naming,
 * adding description, and dropping unsupported keys.
 */
export function normalizePersona(content: string, slug: string): string {
  const parsed = parseFrontmatter(content);

  // Build clean frontmatter with only supported keys
  const cleanFrontmatter: Record<string, string> = {};
  cleanFrontmatter["name"] = slug;

  // Add description from body if not present
  const description = parsed.frontmatter["description"] || extractDescription(parsed.body);
  cleanFrontmatter["description"] = description;

  // Copy remaining supported keys
  for (const [key, value] of Object.entries(parsed.frontmatter)) {
    if (key === "name" || key === "description") continue;
    if (UNSUPPORTED_KEYS.has(key)) continue;
    cleanFrontmatter[key] = value;
  }

  return serializeFrontmatter({ frontmatter: cleanFrontmatter, body: parsed.body });
}
