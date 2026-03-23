import assert from "node:assert/strict";
import test from "node:test";
import type { MemoryRecord } from "@opengoat/contracts";
import { createMemoryRoutes } from "./memory.ts";

function createMockMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    memoryId: "mem-1",
    projectId: "proj-1",
    objectiveId: null,
    category: "product_facts",
    scope: "project",
    content: "Test memory",
    source: "user",
    confidence: 1.0,
    createdBy: "user",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    userConfirmed: true,
    supersedes: null,
    replacedBy: null,
    ...overrides,
  };
}

function createMockRuntime(memoryServiceOverrides: Record<string, unknown> = {}) {
  return {
    artifactService: {} as never,
    authSessions: {} as never,
    authService: {} as never,
    boardService: {} as never,
    config: {
      hostname: "127.0.0.1",
      password: "password",
      port: 3000,
      username: "opengoat",
    },
    embeddedGateway: {} as never,
    gatewaySupervisor: {} as never,
    memoryService: {
      listMemories: () => Promise.resolve([createMockMemoryRecord()]),
      getMemory: (_paths: unknown, memoryId: string) =>
        Promise.resolve(createMockMemoryRecord({ memoryId })),
      createMemory: (_paths: unknown, options: Record<string, unknown>) =>
        Promise.resolve(createMockMemoryRecord(options as Partial<MemoryRecord>)),
      updateMemory: (_paths: unknown, memoryId: string, options: Record<string, unknown>) =>
        Promise.resolve(createMockMemoryRecord({ memoryId, ...options } as Partial<MemoryRecord>)),
      deleteMemory: () => Promise.resolve(),
      resolveConflict: () => Promise.resolve(),
      ...memoryServiceOverrides,
    },
    objectiveService: {} as never,
    opengoatPaths: { agentsDir: "/tmp/agents", dataDir: "/tmp/data" },
    playbookRegistryService: {} as never,
    runService: {} as never,
    skillService: {} as never,
    startedAt: Date.now(),
    version: "0.1.0-test",
  };
}

void test("GET / returns memory list", async () => {
  const app = createMemoryRoutes(createMockRuntime() as never);

  const response = await app.request("/?projectId=proj-1");
  assert.equal(response.status, 200);

  const data = (await response.json()) as MemoryRecord[];
  assert.equal(data.length, 1);
  assert.equal(data[0]?.memoryId, "mem-1");
});

void test("GET / passes query filters to service", async () => {
  let capturedOptions: Record<string, unknown> = {};
  const app = createMemoryRoutes(
    createMockRuntime({
      listMemories: (_paths: unknown, options: Record<string, unknown>) => {
        capturedOptions = options;
        return Promise.resolve([]);
      },
    }) as never,
  );

  const response = await app.request(
    "/?projectId=proj-1&objectiveId=obj-1&category=product_facts&scope=project&activeOnly=false",
  );
  assert.equal(response.status, 200);
  assert.equal(capturedOptions.projectId, "proj-1");
  assert.equal(capturedOptions.objectiveId, "obj-1");
  assert.equal(capturedOptions.category, "product_facts");
  assert.equal(capturedOptions.scope, "project");
  assert.equal(capturedOptions.activeOnly, false);
});

void test("GET / returns 400 without projectId", async () => {
  const app = createMemoryRoutes(createMockRuntime() as never);

  const response = await app.request("/");
  assert.equal(response.status, 400);

  const data = (await response.json()) as { error: string };
  assert.ok(data.error.includes("projectId"));
});

void test("GET /:memoryId returns single entry", async () => {
  const app = createMemoryRoutes(createMockRuntime() as never);

  const response = await app.request("/mem-1");
  assert.equal(response.status, 200);

  const data = (await response.json()) as MemoryRecord;
  assert.equal(data.memoryId, "mem-1");
});

void test("GET /:memoryId returns 404 for missing", async () => {
  const app = createMemoryRoutes(
    createMockRuntime({
      getMemory: () => Promise.resolve(undefined),
    }) as never,
  );

  const response = await app.request("/missing");
  assert.equal(response.status, 404);

  const data = (await response.json()) as { error: string };
  assert.ok(data.error.includes("not found"));
});

void test("POST / creates memory", async () => {
  const app = createMemoryRoutes(createMockRuntime() as never);

  const response = await app.request("/", {
    body: JSON.stringify({
      projectId: "proj-1",
      category: "product_facts",
      scope: "project",
      content: "Our product is great",
      source: "user",
      createdBy: "user",
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(response.status, 201);

  const data = (await response.json()) as MemoryRecord;
  assert.equal(data.projectId, "proj-1");
});

void test("POST / returns 400 for invalid body", async () => {
  const app = createMemoryRoutes(createMockRuntime() as never);

  const response = await app.request("/", {
    body: JSON.stringify({}),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(response.status, 400);
});

void test("PATCH /:memoryId updates memory", async () => {
  const app = createMemoryRoutes(createMockRuntime() as never);

  const response = await app.request("/mem-1", {
    body: JSON.stringify({ content: "Updated content" }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  assert.equal(response.status, 200);

  const data = (await response.json()) as MemoryRecord;
  assert.equal(data.memoryId, "mem-1");
});

void test("PATCH /:memoryId returns 404 for missing", async () => {
  const app = createMemoryRoutes(
    createMockRuntime({
      updateMemory: () => Promise.reject(new Error('Memory "missing" not found')),
    }) as never,
  );

  const response = await app.request("/missing", {
    body: JSON.stringify({ content: "Updated content" }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  assert.equal(response.status, 404);

  const data = (await response.json()) as { error: string };
  assert.ok(data.error.includes("not found"));
});

void test("DELETE /:memoryId deletes memory", async () => {
  const app = createMemoryRoutes(createMockRuntime() as never);

  const response = await app.request("/mem-1", { method: "DELETE" });
  assert.equal(response.status, 204);
});

void test("DELETE /:memoryId returns 404 for missing", async () => {
  const app = createMemoryRoutes(
    createMockRuntime({
      deleteMemory: () => Promise.reject(new Error('Memory "missing" not found')),
    }) as never,
  );

  const response = await app.request("/missing", { method: "DELETE" });
  assert.equal(response.status, 404);

  const data = (await response.json()) as { error: string };
  assert.ok(data.error.includes("not found"));
});

void test("POST /conflicts/resolve resolves conflict", async () => {
  let capturedArgs: Record<string, unknown> = {};
  const app = createMemoryRoutes(
    createMockRuntime({
      resolveConflict: (_paths: unknown, keepMemoryId: string, replaceMemoryId: string) => {
        capturedArgs = { keepMemoryId, replaceMemoryId };
        return Promise.resolve();
      },
    }) as never,
  );

  const response = await app.request("/conflicts/resolve", {
    body: JSON.stringify({ keepMemoryId: "mem-1", replaceMemoryId: "mem-2" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(response.status, 200);

  const data = (await response.json()) as { success: boolean };
  assert.equal(data.success, true);
  assert.equal(capturedArgs.keepMemoryId, "mem-1");
  assert.equal(capturedArgs.replaceMemoryId, "mem-2");
});
