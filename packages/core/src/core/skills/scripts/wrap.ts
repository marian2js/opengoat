/**
 * Adds `disable-model-invocation: true` to every output SKILL.md frontmatter.
 */

import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";

export function wrapSkill(content: string): string {
  const parsed = parseFrontmatter(content);
  parsed.frontmatter["disable-model-invocation"] = "true";
  return serializeFrontmatter(parsed);
}
