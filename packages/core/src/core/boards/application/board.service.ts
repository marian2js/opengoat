import { randomUUID } from "node:crypto";
import {
  readFile as readFileBuffer,
  stat as statFile,
  writeFile as writeFileBuffer,
} from "node:fs/promises";
import { createRequire } from "node:module";
import initSqlJs, {
  type Database as SqlJsDatabase,
  type SqlJsStatic,
} from "sql.js";
import {
  type AgentManifest,
  type AgentManifestService,
} from "../../agents/index.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../domain/agent-id.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import type {
  CreateTaskOptions,
  ListTasksOptions,
  TaskEntry,
  TaskRecord,
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
  updated_at?: string | null;
  status_updated_at?: string | null;
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

interface TaskIdRow {
  task_id: string;
}

interface PendingTaskIdRow {
  task_id: string;
}

const TASK_STATUSES = ["todo", "doing", "pending", "blocked", "done"] as const;
const MAX_TASK_LIST_LIMIT = 100;
const INTERNAL_TASK_BUCKET_ID = "tasks";
const INTERNAL_TASK_BUCKET_TITLE = "Tasks";
const require = createRequire(import.meta.url);

export class BoardService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly nowIso: () => string;
  private readonly agentManifestService: AgentManifestService;
  private sqlPromise?: Promise<SqlJsStatic>;
  private dbPromise?: Promise<SqlJsDatabase>;
  private dbPath?: string;
  private dbFileFingerprint?: string | null;

  public constructor(deps: BoardServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.nowIso = deps.nowIso;
    this.agentManifestService = deps.agentManifestService;
  }

  public async createTask(
    paths: OpenGoatPaths,
    actorId: string,
    options: CreateTaskOptions,
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

    const assignedTo =
      normalizeAgentId(options.assignedTo ?? normalizedActorId) ||
      normalizedActorId;
    const manifests = await this.agentManifestService.listManifests(paths);
    const manifestsById = new Map(
      manifests.map((manifest) => [manifest.agentId, manifest]),
    );

    if (!manifestsById.has(normalizedActorId)) {
      throw new Error(`Agent \"${normalizedActorId}\" does not exist.`);
    }
    if (!manifestsById.has(assignedTo)) {
      throw new Error(`Agent \"${assignedTo}\" does not exist.`);
    }

    const allowedAssignees = collectAssignableAgents(
      manifests,
      normalizedActorId,
    );
    if (!allowedAssignees.has(assignedTo)) {
      throw new Error(
        "Agents can only assign tasks to themselves or their reportees (direct or indirect).",
      );
    }

    const status = normalizeTaskStatus(options.status);
    const taskId = createEntityId(`task-${title}`);
    const createdAt = this.nowIso();

    this.execute(
      db,
      `INSERT INTO tasks (
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
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        INTERNAL_TASK_BUCKET_ID,
        createdAt,
        createdAt,
        createdAt,
        normalizedActorId,
        assignedTo,
        title,
        description,
        status,
        null,
      ],
    );
    await this.persistDatabase(paths, db);

    return this.requireTask(db, taskId);
  }

  public async listTasks(
    paths: OpenGoatPaths,
    options: ListTasksOptions = {},
  ): Promise<TaskRecord[]> {
    const db = await this.getDatabase(paths);
    const limit = resolveTaskListLimit(options.limit);
    const assignee = normalizeOptionalAssignee(options.assignee);

    const rows = assignee
      ? this.queryAll<TaskRow>(
          db,
          `SELECT task_id, board_id, created_at, updated_at, status_updated_at, owner_agent_id, assigned_to_agent_id, title, description, status, status_reason
           FROM tasks
           WHERE assigned_to_agent_id = ?
           ORDER BY created_at DESC, task_id DESC
           LIMIT ?`,
          [assignee, limit],
        )
      : this.queryAll<TaskRow>(
          db,
          `SELECT task_id, board_id, created_at, updated_at, status_updated_at, owner_agent_id, assigned_to_agent_id, title, description, status, status_reason
           FROM tasks
           ORDER BY created_at DESC, task_id DESC
           LIMIT ?`,
          [limit],
        );

    return this.hydrateTaskRows(db, rows);
  }

  public async listLatestTasks(
    paths: OpenGoatPaths,
    options: ListTasksOptions = {},
  ): Promise<TaskRecord[]> {
    return this.listTasks(paths, options);
  }

  public async listLatestTasksPage(
    paths: OpenGoatPaths,
    options: {
      assignee?: string;
      owner?: string;
      status?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{
    tasks: TaskRecord[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const db = await this.getDatabase(paths);
    const limit = resolveTaskListLimit(options.limit);
    const offset = Math.max(0, options.offset ?? 0);
    const assignee = normalizeOptionalAssignee(options.assignee);
    const owner = options.owner
      ? normalizeEntityId(options.owner, "owner")
      : undefined;
    const status = options.status?.trim() || undefined;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (assignee) {
      conditions.push("assigned_to_agent_id = ?");
      params.push(assignee);
    }
    if (owner) {
      conditions.push("owner_agent_id = ?");
      params.push(owner);
    }
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRow = this.queryOne<{ count: number }>(
      db,
      `SELECT COUNT(*) as count FROM tasks ${whereClause}`,
      params,
    );
    const total = countRow?.count ?? 0;

    const rows = this.queryAll<TaskRow>(
      db,
      `SELECT task_id, board_id, created_at, updated_at, status_updated_at, owner_agent_id, assigned_to_agent_id, title, description, status, status_reason
       FROM tasks
       ${whereClause}
       ORDER BY created_at DESC, task_id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const tasks = this.hydrateTaskRows(db, rows);

    return {
      tasks,
      total,
      limit,
      offset,
    };
  }

  public async getTask(
    paths: OpenGoatPaths,
    taskId: string,
  ): Promise<TaskRecord> {
    const db = await this.getDatabase(paths);
    const resolvedTaskId = this.resolveTaskId(db, taskId);
    return this.requireTask(db, resolvedTaskId);
  }

  public async deleteTasks(
    paths: OpenGoatPaths,
    actorId: string,
    taskIds: string[],
  ): Promise<{ deletedTaskIds: string[]; deletedCount: number }> {
    const db = await this.getDatabase(paths);
    const normalizedActorId = normalizeAgentId(actorId) || DEFAULT_AGENT_ID;
    const manifests = await this.agentManifestService.listManifests(paths);

    const seenTaskIds = new Set<string>();
    const resolvedTaskIds: string[] = [];
    for (const taskId of taskIds) {
      const normalizedTaskId = taskId.trim();
      if (!normalizedTaskId) {
        continue;
      }
      const resolvedTaskId = this.resolveTaskId(db, normalizedTaskId);
      if (seenTaskIds.has(resolvedTaskId)) {
        continue;
      }

      const task = this.requireTask(db, resolvedTaskId);
      this.assertTaskUpdatePermission(task, normalizedActorId, manifests);
      seenTaskIds.add(resolvedTaskId);
      resolvedTaskIds.push(resolvedTaskId);
    }

    if (resolvedTaskIds.length === 0) {
      return {
        deletedTaskIds: [],
        deletedCount: 0,
      };
    }

    const placeholders = resolvedTaskIds.map(() => "?").join(", ");
    this.execute(
      db,
      `DELETE FROM tasks WHERE task_id IN (${placeholders})`,
      resolvedTaskIds,
    );
    await this.persistDatabase(paths, db);

    return {
      deletedTaskIds: resolvedTaskIds,
      deletedCount: resolvedTaskIds.length,
    };
  }

  public async updateTaskStatus(
    paths: OpenGoatPaths,
    actorId: string,
    taskId: string,
    status: string,
    reason?: string,
  ): Promise<TaskRecord> {
    const db = await this.getDatabase(paths);
    const normalizedActorId = normalizeAgentId(actorId) || DEFAULT_AGENT_ID;
    const resolvedTaskId = this.resolveTaskId(db, taskId);
    const task = this.requireTask(db, resolvedTaskId);
    const manifests = await this.agentManifestService.listManifests(paths);
    this.assertTaskUpdatePermission(task, normalizedActorId, manifests);

    const nextStatus = normalizeTaskStatus(status, true);
    const nextStatusReason = normalizeTaskStatusReason(nextStatus, reason);
    const updatedAt = this.nowIso();

    this.execute(
      db,
      `UPDATE tasks
       SET status = ?, status_reason = ?, updated_at = ?, status_updated_at = ?
       WHERE task_id = ?`,
      [nextStatus, nextStatusReason, updatedAt, updatedAt, resolvedTaskId],
    );
    await this.persistDatabase(paths, db);
    return this.requireTask(db, resolvedTaskId);
  }

  public async listPendingTaskIdsOlderThan(
    paths: OpenGoatPaths,
    olderThanMinutes: number,
  ): Promise<string[]> {
    if (!Number.isFinite(olderThanMinutes) || olderThanMinutes <= 0) {
      return [];
    }

    const db = await this.getDatabase(paths);
    const nowMs = Date.parse(this.nowIso());
    const referenceNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
    const cutoffIso = new Date(
      referenceNowMs - Math.floor(olderThanMinutes) * 60_000,
    ).toISOString();
    const rows = this.queryAll<PendingTaskIdRow>(
      db,
      `SELECT task_id
       FROM tasks
       WHERE status = 'pending'
         AND COALESCE(status_updated_at, created_at) <= ?
       ORDER BY COALESCE(status_updated_at, created_at) ASC, task_id ASC`,
      [cutoffIso],
    );

    return rows.map((row) => row.task_id);
  }

  public async listDoingTaskIdsOlderThan(
    paths: OpenGoatPaths,
    olderThanMinutes: number,
  ): Promise<string[]> {
    if (!Number.isFinite(olderThanMinutes) || olderThanMinutes <= 0) {
      return [];
    }

    const db = await this.getDatabase(paths);
    const nowMs = Date.parse(this.nowIso());
    const referenceNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
    const cutoffIso = new Date(
      referenceNowMs - Math.floor(olderThanMinutes) * 60_000,
    ).toISOString();
    const rows = this.queryAll<PendingTaskIdRow>(
      db,
      `SELECT task_id
       FROM tasks
       WHERE status = 'doing'
         AND COALESCE(status_updated_at, created_at) <= ?
       ORDER BY COALESCE(status_updated_at, created_at) ASC, task_id ASC`,
      [cutoffIso],
    );

    return rows.map((row) => row.task_id);
  }

  public async resetTaskStatusTimeout(
    paths: OpenGoatPaths,
    taskId: string,
    status: string,
  ): Promise<boolean> {
    const db = await this.getDatabase(paths);
    const normalizedStatus = normalizeTaskStatus(status, true);
    const resolvedTaskId = this.resolveTaskId(db, taskId);
    const now = this.nowIso();
    this.execute(
      db,
      `UPDATE tasks
       SET status_updated_at = ?
       WHERE task_id = ? AND status = ?`,
      [now, resolvedTaskId, normalizedStatus],
    );
    const changesRow = this.queryOne<{ changed: number }>(
      db,
      "SELECT changes() as changed",
    );
    await this.persistDatabase(paths, db);
    return (changesRow?.changed ?? 0) > 0;
  }

  public async addTaskBlocker(
    paths: OpenGoatPaths,
    actorId: string,
    taskId: string,
    blocker: string,
  ): Promise<TaskRecord> {
    const db = await this.getDatabase(paths);
    const normalizedActorId = normalizeAgentId(actorId) || DEFAULT_AGENT_ID;
    const resolvedTaskId = this.resolveTaskId(db, taskId);
    const content = blocker.trim();
    if (!content) {
      throw new Error("Blocker content cannot be empty.");
    }

    const task = this.requireTask(db, resolvedTaskId);
    const manifests = await this.agentManifestService.listManifests(paths);
    this.assertTaskUpdatePermission(task, normalizedActorId, manifests);

    this.execute(
      db,
      `INSERT INTO task_blockers (task_id, created_at, created_by_agent_id, content)
       VALUES (?, ?, ?, ?)`,
      [resolvedTaskId, this.nowIso(), normalizedActorId, content],
    );
    this.touchTaskUpdatedAt(db, resolvedTaskId);
    await this.persistDatabase(paths, db);

    return this.requireTask(db, resolvedTaskId);
  }

  public async addTaskArtifact(
    paths: OpenGoatPaths,
    actorId: string,
    taskId: string,
    content: string,
  ): Promise<TaskRecord> {
    const db = await this.getDatabase(paths);
    const normalizedActorId = normalizeAgentId(actorId) || DEFAULT_AGENT_ID;
    const resolvedTaskId = this.resolveTaskId(db, taskId);
    const cleaned = content.trim();
    if (!cleaned) {
      throw new Error("Artifact content cannot be empty.");
    }

    const task = this.requireTask(db, resolvedTaskId);
    const manifests = await this.agentManifestService.listManifests(paths);
    this.assertTaskUpdatePermission(task, normalizedActorId, manifests);

    this.execute(
      db,
      `INSERT INTO task_artifacts (task_id, created_at, created_by_agent_id, content)
       VALUES (?, ?, ?, ?)`,
      [resolvedTaskId, this.nowIso(), normalizedActorId, cleaned],
    );
    this.touchTaskUpdatedAt(db, resolvedTaskId);
    await this.persistDatabase(paths, db);

    return this.requireTask(db, resolvedTaskId);
  }

  public async addTaskWorklog(
    paths: OpenGoatPaths,
    actorId: string,
    taskId: string,
    content: string,
  ): Promise<TaskRecord> {
    const db = await this.getDatabase(paths);
    const normalizedActorId = normalizeAgentId(actorId) || DEFAULT_AGENT_ID;
    const resolvedTaskId = this.resolveTaskId(db, taskId);
    const cleaned = content.trim();
    if (!cleaned) {
      throw new Error("Worklog content cannot be empty.");
    }

    const task = this.requireTask(db, resolvedTaskId);
    const manifests = await this.agentManifestService.listManifests(paths);
    this.assertTaskUpdatePermission(task, normalizedActorId, manifests);

    this.execute(
      db,
      `INSERT INTO task_worklog (task_id, created_at, created_by_agent_id, content)
       VALUES (?, ?, ?, ?)`,
      [resolvedTaskId, this.nowIso(), normalizedActorId, cleaned],
    );
    this.touchTaskUpdatedAt(db, resolvedTaskId);
    await this.persistDatabase(paths, db);

    return this.requireTask(db, resolvedTaskId);
  }

  private assertTaskUpdatePermission(
    task: TaskRecord,
    actorId: string,
    manifests: AgentManifest[],
  ): void {
    if (task.owner === actorId || task.assignedTo === actorId) {
      return;
    }

    const reportees = collectAssignableAgents(manifests, actorId);
    if (reportees.has(task.owner) || reportees.has(task.assignedTo)) {
      return;
    }

    throw new Error(
      "Agents can only update their own tasks or tasks owned/assigned to their reportees (direct or indirect).",
    );
  }

  private hydrateTaskRows(db: SqlJsDatabase, rows: TaskRow[]): TaskRecord[] {
    const tasks: TaskRecord[] = [];
    for (const row of rows) {
      tasks.push(this.hydrateTaskRow(db, row));
    }

    return tasks;
  }

  private requireTask(db: SqlJsDatabase, taskId: string): TaskRecord {
    const row = this.queryOne<TaskRow>(
      db,
      `SELECT task_id, board_id, created_at, updated_at, status_updated_at, owner_agent_id, assigned_to_agent_id, title, description, status, status_reason
       FROM tasks
       WHERE task_id = ?`,
      [taskId],
    );

    if (!row) {
      throw new Error(`Task \"${taskId}\" does not exist.`);
    }

    return this.hydrateTaskRow(db, row);
  }

  private resolveTaskId(db: SqlJsDatabase, taskId: string): string {
    const normalizedTaskId = normalizeEntityId(taskId, "task id");
    const exactMatch = this.queryOne<TaskIdRow>(
      db,
      `SELECT task_id
       FROM tasks
       WHERE task_id = ?`,
      [normalizedTaskId],
    );
    if (exactMatch?.task_id) {
      return exactMatch.task_id;
    }

    const caseInsensitiveMatches = this.queryAll<TaskIdRow>(
      db,
      `SELECT task_id
       FROM tasks
       WHERE task_id = ? COLLATE NOCASE
       ORDER BY task_id ASC`,
      [normalizedTaskId],
    );

    if (caseInsensitiveMatches.length === 0) {
      throw new Error(`Task \"${normalizedTaskId}\" does not exist.`);
    }

    if (caseInsensitiveMatches.length > 1) {
      throw new Error(
        `Task id \"${normalizedTaskId}\" is ambiguous by case. Use exact task id.`,
      );
    }

    return caseInsensitiveMatches[0]!.task_id;
  }

  private hydrateTaskRow(db: SqlJsDatabase, row: TaskRow): TaskRecord {
    const blockersRows = this.queryAll<EntryRow>(
      db,
      `SELECT created_at, created_by_agent_id, content
       FROM task_blockers
       WHERE task_id = ?
       ORDER BY id ASC`,
      [row.task_id],
    );
    const artifactsRows = this.queryAll<EntryRow>(
      db,
      `SELECT created_at, created_by_agent_id, content
       FROM task_artifacts
       WHERE task_id = ?
       ORDER BY id ASC`,
      [row.task_id],
    );
    const worklogRows = this.queryAll<EntryRow>(
      db,
      `SELECT created_at, created_by_agent_id, content
       FROM task_worklog
       WHERE task_id = ?
       ORDER BY id ASC`,
      [row.task_id],
    );

    return {
      taskId: row.task_id,
      createdAt: row.created_at,
      updatedAt:
        row.updated_at?.trim() ||
        row.status_updated_at?.trim() ||
        row.created_at,
      owner: row.owner_agent_id,
      assignedTo: row.assigned_to_agent_id,
      title: row.title,
      description: row.description,
      status: row.status,
      statusReason: row.status_reason?.trim() || undefined,
      blockers: blockersRows.map((entry) => entry.content),
      artifacts: artifactsRows.map((entry) => toTaskEntry(entry)),
      worklog: worklogRows.map((entry) => toTaskEntry(entry)),
    };
  }

  private async getDatabase(paths: OpenGoatPaths): Promise<SqlJsDatabase> {
    const dbPath = this.pathPort.join(paths.homeDir, "boards.sqlite");
    const pathChanged = this.dbPath !== dbPath;
    const diskFingerprint = await this.readDbFileFingerprint(dbPath);
    const fileChangedExternally =
      !pathChanged &&
      Boolean(this.dbPromise) &&
      this.dbFileFingerprint !== undefined &&
      this.dbFileFingerprint !== diskFingerprint;

    if (!this.dbPromise || pathChanged || fileChangedExternally) {
      this.dbPath = dbPath;
      this.dbFileFingerprint = diskFingerprint;
      this.dbPromise = this.openAndMigrate(dbPath, paths);
    }
    return this.dbPromise;
  }

  private async openAndMigrate(
    dbPath: string,
    paths: OpenGoatPaths,
  ): Promise<SqlJsDatabase> {
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
       );`,
    );
    this.ensureBoardDefaultColumn(db);
    this.ensureInternalTaskBucket(db);
    this.execute(
      db,
      `CREATE TABLE IF NOT EXISTS tasks (
         task_id TEXT PRIMARY KEY,
         board_id TEXT NOT NULL,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL DEFAULT '',
         status_updated_at TEXT,
         owner_agent_id TEXT NOT NULL,
         assigned_to_agent_id TEXT NOT NULL,
         title TEXT NOT NULL,
         description TEXT NOT NULL,
         status TEXT NOT NULL,
         status_reason TEXT,
         FOREIGN KEY(board_id) REFERENCES boards(board_id) ON DELETE CASCADE
       );`,
    );
    this.ensureTaskStatusReasonColumn(db);
    this.ensureTaskStatusUpdatedAtColumn(db);
    this.ensureTaskProjectColumnRemoved(db);
    this.ensureTaskUpdatedAtColumn(db);
    this.ensureTaskUpdatedAtInsertCompatibility(db);
    this.execute(
      db,
      `CREATE TABLE IF NOT EXISTS task_blockers (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         task_id TEXT NOT NULL,
         created_at TEXT NOT NULL,
         created_by_agent_id TEXT NOT NULL,
         content TEXT NOT NULL,
         FOREIGN KEY(task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
       );`,
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
       );`,
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
       );`,
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_tasks_board_id ON tasks(board_id);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at, task_id);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_tasks_status_updated_at ON tasks(status_updated_at, task_id);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_tasks_status_status_updated_at ON tasks(status, status_updated_at, task_id);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_tasks_assignee_created_at ON tasks(assigned_to_agent_id, created_at, task_id);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_task_blockers_task_id ON task_blockers(task_id);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_id ON task_artifacts(task_id);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_task_worklog_task_id ON task_worklog(task_id);",
    );

    await this.persistDatabase(paths, db);
    return db;
  }

  private ensureInternalTaskBucket(db: SqlJsDatabase): void {
    const existing = this.queryOne<BoardRow>(
      db,
      `SELECT board_id, title, created_at, owner_agent_id, is_default
       FROM boards
       WHERE board_id = ?`,
      [INTERNAL_TASK_BUCKET_ID],
    );
    if (existing) {
      return;
    }

    this.execute(
      db,
      `INSERT INTO boards (board_id, title, created_at, owner_agent_id, is_default)
       VALUES (?, ?, ?, ?, 0)`,
      [
        INTERNAL_TASK_BUCKET_ID,
        INTERNAL_TASK_BUCKET_TITLE,
        this.nowIso(),
        DEFAULT_AGENT_ID,
      ],
    );
  }

  private async getSqlJs(): Promise<SqlJsStatic> {
    if (!this.sqlPromise) {
      const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
      this.sqlPromise = initSqlJs({
        locateFile: () => wasmPath,
      });
    }

    return this.sqlPromise;
  }

  private async persistDatabase(
    paths: OpenGoatPaths,
    db: SqlJsDatabase,
  ): Promise<void> {
    const dbPath = this.pathPort.join(paths.homeDir, "boards.sqlite");
    const data = db.export();
    await writeFileBuffer(dbPath, data);
    if (this.dbPath === dbPath) {
      this.dbFileFingerprint = await this.readDbFileFingerprint(dbPath);
    }
  }

  private async readDbFileFingerprint(dbPath: string): Promise<string | null> {
    try {
      const fileStats = await statFile(dbPath);
      return `${fileStats.size}:${fileStats.mtimeMs}`;
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  private execute(
    db: SqlJsDatabase,
    sql: string,
    params: Array<string | number | null> = [],
  ): void {
    const statement = db.prepare(sql);
    statement.bind(params);
    while (statement.step()) {
      // no-op
    }
    statement.free();
  }

  private queryAll<T>(
    db: SqlJsDatabase,
    sql: string,
    params: Array<string | number | null> = [],
  ): T[] {
    const statement = db.prepare(sql);
    statement.bind(params);
    const rows: T[] = [];
    while (statement.step()) {
      rows.push(statement.getAsObject() as T);
    }
    statement.free();
    return rows;
  }

  private queryOne<T>(
    db: SqlJsDatabase,
    sql: string,
    params: Array<string | number | null> = [],
  ): T | undefined {
    const all = this.queryAll<T>(db, sql, params);
    return all[0];
  }

  private ensureTaskProjectColumnRemoved(db: SqlJsDatabase): void {
    const columns = this.queryAll<{ name: string }>(
      db,
      "PRAGMA table_info(tasks);",
    );
    const hasProject = columns.some((column) => column.name === "project");
    if (!hasProject) {
      return;
    }

    const hasStatusUpdatedAt = columns.some(
      (column) => column.name === "status_updated_at",
    );
    const hasStatusReason = columns.some(
      (column) => column.name === "status_reason",
    );
    const hasUpdatedAt = columns.some(
      (column) => column.name === "updated_at",
    );
    const fallbackCreatedAt = this.resolveNowIso();

    this.execute(db, "PRAGMA foreign_keys = OFF;");
    try {
      this.execute(
        db,
        `CREATE TABLE tasks_without_project (
           task_id TEXT PRIMARY KEY,
           board_id TEXT NOT NULL,
           created_at TEXT NOT NULL,
           updated_at TEXT NOT NULL DEFAULT '',
           status_updated_at TEXT,
           owner_agent_id TEXT NOT NULL,
           assigned_to_agent_id TEXT NOT NULL,
           title TEXT NOT NULL,
           description TEXT NOT NULL,
           status TEXT NOT NULL,
           status_reason TEXT,
           FOREIGN KEY(board_id) REFERENCES boards(board_id) ON DELETE CASCADE
         );`,
      );
      this.execute(
        db,
        `INSERT INTO tasks_without_project (
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
         )
         SELECT
           task_id,
           board_id,
           COALESCE(
             NULLIF(TRIM(created_at), ''),
             NULLIF(TRIM(status_updated_at), ''),
             ${hasUpdatedAt ? "NULLIF(TRIM(updated_at), '')" : "NULL"},
             ?
           ),
           ${
             hasUpdatedAt
               ? "COALESCE(NULLIF(TRIM(updated_at), ''), NULLIF(TRIM(status_updated_at), ''), NULLIF(TRIM(created_at), ''), '')"
               : "COALESCE(NULLIF(TRIM(status_updated_at), ''), NULLIF(TRIM(created_at), ''), '')"
           },
           ${hasStatusUpdatedAt ? "status_updated_at" : "created_at"},
           owner_agent_id,
           assigned_to_agent_id,
           title,
           description,
           status,
           ${hasStatusReason ? "status_reason" : "NULL"}
         FROM tasks;`,
        [fallbackCreatedAt],
      );
      this.execute(db, "DROP TABLE tasks;");
      this.execute(db, "ALTER TABLE tasks_without_project RENAME TO tasks;");
    } finally {
      this.execute(db, "PRAGMA foreign_keys = ON;");
    }
  }

  private ensureTaskStatusReasonColumn(db: SqlJsDatabase): void {
    const columns = this.queryAll<{ name: string }>(
      db,
      "PRAGMA table_info(tasks);",
    );
    const hasStatusReason = columns.some(
      (column) => column.name === "status_reason",
    );
    if (hasStatusReason) {
      return;
    }

    this.execute(db, "ALTER TABLE tasks ADD COLUMN status_reason TEXT;");
  }

  private ensureTaskStatusUpdatedAtColumn(db: SqlJsDatabase): void {
    const columns = this.queryAll<{ name: string }>(
      db,
      "PRAGMA table_info(tasks);",
    );
    const hasStatusUpdatedAt = columns.some(
      (column) => column.name === "status_updated_at",
    );
    if (!hasStatusUpdatedAt) {
      this.execute(db, "ALTER TABLE tasks ADD COLUMN status_updated_at TEXT;");
    }

    this.execute(
      db,
      `UPDATE tasks
       SET status_updated_at = created_at
       WHERE status_updated_at IS NULL
          OR TRIM(status_updated_at) = '';`,
    );
  }

  private ensureTaskUpdatedAtColumn(db: SqlJsDatabase): void {
    const columns = this.queryAll<{ name: string }>(
      db,
      "PRAGMA table_info(tasks);",
    );
    const hasUpdatedAt = columns.some(
      (column) => column.name === "updated_at",
    );
    if (!hasUpdatedAt) {
      this.execute(
        db,
        "ALTER TABLE tasks ADD COLUMN updated_at TEXT;",
      );
    }

    this.execute(
      db,
      `UPDATE tasks
       SET updated_at = COALESCE(
         NULLIF(TRIM(status_updated_at), ''),
         NULLIF(TRIM(created_at), ''),
         ''
       )
       WHERE updated_at IS NULL
          OR TRIM(updated_at) = '';`,
    );
  }

  private ensureTaskUpdatedAtInsertCompatibility(db: SqlJsDatabase): void {
    const columns = this.queryAll<{
      name: string;
      notnull: number;
      dflt_value: string | null;
    }>(db, "PRAGMA table_info(tasks);");
    const updatedAt = columns.find((column) => column.name === "updated_at");
    if (!updatedAt) {
      return;
    }

    const hasDefault =
      typeof updatedAt.dflt_value === "string" &&
      updatedAt.dflt_value.trim().length > 0;
    if (updatedAt.notnull !== 1 || hasDefault) {
      return;
    }

    this.execute(db, "PRAGMA foreign_keys = OFF;");
    try {
      const fallbackCreatedAt = this.resolveNowIso();
      this.execute(
        db,
        `CREATE TABLE tasks_with_updated_at_default (
           task_id TEXT PRIMARY KEY,
           board_id TEXT NOT NULL,
           created_at TEXT NOT NULL,
           updated_at TEXT NOT NULL DEFAULT '',
           status_updated_at TEXT,
           owner_agent_id TEXT NOT NULL,
           assigned_to_agent_id TEXT NOT NULL,
           title TEXT NOT NULL,
           description TEXT NOT NULL,
           status TEXT NOT NULL,
           status_reason TEXT,
           FOREIGN KEY(board_id) REFERENCES boards(board_id) ON DELETE CASCADE
         );`,
      );
      this.execute(
        db,
        `INSERT INTO tasks_with_updated_at_default (
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
         )
         SELECT
           task_id,
           board_id,
           COALESCE(
             NULLIF(TRIM(created_at), ''),
             NULLIF(TRIM(status_updated_at), ''),
             NULLIF(TRIM(updated_at), ''),
             ?
           ),
           COALESCE(
             NULLIF(TRIM(updated_at), ''),
             NULLIF(TRIM(status_updated_at), ''),
             NULLIF(TRIM(created_at), ''),
             ''
           ),
           status_updated_at,
           owner_agent_id,
           assigned_to_agent_id,
           title,
           description,
           status,
           status_reason
         FROM tasks;`,
        [fallbackCreatedAt],
      );
      this.execute(db, "DROP TABLE tasks;");
      this.execute(
        db,
        "ALTER TABLE tasks_with_updated_at_default RENAME TO tasks;",
      );
    } finally {
      this.execute(db, "PRAGMA foreign_keys = ON;");
    }
  }

  private ensureBoardDefaultColumn(db: SqlJsDatabase): void {
    const columns = this.queryAll<{ name: string }>(
      db,
      "PRAGMA table_info(boards);",
    );
    const hasDefaultColumn = columns.some(
      (column) => column.name === "is_default",
    );
    if (hasDefaultColumn) {
      return;
    }

    this.execute(
      db,
      "ALTER TABLE boards ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;",
    );
  }

  private touchTaskUpdatedAt(db: SqlJsDatabase, taskId: string): void {
    this.execute(
      db,
      `UPDATE tasks
       SET updated_at = ?
       WHERE task_id = ?`,
      [this.nowIso(), taskId],
    );
  }

  private resolveNowIso(): string {
    const raw = this.nowIso();
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.trim();
    }
    return new Date().toISOString();
  }
}

function normalizeEntityId(value: string, label: string): string {
  const normalized = normalizeAgentId(value);
  if (!normalized) {
    throw new Error(`${label} cannot be empty.`);
  }
  return normalized;
}

function normalizeTaskStatus(
  rawStatus: string | undefined,
  allowEmpty = false,
): string {
  const normalized = (
    rawStatus?.trim().toLowerCase() || (allowEmpty ? "" : TASK_STATUSES[0])
  ).trim();
  if (!normalized) {
    throw new Error("Task status cannot be empty.");
  }
  if (!TASK_STATUSES.includes(normalized as (typeof TASK_STATUSES)[number])) {
    throw new Error(`Task status must be one of: ${TASK_STATUSES.join(", ")}.`);
  }
  return normalized;
}

function normalizeTaskStatusReason(
  status: string,
  rawReason: string | undefined,
): string | null {
  const reason = rawReason?.trim();
  if ((status === "pending" || status === "blocked") && !reason) {
    throw new Error(`Reason is required when task status is \"${status}\".`);
  }
  return reason || null;
}

