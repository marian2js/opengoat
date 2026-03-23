import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignalService } from "../../packages/core/src/core/signals/index.js";
import { WorkspaceSignalDetector } from "../../packages/core/src/core/signals/application/workspace-signal-detector.js";
import type { OpenGoatPaths } from "../../packages/core/src/core/domain/opengoat-paths.js";
import { NodeFileSystem } from "../../packages/core/src/platform/node/node-file-system.js";
import { NodePathPort } from "../../packages/core/src/platform/node/node-path.port.js";
import { createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

async function createHarness(overrides?: { nowIso?: () => string }) {
  const root = await createTempDir("workspace-signal-detector-");
  roots.push(root);
  const fileSystem = new NodeFileSystem();
  const pathPort = new NodePathPort();

  const paths: OpenGoatPaths = {
    homeDir: root,
    workspacesDir: path.join(root, "workspaces"),
    projectsDir: path.join(root, "projects"),
    organizationDir: path.join(root, "organization"),
    agentsDir: path.join(root, "agents"),
    skillsDir: path.join(root, "skills"),
    providersDir: path.join(root, "providers"),
    sessionsDir: path.join(root, "sessions"),
    runsDir: path.join(root, "runs"),
    globalConfigJsonPath: path.join(root, "config.json"),
    globalConfigMarkdownPath: path.join(root, "CONFIG.md"),
    agentsIndexJsonPath: path.join(root, "agents.json"),
  };

  const signalService = new SignalService({
    fileSystem,
    pathPort,
    nowIso: overrides?.nowIso ?? (() => new Date().toISOString()),
  });

  const detector = new WorkspaceSignalDetector({
    signalService,
    nowIso: overrides?.nowIso ?? (() => new Date().toISOString()),
  });

  return { paths, signalService, detector };
}

function createMockBoardService(tasks: Array<{ taskId: string; title: string; status: string; description?: string; statusReason?: string; updatedAt?: string }>) {
  return {
    listLatestTasksPage: vi.fn().mockImplementation(async (_paths: OpenGoatPaths, options: { status?: string; limit?: number }) => {
      const filtered = tasks.filter((t) => !options.status || t.status === options.status);
      return {
        tasks: filtered.map((t) => ({
          taskId: t.taskId,
          title: t.title,
          description: t.description ?? "",
          status: t.status,
          statusReason: t.statusReason,
          owner: "agent-1",
          assignedTo: "agent-1",
          createdAt: "2026-03-20T10:00:00.000Z",
          updatedAt: t.updatedAt ?? "2026-03-20T10:00:00.000Z",
          blockers: [],
          artifacts: [],
          worklog: [],
        })),
        total: filtered.length,
        limit: options.limit ?? 50,
        offset: 0,
      };
    }),
  };
}

describe("WorkspaceSignalDetector", () => {
  it("creates signals for blocked tasks", async () => {
    const harness = await createHarness({
      nowIso: () => "2026-03-20T10:00:00.000Z",
    });
    const boardService = createMockBoardService([
      { taskId: "task-1", title: "Fix homepage", status: "blocked", statusReason: "Waiting for API key" },
      { taskId: "task-2", title: "Write copy", status: "blocked" },
    ]);

    const result = await harness.detector.detectAndCreateSignals(
      harness.paths,
      "proj-1",
      { boardService: boardService as any },
    );

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);

    const signals = await harness.signalService.listSignals(harness.paths, {
      projectId: "proj-1",
      sourceType: "workspace",
    });
    expect(signals.items).toHaveLength(2);
    expect(signals.items[0].signalType).toBe("review-needed-warning");
    expect(signals.items[0].sourceType).toBe("workspace");
    expect(signals.items[0].importance).toBe("medium");
  });

  it("creates signals for pending tasks", async () => {
    const harness = await createHarness({
      nowIso: () => "2026-03-20T10:00:00.000Z",
    });
    const boardService = createMockBoardService([
      { taskId: "task-3", title: "Review draft", status: "pending" },
    ]);

    const result = await harness.detector.detectAndCreateSignals(
      harness.paths,
      "proj-1",
      { boardService: boardService as any },
    );

    expect(result.created).toBe(1);

    const signals = await harness.signalService.listSignals(harness.paths, {
      projectId: "proj-1",
      sourceType: "workspace",
    });
    expect(signals.items).toHaveLength(1);
    expect(signals.items[0].signalType).toBe("review-needed-warning");
    expect(signals.items[0].title).toContain("Review draft");
  });

  it("does not create duplicate signals for the same condition", async () => {
    const harness = await createHarness({
      nowIso: () => "2026-03-20T10:00:00.000Z",
    });
    const boardService = createMockBoardService([
      { taskId: "task-1", title: "Fix homepage", status: "blocked" },
    ]);

    // First detection
    const result1 = await harness.detector.detectAndCreateSignals(
      harness.paths,
      "proj-1",
      { boardService: boardService as any },
    );
    expect(result1.created).toBe(1);
    expect(result1.skipped).toBe(0);

    // Second detection — same condition
    const result2 = await harness.detector.detectAndCreateSignals(
      harness.paths,
      "proj-1",
      { boardService: boardService as any },
    );
    expect(result2.created).toBe(0);
    expect(result2.skipped).toBe(1);

    const signals = await harness.signalService.listSignals(harness.paths, {
      projectId: "proj-1",
      sourceType: "workspace",
    });
    expect(signals.items).toHaveLength(1);
  });

  it("creates new signal after previous one was dismissed", async () => {
    const harness = await createHarness({
      nowIso: () => "2026-03-20T10:00:00.000Z",
    });
    const boardService = createMockBoardService([
      { taskId: "task-1", title: "Fix homepage", status: "blocked" },
    ]);

    // First detection
    await harness.detector.detectAndCreateSignals(
      harness.paths,
      "proj-1",
      { boardService: boardService as any },
    );

    // Dismiss the signal
    const signals = await harness.signalService.listSignals(harness.paths, {
      projectId: "proj-1",
      sourceType: "workspace",
    });
    await harness.signalService.dismissSignal(harness.paths, signals.items[0].signalId);

    // Second detection — should create new signal since previous was dismissed
    const result2 = await harness.detector.detectAndCreateSignals(
      harness.paths,
      "proj-1",
      { boardService: boardService as any },
    );
    expect(result2.created).toBe(1);
    expect(result2.skipped).toBe(0);
  });

  it("gracefully handles when no services are provided", async () => {
    const harness = await createHarness({
      nowIso: () => "2026-03-20T10:00:00.000Z",
    });

    const result = await harness.detector.detectAndCreateSignals(
      harness.paths,
      "proj-1",
      {},
    );

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("returns correct created/skipped counts for mixed scenarios", async () => {
    const harness = await createHarness({
      nowIso: () => "2026-03-20T10:00:00.000Z",
    });
    const boardService = createMockBoardService([
      { taskId: "task-1", title: "Task A", status: "blocked" },
      { taskId: "task-2", title: "Task B", status: "pending" },
      { taskId: "task-3", title: "Task C", status: "blocked" },
    ]);

    // First pass: create all 3
    const result1 = await harness.detector.detectAndCreateSignals(
      harness.paths,
      "proj-1",
      { boardService: boardService as any },
    );
    expect(result1.created).toBe(3);
    expect(result1.skipped).toBe(0);

    // Second pass: skip all 3
    const result2 = await harness.detector.detectAndCreateSignals(
      harness.paths,
      "proj-1",
      { boardService: boardService as any },
    );
    expect(result2.created).toBe(0);
    expect(result2.skipped).toBe(3);
  });

  it("returns { created: 0, skipped: 0 } for empty workspace", async () => {
    const harness = await createHarness({
      nowIso: () => "2026-03-20T10:00:00.000Z",
    });
    const boardService = createMockBoardService([]);

    const result = await harness.detector.detectAndCreateSignals(
      harness.paths,
      "proj-1",
      { boardService: boardService as any },
    );

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("uses evidence fingerprint for dedup", async () => {
    const harness = await createHarness({
      nowIso: () => "2026-03-20T10:00:00.000Z",
    });
    const boardService = createMockBoardService([
      { taskId: "task-1", title: "Fix homepage", status: "blocked" },
    ]);

    await harness.detector.detectAndCreateSignals(
      harness.paths,
      "proj-1",
      { boardService: boardService as any },
    );

    const signals = await harness.signalService.listSignals(harness.paths, {
      projectId: "proj-1",
      sourceType: "workspace",
    });

    // Evidence should contain the fingerprint
    expect(signals.items[0].evidence).toBe("blocked-task:task-1");
  });
});
