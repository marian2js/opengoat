import assert from "node:assert/strict";
import test from "node:test";
import type { TaskRecord } from "@opengoat/contracts";
import { createTaskRoutes } from "./tasks.ts";

function createMockTaskRecord(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    taskId: "task-1",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    owner: "agent-1",
    assignedTo: "agent-1",
    title: "Test task",
    description: "A test task",
    status: "todo",
    blockers: [],
    artifacts: [],
    worklog: [],
    ...overrides,
  };
}

function createMockRuntime(boardServiceOverrides: Record<string, unknown> = {}) {
  return {
    authSessions: {} as never,
    authService: {} as never,
    boardService: {
      listLatestTasksPage: () =>
        Promise.resolve({
          tasks: [createMockTaskRecord()],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      getTask: (_paths: unknown, taskId: string) =>
        Promise.resolve(createMockTaskRecord({ taskId })),
      updateTaskStatus: (_paths: unknown, _actorId: string, taskId: string, status: string, reason?: string) =>
        Promise.resolve(createMockTaskRecord({ taskId, status, statusReason: reason })),
      addTaskBlocker: (_paths: unknown, _actorId: string, taskId: string, blocker: string) =>
        Promise.resolve(createMockTaskRecord({ taskId, blockers: [blocker] })),
      addTaskArtifact: (_paths: unknown, _actorId: string, taskId: string, content: string) =>
        Promise.resolve(
          createMockTaskRecord({
            taskId,
            artifacts: [{ createdAt: "2025-01-01T00:00:00.000Z", createdBy: "sidecar", content }],
          }),
        ),
      addTaskWorklog: (_paths: unknown, _actorId: string, taskId: string, content: string) =>
        Promise.resolve(
          createMockTaskRecord({
            taskId,
            worklog: [{ createdAt: "2025-01-01T00:00:00.000Z", createdBy: "sidecar", content }],
          }),
        ),
      deleteTasks: (_paths: unknown, _actorId: string, taskIds: string[]) =>
        Promise.resolve({ deletedTaskIds: taskIds, deletedCount: taskIds.length }),
      ...boardServiceOverrides,
    },
    config: {
      hostname: "127.0.0.1",
      password: "password",
      port: 3000,
      username: "opengoat",
    },
    embeddedGateway: {} as never,
    gatewaySupervisor: {} as never,
    opengoatPaths: { agentsDir: "/tmp/agents", dataDir: "/tmp/data" },
    skillService: {} as never,
    startedAt: Date.now(),
    version: "0.1.0-test",
  };
}

void test("GET /tasks returns paginated task list", async () => {
  const app = createTaskRoutes(createMockRuntime() as never);

  const response = await app.request("/");
  assert.equal(response.status, 200);

  const data = (await response.json()) as { tasks: TaskRecord[]; total: number; limit: number; offset: number };
  assert.equal(data.tasks.length, 1);
  assert.equal(data.total, 1);
  assert.equal(data.limit, 50);
  assert.equal(data.offset, 0);
});

void test("GET /tasks passes query params to service", async () => {
  let capturedOptions: Record<string, unknown> = {};
  const app = createTaskRoutes(
    createMockRuntime({
      listLatestTasksPage: (_paths: unknown, options: Record<string, unknown>) => {
        capturedOptions = options;
        return Promise.resolve({ tasks: [], total: 0, limit: 10, offset: 5 });
      },
    }) as never,
  );

  const response = await app.request("/?status=doing&assignee=agent-2&limit=10&offset=5");
  assert.equal(response.status, 200);
  assert.equal(capturedOptions.status, "doing");
  assert.equal(capturedOptions.assignee, "agent-2");
  assert.equal(capturedOptions.limit, 10);
  assert.equal(capturedOptions.offset, 5);
});

void test("GET /tasks/:taskId returns single task", async () => {
  const app = createTaskRoutes(createMockRuntime() as never);

  const response = await app.request("/task-1");
  assert.equal(response.status, 200);

  const data = (await response.json()) as TaskRecord;
  assert.equal(data.taskId, "task-1");
  assert.equal(data.title, "Test task");
});

void test("GET /tasks/:taskId returns 404 for missing task", async () => {
  const app = createTaskRoutes(
    createMockRuntime({
      getTask: () => Promise.reject(new Error('Task "missing" does not exist.')),
    }) as never,
  );

  const response = await app.request("/missing");
  assert.equal(response.status, 404);

  const data = (await response.json()) as { error: string };
  assert.ok(data.error.includes("does not exist"));
});

void test("PATCH /tasks/:taskId/status updates task status", async () => {
  const app = createTaskRoutes(createMockRuntime() as never);

  const response = await app.request("/task-1/status", {
    body: JSON.stringify({ status: "doing" }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  assert.equal(response.status, 200);

  const data = (await response.json()) as TaskRecord;
  assert.equal(data.status, "doing");
});

void test("PATCH /tasks/:taskId/status accepts reason", async () => {
  const app = createTaskRoutes(createMockRuntime() as never);

  const response = await app.request("/task-1/status", {
    body: JSON.stringify({ status: "blocked", reason: "Waiting for approval" }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  assert.equal(response.status, 200);

  const data = (await response.json()) as TaskRecord;
  assert.equal(data.status, "blocked");
  assert.equal(data.statusReason, "Waiting for approval");
});

void test("PATCH /tasks/:taskId/status uses x-actor-id header", async () => {
  let capturedActorId = "";
  const app = createTaskRoutes(
    createMockRuntime({
      updateTaskStatus: (_paths: unknown, actorId: string, taskId: string, status: string) => {
        capturedActorId = actorId;
        return Promise.resolve(createMockTaskRecord({ taskId, status }));
      },
    }) as never,
  );

  await app.request("/task-1/status", {
    body: JSON.stringify({ status: "doing" }),
    headers: { "Content-Type": "application/json", "x-actor-id": "my-agent" },
    method: "PATCH",
  });
  assert.equal(capturedActorId, "my-agent");
});

void test("POST /tasks/:taskId/blockers adds a blocker", async () => {
  const app = createTaskRoutes(createMockRuntime() as never);

  const response = await app.request("/task-1/blockers", {
    body: JSON.stringify({ content: "Need API key" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(response.status, 200);

  const data = (await response.json()) as TaskRecord;
  assert.ok(data.blockers.includes("Need API key"));
});

void test("POST /tasks/:taskId/artifacts adds an artifact", async () => {
  const app = createTaskRoutes(createMockRuntime() as never);

  const response = await app.request("/task-1/artifacts", {
    body: JSON.stringify({ content: "Draft copy v1" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(response.status, 200);

  const data = (await response.json()) as TaskRecord;
  assert.equal(data.artifacts.length, 1);
  assert.equal(data.artifacts[0]?.content, "Draft copy v1");
});

void test("POST /tasks/:taskId/worklog adds a worklog entry", async () => {
  const app = createTaskRoutes(createMockRuntime() as never);

  const response = await app.request("/task-1/worklog", {
    body: JSON.stringify({ content: "Started research phase" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(response.status, 200);

  const data = (await response.json()) as TaskRecord;
  assert.equal(data.worklog.length, 1);
  assert.equal(data.worklog[0]?.content, "Started research phase");
});

void test("DELETE /tasks deletes tasks by IDs", async () => {
  const app = createTaskRoutes(createMockRuntime() as never);

  const response = await app.request("/", {
    body: JSON.stringify({ taskIds: ["task-1", "task-2"] }),
    headers: { "Content-Type": "application/json" },
    method: "DELETE",
  });
  assert.equal(response.status, 200);

  const data = (await response.json()) as { deletedTaskIds: string[]; deletedCount: number };
  assert.deepEqual(data.deletedTaskIds, ["task-1", "task-2"]);
  assert.equal(data.deletedCount, 2);
});

void test("DELETE /tasks uses x-actor-id header", async () => {
  let capturedActorId = "";
  const app = createTaskRoutes(
    createMockRuntime({
      deleteTasks: (_paths: unknown, actorId: string, taskIds: string[]) => {
        capturedActorId = actorId;
        return Promise.resolve({ deletedTaskIds: taskIds, deletedCount: taskIds.length });
      },
    }) as never,
  );

  await app.request("/", {
    body: JSON.stringify({ taskIds: ["task-1"] }),
    headers: { "Content-Type": "application/json", "x-actor-id": "my-agent" },
    method: "DELETE",
  });
  assert.equal(capturedActorId, "my-agent");
});
