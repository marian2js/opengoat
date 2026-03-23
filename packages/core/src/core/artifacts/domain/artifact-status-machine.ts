import type { ArtifactStatus } from "./artifact.js";

export const VALID_ARTIFACT_TRANSITIONS: Record<
  ArtifactStatus,
  ArtifactStatus[]
> = {
  draft: ["ready_for_review", "archived"],
  ready_for_review: ["approved", "needs_changes", "archived"],
  needs_changes: ["ready_for_review", "archived"],
  approved: ["archived"],
  archived: [],
};

const TERMINAL_STATUSES: ReadonlySet<ArtifactStatus> = new Set(["archived"]);

export function validateArtifactStatusTransition(
  from: ArtifactStatus,
  to: ArtifactStatus,
): void {
  const allowed = VALID_ARTIFACT_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid artifact status transition from "${from}" to "${to}"`,
    );
  }
}

export function getValidNextArtifactStatuses(
  from: ArtifactStatus,
): ArtifactStatus[] {
  return [...VALID_ARTIFACT_TRANSITIONS[from]];
}

export function isTerminalArtifactStatus(status: ArtifactStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
