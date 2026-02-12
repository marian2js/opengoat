import { randomUUID } from "node:crypto";
import { readFile as readFileBuffer, writeFile as writeFileBuffer } from "node:fs/promises";
import { createRequire } from "node:module";
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from "sql.js";
import { isManagerAgent, type AgentManifest, type AgentManifestService } from "../../agents/index.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../domain/agent-id.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import type {
  BoardRecord,
  BoardSummary,
  CreateBoardOptions,
  CreateTaskOptions,
  TaskEntry,
  TaskRecord,
  UpdateBoardOptions
} from "../domain/board.js";

interface BoardServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  nowIso: () => string;
  agentManifestService: AgentManifestService;
}

interface BoardRow {
  board_id: string;
  title: string;
  created_at: string;
  owner_agent_id: string;
  is_default: number;
}

interface TaskRow {
  task_id: string;
  board_id: string;
  created_at: string;
  project: string;
  owner_agent_id: string;
  assigned_to_agent_id: string;
  title: string;
  description: string;
  status: string;
  status_reason: string | null;
}

interface EntryRow {
  created_at: string;
  created_by_agent_id: string;
  content: string;
}

const TASK_STATUSES = ["todo", "doing", "pending", "blocked", "done"] as const;
const DEFAULT_TASK_PROJECT = "~";
const require = createRequire(import.meta.url);