function toTaskEntry(row: EntryRow): TaskEntry {
  return {
    createdAt: row.created_at,
    createdBy: row.created_by_agent_id,
    content: row.content,
  };
}

function createEntityId(prefixSource: string): string {
  const prefix = normalizeAgentId(prefixSource) || "item";
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function resolveTaskListLimit(rawLimit: number | undefined): number {
  if (!Number.isFinite(rawLimit)) {
    return MAX_TASK_LIST_LIMIT;
  }
  const parsedLimit = Math.trunc(rawLimit ?? MAX_TASK_LIST_LIMIT);
  if (parsedLimit <= 0) {
    return 1;
  }
  return Math.min(parsedLimit, MAX_TASK_LIST_LIMIT);
}

function normalizeOptionalAssignee(
  rawAssignee: string | undefined,
): string | undefined {
  if (rawAssignee === undefined) {
    return undefined;
  }
  const normalized = normalizeAgentId(rawAssignee);
  if (!normalized) {
    throw new Error("assignee cannot be empty.");
  }
  return normalized;
}

function collectAssignableAgents(
  manifests: AgentManifest[],
  actorId: string,
): Set<string> {
  const normalizedActorId = normalizeAgentId(actorId) || DEFAULT_AGENT_ID;
  const directReporteesByManager = new Map<string, string[]>();

  for (const manifest of manifests) {
    const managerId = normalizeAgentId(manifest.metadata.reportsTo ?? "");
    if (!managerId) {
      continue;
    }

    const reportees = directReporteesByManager.get(managerId) ?? [];
    reportees.push(manifest.agentId);
    directReporteesByManager.set(managerId, reportees);
  }

  const allowed = new Set<string>([normalizedActorId]);
  const queue = [...(directReporteesByManager.get(normalizedActorId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || allowed.has(current)) {
      continue;
    }

    allowed.add(current);
    const nested = directReporteesByManager.get(current) ?? [];
    for (const reporteeId of nested) {
      if (!allowed.has(reporteeId)) {
        queue.push(reporteeId);
      }
    }
  }

  return allowed;
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  return (error as NodeJS.ErrnoException).code === "ENOENT";
}
