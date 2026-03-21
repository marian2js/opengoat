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

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Assembles a complete prompt from an ActionCard by combining:
 * 1. Skill reading instructions (for each skill in card.skills)
 * 2. Persona instruction (if card.persona is set)
 * 3. Context instruction (PRODUCT.md, MARKET.md, GROWTH.md)
 * 4. Task-specific instructions (card.prompt)
 * 5. Quality gate / self-critique section
 */
export function buildActionPrompt(card: ActionCard): string {
  const sections: string[] = [];

  // 1. Skills section
  if (card.skills.length > 0) {
    const skillLines = card.skills.map(
      (skillId) =>
        `Read and follow the skill at ./skills/marketing/${skillId}/SKILL.md\nIf the skill references files in its references/ subdirectory, read those too when relevant.`,
    );
    sections.push(skillLines.join("\n\n"));
  }

  // 2. Persona section (conditional)
  if (card.persona) {
    sections.push(
      `Read ./skills/personas/${card.persona}/SKILL.md and adopt its domain expertise and quality standards for this task.`,
    );
  }

  // 3. Context section
  sections.push(CONTEXT_INSTRUCTION);

  // 4. Task-specific instructions
  sections.push(card.prompt);

  // 5. Quality gate
  sections.push(QUALITY_GATE_TEMPLATE);

  return sections.join("\n\n");
}
