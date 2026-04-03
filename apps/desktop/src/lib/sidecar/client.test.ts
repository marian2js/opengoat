import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Test that SidecarClient.createTaskFromRun correctly handles actorId
// and sends the expected JSON body. We mock globalThis.fetch to capture
// requests, following the same pattern as client-task-actor.test.ts.
// ---------------------------------------------------------------------------

import { SidecarClient } from "./client";

const CONNECTION = { url: "http://localhost:9999", username: "u", password: "p" };

function mockFetch(responseBody: Record<string, unknown> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: URL | string, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof globalThis.fetch;

  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const MOCK_TASK = {
  taskId: "task-1",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  owner: "agent-1",
  assignedTo: "agent-1",
  title: "Test",
  description: "",
  status: "todo",
  blockers: [],
  artifacts: [],
  worklog: [],
};

void test("createTaskFromRun sends x-actor-id header when actorId is provided", async () => {
  const { calls, restore } = mockFetch(MOCK_TASK);
  try {
    const client = new SidecarClient(CONNECTION);
    await client.createTaskFromRun(
      {
        runId: "run-1",
        objectiveId: "obj-1",
        title: "Task from run",
        description: "Some output",
      },
      "agent-abc",
    );

    assert.equal(calls.length, 1);
    const headers = new Headers(calls[0]!.init.headers as HeadersInit);
    assert.equal(headers.get("x-actor-id"), "agent-abc");
  } finally {
    restore();
  }
});

void test("createTaskFromRun does NOT send x-actor-id header when actorId is omitted", async () => {
  const { calls, restore } = mockFetch(MOCK_TASK);
  try {
    const client = new SidecarClient(CONNECTION);
    await client.createTaskFromRun({
      runId: "run-1",
      objectiveId: "obj-1",
      title: "Task from run",
      description: "Some output",
    });

    assert.equal(calls.length, 1);
    const headers = new Headers(calls[0]!.init.headers as HeadersInit);
    assert.equal(headers.get("x-actor-id"), null);
  } finally {
    restore();
  }
});

void test("createTaskFromRun sends correct JSON body", async () => {
  const { calls, restore } = mockFetch(MOCK_TASK);
  try {
    const client = new SidecarClient(CONNECTION);
    const payload = {
      runId: "run-42",
      objectiveId: "obj-7",
      title: "My output task",
      description: "Detailed description of the output",
    };
    await client.createTaskFromRun(payload, "agent-1");

    assert.equal(calls.length, 1);

    // Verify the URL targets /tasks/from-run
    assert.ok(
      calls[0]!.url.endsWith("/tasks/from-run"),
      `Expected URL to end with /tasks/from-run, got ${calls[0]!.url}`,
    );

    // Verify the method is POST
    assert.equal(calls[0]!.init.method, "POST");

    // Verify the body matches the payload
    const body = JSON.parse(calls[0]!.init.body as string) as Record<string, unknown>;
    assert.equal(body.runId, "run-42");
    assert.equal(body.objectiveId, "obj-7");
    assert.equal(body.title, "My output task");
    assert.equal(body.description, "Detailed description of the output");
  } finally {
    restore();
  }
});

void test("createTaskFromRun sends optional fields when provided", async () => {
  const { calls, restore } = mockFetch(MOCK_TASK);
  try {
    const client = new SidecarClient(CONNECTION);
    await client.createTaskFromRun({
      runId: "run-1",
      objectiveId: "obj-1",
      title: "Task",
      description: "Desc",
      assignedTo: "agent-2",
      status: "doing",
    });

    assert.equal(calls.length, 1);
    const body = JSON.parse(calls[0]!.init.body as string) as Record<string, unknown>;
    assert.equal(body.assignedTo, "agent-2");
    assert.equal(body.status, "doing");
  } finally {
    restore();
  }
});
