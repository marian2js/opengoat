import { readFile as readFileBuffer, writeFile as writeFileBuffer } from "node:fs/promises";
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
const INTERNAL_TASK_BUCKET_ID = "tasks";

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("BoardService (tasks-only)", () => {
  it("auto-populates createdAt and updatedAt during task creation", async () => {
    const harness = await createHarness({
      nowIso: () => "2026-02-10T12:34:56.000Z",
    });

    const task = await harness.boardService.createTask(harness.paths, "goat", {
      title: "Auto timestamp test",
      description: "Verify internal timestamp defaults",
      assignedTo: "cto",
    });

    expect(task.createdAt).toBe("2026-02-10T12:34:56.000Z");
    expect(task.updatedAt).toBe("2026-02-10T12:34:56.000Z");
  });

  it("allows assigning tasks to direct and indirect reportees", async () => {
    const harness = await createHarness();

    const direct = await harness.boardService.createTask(harness.paths, "goat", {
      title: "Define roadmap",
      description: "Draft roadmap",
      assignedTo: "cto",
    });
    expect(direct.assignedTo).toBe("cto");

    const indirect = await harness.boardService.createTask(harness.paths, "goat", {
      title: "Deep implementation",
      description: "Implement execution detail",
      assignedTo: "engineer",
    });
    expect(indirect.assignedTo).toBe("engineer");
  });

  it("rejects assignment outside actor reportee tree", async () => {
    const harness = await createHarness();

    await expect(
      harness.boardService.createTask(harness.paths, "cto", {
        title: "Cross-org assignment",
        description: "Should fail",
        assignedTo: "qa",
      }),
    ).rejects.toThrow(
      "Agents can only assign tasks to themselves or their reportees (direct or indirect).",
    );

    await expect(
      harness.boardService.createTask(harness.paths, "engineer", {
        title: "Unauthorized assignment",
        description: "Should fail",
        assignedTo: "qa",
      }),
    ).rejects.toThrow(
      "Agents can only assign tasks to themselves or their reportees (direct or indirect).",
    );
  });

  it("allows any agent to create tasks for themselves", async () => {
    const harness = await createHarness();

    const ownTask = await harness.boardService.createTask(harness.paths, "engineer", {
      title: "Implement endpoint",
      description: "Add endpoint and tests",
    });

    expect(ownTask.assignedTo).toBe("engineer");
    expect(ownTask.owner).toBe("engineer");

    const secondTask = await harness.boardService.createTask(harness.paths, "engineer", {
      title: "Implement worker",
      description: "Add worker and retry logic",
    });
    expect(secondTask.assignedTo).toBe("engineer");
  });

  it("allows updating own tasks and tasks of reportees", async () => {
    const harness = await createHarness();

    const task = await harness.boardService.createTask(harness.paths, "goat", {
      title: "Architecture review",
      description: "Review architecture and report",
      assignedTo: "engineer",
    });

    const assigneeUpdate = await harness.boardService.updateTaskStatus(
      harness.paths,
      "engineer",
      task.taskId,
      "doing",
    );
    expect(assigneeUpdate.status).toBe("doing");

    const managerUpdate = await harness.boardService.addTaskBlocker(
      harness.paths,
      "cto",
      task.taskId,
      "Need API token",
    );
    expect(managerUpdate.blockers).toEqual(["Need API token"]);

    const upperManagerUpdate = await harness.boardService.addTaskArtifact(
      harness.paths,
      "goat",
      task.taskId,
      "Architecture draft v1",
    );
    expect(upperManagerUpdate.artifacts).toHaveLength(1);
    expect(upperManagerUpdate.artifacts[0]?.createdBy).toBe("goat");

    await expect(
      harness.boardService.updateTaskStatus(harness.paths, "qa", task.taskId, "done"),
    ).rejects.toThrow(
      "Agents can only update their own tasks or tasks owned/assigned to their reportees (direct or indirect).",
    );
  });

  it("deletes tasks in bulk when actor has permission", async () => {
    const harness = await createHarness();

    const first = await harness.boardService.createTask(harness.paths, "goat", {
      title: "Delete first",
      description: "Clean this up",
      assignedTo: "cto",
    });
    const second = await harness.boardService.createTask(harness.paths, "cto", {
      title: "Delete second",
      description: "Clean this up too",
      assignedTo: "engineer",
    });

    const result = await harness.boardService.deleteTasks(harness.paths, "goat", [
      first.taskId,
      second.taskId,
      second.taskId,
    ]);
    expect(result).toEqual({
      deletedTaskIds: [first.taskId, second.taskId],
      deletedCount: 2,
    });

    const remaining = await harness.boardService.listTasks(harness.paths, {
      limit: 10,
    });
    expect(remaining).toHaveLength(0);
  });

  it("rejects task deletion when actor lacks permission", async () => {
    const harness = await createHarness();

    const qaTask = await harness.boardService.createTask(harness.paths, "qa", {
      title: "QA owned task",
      description: "Restricted to QA tree",
      assignedTo: "qa",
    });

    await expect(
      harness.boardService.deleteTasks(harness.paths, "cto", [qaTask.taskId]),
    ).rejects.toThrow(
      "Agents can only update their own tasks or tasks owned/assigned to their reportees (direct or indirect).",
    );
  });

  it("accepts only todo/doing/pending/blocked/done as task status values", async () => {
    const harness = await createHarness();

    const created = await harness.boardService.createTask(harness.paths, "goat", {
      title: "Prepare release",
      description: "Prepare release notes",
      assignedTo: "cto",
      status: "doing",
    });

    const blocked = await harness.boardService.updateTaskStatus(
      harness.paths,
      "cto",
      created.taskId,
      "blocked",
      "Waiting on dependency",
    );
    expect(blocked.status).toBe("blocked");
    expect(blocked.statusReason).toBe("Waiting on dependency");

    const pending = await harness.boardService.updateTaskStatus(
      harness.paths,
      "cto",
      created.taskId,
      "pending",
      "Needs product clarification",
    );
    expect(pending.status).toBe("pending");
    expect(pending.statusReason).toBe("Needs product clarification");

    await expect(
      harness.boardService.updateTaskStatus(harness.paths, "cto", created.taskId, "blocked"),
    ).rejects.toThrow('Reason is required when task status is "blocked".');

    await expect(
      harness.boardService.updateTaskStatus(harness.paths, "cto", created.taskId, "pending"),
    ).rejects.toThrow('Reason is required when task status is "pending".');

    await expect(
      harness.boardService.updateTaskStatus(harness.paths, "cto", created.taskId, "in-review"),
    ).rejects.toThrow("Task status must be one of: todo, doing, pending, blocked, done.");

    await expect(
      harness.boardService.createTask(harness.paths, "goat", {
        title: "Invalid status creation",
        description: "Should fail",
        assignedTo: "cto",
        status: "in-review",
      }),
    ).rejects.toThrow("Task status must be one of: todo, doing, pending, blocked, done.");
  });

  it("supports legacy mixed-case task ids for show and updates", async () => {
    const harness = await createHarness();

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
         updated_at,
         owner_agent_id,
         assigned_to_agent_id,
         title,
         description,
         status,
         status_reason
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        legacyTaskId,
        INTERNAL_TASK_BUCKET_ID,
        "2026-02-10T00:00:00.000Z",
        "2026-02-10T00:00:00.000Z",
        "goat",
        "cto",
        "Write: Changelog",
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

  it("migrates legacy task schema by removing the project column", async () => {
    const harness = await createHarness();
    const SQL = await initSqlJs({
      locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm"),
    });
    const legacyDb = new SQL.Database();
    legacyDb.exec(`
      CREATE TABLE boards (
        board_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        owner_agent_id TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO boards (board_id, title, created_at, owner_agent_id, is_default)
      VALUES ('tasks', 'Tasks', '2026-02-10T00:00:00.000Z', 'goat', 0);

      CREATE TABLE tasks (
        task_id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status_updated_at TEXT,
        project TEXT NOT NULL DEFAULT '~',
        owner_agent_id TEXT NOT NULL,
        assigned_to_agent_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        status_reason TEXT,
        FOREIGN KEY(board_id) REFERENCES boards(board_id) ON DELETE CASCADE
      );
      INSERT INTO tasks (
        task_id,
        board_id,
        created_at,
        status_updated_at,
        project,
        owner_agent_id,
        assigned_to_agent_id,
        title,
        description,
        status,
        status_reason
      ) VALUES (
        'legacy-task-1',
        'tasks',
        '2026-02-10T00:00:00.000Z',
        '2026-02-10T00:00:00.000Z',
        '/workspace/legacy',
        'goat',
        'cto',
        'Legacy task',
        'Migrate me',
        'todo',
        NULL
      );
    `);

    const dbPath = path.join(harness.paths.homeDir, "boards.sqlite");
    await writeFileBuffer(dbPath, legacyDb.export());
    legacyDb.close();

    const tasks = await harness.boardService.listTasks(harness.paths, {
      limit: 10,
    });
    expect(tasks.map((task) => task.taskId)).toEqual(["legacy-task-1"]);
    expect(tasks[0]?.updatedAt).toBe("2026-02-10T00:00:00.000Z");

    const migratedDb = new SQL.Database(
      new Uint8Array(await readFileBuffer(dbPath)),
    );
    const columnRows = migratedDb.exec("PRAGMA table_info(tasks);");
    const columnNames = (columnRows[0]?.values ?? []).map(
      (row) => row[1] as string,
    );
    expect(columnNames).not.toContain("project");
    expect(columnNames).toContain("updated_at");
    migratedDb.close();
  });

  it("adds updated_at default for legacy runtimes that omit the column on insert", async () => {
    const harness = await createHarness();
    const SQL = await initSqlJs({
      locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm"),
    });
    const legacyDb = new SQL.Database();
    legacyDb.exec(`
      CREATE TABLE boards (
        board_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        owner_agent_id TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO boards (board_id, title, created_at, owner_agent_id, is_default)
      VALUES ('tasks', 'Tasks', '2026-02-10T00:00:00.000Z', 'goat', 0);

      CREATE TABLE tasks (
        task_id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status_updated_at TEXT,
        owner_agent_id TEXT NOT NULL,
        assigned_to_agent_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        status_reason TEXT,
        FOREIGN KEY(board_id) REFERENCES boards(board_id) ON DELETE CASCADE
      );
      INSERT INTO tasks (
        task_id,
        board_id,
        created_at,
        updated_at,
        status_updated_at,
        owner_agent_id,
        assigned_to_agent_id,
        title,
        description,
        status,
        status_reason
      ) VALUES (
        'legacy-task-existing',
        'tasks',
        '2026-02-10T00:00:00.000Z',
        '2026-02-10T00:00:00.000Z',
        '2026-02-10T00:00:00.000Z',
        'goat',
        'cto',
        'Legacy existing',
        'Exists before migration',
        'todo',
        NULL
      );
    `);

    const dbPath = path.join(harness.paths.homeDir, "boards.sqlite");
    await writeFileBuffer(dbPath, legacyDb.export());
    legacyDb.close();

    const tasks = await harness.boardService.listTasks(harness.paths, {
      limit: 10,
    });
    expect(tasks.map((task) => task.taskId)).toEqual(["legacy-task-existing"]);

    const migratedDb = new SQL.Database(
      new Uint8Array(await readFileBuffer(dbPath)),
    );
    const columnRows = migratedDb.exec("PRAGMA table_info(tasks);");
    const createdAtColumn = (columnRows[0]?.values ?? []).find(
      (row) => row[1] === "created_at",
    );
    const updatedAtColumn = (columnRows[0]?.values ?? []).find(
      (row) => row[1] === "updated_at",
    );
    expect(createdAtColumn?.[3]).toBe(1);
    expect(createdAtColumn?.[4]).toBe("''");
    expect(updatedAtColumn?.[3]).toBe(1);
    expect(updatedAtColumn?.[4]).toBe("''");
    migratedDb.close();

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
         status_updated_at,
         owner_agent_id,
         assigned_to_agent_id,
         title,
         description,
         status,
         status_reason
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "legacy-runtime-insert",
        INTERNAL_TASK_BUCKET_ID,
        "2026-02-11T00:00:00.000Z",
        "2026-02-11T00:00:00.000Z",
        "goat",
        "cto",
        "Inserted by legacy runtime",
        "No updated_at column provided",
        "todo",
        null,
      ],
    );
    await boardServiceInternals.persistDatabase(harness.paths, db);

    const inserted = await harness.boardService.getTask(
      harness.paths,
      "legacy-runtime-insert",
    );
    expect(inserted.updatedAt).toBe("2026-02-11T00:00:00.000Z");
  });

  it("reloads database state when another process updates boards.sqlite", async () => {
    const harness = await createHarness();

    const baselineTasks = await harness.boardService.listTasks(harness.paths);
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

    await externalWriter.createTask(harness.paths, "goat", {
      title: "Synced from external process",
      description: "Added from a second BoardService instance",
      assignedTo: "cto",
      status: "todo",
    });

    const refreshedTasks = await harness.boardService.listTasks(harness.paths);
    expect(refreshedTasks).toHaveLength(1);
    expect(refreshedTasks[0]?.title).toBe("Synced from external process");
  });

  it("lists latest tasks with limit and assignee filters", async () => {
    const harness = await createHarness();

    const boardServiceInternals = harness.boardService as unknown as {
      getDatabase: (paths: OpenGoatPaths) => Promise<unknown>;
      execute: (db: unknown, sql: string, params?: unknown[]) => void;
      persistDatabase: (paths: OpenGoatPaths, db: unknown) => Promise<void>;
    };
    const db = await boardServiceInternals.getDatabase(harness.paths);
    const rows = [
      {
        taskId: "task-old",
        createdAt: "2026-02-10T00:00:00.000Z",
        owner: "goat",
        assignedTo: "cto",
        title: "Old",
      },
      {
        taskId: "task-mid",
        createdAt: "2026-02-11T00:00:00.000Z",
        owner: "cto",
        assignedTo: "cto",
        title: "Mid",
      },
      {
        taskId: "task-new",
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
           updated_at,
           owner_agent_id,
           assigned_to_agent_id,
           title,
           description,
           status,
           status_reason
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.taskId,
          INTERNAL_TASK_BUCKET_ID,
          row.createdAt,
          row.createdAt,
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

    const latestForCto = await harness.boardService.listLatestTasks(harness.paths, {
      assignee: "cto",
      limit: 10,
    });
    expect(latestForCto.map((task) => task.taskId)).toEqual(["task-mid", "task-old"]);
  });

  it("caps latest task listing to 100 results", async () => {
    const harness = await createHarness();

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
           updated_at,
           owner_agent_id,
           assigned_to_agent_id,
           title,
           description,
           status,
           status_reason
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `task-${sequence}`,
          INTERNAL_TASK_BUCKET_ID,
          `2026-02-10T00:00:00.${sequence}Z`,
          `2026-02-10T00:00:00.${sequence}Z`,
          "goat",
          "goat",
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

  it("creates indexes for task status and task ordering", async () => {
    const harness = await createHarness();

    await harness.boardService.createTask(harness.paths, "goat", {
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

  it("tracks doing-task timeout using status_updated_at and can reset the countdown", async () => {
    let nowMs = Date.parse("2026-02-10T00:00:00.000Z");
    const harness = await createHarness({
      nowIso: () => new Date(nowMs).toISOString(),
    });

    const task = await harness.boardService.createTask(harness.paths, "goat", {
      title: "Long running implementation",
      description: "Build and validate long running flow",
      assignedTo: "engineer",
      status: "doing",
    });
    const initialTask = await harness.boardService.getTask(
      harness.paths,
      task.taskId,
    );

    nowMs += 4 * 60_000;
    const dueAtFourMinutes = await harness.boardService.listDoingTaskIdsOlderThan(
      harness.paths,
      4,
    );
    expect(dueAtFourMinutes).toContain(task.taskId);

    const resetApplied = await harness.boardService.resetTaskStatusTimeout(
      harness.paths,
      task.taskId,
      "doing",
    );
    expect(resetApplied).toBe(true);
    const taskAfterReset = await harness.boardService.getTask(
      harness.paths,
      task.taskId,
    );
    expect(taskAfterReset.updatedAt).not.toBe(initialTask.updatedAt);
    expect(taskAfterReset.updatedAt).toBe("2026-02-10T00:04:00.000Z");

    const dueImmediatelyAfterReset =
      await harness.boardService.listDoingTaskIdsOlderThan(harness.paths, 4);
    expect(dueImmediatelyAfterReset).not.toContain(task.taskId);

    nowMs += 4 * 60_000;
    const dueAfterResetWindow = await harness.boardService.listDoingTaskIdsOlderThan(
      harness.paths,
      4,
    );
    expect(dueAfterResetWindow).toContain(task.taskId);
  });
});

async function createHarness(options?: {
  nowIso?: () => string;
}): Promise<{
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
  await agentService.ensureAgent(
    paths,
    { id: "engineer", displayName: "Engineer" },
    { type: "individual", reportsTo: "cto", role: "Developer" },
  );
  await agentService.ensureAgent(
    paths,
    { id: "qa", displayName: "QA" },
    { type: "individual", reportsTo: "goat", role: "QA" },
  );

  const boardService = new BoardService({
    fileSystem,
    pathPort,
    nowIso: options?.nowIso ?? (() => new Date().toISOString()),
    agentManifestService: new AgentManifestService({ fileSystem, pathPort }),
  });

  return {
    boardService,
    paths,
  };
}
