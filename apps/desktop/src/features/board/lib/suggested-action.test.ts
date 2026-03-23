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
    statusReason: undefined,
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

function makeSignal(
  overrides: Partial<Signal> & { signalId: string },
): Signal {
  return {
    projectId: "proj-1",
    sourceType: "web",
    signalType: "content_opportunity",
    title: "Signal",
    summary: "A signal",
    importance: "medium",
    freshness: "fresh",
    status: "new",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  } as Signal;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void test("returns blocker suggestion when task is blocked with blockers", () => {
  const task = makeTask({
    taskId: "t1",
    status: "blocked",
    blockers: ["Need API key", "Waiting for design"],
  });
  const result = computeSuggestedAction(task, [], []);
  assert.ok(result);
  assert.match(result.text, /2 blocker/);
  assert.equal(result.icon, "shield-alert");
});

void test("returns review artifacts suggestion when artifacts are ready_for_review", () => {
  const task = makeTask({ taskId: "t1", status: "doing" });
  const artifacts = [
    makeArtifact({ artifactId: "a1", status: "ready_for_review" }),
    makeArtifact({ artifactId: "a2", status: "ready_for_review" }),
    makeArtifact({ artifactId: "a3", status: "draft" }),
  ];
  const result = computeSuggestedAction(task, artifacts, []);
  assert.ok(result);
  assert.match(result.text, /2 pending artifact/);
  assert.equal(result.icon, "file-check");
});

void test("returns waiting for review when task is pending", () => {
  const task = makeTask({ taskId: "t1", status: "pending" });
  const result = computeSuggestedAction(task, [], []);
  assert.ok(result);
  assert.match(result.text, /[Ww]aiting for review/);
  assert.equal(result.icon, "clock");
});

void test("returns mark-as-done when all artifacts approved and task is doing", () => {
  const task = makeTask({ taskId: "t1", status: "doing" });
  const artifacts = [
    makeArtifact({ artifactId: "a1", status: "approved" }),
    makeArtifact({ artifactId: "a2", status: "approved" }),
  ];
  const result = computeSuggestedAction(task, artifacts, []);
  assert.ok(result);
  assert.match(result.text, /[Mm]ark as done/);
  assert.equal(result.icon, "check-circle");
});

void test("returns start suggestion when task is todo", () => {
  const task = makeTask({ taskId: "t1", status: "todo" });
  const result = computeSuggestedAction(task, [], []);
  assert.ok(result);
  assert.match(result.text, /[Ss]tart working/);
  assert.equal(result.icon, "play");
});

void test("returns null when task is done", () => {
  const task = makeTask({ taskId: "t1", status: "done" });
  const result = computeSuggestedAction(task, [], []);
  assert.equal(result, null);
});

void test("returns null when task is doing with no artifacts", () => {
  const task = makeTask({ taskId: "t1", status: "doing" });
  const result = computeSuggestedAction(task, [], []);
  assert.equal(result, null);
});

void test("blocker takes priority over artifacts ready for review", () => {
  const task = makeTask({
    taskId: "t1",
    status: "blocked",
    blockers: ["Blocker"],
  });
  const artifacts = [
    makeArtifact({ artifactId: "a1", status: "ready_for_review" }),
  ];
  const result = computeSuggestedAction(task, artifacts, []);
  assert.ok(result);
  assert.match(result.text, /blocker/);
});

void test("mark as done only when artifacts exist and all approved", () => {
  const task = makeTask({ taskId: "t1", status: "doing" });
  const artifacts = [
    makeArtifact({ artifactId: "a1", status: "approved" }),
    makeArtifact({ artifactId: "a2", status: "draft" }),
  ];
  const result = computeSuggestedAction(task, artifacts, []);
  // Should NOT suggest mark as done since not all approved
  assert.ok(result === null || !result.text.includes("Mark as done"));
});

void test("single blocker uses singular form", () => {
  const task = makeTask({
    taskId: "t1",
    status: "blocked",
    blockers: ["One blocker"],
  });
  const result = computeSuggestedAction(task, [], []);
  assert.ok(result);
  assert.match(result.text, /1 blocker(?!\(s\))/);
});