export class BoardService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly nowIso: () => string;
  private readonly agentManifestService: AgentManifestService;
  private sqlPromise?: Promise<SqlJsStatic>;
  private dbPromise?: Promise<SqlJsDatabase>;
  private dbPath?: string;

  public constructor(deps: BoardServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.nowIso = deps.nowIso;
    this.agentManifestService = deps.agentManifestService;
  }

  public async createBoard(paths: OpenGoatPaths, actorId: string, options: CreateBoardOptions): Promise<BoardSummary> {
    const db = await this.getDatabase(paths);
    const normalizedActorId = normalizeAgentId(actorId) || DEFAULT_AGENT_ID;
    const title = options.title.trim();
    if (!title) {
      throw new Error("Board title cannot be empty.");
    }

    const manifests = await this.agentManifestService.listManifests(paths);
    const actor = manifests.find((manifest) => manifest.agentId === normalizedActorId);
    if (!actor) {
      throw new Error(`Agent \"${normalizedActorId}\" does not exist.`);
    }
    if (!isManagerAgent(actor)) {
      throw new Error("Only managers can create boards.");
    }

    const hasDefaultBoard = this.getDefaultBoardByOwner(db, normalizedActorId) !== undefined;
    const board = this.insertBoard(db, {
      title,
      owner: normalizedActorId,
      makeDefault: !hasDefaultBoard
    });
    await this.persistDatabase(paths, db);

    return board;
  }

  public async listBoards(paths: OpenGoatPaths): Promise<BoardSummary[]> {
    const db = await this.getDatabase(paths);
    const rows = this.queryAll<BoardRow>(
      db,
      `SELECT board_id, title, created_at, owner_agent_id, is_default
       FROM boards
       ORDER BY created_at ASC`
    );

    return rows.map((row) => toBoardSummary(row));
  }

  public async getBoard(paths: OpenGoatPaths, boardId: string): Promise<BoardRecord> {
    const db = await this.getDatabase(paths);
    const normalizedBoardId = normalizeEntityId(boardId, "board id");
    const board = this.requireBoard(db, normalizedBoardId);
    const tasks = await this.listTasksByBoardId(db, normalizedBoardId);
    return {
      ...toBoardSummary(board),
      tasks
    };
  }

  public async updateBoard(
    paths: OpenGoatPaths,
    actorId: string,
    boardId: string,
    options: UpdateBoardOptions
  ): Promise<BoardSummary> {
    const db = await this.getDatabase(paths);
    const normalizedActorId = normalizeAgentId(actorId) || DEFAULT_AGENT_ID;
    const normalizedBoardId = normalizeEntityId(boardId, "board id");
    const board = this.requireBoard(db, normalizedBoardId);

    if (board.owner_agent_id !== normalizedActorId) {
      throw new Error("Only board owners can update their own board.");
    }

    const nextTitle = options.title?.trim() || board.title;
    if (!nextTitle) {
      throw new Error("Board title cannot be empty.");
    }

    this.execute(
      db,
      `UPDATE boards
       SET title = ?
       WHERE board_id = ?`,
      [nextTitle, normalizedBoardId]
    );
    await this.persistDatabase(paths, db);

    return {
      boardId: normalizedBoardId,
      title: nextTitle,
      createdAt: board.created_at,
      owner: board.owner_agent_id
    };
  }

  public async createTask(
    paths: OpenGoatPaths,
    actorId: string,
    boardId: string | null | undefined,
    options: CreateTaskOptions
  ): Promise<TaskRecord> {
    const db = await this.getDatabase(paths);
    const normalizedActorId = normalizeAgentId(actorId) || DEFAULT_AGENT_ID;
    const title = options.title.trim();
    if (!title) {
      throw new Error("Task title cannot be empty.");
    }
    const description = options.description.trim();
    if (!description) {
      throw new Error("Task description cannot be empty.");
    }

    const assignedTo = normalizeAgentId(options.assignedTo ?? normalizedActorId) || normalizedActorId;
    const manifests = await this.agentManifestService.listManifests(paths);
    const actor = manifests.find((manifest) => manifest.agentId === normalizedActorId);
    const assignee = manifests.find((manifest) => manifest.agentId === assignedTo);

    if (!actor) {
      throw new Error(`Agent \"${normalizedActorId}\" does not exist.`);
    }
    if (!assignee) {
      throw new Error(`Agent \"${assignedTo}\" does not exist.`);
    }

    if (assignedTo !== normalizedActorId) {
      if (!isManagerAgent(actor)) {
        throw new Error("Only managers can assign tasks to other agents.");
      }
      if ((assignee.metadata.reportsTo ?? "") !== normalizedActorId) {
        throw new Error("Managers can only assign tasks to their direct reportees.");
      }
    }

    const status = normalizeTaskStatus(options.status);
    const project = normalizeTaskProject(options.project);
    const { boardId: resolvedBoardId } = this.resolveBoardForTaskCreation(db, actor, boardId);

    const taskId = createEntityId(`task-${title}`);
    const createdAt = this.nowIso();
    this.execute(
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
      [taskId, resolvedBoardId, createdAt, project, normalizedActorId, assignedTo, title, description, status, null]
    );
    await this.persistDatabase(paths, db);

    return this.requireTask(db, taskId);
  }

  public async ensureDefaultBoardForAgent(paths: OpenGoatPaths, agentId: string): Promise<BoardSummary | null> {
    const normalizedAgentId = normalizeAgentId(agentId);
    if (!normalizedAgentId) {
      throw new Error("Agent id cannot be empty.");
    }

    const db = await this.getDatabase(paths);
    const manifests = await this.agentManifestService.listManifests(paths);
    const agent = manifests.find((manifest) => manifest.agentId === normalizedAgentId);
    if (!agent) {
      throw new Error(`Agent \"${normalizedAgentId}\" does not exist.`);
    }
    if (!isManagerAgent(agent)) {
      return null;
    }

    const ensured = this.ensureDefaultBoardForManager(db, normalizedAgentId, agent.metadata.name);
    if (ensured.changed) {
      await this.persistDatabase(paths, db);
    }
    return ensured.board;
  }

  public async ensureDefaultBoardsForManagers(paths: OpenGoatPaths): Promise<BoardSummary[]> {
    const db = await this.getDatabase(paths);
    const manifests = await this.agentManifestService.listManifests(paths);
    const managers = manifests.filter((manifest) => isManagerAgent(manifest));
    const ensuredBoards: BoardSummary[] = [];
    let changed = false;

    for (const manager of managers) {
      const ensured = this.ensureDefaultBoardForManager(db, manager.agentId, manager.metadata.name);
      ensuredBoards.push(ensured.board);
      if (ensured.changed) {
        changed = true;
      }
    }

    if (changed) {
      await this.persistDatabase(paths, db);
    }

    return ensuredBoards;
  }

  public async listTasks(paths: OpenGoatPaths, boardId: string): Promise<TaskRecord[]> {
    const db = await this.getDatabase(paths);
    const normalizedBoardId = normalizeEntityId(boardId, "board id");
    this.requireBoard(db, normalizedBoardId);
    return this.listTasksByBoardId(db, normalizedBoardId);
  }

  public async getTask(paths: OpenGoatPaths, taskId: string): Promise<TaskRecord> {
    const db = await this.getDatabase(paths);
    const normalizedTaskId = normalizeEntityId(taskId, "task id");
    return this.requireTask(db, normalizedTaskId);
  }

  public async updateTaskStatus(
    paths: OpenGoatPaths,
    actorId: string,
    taskId: string,
    status: string,
    reason?: string
  ): Promise<TaskRecord> {
    const db = await this.getDatabase(paths);
    const normalizedActorId = normalizeAgentId(actorId) || DEFAULT_AGENT_ID;
    const normalizedTaskId = normalizeEntityId(taskId, "task id");
    const task = this.requireTask(db, normalizedTaskId);
    this.assertTaskAssignee(task, normalizedActorId);

    const nextStatus = normalizeTaskStatus(status, true);
    const nextStatusReason = normalizeTaskStatusReason(nextStatus, reason);

    this.execute(db, `UPDATE tasks SET status = ?, status_reason = ? WHERE task_id = ?`, [
      nextStatus,
      nextStatusReason,
      normalizedTaskId
    ]);
    await this.persistDatabase(paths, db);
    return this.requireTask(db, normalizedTaskId);
  }

  public async addTaskBlocker(
    paths: OpenGoatPaths,
    actorId: string,
    taskId: string,
    blocker: string
  ): Promise<TaskRecord> {
    const db = await this.getDatabase(paths);
    const normalizedActorId = normalizeAgentId(actorId) || DEFAULT_AGENT_ID;
    const normalizedTaskId = normalizeEntityId(taskId, "task id");
    const content = blocker.trim();
    if (!content) {
      throw new Error("Blocker content cannot be empty.");
    }

    const task = this.requireTask(db, normalizedTaskId);
    this.assertTaskAssignee(task, normalizedActorId);

    this.execute(
      db,
      `INSERT INTO task_blockers (task_id, created_at, created_by_agent_id, content)
       VALUES (?, ?, ?, ?)`,
      [normalizedTaskId, this.nowIso(), normalizedActorId, content]
    );
    await this.persistDatabase(paths, db);

    return this.requireTask(db, normalizedTaskId);
  }

  public async addTaskArtifact(
    paths: OpenGoatPaths,
    actorId: string,
    taskId: string,
    content: string
  ): Promise<TaskRecord> {
    const db = await this.getDatabase(paths);
    const normalizedActorId = normalizeAgentId(actorId) || DEFAULT_AGENT_ID;
    const normalizedTaskId = normalizeEntityId(taskId, "task id");
    const cleaned = content.trim();
    if (!cleaned) {
      throw new Error("Artifact content cannot be empty.");
    }

    const task = this.requireTask(db, normalizedTaskId);
    this.assertTaskAssignee(task, normalizedActorId);

    this.execute(
      db,
      `INSERT INTO task_artifacts (task_id, created_at, created_by_agent_id, content)
       VALUES (?, ?, ?, ?)`,
      [normalizedTaskId, this.nowIso(), normalizedActorId, cleaned]
    );
    await this.persistDatabase(paths, db);

    return this.requireTask(db, normalizedTaskId);
  }

  public async addTaskWorklog(
    paths: OpenGoatPaths,
    actorId: string,
    taskId: string,
    content: string
  ): Promise<TaskRecord> {
    const db = await this.getDatabase(paths);
    const normalizedActorId = normalizeAgentId(actorId) || DEFAULT_AGENT_ID;
    const normalizedTaskId = normalizeEntityId(taskId, "task id");
    const cleaned = content.trim();
    if (!cleaned) {
      throw new Error("Worklog content cannot be empty.");
    }

    const task = this.requireTask(db, normalizedTaskId);
    this.assertTaskAssignee(task, normalizedActorId);

    this.execute(
      db,
      `INSERT INTO task_worklog (task_id, created_at, created_by_agent_id, content)
       VALUES (?, ?, ?, ?)`,
      [normalizedTaskId, this.nowIso(), normalizedActorId, cleaned]
    );
    await this.persistDatabase(paths, db);

    return this.requireTask(db, normalizedTaskId);
  }

  private assertTaskAssignee(task: TaskRecord, actorId: string): void {
    if (task.assignedTo !== actorId) {
      throw new Error("Only the assigned agent can update task status, blockers, artifacts, and worklog.");
    }
  }

  private async listTasksByBoardId(db: SqlJsDatabase, boardId: string): Promise<TaskRecord[]> {
    const rows = this.queryAll<TaskRow>(
      db,
      `SELECT task_id, board_id, created_at, project, owner_agent_id, assigned_to_agent_id, title, description, status, status_reason
       FROM tasks
       WHERE board_id = ?
       ORDER BY created_at ASC`,
      [boardId]
    );

    const tasks: TaskRecord[] = [];
    for (const row of rows) {
      tasks.push(this.hydrateTaskRow(db, row));
    }

    return tasks;
  }

  private requireTask(db: SqlJsDatabase, taskId: string): TaskRecord {
    const row = this.queryOne<TaskRow>(
      db,
      `SELECT task_id, board_id, created_at, project, owner_agent_id, assigned_to_agent_id, title, description, status, status_reason
       FROM tasks
       WHERE task_id = ?`,
      [taskId]
    );

    if (!row) {
      throw new Error(`Task \"${taskId}\" does not exist.`);
    }

    return this.hydrateTaskRow(db, row);
  }

  private hydrateTaskRow(db: SqlJsDatabase, row: TaskRow): TaskRecord {
    const blockersRows = this.queryAll<EntryRow>(
      db,
      `SELECT created_at, created_by_agent_id, content
       FROM task_blockers
       WHERE task_id = ?
       ORDER BY id ASC`,
      [row.task_id]
    );
    const artifactsRows = this.queryAll<EntryRow>(
      db,
      `SELECT created_at, created_by_agent_id, content
       FROM task_artifacts
       WHERE task_id = ?
       ORDER BY id ASC`,
      [row.task_id]
    );
    const worklogRows = this.queryAll<EntryRow>(
      db,
      `SELECT created_at, created_by_agent_id, content
       FROM task_worklog
       WHERE task_id = ?
       ORDER BY id ASC`,
      [row.task_id]
    );

    return {
      taskId: row.task_id,
      boardId: row.board_id,
      createdAt: row.created_at,
      project: row.project || DEFAULT_TASK_PROJECT,
      owner: row.owner_agent_id,
      assignedTo: row.assigned_to_agent_id,
      title: row.title,
      description: row.description,
      status: row.status,
      statusReason: row.status_reason?.trim() || undefined,
      blockers: blockersRows.map((entry) => entry.content),
      artifacts: artifactsRows.map((entry) => toTaskEntry(entry)),
      worklog: worklogRows.map((entry) => toTaskEntry(entry))
    };
  }

  private requireBoard(db: SqlJsDatabase, boardId: string): BoardRow {
    const row = this.queryOne<BoardRow>(
      db,
      `SELECT board_id, title, created_at, owner_agent_id, is_default
       FROM boards
       WHERE board_id = ?`,
      [boardId]
    );

    if (!row) {
      throw new Error(`Board \"${boardId}\" does not exist.`);
    }

    return row;
  }

  private async getDatabase(paths: OpenGoatPaths): Promise<SqlJsDatabase> {
    const dbPath = this.pathPort.join(paths.homeDir, "boards.sqlite");
    if (!this.dbPromise || this.dbPath !== dbPath) {
      this.dbPath = dbPath;
      this.dbPromise = this.openAndMigrate(dbPath, paths);
    }
    return this.dbPromise;
  }

  private async openAndMigrate(dbPath: string, paths: OpenGoatPaths): Promise<SqlJsDatabase> {
    await this.fileSystem.ensureDir(paths.homeDir);
    const SQL = await this.getSqlJs();
    const exists = await this.fileSystem.exists(dbPath);
    const db = exists
      ? new SQL.Database(new Uint8Array(await readFileBuffer(dbPath)))
      : new SQL.Database();

    this.execute(db, "PRAGMA foreign_keys = ON;");
    this.execute(
      db,
      `CREATE TABLE IF NOT EXISTS boards (
         board_id TEXT PRIMARY KEY,
         title TEXT NOT NULL,
         created_at TEXT NOT NULL,
         owner_agent_id TEXT NOT NULL,
         is_default INTEGER NOT NULL DEFAULT 0
       );`
    );
    this.ensureBoardDefaultColumn(db);
    this.normalizeDefaultBoardsByOwner(db);
    this.execute(
      db,
      `CREATE TABLE IF NOT EXISTS tasks (
         task_id TEXT PRIMARY KEY,
         board_id TEXT NOT NULL,
         created_at TEXT NOT NULL,
         project TEXT NOT NULL DEFAULT '${DEFAULT_TASK_PROJECT}',
         owner_agent_id TEXT NOT NULL,
         assigned_to_agent_id TEXT NOT NULL,
         title TEXT NOT NULL,
         description TEXT NOT NULL,
         status TEXT NOT NULL,
         status_reason TEXT,
         FOREIGN KEY(board_id) REFERENCES boards(board_id) ON DELETE CASCADE
       );`
    );
    this.ensureTaskProjectColumn(db);
    this.ensureTaskStatusReasonColumn(db);
    this.execute(
      db,
      `CREATE TABLE IF NOT EXISTS task_blockers (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         task_id TEXT NOT NULL,
         created_at TEXT NOT NULL,
         created_by_agent_id TEXT NOT NULL,
         content TEXT NOT NULL,
         FOREIGN KEY(task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
       );`
    );
    this.execute(
      db,
      `CREATE TABLE IF NOT EXISTS task_artifacts (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         task_id TEXT NOT NULL,
         created_at TEXT NOT NULL,
         created_by_agent_id TEXT NOT NULL,
         content TEXT NOT NULL,
         FOREIGN KEY(task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
       );`
    );
    this.execute(
      db,
      `CREATE TABLE IF NOT EXISTS task_worklog (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         task_id TEXT NOT NULL,
         created_at TEXT NOT NULL,
         created_by_agent_id TEXT NOT NULL,
         content TEXT NOT NULL,
         FOREIGN KEY(task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
       );`
    );
    this.execute(
      db,
      `CREATE TRIGGER IF NOT EXISTS prevent_default_board_delete
       BEFORE DELETE ON boards
       FOR EACH ROW
       WHEN OLD.is_default = 1
       BEGIN
         SELECT RAISE(ABORT, 'Default boards cannot be deleted.');
       END;`
    );
    this.execute(db, "CREATE INDEX IF NOT EXISTS idx_tasks_board_id ON tasks(board_id);");
    this.execute(db, "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);");
    this.execute(db, "CREATE INDEX IF NOT EXISTS idx_boards_owner_default ON boards(owner_agent_id, is_default);");
    this.execute(db, "CREATE INDEX IF NOT EXISTS idx_task_blockers_task_id ON task_blockers(task_id);");
    this.execute(db, "CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_id ON task_artifacts(task_id);");
    this.execute(db, "CREATE INDEX IF NOT EXISTS idx_task_worklog_task_id ON task_worklog(task_id);");
    await this.ensureDefaultBoardsForManagersInDatabase(paths, db);

    await this.persistDatabase(paths, db);
    return db;
  }

  private async getSqlJs(): Promise<SqlJsStatic> {
    if (!this.sqlPromise) {
      const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
      this.sqlPromise = initSqlJs({
        locateFile: () => wasmPath
      });
    }

    return this.sqlPromise;
  }

  private async persistDatabase(paths: OpenGoatPaths, db: SqlJsDatabase): Promise<void> {
    const dbPath = this.pathPort.join(paths.homeDir, "boards.sqlite");
    const data = db.export();
    await writeFileBuffer(dbPath, data);
  }

  private execute(db: SqlJsDatabase, sql: string, params: Array<string | number | null> = []): void {
    const statement = db.prepare(sql);
    statement.bind(params);
    while (statement.step()) {
      // no-op
    }
    statement.free();
  }

  private queryAll<T>(db: SqlJsDatabase, sql: string, params: Array<string | number | null> = []): T[] {
    const statement = db.prepare(sql);
    statement.bind(params);
    const rows: T[] = [];
    while (statement.step()) {
      rows.push(statement.getAsObject() as T);
    }
    statement.free();
    return rows;
  }

  private queryOne<T>(db: SqlJsDatabase, sql: string, params: Array<string | number | null> = []): T | undefined {
    const all = this.queryAll<T>(db, sql, params);
    return all[0];
  }

  private ensureTaskProjectColumn(db: SqlJsDatabase): void {
    const columns = this.queryAll<{ name: string }>(db, "PRAGMA table_info(tasks);");
    const hasProject = columns.some((column) => column.name === "project");
    if (hasProject) {
      return;
    }

    this.execute(
      db,
      `ALTER TABLE tasks ADD COLUMN project TEXT NOT NULL DEFAULT '${DEFAULT_TASK_PROJECT}';`
    );

    const hasWorkspace = columns.some((column) => column.name === "workspace");
    if (hasWorkspace) {
      this.execute(
        db,
        `UPDATE tasks
         SET project = workspace
         WHERE workspace IS NOT NULL
           AND TRIM(workspace) <> '';`
      );
    }
  }

  private ensureTaskStatusReasonColumn(db: SqlJsDatabase): void {
    const columns = this.queryAll<{ name: string }>(db, "PRAGMA table_info(tasks);");
    const hasStatusReason = columns.some((column) => column.name === "status_reason");
    if (hasStatusReason) {
      return;
    }

    this.execute(db, "ALTER TABLE tasks ADD COLUMN status_reason TEXT;");
  }

  private ensureBoardDefaultColumn(db: SqlJsDatabase): void {
    const columns = this.queryAll<{ name: string }>(db, "PRAGMA table_info(boards);");
    const hasDefaultColumn = columns.some((column) => column.name === "is_default");
    if (hasDefaultColumn) {
      return;
    }

    this.execute(db, "ALTER TABLE boards ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;");
  }

  private normalizeDefaultBoardsByOwner(db: SqlJsDatabase): void {
    const owners = this.queryAll<{ owner_agent_id: string }>(
      db,
      `SELECT DISTINCT owner_agent_id
       FROM boards
       ORDER BY owner_agent_id ASC`
    );
    for (const ownerRow of owners) {
      const ownerId = ownerRow.owner_agent_id;
      if (!ownerId) {
        continue;
      }
      const ownedBoards = this.queryAll<BoardRow>(
        db,
        `SELECT board_id, title, created_at, owner_agent_id, is_default
         FROM boards
         WHERE owner_agent_id = ?
         ORDER BY is_default DESC, created_at ASC, board_id ASC`,
        [ownerId]
      );
      const selectedBoardId = ownedBoards[0]?.board_id;
      if (!selectedBoardId) {
        continue;
      }
      this.assignDefaultBoard(db, ownerId, selectedBoardId);
    }
  }

  private async ensureDefaultBoardsForManagersInDatabase(paths: OpenGoatPaths, db: SqlJsDatabase): Promise<void> {
    const manifests = await this.agentManifestService.listManifests(paths);
    const managers = manifests.filter((manifest) => isManagerAgent(manifest));
    for (const manager of managers) {
      this.ensureDefaultBoardForManager(db, manager.agentId, manager.metadata.name);
    }
  }

  private ensureDefaultBoardForManager(
    db: SqlJsDatabase,
    managerId: string,
    displayName: string
  ): {
    board: BoardSummary;
    changed: boolean;
  } {
    const existingDefault = this.getDefaultBoardByOwner(db, managerId);
    if (existingDefault) {
      return {
        board: toBoardSummary(existingDefault),
        changed: false
      };
    }

    const existingBoard = this.queryOne<BoardRow>(
      db,
      `SELECT board_id, title, created_at, owner_agent_id, is_default
       FROM boards
       WHERE owner_agent_id = ?
       ORDER BY created_at ASC, board_id ASC`,
      [managerId]
    );
    if (existingBoard) {
      this.assignDefaultBoard(db, managerId, existingBoard.board_id);
      return {
        board: {
          boardId: existingBoard.board_id,
          title: existingBoard.title,
          createdAt: existingBoard.created_at,
          owner: existingBoard.owner_agent_id
        },
        changed: true
      };
    }

    const created = this.insertBoard(db, {
      title: `${displayName.trim() || managerId} Board`,
      owner: managerId,
      makeDefault: true
    });
    return {
      board: created,
      changed: true
    };
  }

  private resolveBoardForTaskCreation(
    db: SqlJsDatabase,
    actor: AgentManifest,
    rawBoardId: string | null | undefined
  ): {
    boardId: string;
  } {
    const providedBoardId = rawBoardId?.trim();
    if (providedBoardId) {
      const normalizedBoardId = normalizeEntityId(providedBoardId, "board id");
      this.requireBoard(db, normalizedBoardId);
      return {
        boardId: normalizedBoardId
      };
    }

    if (!isManagerAgent(actor)) {
      throw new Error("Board id is required for non-manager agents.");
    }

    const ensured = this.ensureDefaultBoardForManager(db, actor.agentId, actor.metadata.name);
    return {
      boardId: ensured.board.boardId
    };
  }

  private getDefaultBoardByOwner(db: SqlJsDatabase, ownerAgentId: string): BoardRow | undefined {
    return this.queryOne<BoardRow>(
      db,
      `SELECT board_id, title, created_at, owner_agent_id, is_default
       FROM boards
       WHERE owner_agent_id = ?
         AND is_default = 1
       ORDER BY created_at ASC, board_id ASC`,
      [ownerAgentId]
    );
  }

  private assignDefaultBoard(db: SqlJsDatabase, ownerAgentId: string, boardId: string): void {
    this.execute(
      db,
      `UPDATE boards
       SET is_default = 0
       WHERE owner_agent_id = ?`,
      [ownerAgentId]
    );
    this.execute(
      db,
      `UPDATE boards
       SET is_default = 1
       WHERE board_id = ?`,
      [boardId]
    );
  }

  private insertBoard(
    db: SqlJsDatabase,
    params: {
      title: string;
      owner: string;
      makeDefault: boolean;
    }
  ): BoardSummary {
    const boardId = createEntityId(params.title);
    const createdAt = this.nowIso();

    if (params.makeDefault) {
      this.assignDefaultBoard(db, params.owner, boardId);
    }

    this.execute(
      db,
      `INSERT INTO boards (board_id, title, created_at, owner_agent_id, is_default)
       VALUES (?, ?, ?, ?, ?)`,
      [boardId, params.title, createdAt, params.owner, params.makeDefault ? 1 : 0]
    );

    return {
      boardId,
      title: params.title,
      createdAt,
      owner: params.owner
    };
  }
}

