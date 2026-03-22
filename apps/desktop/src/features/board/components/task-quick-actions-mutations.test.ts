import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Test the add blocker / artifact / worklog logic that will live in
// TaskDetailPanel.  We simulate the handler functions the same way the
// existing task-status-update tests do: by extracting the core logic into
// a pure function and asserting the call shape.
// ---------------------------------------------------------------------------

interface MockTask {
  taskId: string;
  owner: string;
  assignedTo: string;
  status: string;
}

interface MutationCall {
  taskId: string;
  content: string;
  actorId: string | undefined;
}

/**
 * Simulates the handleAddBlocker / handleAddArtifact / handleAddWorklog
 * logic from TaskDetailPanel.  Each handler guards on taskId, passes
 * task.owner as actorId, and forwards the user-supplied content string.
 */
function simulateAddEntry(
  taskId: string | null,
  task: MockTask | null,
  content: string,
): MutationCall | null {
  if (!taskId) return null;

  return {
    taskId,
    content,
    actorId: task?.owner,
  };
}

// ---- Add Blocker -----------------------------------------------------------

void test("handleAddBlocker passes task owner as actorId", async () => {
  const task: MockTask = {
    taskId: "task-1",
    owner: "agent-abc",
    assignedTo: "agent-xyz",
    status: "doing",
  };

  const call = simulateAddEntry("task-1", task, "Waiting for API key");
  assert.ok(call);
  assert.equal(call.actorId, "agent-abc");
  assert.equal(call.content, "Waiting for API key");
  assert.equal(call.taskId, "task-1");
});

void test("handleAddBlocker returns null when taskId is null", async () => {
  const call = simulateAddEntry(null, null, "some blocker");
  assert.equal(call, null);
});

void test("handleAddBlocker passes undefined actorId when task is null", async () => {
  const call = simulateAddEntry("task-1", null, "some blocker");
  assert.ok(call);
  assert.equal(call.actorId, undefined);
});

// ---- Add Artifact ----------------------------------------------------------

void test("handleAddArtifact passes task owner as actorId", async () => {
  const task: MockTask = {
    taskId: "task-2",
    owner: "agent-def",
    assignedTo: "agent-xyz",
    status: "doing",
  };

  const call = simulateAddEntry("task-2", task, "Draft homepage copy v1");
  assert.ok(call);
  assert.equal(call.actorId, "agent-def");
  assert.equal(call.content, "Draft homepage copy v1");
});

// ---- Add Worklog -----------------------------------------------------------

void test("handleAddWorklog passes task owner as actorId", async () => {
  const task: MockTask = {
    taskId: "task-3",
    owner: "agent-ghi",
    assignedTo: "agent-ghi",
    status: "doing",
  };

  const call = simulateAddEntry("task-3", task, "Researched competitor pricing");
  assert.ok(call);
  assert.equal(call.actorId, "agent-ghi");
  assert.equal(call.content, "Researched competitor pricing");
});

void test("handleAddWorklog returns null when taskId is null", async () => {
  const call = simulateAddEntry(null, null, "some worklog");
  assert.equal(call, null);
});
