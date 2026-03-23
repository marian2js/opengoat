import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AgentManifestService,
  AgentService,
} from "../../packages/core/src/core/agents/index.js";
import { BoardService } from "../../packages/core/src/core/boards/index.js";
import type { OpenGoatPaths } from "../../packages/core/src/core/domain/opengoat-paths.js";
import { NodeFileSystem } from "../../packages/core/src/platform/node/node-file-system.js";
import { NodePathPort } from "../../packages/core/src/platform/node/node-path.port.js";
import { createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

const roots: string[] = [];
const require = createRequire(import.meta.url);

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("BoardService — task linkage fields", () => {
  it("persists objectiveId, runId, sourceType, sourceId via metadata into dedicated columns", async () => {
    const harness = await createHarness();
    const task = await harness.boardService.createTask(harness.paths, "goat", {
      title: "Linked task",
      description: "Task with linkage metadata",
      metadata: {
        objectiveId: "obj-123",
        runId: "run-456",
        sourceType: "chat",
        sourceId: "src-789",
      },
    });

    expect(task.objectiveId).toBe("obj-123");
    expect(task.runId).toBe("run-456");
    expect(task.sourceType).toBe("chat");
    expect(task.sourceId).toBe("src-789");
  });

  it("returns tasks via createTaskFromRun with objectiveId and runId on top-level fields", async () => {
    const harness = await createHarness();
    const task = await harness.boardService.createTaskFromRun(
      harness.paths,
      "goat",
      "run-abc",
      "obj-xyz",
      {
        title: "Run-created task",
        description: "Created from a run",
      },
    );

    expect(task.objectiveId).toBe("obj-xyz");
    expect(task.runId).toBe("run-abc");
  });

  it("filters listLatestTasksPage by objectiveId", async () => {
    const harness = await createHarness();
    await harness.boardService.createTask(harness.paths, "goat", {
      title: "Task A",
      description: "Obj 1",
      metadata: { objectiveId: "obj-1" },
    });
    await harness.boardService.createTask(harness.paths, "goat", {
      title: "Task B",
      description: "Obj 2",
      metadata: { objectiveId: "obj-2" },
    });
    await harness.boardService.createTask(harness.paths, "goat", {
      title: "Task C",
      description: "No objective",
    });

    const result = await harness.boardService.listLatestTasksPage(
      harness.paths,
      { objectiveId: "obj-1" },
    );

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe("Task A");
    expect(result.total).toBe(1);
  });

  it("filters listLatestTasksPage by runId", async () => {
    const harness = await createHarness();
    await harness.boardService.createTask(harness.paths, "goat", {
      title: "Task A",
      description: "Run 1",
      metadata: { runId: "run-1" },
    });
    await harness.boardService.createTask(harness.paths, "goat", {
      title: "Task B",
      description: "Run 2",
      metadata: { runId: "run-2" },
    });

    const result = await harness.boardService.listLatestTasksPage(
      harness.paths,
      { runId: "run-1" },
    );

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe("Task A");
  });

  it("filters listLatestTasksPage by sourceType", async () => {
    const harness = await createHarness();
    await harness.boardService.createTask(harness.paths, "goat", {
      title: "Chat task",
      description: "From chat",
      metadata: { sourceType: "chat" },
    });
    await harness.boardService.createTask(harness.paths, "goat", {
      title: "Playbook task",
      description: "From playbook",
      metadata: { sourceType: "playbook" },
    });

    const result = await harness.boardService.listLatestTasksPage(
      harness.paths,
      { sourceType: "chat" },
    );

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe("Chat task");
  });

  it("combines objectiveId and status filters", async () => {
    const harness = await createHarness();
    await harness.boardService.createTask(harness.paths, "goat", {
      title: "Obj1 Todo",
      description: "todo task for obj-1",
      metadata: { objectiveId: "obj-1" },
      status: "todo",
    });
    await harness.boardService.createTask(harness.paths, "goat", {
      title: "Obj1 Done",
      description: "done task for obj-1",
      metadata: { objectiveId: "obj-1" },
    });
    // Mark second task done
    const tasks = await harness.boardService.listLatestTasksPage(harness.paths, {});
    const doneTask = tasks.tasks.find((t) => t.title === "Obj1 Done");
    if (doneTask) {
      await harness.boardService.updateTaskStatus(
        harness.paths,
        "goat",
        doneTask.taskId,
        "done",
      );
    }

    const result = await harness.boardService.listLatestTasksPage(
      harness.paths,
      { objectiveId: "obj-1", status: "todo" },
    );

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe("Obj1 Todo");
  });
});

// ---------------------------------------------------------------------------
// Harness — same pattern as board.service.test.ts
// ---------------------------------------------------------------------------

async function createHarness(options?: {
  nowIso?: () => string;
}): Promise<{
  boardService: BoardService;
  paths: OpenGoatPaths;
}> {
  const root = await createTempDir("board-linkage-test-");
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

  await fileSystem.ensureDir(paths.homeDir);
  await fileSystem.ensureDir(paths.workspacesDir);
  await fileSystem.ensureDir(paths.agentsDir);
  await fileSystem.ensureDir(paths.skillsDir);
  await fileSystem.ensureDir(paths.providersDir);
  await fileSystem.ensureDir(paths.sessionsDir);
  await fileSystem.ensureDir(paths.runsDir);

  const agentService = new AgentService({
    fileSystem,
    pathPort,
    nowIso: () => "2026-02-10T00:00:00.000Z",
  });

  await agentService.ensureAgent(
    paths,
    { id: "goat", displayName: "Goat" },
    { type: "manager", reportsTo: null, role: "co-founder" },
  );
  await agentService.ensureAgent(
    paths,
    { id: "cto", displayName: "CTO" },
    { type: "manager", reportsTo: "goat", role: "CTO" },
  );

  const boardService = new BoardService({
    fileSystem,
    pathPort,
    nowIso: options?.nowIso ?? (() => new Date().toISOString()),
    agentManifestService: new AgentManifestService({ fileSystem, pathPort }),
  });

  return { boardService, paths };
}
