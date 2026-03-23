import assert from "node:assert/strict";
import test from "node:test";
import { computeSuggestedAction } from "./suggested-action.js";
import type { TaskRecord, ArtifactRecord, Signal } from "@opengoat/contracts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(
  overrides: Partial<TaskRecord> & { taskId: string; status: string },
): TaskRecord {
  return {
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    owner: "agent",
    assignedTo: "user",
    title: "Test task",
    description: "",
    blockers: [],
    artifacts: [],
    worklog: [],
    ...overrides,
  };
}

function makeArtifact(
  overrides: Partial<ArtifactRecord> & { artifactId: string; status: string },
): ArtifactRecord {
  return {
    projectId: "proj-1",
    title: "Artifact",
    type: "copy_draft",
    format: "markdown",
    contentRef: "ref-1",
    version: 1,
    createdBy: "agent",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  } as ArtifactRecord;
}

// ---------------------------------------------------------------------------
// Integration: suggested action with linked entities patterns
// ---------------------------------------------------------------------------

void test("suggested action priority: blocked > pending artifacts > pending > mark done > todo", () => {
  // Blocked has highest priority
  const blockedTask = makeTask({
    taskId: "t1",
    status: "blocked",
    blockers: ["x"],
  });
  const pendingArtifacts = [
    makeArtifact({ artifactId: "a1", status: "ready_for_review" }),
  ];
  const r1 = computeSuggestedAction(blockedTask, pendingArtifacts, []);
  assert.ok(r1);
  assert.match(r1.text, /blocker/);

  // Pending artifacts is next
  const doingTask = makeTask({ taskId: "t2", status: "doing" });
  const r2 = computeSuggestedAction(doingTask, pendingArtifacts, []);
  assert.ok(r2);
  assert.match(r2.text, /pending artifact/);

  // Pending status is next
  const pendingTask = makeTask({ taskId: "t3", status: "pending" });
  const r3 = computeSuggestedAction(pendingTask, [], []);
  assert.ok(r3);
  assert.match(r3.text, /review/i);

  // Mark as done with all approved
  const allApproved = [
    makeArtifact({ artifactId: "a2", status: "approved" }),
  ];
  const r4 = computeSuggestedAction(doingTask, allApproved, []);
  assert.ok(r4);
  assert.match(r4.text, /[Mm]ark as done/);

  // Todo task
  const todoTask = makeTask({ taskId: "t4", status: "todo" });
  const r5 = computeSuggestedAction(todoTask, [], []);
  assert.ok(r5);
  assert.match(r5.text, /[Ss]tart working/);
});

void test("suggested action returns correct icon for each state", () => {
  assert.equal(
    computeSuggestedAction(
      makeTask({ taskId: "t1", status: "blocked", blockers: ["x"] }),
      [],
      [],
    )?.icon,
    "shield-alert",
  );

  assert.equal(
    computeSuggestedAction(
      makeTask({ taskId: "t2", status: "doing" }),
      [makeArtifact({ artifactId: "a1", status: "ready_for_review" })],
      [],
    )?.icon,
    "file-check",
  );

  assert.equal(
    computeSuggestedAction(
      makeTask({ taskId: "t3", status: "pending" }),
      [],
      [],
    )?.icon,
    "clock",
  );

  assert.equal(
    computeSuggestedAction(
      makeTask({ taskId: "t4", status: "doing" }),
      [makeArtifact({ artifactId: "a1", status: "approved" })],
      [],
    )?.icon,
    "check-circle",
  );

  assert.equal(
    computeSuggestedAction(
      makeTask({ taskId: "t5", status: "todo" }),
      [],
      [],
    )?.icon,
    "play",
  );
});

void test("suggested action with mixed artifact statuses does not suggest mark as done", () => {
  const task = makeTask({ taskId: "t1", status: "doing" });
  const artifacts = [
    makeArtifact({ artifactId: "a1", status: "approved" }),
    makeArtifact({ artifactId: "a2", status: "needs_changes" }),
  ];
  const result = computeSuggestedAction(task, artifacts, []);
  // Should not suggest mark as done
  assert.ok(result === null || !result.text.toLowerCase().includes("mark as done"));
});

void test("suggested action with empty artifacts and doing status returns null", () => {
  const task = makeTask({ taskId: "t1", status: "doing" });
  const result = computeSuggestedAction(task, [], []);
  assert.equal(result, null);
});
