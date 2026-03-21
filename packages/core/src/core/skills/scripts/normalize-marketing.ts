/**
 * Normalizes marketingskills SKILL.md files for OpenClaw compatibility.
 * - Ensures frontmatter keys are single-line
 * - Ensures `metadata` is a single-line JSON object if present
 */

import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";

export function normalizeMarketing(content: string): string {
  const parsed = parseFrontmatter(content);

  // metadata must be a single-line JSON string
  if (parsed.frontmatter["metadata"]) {
    try {
      const obj = JSON.parse(parsed.frontmatter["metadata"]);
      parsed.frontmatter["metadata"] = JSON.stringify(obj);
    } catch {
      // Already a string or invalid — leave as-is
    }
  }

  // parseFrontmatter already joins multiline values to single lines,
  // so all frontmatter keys are now single-line.
  return serializeFrontmatter(parsed);
}
