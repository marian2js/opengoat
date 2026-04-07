import type { ActionCard } from "./actions";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const QUALITY_GATE_TEMPLATE = `After completing your work, self-critique:
- Default assumption: your work NEEDS IMPROVEMENT unless evidence says otherwise
- Flag any recommendations that lack specific evidence from the website or workspace
- Rate confidence per recommendation: high (strong evidence), medium (reasonable inference), low (hypothesis)
- If you find yourself giving a perfect or uniformly positive assessment, dig deeper
- Cite specific URLs, text, or data points as evidence for each finding
- Be specific to THIS product — reject any output that could apply to any company`;

export const CONTEXT_INSTRUCTION = `Read the workspace context files — PRODUCT.md, MARKET.md, and GROWTH.md — to understand this product, its target audience, market positioning, and growth opportunities.`;

export const MISSING_FILE_INSTRUCTION = `Important: Some files referenced below may not exist in the workspace yet. If you cannot read a file, skip it silently and continue with the information you have. Do NOT mention, warn about, or apologize for missing files in your output.`;

export const OUTPUT_FORMAT_INSTRUCTION = `Format your response as structured markdown. Use ## headings for each numbered deliverable, bullet points and numbered lists for items within each section, and blank lines between sections. Each major output must be its own clearly separated section — never combine multiple deliverables into a single paragraph.`;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Assembles a complete prompt from an ActionCard by combining:
 * 1. Missing-file handling preamble
 * 2. Skill reading instructions (for each skill in card.skills)
 * 3. Persona instruction (if card.persona is set)
 * 4. Context instruction (PRODUCT.md, MARKET.md, GROWTH.md)
 * 5. Task-specific instructions (card.prompt)
 * 6. Output format instructions
 * 7. Quality gate / self-critique section
 */
export function buildActionPrompt(card: ActionCard): string {
  const sections: string[] = [];

  // 1. Missing-file handling preamble
  sections.push(MISSING_FILE_INSTRUCTION);

  // 2. Skills section
  if (card.skills.length > 0) {
    const skillLines = card.skills.map(
      (skillId) =>
        `If it exists, read and follow the skill at ./skills/marketing/${skillId}/SKILL.md\nIf the skill references files in its references/ subdirectory, read those too when relevant.`,
    );
    sections.push(skillLines.join("\n\n"));
  }

  // 3. Persona section (conditional)
  if (card.persona) {
    sections.push(
      `If it exists, read ./skills/personas/${card.persona}/SKILL.md and adopt its domain expertise and quality standards for this task.`,
    );
  }

  // 4. Context section
  sections.push(CONTEXT_INSTRUCTION);

  // 5. Task-specific instructions
  sections.push(card.prompt);

  // 6. Output format instructions
  sections.push(OUTPUT_FORMAT_INSTRUCTION);

  // 7. Quality gate
  sections.push(QUALITY_GATE_TEMPLATE);

  return sections.join("\n\n");
}

/**
 * Builds an action prompt enriched with structured intake form values.
 * Prepends a "## User Context" section with the intake values formatted
 * as labeled key-value pairs, keeping the existing 7-part prompt intact.
 */
export function buildActionPromptWithIntake(
  card: ActionCard,
  intakeValues: Record<string, string>,
): string {
  const base = buildActionPrompt(card);
  const entries = Object.entries(intakeValues).filter(([, v]) => v.trim());
  if (entries.length === 0) return base;

  const lines = entries.map(([k, v]) => `- **${formatKey(k)}**: ${v}`).join("\n");
  return `## User Context\n${lines}\n\n${base}`;
}

/** Converts camelCase keys to readable labels (e.g. "targetBuyer" → "Target buyer") */
function formatKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
