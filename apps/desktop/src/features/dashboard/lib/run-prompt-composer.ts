import type { PlaybookManifest } from "@opengoat/contracts";

// Re-export constants from prompt-builder to avoid path-alias issues in tests
export const QUALITY_GATE_TEMPLATE = `After completing your work, self-critique:
- Default assumption: your work NEEDS IMPROVEMENT unless evidence says otherwise
- Flag any recommendations that lack specific evidence from the website or workspace
- Rate confidence per recommendation: high (strong evidence), medium (reasonable inference), low (hypothesis)
- If you find yourself giving a perfect or uniformly positive assessment, dig deeper
- Cite specific URLs, text, or data points as evidence for each finding
- Be specific to THIS product — reject any output that could apply to any company`;

export const CONTEXT_INSTRUCTION = `Read the workspace context files — PRODUCT.md, MARKET.md, and GROWTH.md — to understand this product, its target audience, market positioning, and growth opportunities.`;

/**
 * Minimal objective shape needed by the prompt composer.
 * Accepts the full Objective from contracts or the local dashboard type.
 */
export interface RunObjectiveContext {
  title: string;
  summary?: string;
  successDefinition?: string;
  constraints?: string;
  avoid?: string;
}

export interface RunPromptParams {
  playbook: PlaybookManifest;
  objective: RunObjectiveContext;
  phaseName: string;
}

/**
 * Composes a structured prompt for a playbook run's agent session.
 *
 * Sections:
 * 1. Role preamble
 * 2. Playbook context (title, description, current phase + instructions)
 * 3. Skill references
 * 4. Objective context (summary, success definition, constraints, avoid)
 * 5. Project context (PRODUCT.md, MARKET.md, GROWTH.md)
 * 6. Task policy
 * 7. Artifact policy (expected types)
 * 8. Quality gate
 */
export function buildRunPrompt(params: RunPromptParams): string {
  const { playbook, objective, phaseName } = params;
  const sections: string[] = [];

  // 1. Role preamble
  sections.push(
    "You are executing a marketing playbook run. Follow the phase instructions below.",
  );

  // 2. Playbook context
  const currentPhase = playbook.defaultPhases.find(
    (p) => p.name === phaseName,
  );
  const phaseBlock = [
    `## Playbook: ${playbook.title}`,
    playbook.description,
    "",
    `### Current Phase: ${phaseName}`,
    currentPhase
      ? currentPhase.description
      : "(no specific instructions for this phase)",
  ];
  if (currentPhase?.expectedArtifacts && currentPhase.expectedArtifacts.length > 0) {
    phaseBlock.push(
      `Expected artifacts for this phase: ${currentPhase.expectedArtifacts.join(", ")}`,
    );
  }
  sections.push(phaseBlock.join("\n"));

  // 3. Skill references
  if (playbook.skillRefs.length > 0) {
    const skillLines = playbook.skillRefs.map(
      (skillId) =>
        `Read and follow the skill at ./skills/marketing/${skillId}/SKILL.md\nIf the skill references files in its references/ subdirectory, read those too when relevant.`,
    );
    sections.push(skillLines.join("\n\n"));
  }

  // 4. Objective context
  const objectiveLines: string[] = ["## Objective Context"];
  objectiveLines.push(`**Objective:** ${objective.title}`);
  if (objective.summary) {
    objectiveLines.push(`**Summary:** ${objective.summary}`);
  }
  if (objective.successDefinition) {
    objectiveLines.push(
      `**Success Definition:** ${objective.successDefinition}`,
    );
  }
  if (objective.constraints) {
    objectiveLines.push(`**Constraints:** ${objective.constraints}`);
  }
  if (objective.avoid) {
    objectiveLines.push(`**Avoid:** ${objective.avoid}`);
  }
  sections.push(objectiveLines.join("\n"));

  // 5. Project context
  sections.push(CONTEXT_INSTRUCTION);

  // 6. Task policy
  sections.push(`## Task Policy\n${playbook.taskPolicy}`);

  // 7. Artifact policy
  sections.push(
    `## Expected Artifact Types\n${playbook.artifactTypes.join(", ")}`,
  );

  // 8. Quality gate
  sections.push(QUALITY_GATE_TEMPLATE);

  return sections.join("\n\n");
}
