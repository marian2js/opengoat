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
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import {
  validateTransition,
} from "../domain/run-state-machine.js";
import type {
  CreateRunOptions,
  ListRunsOptions,
  RunListPage,
  RunPhaseInfo,
  RunRecord,
  RunStatus,
} from "../domain/run.js";

interface RunServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  nowIso: () => string;
}

interface RunRow {
  run_id: string;
  project_id: string;
  objective_id: string;
  playbook_id: string | null;
  title: string;
  status: string;
  phase: string;
  phase_summary: string;
  started_from: string;
  agent_id: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

const require = createRequire(import.meta.url);

export class RunService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly nowIso: () => string;
  private sqlPromise?: Promise<SqlJsStatic>;
  private dbPromise?: Promise<SqlJsDatabase>;
  private dbPath?: string;
  private dbFileFingerprint?: string | null;

  public constructor(deps: RunServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.nowIso = deps.nowIso;
  }

  public async createRun(
    paths: OpenGoatPaths,
    options: CreateRunOptions,
  ): Promise<RunRecord> {
    if (!options.title.trim()) {
      throw new Error("Run title must not be empty");
    }
    if (!options.projectId.trim()) {
      throw new Error("Run projectId must not be empty");
    }
    if (!options.objectiveId.trim()) {
      throw new Error("Run objectiveId must not be empty");
    }

    const db = await this.getDatabase(paths);
    const now = this.nowIso();
    const runId = `run-${randomUUID().slice(0, 8)}`;

    this.execute(
      db,
      `INSERT INTO runs (
        run_id, project_id, objective_id, playbook_id, title, status,
        phase, phase_summary, started_from, agent_id, session_id,
        created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        runId,
        options.projectId,
        options.objectiveId,
        options.playbookId ?? null,
        options.title,
        "draft",
        options.phase ?? "",
        options.phaseSummary ?? "",
        options.startedFrom ?? "dashboard",
        options.agentId ?? "goat",
        options.sessionId ?? null,
        now,
        now,
        null,
      ],
    );

    await this.persistDatabase(paths, db);
    return this.getRun(paths, runId);
  }

  public async getRun(
    paths: OpenGoatPaths,
    runId: string,
  ): Promise<RunRecord> {
    const db = await this.getDatabase(paths);
    const row = this.queryOne<RunRow>(
      db,
      "SELECT * FROM runs WHERE run_id = ?",
      [runId],
    );

    if (!row) {
      throw new Error("Run not found");
    }

    return toRunRecord(row);
  }

  public async listRuns(
    paths: OpenGoatPaths,
    options?: ListRunsOptions,
  ): Promise<RunListPage> {
    const db = await this.getDatabase(paths);

    const whereClauses: string[] = [];
    const params: Array<string | number | null> = [];

    if (options?.projectId) {
      whereClauses.push("project_id = ?");
      params.push(options.projectId);
    }
    if (options?.objectiveId) {
      whereClauses.push("objective_id = ?");
      params.push(options.objectiveId);
    }
    if (options?.status) {
      whereClauses.push("status = ?");
      params.push(options.status);
    }

    const whereStr =
      whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : "";

    // Count total matching rows
    const countRow = this.queryOne<{ total: number }>(
      db,
      `SELECT COUNT(*) as total FROM runs${whereStr}`,
      params,
    );
    const total = countRow?.total ?? 0;

    const limit = Math.min(options?.limit ?? 50, 100);
    const offset = options?.offset ?? 0;

    const rows = this.queryAll<RunRow>(
      db,
      `SELECT * FROM runs${whereStr} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return {
      runs: rows.map(toRunRecord),
      total,
      limit,
      offset,
    };
  }

  public async updateRunStatus(
    paths: OpenGoatPaths,
    runId: string,
    status: RunStatus,
  ): Promise<RunRecord> {
    const db = await this.getDatabase(paths);
    const row = this.requireRun(db, runId);

    validateTransition(row.status as RunStatus, status);

    const now = this.nowIso();
    const completedAt =
      status === "completed" || status === "cancelled" ? now : null;

    this.execute(
      db,
      `UPDATE runs SET status = ?, updated_at = ?, completed_at = COALESCE(?, completed_at) WHERE run_id = ?`,
      [status, now, completedAt, runId],
    );

    await this.persistDatabase(paths, db);
    return this.getRun(paths, runId);
  }

  public async advancePhase(
    paths: OpenGoatPaths,
    runId: string,
    phaseInfo: RunPhaseInfo,
  ): Promise<RunRecord> {
    if (!phaseInfo.phase.trim()) {
      throw new Error("Phase name must not be empty");
    }

    const db = await this.getDatabase(paths);
    const row = this.requireRun(db, runId);

    if (row.status !== "running") {
      throw new Error("Can only advance phase on a running run");
    }

    const now = this.nowIso();

    this.execute(
      db,
      `UPDATE runs SET phase = ?, phase_summary = ?, updated_at = ? WHERE run_id = ?`,
      [phaseInfo.phase, phaseInfo.phaseSummary ?? "", now, runId],
    );

    await this.persistDatabase(paths, db);
    return this.getRun(paths, runId);
  }

  public async completeRun(
    paths: OpenGoatPaths,
    runId: string,
  ): Promise<RunRecord> {
    return this.updateRunStatus(paths, runId, "completed");
  }

  public async cancelRun(
    paths: OpenGoatPaths,
    runId: string,
  ): Promise<RunRecord> {
    return this.updateRunStatus(paths, runId, "cancelled");
  }

  // ---------------------------------------------------------------------------
  // Private database helpers
  // ---------------------------------------------------------------------------

  private requireRun(db: SqlJsDatabase, runId: string): RunRow {
    const row = this.queryOne<RunRow>(
      db,
      "SELECT * FROM runs WHERE run_id = ?",
      [runId],
    );
    if (!row) {
      throw new Error("Run not found");
    }
    return row;
  }

  private async getDatabase(paths: OpenGoatPaths): Promise<SqlJsDatabase> {
    const dbPath = this.pathPort.join(paths.homeDir, "runs.sqlite");
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

    this.execute(
      db,
      `CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        objective_id TEXT NOT NULL,
        playbook_id TEXT,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        phase TEXT NOT NULL DEFAULT '',
        phase_summary TEXT NOT NULL DEFAULT '',
        started_from TEXT NOT NULL DEFAULT 'dashboard',
        agent_id TEXT NOT NULL DEFAULT 'goat',
        session_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );`,
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_runs_project_id ON runs(project_id);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_runs_objective_id ON runs(objective_id);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);",
    );

    await this.persistDatabase(paths, db);
    return db;
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
    const dbPath = this.pathPort.join(paths.homeDir, "runs.sqlite");
    const data = db.export();
    await writeFileBuffer(dbPath, data);
    if (this.dbPath === dbPath) {
      this.dbFileFingerprint = await this.readDbFileFingerprint(dbPath);
    }
  }

  private async readDbFileFingerprint(
    dbPath: string,
  ): Promise<string | null> {
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
}

function toRunRecord(row: RunRow): RunRecord {
  return {
    runId: row.run_id,
    projectId: row.project_id,
    objectiveId: row.objective_id,
    playbookId: row.playbook_id ?? undefined,
    title: row.title,
    status: row.status as RunRecord["status"],
    phase: row.phase,
    phaseSummary: row.phase_summary,
    startedFrom: row.started_from as RunRecord["startedFrom"],
    agentId: row.agent_id,
    sessionId: row.session_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  };
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  if (typeof error !== "object" || error === null) return false;
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}
