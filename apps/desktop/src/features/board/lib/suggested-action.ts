import type { TaskRecord, ArtifactRecord, Signal } from "@opengoat/contracts";

export interface SuggestedAction {
  text: string;
  icon: string;
}

export function computeSuggestedAction(
  task: TaskRecord,
  artifacts: ArtifactRecord[],
  _signals: Signal[],
): SuggestedAction | null {
  // Rule 1: blocked with blockers
  if (task.status === "blocked" && task.blockers.length > 0) {
    const n = task.blockers.length;
    return {
      text: `Resolve ${n} blocker${n === 1 ? "" : "s"} to unblock this task`,
      icon: "shield-alert",
    };
  }

  // Rule 2: artifacts ready for review
  const pendingArtifacts = artifacts.filter(
    (a) => a.status === "ready_for_review",
  );
  if (pendingArtifacts.length > 0) {
    const n = pendingArtifacts.length;
    return {
      text: `Review ${n} pending artifact${n === 1 ? "" : "s"}`,
      icon: "file-check",
    };
  }

  // Rule 3: task pending review
  if (task.status === "pending") {
    return { text: "Waiting for review", icon: "clock" };
  }

  // Rule 4: all artifacts approved and task is doing
  if (
    task.status === "doing" &&
    artifacts.length > 0 &&
    artifacts.every((a) => a.status === "approved")
  ) {
    return {
      text: "Mark as done — all artifacts approved",
      icon: "check-circle",
    };
  }

  // Rule 5: task is todo
  if (task.status === "todo") {
    return { text: "Start working on this task", icon: "play" };
  }

  // Default: no suggestion
  return null;
}