function normalizeEntityId(value: string, label: string): string {
  const normalized = normalizeAgentId(value);
  if (!normalized) {
    throw new Error(`${label} cannot be empty.`);
  }
  return normalized;
}

function toBoardSummary(row: BoardRow): BoardSummary {
  return {
    boardId: row.board_id,
    title: row.title,
    createdAt: row.created_at,
    owner: row.owner_agent_id
  };
}

function normalizeTaskStatus(rawStatus: string | undefined, allowEmpty = false): string {
  const normalized = (rawStatus?.trim().toLowerCase() || (allowEmpty ? "" : TASK_STATUSES[0])).trim();
  if (!normalized) {
    throw new Error("Task status cannot be empty.");
  }
  if (!TASK_STATUSES.includes(normalized as (typeof TASK_STATUSES)[number])) {
    throw new Error(`Task status must be one of: ${TASK_STATUSES.join(", ")}.`);
  }
  return normalized;
}

function normalizeTaskStatusReason(status: string, rawReason: string | undefined): string | null {
  const reason = rawReason?.trim();
  if ((status === "pending" || status === "blocked") && !reason) {
    throw new Error(`Reason is required when task status is "${status}".`);
  }
  return reason || null;
}

function normalizeTaskProject(rawProject: string | undefined): string {
  const normalized = rawProject?.trim();
  if (!normalized) {
    return DEFAULT_TASK_PROJECT;
  }
  return normalized;
}

function toTaskEntry(row: EntryRow): TaskEntry {
  return {
    createdAt: row.created_at,
    createdBy: row.created_by_agent_id,
    content: row.content
  };
}

function createEntityId(prefixSource: string): string {
  const prefix = normalizeAgentId(prefixSource) || "item";
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}
