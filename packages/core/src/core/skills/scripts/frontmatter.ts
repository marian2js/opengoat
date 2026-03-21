/**
 * Minimal YAML frontmatter parser/serializer for SKILL.md files.
 * Handles simple key-value frontmatter delimited by --- markers.
 */

export interface ParsedSkillFile {
  frontmatter: Record<string, string>;
  body: string;
}

/**
 * Parses a SKILL.md file into frontmatter key-value pairs and body content.
 * Handles multiline values by joining them into single lines.
 */
export function parseFrontmatter(content: string): ParsedSkillFile {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") {
    return { frontmatter: {}, body: content };
  }

  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    return { frontmatter: {}, body: content };
  }

  const frontmatter: Record<string, string> = {};
  let currentKey = "";
  let currentValue = "";

  for (let i = 1; i < closingIndex; i++) {
    const line = lines[i] ?? "";
    const keyMatch = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*:\s*(.*)/);
    if (keyMatch) {
      if (currentKey) {
        frontmatter[currentKey] = currentValue.trim();
      }
      currentKey = keyMatch[1]!;
      currentValue = keyMatch[2] ?? "";
    } else if (currentKey) {
      // Continuation of multiline value — join to single line
      currentValue += " " + line.trim();
    }
  }
  if (currentKey) {
    frontmatter[currentKey] = currentValue.trim();
  }

  const body = lines.slice(closingIndex + 1).join("\n");
  return { frontmatter, body };
}

/**
 * Serializes frontmatter key-value pairs and body back into a SKILL.md string.
 */
export function serializeFrontmatter(parsed: ParsedSkillFile): string {
  const keys = Object.keys(parsed.frontmatter);
  if (keys.length === 0) {
    return parsed.body;
  }

  const frontmatterLines = ["---"];
  for (const key of keys) {
    frontmatterLines.push(`${key}: ${parsed.frontmatter[key]}`);
  }
  frontmatterLines.push("---");

  return frontmatterLines.join("\n") + "\n" + parsed.body;
}
