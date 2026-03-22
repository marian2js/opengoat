import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Test that SidecarClient task mutation methods accept and forward an actorId
// as the x-actor-id header. We mock globalThis.fetch to capture requests.
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

void test("updateTaskStatus sends x-actor-id header", async () => {
  const { calls, restore } = mockFetch(MOCK_TASK);
  try {
    const client = new SidecarClient(CONNECTION);
    await client.updateTaskStatus("task-1", "doing", undefined, "agent-1");

    assert.equal(calls.length, 1);
    const headers = new Headers(calls[0]!.init.headers as HeadersInit);
    assert.equal(headers.get("x-actor-id"), "agent-1");
  } finally {
    restore();
  }
});

void test("addTaskBlocker sends x-actor-id header", async () => {
  const { calls, restore } = mockFetch({ ...MOCK_TASK, blockers: ["blocker"] });
  try {
    const client = new SidecarClient(CONNECTION);
    await client.addTaskBlocker("task-1", "blocker", "agent-1");

    assert.equal(calls.length, 1);
    const headers = new Headers(calls[0]!.init.headers as HeadersInit);
    assert.equal(headers.get("x-actor-id"), "agent-1");
  } finally {
    restore();
  }
});

void test("addTaskArtifact sends x-actor-id header", async () => {
  const mockTaskWithArtifact = {
    ...MOCK_TASK,
    artifacts: [{ createdAt: "2025-01-01T00:00:00.000Z", createdBy: "agent-1", content: "artifact" }],
  };
  const { calls, restore } = mockFetch(mockTaskWithArtifact);
  try {
    const client = new SidecarClient(CONNECTION);
    await client.addTaskArtifact("task-1", "artifact", "agent-1");

    assert.equal(calls.length, 1);
    const headers = new Headers(calls[0]!.init.headers as HeadersInit);
    assert.equal(headers.get("x-actor-id"), "agent-1");
  } finally {
    restore();
  }
});

void test("addTaskWorklog sends x-actor-id header", async () => {
  const mockTaskWithWorklog = {
    ...MOCK_TASK,
    worklog: [{ createdAt: "2025-01-01T00:00:00.000Z", createdBy: "agent-1", content: "entry" }],
  };
  const { calls, restore } = mockFetch(mockTaskWithWorklog);
  try {
    const client = new SidecarClient(CONNECTION);
    await client.addTaskWorklog("task-1", "entry", "agent-1");

    assert.equal(calls.length, 1);
    const headers = new Headers(calls[0]!.init.headers as HeadersInit);
    assert.equal(headers.get("x-actor-id"), "agent-1");
  } finally {
    restore();
  }
});

void test("updateTaskStatus without actorId does not send x-actor-id header", async () => {
  const { calls, restore } = mockFetch(MOCK_TASK);
  try {
    const client = new SidecarClient(CONNECTION);
    await client.updateTaskStatus("task-1", "doing");

    assert.equal(calls.length, 1);
    const headers = new Headers(calls[0]!.init.headers as HeadersInit);
    assert.equal(headers.get("x-actor-id"), null);
  } finally {
    restore();
  }
});
