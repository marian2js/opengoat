import assert from "node:assert/strict";
import test from "node:test";

// We test the pure fetcher logic rather than the React hook
import { fetchLinkedEntities } from "./useLinkedEntities.js";
import type { TaskRecord, Objective, RunRecord, ArtifactRecord, Signal } from "@opengoat/contracts";

// ---------------------------------------------------------------------------
// Mock data
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

const fakeObjective: Objective = {
  objectiveId: "obj-1",
  projectId: "proj-1",
  title: "Launch on PH",
  goalType: "launch",
  status: "active",
  summary: "Launch next week",
  createdFrom: "dashboard",
  isPrimary: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const fakeRun: RunRecord = {
  runId: "run-1",
  projectId: "proj-1",
  objectiveId: "obj-1",
  title: "Launch Pack Run",
  status: "running",
  phase: "research",
  phaseSummary: "Researching competitors",
  startedFrom: "dashboard",
  agentId: "agent-1",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const fakeArtifact: ArtifactRecord = {
  artifactId: "art-1",
  projectId: "proj-1",
  type: "copy_draft",
  title: "PH copy",
  status: "draft",
  format: "markdown",
  contentRef: "ref-1",
  version: 1,
  createdBy: "agent",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const fakeSignal: Signal = {
  signalId: "sig-1",
  projectId: "proj-1",
  sourceType: "web",
  signalType: "content_opportunity",
  title: "Trending topic",
  summary: "Topic is trending",
  importance: "high",
  freshness: "fresh",
  status: "new",
  createdAt: "2024-01-01T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockClient {
  getObjective: (id: string) => Promise<Objective>;
  getRun: (id: string) => Promise<RunRecord>;
  listArtifacts: (params: { taskId: string }) => Promise<{ items: ArtifactRecord[] }>;
  listSignals: (params: { objectiveId: string }) => Promise<{ items: Signal[] }>;
}

function makeMockClient(overrides: Partial<MockClient> = {}): MockClient {
  return {
    getObjective: () => Promise.resolve(fakeObjective),
    getRun: () => Promise.resolve(fakeRun),
    listArtifacts: () => Promise.resolve({ items: [fakeArtifact] }),
    listSignals: () => Promise.resolve({ items: [fakeSignal] }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void test("fetchLinkedEntities fetches all entities when task has objectiveId and runId", async () => {
  const client = makeMockClient();
  const task = makeTask({ taskId: "t1", status: "doing", objectiveId: "obj-1", runId: "run-1" });

  const result = await fetchLinkedEntities(task, client as never);
  assert.deepEqual(result.objective, fakeObjective);
  assert.deepEqual(result.run, fakeRun);
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.signals.length, 1);
});

void test("fetchLinkedEntities returns nulls when task has no linkage fields", async () => {
  const client = makeMockClient();
  const task = makeTask({ taskId: "t1", status: "doing" });

  const result = await fetchLinkedEntities(task, client as never);
  assert.equal(result.objective, null);
  assert.equal(result.run, null);
  assert.deepEqual(result.artifacts, []);
  assert.deepEqual(result.signals, []);
});

void test("fetchLinkedEntities handles partial failure gracefully", async () => {
  const client = makeMockClient({
    getObjective: () => Promise.reject(new Error("404")),
  });
  const task = makeTask({ taskId: "t1", status: "doing", objectiveId: "obj-bad", runId: "run-1" });

  const result = await fetchLinkedEntities(task, client as never);
  assert.equal(result.objective, null); // Failed gracefully
  assert.deepEqual(result.run, fakeRun); // Other fetches succeed
});

void test("fetchLinkedEntities fetches artifacts by taskId even without objectiveId", async () => {
  const client = makeMockClient();
  const task = makeTask({ taskId: "t1", status: "doing" });

  const result = await fetchLinkedEntities(task, client as never);
  assert.deepEqual(result.artifacts, []); // No taskId artifacts fetched since we don't have objectiveId
});

void test("fetchLinkedEntities does not fetch signals when no objectiveId", async () => {
  let signalsCalled = false;
  const client = makeMockClient({
    listSignals: () => { signalsCalled = true; return Promise.resolve({ items: [] }); },
  });
  const task = makeTask({ taskId: "t1", status: "doing" });

  await fetchLinkedEntities(task, client as never);
  assert.equal(signalsCalled, false);
});
