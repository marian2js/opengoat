import type { RunRecord } from "@opengoat/core/core/runs/domain/run.js";
import type { ArtifactRecord } from "@opengoat/core/core/artifacts/domain/artifact.js";
import type { PlaybookManifest } from "@opengoat/core/core/playbooks/domain/playbook.js";

export interface PlaybookPhaseContextInput {
  run: RunRecord | null;
  playbook: PlaybookManifest | null;
  artifacts: ArtifactRecord[];
}

/**
 * Composes natural-language playbook phase context for specialist chat.
 *
 * Tells the specialist what phase of the playbook they're in, what artifacts
 * are expected, and what comes next — as guidance, not a rigid script.
 */
export function composePlaybookPhaseContext(input: PlaybookPhaseContextInput): string {
  const { run, playbook, artifacts } = input;

  if (!run || !playbook) return "";

  const phases = playbook.defaultPhases;
  const currentPhaseIndex = phases.findIndex((p) => p.name === run.phase);

  if (currentPhaseIndex === -1) return "";

  const currentPhase = phases[currentPhaseIndex]!;
  const totalPhases = phases.length;
  const phaseNumber = currentPhaseIndex + 1;

  const lines: string[] = [];

  // Natural-language intro
  lines.push(
    `You're in the **${currentPhase.name}** phase of a **${playbook.title}** workflow (Phase ${phaseNumber}/${totalPhases}).`,
  );
  lines.push("");

  // Phase description
  lines.push(`**Phase goal:** ${currentPhase.description}`);

  // Expected artifacts for this phase
  const expectedArtifacts = currentPhase.expectedArtifacts ?? [];
  if (expectedArtifacts.length > 0) {
    lines.push("");
    lines.push("**Expected deliverables for this phase:**");
    for (const artifact of expectedArtifacts) {
      lines.push(`- ${artifact}`);
    }
  }

  // Upcoming phases
  const upcomingPhases = phases.slice(currentPhaseIndex + 1);
  if (upcomingPhases.length > 0) {
    lines.push("");
    const upcoming = upcomingPhases.map((p) => p.name).join(" → ");
    lines.push(`**Next:** ${upcoming}`);
  }

  const body = lines.join("\n");
  return `<playbook-phase-context>\n${body}\n</playbook-phase-context>`;
}
