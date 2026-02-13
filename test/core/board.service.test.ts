import { readFile as readFileBuffer } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import initSqlJs from "sql.js";
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

describe("BoardService", () => {
  it("allows only managers to create boards", async () => {
    const harness = await createHarness();

    const board = await harness.boardService.createBoard(harness.paths, "ceo", {
      title: "Core Planning",
    });

    expect(board.owner).toBe("ceo");

    await expect(
      harness.boardService.createBoard(harness.paths, "engineer", {
        title: "Should Fail",
      }),
    ).rejects.toThrow("Only managers can create boards");
  });

  it("allows managers to assign tasks only to direct reportees", async () => {
    const harness = await createHarness();

    const board = await harness.boardService.createBoard(harness.paths, "ceo", {
      title: "Leadership",
    });

    const allowed = await harness.boardService.createTask(
      harness.paths,
      "ceo",
      board.boardId,
      {
        title: "Define roadmap",
        description: "Draft Q2 roadmap",
        assignedTo: "cto",
      },
    );

    expect(allowed.assignedTo).toBe("cto");

    await expect(
      harness.boardService.createTask(harness.paths, "ceo", board.boardId, {
        title: "Deep engineering task",
        description:
          "Should fail because engineer is not a direct report of ceo",
        assignedTo: "engineer",
      }),
    ).rejects.toThrow(
      "Managers can only assign tasks to their direct reportees",
    );
  });

  it("creates a default board for managers and uses it when board id is omitted", async () => {
    const harness = await createHarness();

    const task = await harness.boardService.createTask(
      harness.paths,
      "ceo",
      undefined,
      {
        title: "Shape roadmap",
        description: "Define scope for next cycle",
      },
    );

    const boards = await harness.boardService.listBoards(harness.paths);
    const ceoBoards = boards.filter((board) => board.owner === "ceo");

    expect(ceoBoards).toHaveLength(1);
    expect(task.boardId).toBe(ceoBoards[0]?.boardId);
  });

  it("rejects boardless task creation for non-manager agents", async () => {
    const harness = await createHarness();

    await expect(
      harness.boardService.createTask(harness.paths, "engineer", undefined, {
        title: "No board",
        description: "Should fail",
      }),
    ).rejects.toThrow("Board id is required for non-manager agents.");
  });

  it("allows any agent to create tasks for themselves and blocks non-manager assignment to others", async () => {
    const harness = await createHarness();

    const board = await harness.boardService.createBoard(harness.paths, "ceo", {
      title: "Execution",
    });

    const ownTask = await harness.boardService.createTask(
      harness.paths,
      "engineer",
      board.boardId,
      {
        title: "Implement endpoint",
        description: "Add endpoint and tests",
      },
    );

    expect(ownTask.assignedTo).toBe("engineer");
    expect(ownTask.owner).toBe("engineer");
    expect(ownTask.project).toBe("~");

    const customProjectTask = await harness.boardService.createTask(
      harness.paths,
      "engineer",
      board.boardId,
      {
        title: "Implement worker",
        description: "Add worker in custom path",
        project: "/workspace/project",
      },
    );
    expect(customProjectTask.project).toBe("/workspace/project");

    await expect(
      harness.boardService.createTask(
        harness.paths,
        "engineer",
        board.boardId,
        {
          title: "Unauthorized assignment",
          description: "Trying to assign to someone else",
          assignedTo: "qa",
        },
      ),
    ).rejects.toThrow("Only managers can assign tasks to other agents");
  });

  it("allows only assignee to update task status, blockers, artifacts, and worklog", async () => {
    const harness = await createHarness();

    const board = await harness.boardService.createBoard(harness.paths, "ceo", {
      title: "Delivery",
    });

    const task = await harness.boardService.createTask(
      harness.paths,
      "ceo",
      board.boardId,
      {
        title: "Architecture review",
        description: "Review architecture and report",
        assignedTo: "cto",
      },
    );

    const updatedStatus = await harness.boardService.updateTaskStatus(
      harness.paths,
      "cto",
      task.taskId,
      "doing",
    );
    expect(updatedStatus.status).toBe("doing");

    const withBlocker = await harness.boardService.addTaskBlocker(
      harness.paths,
      "cto",
      task.taskId,
      "Need API token",
    );
    expect(withBlocker.blockers).toEqual(["Need API token"]);

    const withArtifact = await harness.boardService.addTaskArtifact(
      harness.paths,
      "cto",
      task.taskId,
      "Architecture draft v1",
    );
    expect(withArtifact.artifacts).toHaveLength(1);
    expect(withArtifact.artifacts[0]?.createdBy).toBe("cto");

    const withWorklog = await harness.boardService.addTaskWorklog(
      harness.paths,
      "cto",
      task.taskId,
      "Reviewed docs and synced with engineer",
    );
    expect(withWorklog.worklog).toHaveLength(1);
    expect(withWorklog.worklog[0]?.createdBy).toBe("cto");

    await expect(
      harness.boardService.updateTaskStatus(
        harness.paths,
        "ceo",
        task.taskId,
        "done",
      ),
    ).rejects.toThrow("Only the assigned agent can update task status");
  });

  it("allows only board owner to update board settings", async () => {
    const harness = await createHarness();

    const board = await harness.boardService.createBoard(harness.paths, "ceo", {
      title: "Org Board",
    });

    const updated = await harness.boardService.updateBoard(
      harness.paths,
      "ceo",
      board.boardId,
      {
        title: "Org Board Updated",
      },
    );

    expect(updated.title).toBe("Org Board Updated");

    await expect(
      harness.boardService.updateBoard(harness.paths, "cto", board.boardId, {
        title: "Unauthorized update",
      }),
    ).rejects.toThrow("Only board owners can update their own board");
  });

  it("accepts only todo/doing/pending/blocked/done as task status values", async () => {
    const harness = await createHarness();

    const board = await harness.boardService.createBoard(harness.paths, "ceo", {
      title: "QA Board",
    });

    await harness.boardService.createTask(harness.paths, "ceo", board.boardId, {
      title: "Prepare release",
      description: "Prepare release notes",
      assignedTo: "cto",
      status: "doing",
    });

    const task = await harness.boardService.listTasks(
      harness.paths,
      board.boardId,
    );
    const blocked = await harness.boardService.updateTaskStatus(
      harness.paths,
      "cto",
      task[0]!.taskId,
      "blocked",
      "Waiting on dependency",
    );
    expect(blocked.status).toBe("blocked");
    expect(blocked.statusReason).toBe("Waiting on dependency");

    const pending = await harness.boardService.updateTaskStatus(
      harness.paths,
      "cto",
      task[0]!.taskId,
      "pending",
      "Needs product clarification",
    );
    expect(pending.status).toBe("pending");
    expect(pending.statusReason).toBe("Needs product clarification");

    await expect(
      harness.boardService.updateTaskStatus(
        harness.paths,
        "cto",
        task[0]!.taskId,
        "blocked",
      ),
    ).rejects.toThrow('Reason is required when task status is "blocked".');

    await expect(
      harness.boardService.updateTaskStatus(
        harness.paths,
        "cto",
        task[0]!.taskId,
        "pending",
      ),
    ).rejects.toThrow('Reason is required when task status is "pending".');

    await expect(
      harness.boardService.updateTaskStatus(
        harness.paths,
        "cto",
        task[0]!.taskId,
        "in-review",
      ),
    ).rejects.toThrow(
      "Task status must be one of: todo, doing, pending, blocked, done.",
    );

    await expect(
      harness.boardService.createTask(harness.paths, "ceo", board.boardId, {
        title: "Invalid status creation",
        description: "Should fail",
        assignedTo: "cto",
        status: "in-review",
      }),
    ).rejects.toThrow(
      "Task status must be one of: todo, doing, pending, blocked, done.",
    );
  });

  it("supports legacy mixed-case task ids for show and updates", async () => {
    const harness = await createHarness();

    const board = await harness.boardService.createBoard(harness.paths, "ceo", {
      title: "Legacy Tasks",
    });

    const legacyTaskId = "task-F62DA660";
    const boardServiceInternals = harness.boardService as unknown as {
      getDatabase: (paths: OpenGoatPaths) => Promise<unknown>;
      execute: (db: unknown, sql: string, params?: unknown[]) => void;
      persistDatabase: (paths: OpenGoatPaths, db: unknown) => Promise<void>;
    };
    const db = await boardServiceInternals.getDatabase(harness.paths);
    boardServiceInternals.execute(
      db,
      `INSERT INTO tasks (
         task_id,
         board_id,
         created_at,
         project,
         owner_agent_id,
         assigned_to_agent_id,
         title,
         description,
         status,
         status_reason
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        legacyTaskId,
        board.boardId,
        "2026-02-10T00:00:00.000Z",
        "~",
        "ceo",
        "cto",
        "Write: Changlog",
        "Fix typo and publish notes",
        "todo",
        null,
      ],
    );
    await boardServiceInternals.persistDatabase(harness.paths, db);

    const shown = await harness.boardService.getTask(harness.paths, legacyTaskId);
    expect(shown.taskId).toBe(legacyTaskId);

    const shownLowercase = await harness.boardService.getTask(
      harness.paths,
      legacyTaskId.toLowerCase(),
    );
    expect(shownLowercase.taskId).toBe(legacyTaskId);

    const updated = await harness.boardService.updateTaskStatus(
      harness.paths,
      "cto",
      legacyTaskId.toLowerCase(),
      "doing",
    );
    expect(updated.taskId).toBe(legacyTaskId);
    expect(updated.status).toBe("doing");
  });

  it("reloads database state when another process updates boards.sqlite", async () => {
    const harness = await createHarness();

    const board = await harness.boardService.createBoard(harness.paths, "ceo", {
      title: "External Sync Board",
    });

    const baselineTasks = await harness.boardService.listTasks(
      harness.paths,
      board.boardId,
    );
    expect(baselineTasks).toHaveLength(0);

    const externalWriter = new BoardService({
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => new Date().toISOString(),
      agentManifestService: new AgentManifestService({
        fileSystem: new NodeFileSystem(),
        pathPort: new NodePathPort(),
      }),
    });

    await externalWriter.createTask(harness.paths, "ceo", board.boardId, {
      title: "Synced from external process",
      description: "Added from a second BoardService instance",
      assignedTo: "cto",
      status: "todo",
    });

    const refreshedTasks = await harness.boardService.listTasks(
      harness.paths,
      board.boardId,
    );
    expect(refreshedTasks).toHaveLength(1);
    expect(refreshedTasks[0]?.title).toBe("Synced from external process");
  });

  it("lists latest tasks across boards with limit and assignee filters", async () => {
    const harness = await createHarness();

    const ceoBoard = await harness.boardService.createBoard(harness.paths, "ceo", {
      title: "CEO Board",
    });
    const ctoBoard = await harness.boardService.createBoard(harness.paths, "cto", {
      title: "CTO Board",
    });

    const boardServiceInternals = harness.boardService as unknown as {
      getDatabase: (paths: OpenGoatPaths) => Promise<unknown>;
      execute: (db: unknown, sql: string, params?: unknown[]) => void;
      persistDatabase: (paths: OpenGoatPaths, db: unknown) => Promise<void>;
    };
    const db = await boardServiceInternals.getDatabase(harness.paths);
    const rows = [
      {
        taskId: "task-old",
        boardId: ceoBoard.boardId,
        createdAt: "2026-02-10T00:00:00.000Z",
        owner: "ceo",
        assignedTo: "cto",
        title: "Old",
      },
      {
        taskId: "task-mid",
        boardId: ctoBoard.boardId,
        createdAt: "2026-02-11T00:00:00.000Z",
        owner: "cto",
        assignedTo: "cto",
        title: "Mid",
      },
      {
        taskId: "task-new",
        boardId: ctoBoard.boardId,
        createdAt: "2026-02-12T00:00:00.000Z",
        owner: "cto",
        assignedTo: "engineer",
        title: "New",
      },
    ];

    for (const row of rows) {
      boardServiceInternals.execute(
        db,
        `INSERT INTO tasks (
           task_id,
           board_id,
           created_at,
           project,
           owner_agent_id,
           assigned_to_agent_id,
           title,
           description,
           status,
           status_reason
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.taskId,
          row.boardId,
          row.createdAt,
          "~",
          row.owner,
          row.assignedTo,
          row.title,
          `Description for ${row.taskId}`,
          "todo",
          null,
        ],
      );
    }
    await boardServiceInternals.persistDatabase(harness.paths, db);

    const latestTwo = await harness.boardService.listLatestTasks(harness.paths, {
      limit: 2,
    });
    expect(latestTwo.map((task) => task.taskId)).toEqual(["task-new", "task-mid"]);

    const latestForCto = await harness.boardService.listLatestTasks(
      harness.paths,
      {
        assignee: "cto",
        limit: 10,
      },
    );
    expect(latestForCto.map((task) => task.taskId)).toEqual([
      "task-mid",
      "task-old",
    ]);
  });

  it("caps latest task listing to 100 results", async () => {
    const harness = await createHarness();
    const board = await harness.boardService.createBoard(harness.paths, "ceo", {
      title: "Latest Limit",
    });

    const boardServiceInternals = harness.boardService as unknown as {
      getDatabase: (paths: OpenGoatPaths) => Promise<unknown>;
      execute: (db: unknown, sql: string, params?: unknown[]) => void;
      persistDatabase: (paths: OpenGoatPaths, db: unknown) => Promise<void>;
    };
    const db = await boardServiceInternals.getDatabase(harness.paths);
    for (let index = 0; index < 101; index += 1) {
      const sequence = String(index).padStart(3, "0");
      boardServiceInternals.execute(
        db,
        `INSERT INTO tasks (
           task_id,
           board_id,
           created_at,
           project,
           owner_agent_id,
           assigned_to_agent_id,
           title,
           description,
           status,
           status_reason
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `task-${sequence}`,
          board.boardId,
          `2026-02-10T00:00:00.${sequence}Z`,
          "~",
          "ceo",
          "ceo",
          `Task ${sequence}`,
          `Description ${sequence}`,
          "todo",
          null,
        ],
      );
    }
    await boardServiceInternals.persistDatabase(harness.paths, db);

    const latest = await harness.boardService.listLatestTasks(harness.paths, {
      limit: 500,
    });
    expect(latest).toHaveLength(100);
    expect(latest[0]?.taskId).toBe("task-100");
    expect(latest[99]?.taskId).toBe("task-001");
  });

  it("creates an index for task status", async () => {
    const harness = await createHarness();

    const board = await harness.boardService.createBoard(harness.paths, "ceo", {
      title: "Index Board",
    });
    await harness.boardService.createTask(harness.paths, "ceo", board.boardId, {
      title: "Indexed task",
      description: "Ensures DB is initialized",
    });

    const SQL = await initSqlJs({
      locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm"),
    });
    const dbPath = path.join(harness.paths.homeDir, "boards.sqlite");
    const db = new SQL.Database(new Uint8Array(await readFileBuffer(dbPath)));
    const rows = db.exec(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_tasks_status';",
    );
    expect(rows[0]?.values[0]?.[0]).toBe("idx_tasks_status");
    const createdAtIndexRows = db.exec(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_tasks_created_at';",
    );
    expect(createdAtIndexRows[0]?.values[0]?.[0]).toBe("idx_tasks_created_at");
    const assigneeCreatedAtIndexRows = db.exec(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_tasks_assignee_created_at';",
    );
    expect(assigneeCreatedAtIndexRows[0]?.values[0]?.[0]).toBe(
      "idx_tasks_assignee_created_at",
    );
    db.close();
  });
});

async function createHarness(): Promise<{
  boardService: BoardService;
  paths: OpenGoatPaths;
}> {
  const root = await createTempDir("opengoat-board-service-");
  roots.push(root);

  const fileSystem = new NodeFileSystem();
  const pathPort = new NodePathPort();
  const paths: OpenGoatPaths = {
    homeDir: root,
    workspacesDir: path.join(root, "workspaces"),
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
    { id: "ceo", displayName: "CEO" },
    { type: "manager", reportsTo: null, role: "CEO" },
  );
  await agentService.ensureAgent(
    paths,
    { id: "cto", displayName: "CTO" },
    { type: "manager", reportsTo: "ceo", role: "CTO" },
  );
  await agentService.ensureAgent(
    paths,
    { id: "engineer", displayName: "Engineer" },
    { type: "individual", reportsTo: "cto", role: "Developer" },
  );
  await agentService.ensureAgent(
    paths,
    { id: "qa", displayName: "QA" },
    { type: "individual", reportsTo: "ceo", role: "QA" },
  );

  const boardService = new BoardService({
    fileSystem,
    pathPort,
    nowIso: () => new Date().toISOString(),
    agentManifestService: new AgentManifestService({ fileSystem, pathPort }),
  });

  return {
    boardService,
    paths,
  };
}
