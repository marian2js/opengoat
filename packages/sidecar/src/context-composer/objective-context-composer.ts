import type { ObjectiveRecord } from "@opengoat/core/core/objectives/domain/objective.js";
import type { MemoryRecord } from "@opengoat/core/core/memory/domain/memory.js";
import type { RunRecord } from "@opengoat/core/core/runs/domain/run.js";
import type { ArtifactRecord } from "@opengoat/core/core/artifacts/domain/artifact.js";

export interface ObjectiveContextInput {
  objective: ObjectiveRecord | null;
  objectiveMemories: MemoryRecord[];
  projectMemories: MemoryRecord[];
  run: RunRecord | null;
  artifacts: ArtifactRecord[];
}

export interface ContextComposerOptions {
  tokenBudget?: number;
}

const DEFAULT_TOKEN_BUDGET = 2000;
const MAX_ARTIFACTS_IN_CONTEXT = 10;

export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

function renderObjectiveSummary(objective: ObjectiveRecord): string {
  const lines: string[] = [
    "## Active Objective",
    "",
    `**Title:** ${objective.title}`,
    `**Status:** ${objective.status}`,
  ];

  if (objective.summary) {
    lines.push(`**Goal:** ${objective.summary}`);
  }
  if (objective.successDefinition) {
    lines.push(`**Success:** ${objective.successDefinition}`);
  }
  if (objective.whyNow) {
    lines.push(`**Why Now:** ${objective.whyNow}`);
  }
  if (objective.timeframe) {
    lines.push(`**Timeframe:** ${objective.timeframe}`);
  }
  if (objective.alreadyTried) {
    lines.push(`**Already Tried:** ${objective.alreadyTried}`);
  }
  if (objective.avoid) {
    lines.push(`**Avoid:** ${objective.avoid}`);
  }
  if (objective.constraints) {
    lines.push(`**Constraints:** ${objective.constraints}`);
  }

  return lines.join("\n");
}

function renderObjectiveMemory(memories: MemoryRecord[]): string {
  if (memories.length === 0) return "";

  const lines: string[] = ["## Objective Memory", ""];
  for (const mem of memories) {
    lines.push(`- [${mem.category}] ${mem.content}`);
  }
  return lines.join("\n");
}

function renderRunState(run: RunRecord): string {
  const lines: string[] = [
    "## Current Run",
    "",
    `**Title:** ${run.title}`,
    `**Status:** ${run.status}`,
    `**Phase:** ${run.phase}`,
  ];
  if (run.phaseSummary) {
    lines.push(`**Phase Summary:** ${run.phaseSummary}`);
  }
  if (run.playbookId) {
    lines.push(`**Playbook:** ${run.playbookId}`);
  }
  return lines.join("\n");
}

function renderArtifactSummaries(artifacts: ArtifactRecord[]): string {
  if (artifacts.length === 0) return "";

  const limited = artifacts.slice(0, MAX_ARTIFACTS_IN_CONTEXT);
  const lines: string[] = ["## Linked Artifacts", ""];
  for (const art of limited) {
    lines.push(`- **${art.title}** (${art.type}, ${art.status})`);
  }
  if (artifacts.length > MAX_ARTIFACTS_IN_CONTEXT) {
    lines.push(`- ... and ${artifacts.length - MAX_ARTIFACTS_IN_CONTEXT} more`);
  }
  return lines.join("\n");
}

function renderProjectMemory(memories: MemoryRecord[]): string {
  if (memories.length === 0) return "";

  const lines: string[] = ["## Project Memory", ""];
  for (const mem of memories) {
    lines.push(`- [${mem.category}] ${mem.content}`);
  }
  return lines.join("\n");
}

export function composeObjectiveContext(
  input: ObjectiveContextInput,
  options: ContextComposerOptions = {},
): string {
  const { objective } = input;
  if (!objective) return "";

  const tokenBudget = options.tokenBudget ?? DEFAULT_TOKEN_BUDGET;

  // Build sections in priority order
  const sections: string[] = [];

  // Priority 1: Objective summary (always included if available)
  const objSection = renderObjectiveSummary(objective);
  sections.push(objSection);

  // Priority 2: Objective memory
  const objMemSection = renderObjectiveMemory(input.objectiveMemories);
  if (objMemSection) sections.push(objMemSection);

  // Priority 3: Current run state
  if (input.run) {
    const runSection = renderRunState(input.run);
    sections.push(runSection);
  }

  // Priority 4: Artifact summaries
  const artSection = renderArtifactSummaries(input.artifacts);
  if (artSection) sections.push(artSection);

  // Priority 5: Project memory
  const projMemSection = renderProjectMemory(input.projectMemories);
  if (projMemSection) sections.push(projMemSection);

  // Assemble with budget tracking — keep adding sections until budget exceeded
  const includedSections: string[] = [];
  let currentTokens = 0;
  // Reserve tokens for wrapper tags
  const wrapperOverhead = estimateTokens("<objective-context>\n\n</objective-context>");

  for (const section of sections) {
    const sectionTokens = estimateTokens(section);
    if (currentTokens + sectionTokens + wrapperOverhead > tokenBudget && includedSections.length > 0) {
      // Budget exceeded — stop adding sections, but always include at least the first section
      break;
    }
    includedSections.push(section);
    currentTokens += sectionTokens;
  }

  if (includedSections.length === 0) return "";

  const body = includedSections.join("\n\n");
  return `<objective-context>\n${body}\n</objective-context>`;
}
