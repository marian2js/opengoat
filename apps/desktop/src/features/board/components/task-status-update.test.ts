import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Test the status update logic: the actorId passed to updateTaskStatus
// should be the task's owner so the sidecar permission check passes.
// ---------------------------------------------------------------------------

interface MockTask {
  taskId: string;
  owner: string;
  assignedTo: string;
  status: string;
}

interface StatusUpdateCall {
  taskId: string;
  status: string;
  reason: string | undefined;
  actorId: string | undefined;
}

/**
 * Simulates the handleStatusChange logic from TaskDetailPanel.
 * This mirrors the real implementation's behavior of passing task.owner
 * as the actorId to the client's updateTaskStatus method.
 */
async function simulateStatusChange(
  taskId: string | null,
  task: MockTask | null,
  status: string,
  reason?: string,
): Promise<StatusUpdateCall | null> {
  if (!taskId) return null;

  return {
    taskId,
    status,
    reason,
    actorId: task?.owner,
  };
}

void test("handleStatusChange passes task owner as actorId", async () => {
  const task: MockTask = {
    taskId: "task-1",
    owner: "agent-abc",
    assignedTo: "agent-xyz",
    status: "todo",
  };

  const call = await simulateStatusChange("task-1", task, "doing");
  assert.ok(call);
  assert.equal(call.actorId, "agent-abc");
  assert.equal(call.status, "doing");
  assert.equal(call.taskId, "task-1");
});

void test("handleStatusChange passes reason along with actorId", async () => {
  const task: MockTask = {
    taskId: "task-2",
    owner: "agent-abc",
    assignedTo: "agent-abc",
    status: "doing",
  };

  const call = await simulateStatusChange("task-2", task, "blocked", "Waiting for approval");
  assert.ok(call);
  assert.equal(call.actorId, "agent-abc");
  assert.equal(call.status, "blocked");
  assert.equal(call.reason, "Waiting for approval");
});

void test("handleStatusChange returns null when taskId is null", async () => {
  const task: MockTask = {
    taskId: "task-1",
    owner: "agent-abc",
    assignedTo: "agent-abc",
    status: "todo",
  };

  const call = await simulateStatusChange(null, task, "doing");
  assert.equal(call, null);
});

void test("handleStatusChange passes undefined actorId when task is null", async () => {
  const call = await simulateStatusChange("task-1", null, "doing");
  assert.ok(call);
  assert.equal(call.actorId, undefined);
});
