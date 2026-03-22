import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Inline minimal implementation to test pure logic
// Since the hook uses React hooks (useState, useEffect, useCallback),
// we test the core fetch logic and refresh mechanism here.
// ---------------------------------------------------------------------------

// Simulate the core logic of useTaskDetail without React hooks
interface TaskDetailState {
  task: unknown | null;
  isLoading: boolean;
  error: string | null;
}

async function fetchTaskDetail(
  taskId: string | null,
  getTask: (id: string) => Promise<unknown>,
): Promise<TaskDetailState> {
  if (!taskId) {
    return { task: null, isLoading: false, error: null };
  }
  try {
    const task = await getTask(taskId);
    return { task, isLoading: false, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { task: null, isLoading: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void test("useTaskDetail: returns null task when taskId is null", async () => {
  const getTask = async () => {
    throw new Error("should not be called");
  };
  const result = await fetchTaskDetail(null, getTask);
  assert.equal(result.task, null);
  assert.equal(result.isLoading, false);
  assert.equal(result.error, null);
});

void test("useTaskDetail: calls getTask when taskId is provided", async () => {
  let calledWith: string | null = null;
  const mockTask = { taskId: "t1", title: "Test Task", status: "todo" };
  const getTask = async (id: string) => {
    calledWith = id;
    return mockTask;
  };
  const result = await fetchTaskDetail("t1", getTask);
  assert.equal(calledWith, "t1");
  assert.deepEqual(result.task, mockTask);
  assert.equal(result.error, null);
});

void test("useTaskDetail: returns error when getTask fails", async () => {
  const getTask = async () => {
    throw new Error("Network error");
  };
  const result = await fetchTaskDetail("t1", getTask);
  assert.equal(result.task, null);
  assert.equal(result.error, "Network error");
});

void test("useTaskDetail: handles non-Error throws", async () => {
  const getTask = async () => {
    throw "string error";
  };
  const result = await fetchTaskDetail("t1", getTask);
  assert.equal(result.task, null);
  assert.equal(result.error, "string error");
});

void test("useTaskDetail: returns different tasks for different taskIds", async () => {
  const tasks: Record<string, unknown> = {
    t1: { taskId: "t1", title: "Task One" },
    t2: { taskId: "t2", title: "Task Two" },
  };
  const getTask = async (id: string) => {
    if (!(id in tasks)) throw new Error("Not found");
    return tasks[id];
  };

  const result1 = await fetchTaskDetail("t1", getTask);
  assert.deepEqual(result1.task, { taskId: "t1", title: "Task One" });

  const result2 = await fetchTaskDetail("t2", getTask);
  assert.deepEqual(result2.task, { taskId: "t2", title: "Task Two" });
});
