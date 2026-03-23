import assert from "node:assert/strict";
import test from "node:test";
import type { ArtifactRecord, ArtifactVersion, BundleRecord } from "@opengoat/contracts";
import { createArtifactRoutes, createBundleRoutes } from "./artifacts.ts";

function createMockArtifactRecord(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    artifactId: "art-abc12345",
    projectId: "proj-1",
    objectiveId: null,
    runId: null,
    taskId: null,
    bundleId: null,
    type: "copy_draft",
    title: "Test Artifact",
    status: "draft",
    format: "markdown",
    contentRef: "artifacts/test.md",
    content: "# Test content",
    summary: "A test artifact",
    version: 1,
    createdBy: "agent-1",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    approvedAt: null,
    approvedBy: null,
    ...overrides,
  };
}

function createMockArtifactVersion(overrides: Partial<ArtifactVersion> = {}): ArtifactVersion {
  return {
    versionId: "ver-abc12345",
    artifactId: "art-abc12345",
    version: 1,
    content: "# Test content",
    contentRef: "artifacts/test.md",
    summary: "A test artifact",
    createdBy: "agent-1",
    createdAt: "2025-01-01T00:00:00.000Z",
    note: null,
    ...overrides,
  };
}

function createMockBundleRecord(overrides: Partial<BundleRecord> = {}): BundleRecord {
  return {
    bundleId: "bun-abc12345",
    projectId: "proj-1",
    title: "Test Bundle",
    description: "A test bundle",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createMockRuntime(artifactServiceOverrides: Record<string, unknown> = {}) {
  return {
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
    objectiveService: {} as never,
    opengoatPaths: { agentsDir: "/tmp/agents", dataDir: "/tmp/data" },
    playbookRegistryService: {} as never,
    runService: {} as never,
    skillService: {} as never,
    startedAt: Date.now(),
    version: "0.1.0-test",
    artifactService: {
      listArtifacts: () =>
        Promise.resolve({
          items: [createMockArtifactRecord()],
          total: 1,
        }),
      getArtifact: (_paths: unknown, artifactId: string) =>
        Promise.resolve(createMockArtifactRecord({ artifactId })),
      createArtifact: (_paths: unknown, options: Record<string, unknown>) =>
        Promise.resolve(createMockArtifactRecord({ title: options.title as string })),
      updateArtifact: (_paths: unknown, artifactId: string) =>
        Promise.resolve(createMockArtifactRecord({ artifactId, version: 2 })),
      updateArtifactStatus: (_paths: unknown, artifactId: string, status: string) =>
        Promise.resolve(createMockArtifactRecord({ artifactId, status: status as ArtifactRecord["status"] })),
      getVersionHistory: () =>
        Promise.resolve([createMockArtifactVersion({ version: 2 }), createMockArtifactVersion({ version: 1 })]),
      createBundle: (_paths: unknown, options: Record<string, unknown>) =>
        Promise.resolve(createMockBundleRecord({ title: options.title as string })),
      listBundleArtifacts: () =>
        Promise.resolve([createMockArtifactRecord()]),
      ...artifactServiceOverrides,
    },
  };
}

// ---------------------------------------------------------------------------
// Artifact Routes
// ---------------------------------------------------------------------------

void test("GET /artifacts returns paginated artifact list", async () => {
  const app = createArtifactRoutes(createMockRuntime() as never);

  const response = await app.request("/");
  assert.equal(response.status, 200);

  const data = (await response.json()) as { items: ArtifactRecord[]; total: number };
  assert.equal(data.items.length, 1);
  assert.equal(data.total, 1);
});

void test("GET /artifacts passes query filters to service", async () => {
  let capturedOptions: Record<string, unknown> = {};
  const app = createArtifactRoutes(
    createMockRuntime({
      listArtifacts: (_paths: unknown, options: Record<string, unknown>) => {
        capturedOptions = options;
        return Promise.resolve({ items: [], total: 0 });
      },
    }) as never,
  );

  const response = await app.request(
    "/?projectId=proj-1&objectiveId=obj-1&runId=run-1&taskId=task-1&bundleId=bun-1&status=draft&limit=10&offset=5",
  );
  assert.equal(response.status, 200);
  assert.equal(capturedOptions.projectId, "proj-1");
  assert.equal(capturedOptions.objectiveId, "obj-1");
  assert.equal(capturedOptions.runId, "run-1");
  assert.equal(capturedOptions.taskId, "task-1");
  assert.equal(capturedOptions.bundleId, "bun-1");
  assert.equal(capturedOptions.status, "draft");
  assert.equal(capturedOptions.limit, 10);
  assert.equal(capturedOptions.offset, 5);
});

void test("GET /artifacts/:artifactId returns single artifact", async () => {
  const app = createArtifactRoutes(createMockRuntime() as never);

  const response = await app.request("/art-abc12345");
  assert.equal(response.status, 200);

  const data = (await response.json()) as ArtifactRecord;
  assert.equal(data.artifactId, "art-abc12345");
  assert.equal(data.title, "Test Artifact");
});

void test("GET /artifacts/:artifactId returns 404 for missing artifact", async () => {
  const app = createArtifactRoutes(
    createMockRuntime({
      getArtifact: () => Promise.reject(new Error('Artifact "missing" does not exist.')),
    }) as never,
  );

  const response = await app.request("/missing");
  assert.equal(response.status, 404);

  const data = (await response.json()) as { error: string };
  assert.ok(data.error.includes("does not exist"));
});

void test("POST /artifacts creates an artifact", async () => {
  const app = createArtifactRoutes(createMockRuntime() as never);

  const response = await app.request("/", {
    body: JSON.stringify({
      projectId: "proj-1",
      title: "New Artifact",
      type: "copy_draft",
      format: "markdown",
      contentRef: "artifacts/new.md",
      createdBy: "agent-1",
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(response.status, 200);

  const data = (await response.json()) as ArtifactRecord;
  assert.equal(data.title, "New Artifact");
});

void test("PATCH /artifacts/:artifactId updates artifact content", async () => {
  const app = createArtifactRoutes(createMockRuntime() as never);

  const response = await app.request("/art-abc12345", {
    body: JSON.stringify({ title: "Updated Title" }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  assert.equal(response.status, 200);

  const data = (await response.json()) as ArtifactRecord;
  assert.equal(data.artifactId, "art-abc12345");
  assert.equal(data.version, 2);
});

void test("PATCH /artifacts/:artifactId returns 404 for missing artifact", async () => {
  const app = createArtifactRoutes(
    createMockRuntime({
      updateArtifact: () => Promise.reject(new Error('Artifact "missing" does not exist.')),
    }) as never,
  );

  const response = await app.request("/missing", {
    body: JSON.stringify({ title: "Updated" }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  assert.equal(response.status, 404);

  const data = (await response.json()) as { error: string };
  assert.ok(data.error.includes("does not exist"));
});

void test("PATCH /artifacts/:artifactId/status updates status", async () => {
  const app = createArtifactRoutes(createMockRuntime() as never);

  const response = await app.request("/art-abc12345/status", {
    body: JSON.stringify({ status: "ready_for_review" }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  assert.equal(response.status, 200);

  const data = (await response.json()) as ArtifactRecord;
  assert.equal(data.status, "ready_for_review");
});

void test("PATCH /artifacts/:artifactId/status returns 404 for missing artifact", async () => {
  const app = createArtifactRoutes(
    createMockRuntime({
      updateArtifactStatus: () =>
        Promise.reject(new Error('Artifact "missing" does not exist.')),
    }) as never,
  );

  const response = await app.request("/missing/status", {
    body: JSON.stringify({ status: "ready_for_review" }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  assert.equal(response.status, 404);

  const data = (await response.json()) as { error: string };
  assert.ok(data.error.includes("does not exist"));
});

void test("PATCH /artifacts/:artifactId/status returns 400 for invalid transition", async () => {
  const app = createArtifactRoutes(
    createMockRuntime({
      updateArtifactStatus: () =>
        Promise.reject(new Error("Invalid status transition from draft to approved")),
    }) as never,
  );

  const response = await app.request("/art-abc12345/status", {
    body: JSON.stringify({ status: "approved" }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  assert.equal(response.status, 400);

  const data = (await response.json()) as { error: string };
  assert.ok(data.error.includes("Invalid status transition"));
});

void test("PATCH /artifacts/:artifactId/status uses x-actor-id header", async () => {
  let capturedActor = "";
  const app = createArtifactRoutes(
    createMockRuntime({
      updateArtifactStatus: (_paths: unknown, _id: string, _status: string, actor?: string) => {
        capturedActor = actor || "";
        return Promise.resolve(createMockArtifactRecord({ status: "ready_for_review" }));
      },
    }) as never,
  );

  await app.request("/art-abc12345/status", {
    body: JSON.stringify({ status: "ready_for_review" }),
    headers: { "Content-Type": "application/json", "x-actor-id": "my-agent" },
    method: "PATCH",
  });
  assert.equal(capturedActor, "my-agent");
});

void test("GET /artifacts/:artifactId/versions returns version history", async () => {
  const app = createArtifactRoutes(createMockRuntime() as never);

  const response = await app.request("/art-abc12345/versions");
  assert.equal(response.status, 200);

  const data = (await response.json()) as ArtifactVersion[];
  assert.equal(data.length, 2);
  assert.equal(data[0]?.version, 2);
  assert.equal(data[1]?.version, 1);
});

void test("GET /artifacts/:artifactId/versions returns 404 for missing artifact", async () => {
  const app = createArtifactRoutes(
    createMockRuntime({
      getVersionHistory: () =>
        Promise.reject(new Error('Artifact "missing" does not exist.')),
    }) as never,
  );

  const response = await app.request("/missing/versions");
  assert.equal(response.status, 404);

  const data = (await response.json()) as { error: string };
  assert.ok(data.error.includes("does not exist"));
});

// ---------------------------------------------------------------------------
// Bundle Routes
// ---------------------------------------------------------------------------

void test("POST /bundles creates a bundle", async () => {
  const app = createBundleRoutes(createMockRuntime() as never);

  const response = await app.request("/", {
    body: JSON.stringify({
      projectId: "proj-1",
      title: "New Bundle",
      description: "A new bundle",
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(response.status, 200);

  const data = (await response.json()) as BundleRecord;
  assert.equal(data.title, "New Bundle");
});

void test("GET /bundles/:bundleId returns bundle artifacts", async () => {
  const app = createBundleRoutes(createMockRuntime() as never);

  const response = await app.request("/bun-abc12345");
  assert.equal(response.status, 200);

  const data = (await response.json()) as ArtifactRecord[];
  assert.equal(data.length, 1);
  assert.equal(data[0]?.artifactId, "art-abc12345");
});

void test("GET /bundles/:bundleId returns 404 for missing bundle", async () => {
  const app = createBundleRoutes(
    createMockRuntime({
      listBundleArtifacts: () =>
        Promise.reject(new Error('Bundle "missing" does not exist.')),
    }) as never,
  );

  const response = await app.request("/missing");
  assert.equal(response.status, 404);

  const data = (await response.json()) as { error: string };
  assert.ok(data.error.includes("does not exist"));
});
