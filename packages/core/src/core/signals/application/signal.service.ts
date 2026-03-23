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
import type {
  CreateSignalOptions,
  ListSignalsOptions,
  SignalRecord,
} from "../domain/signal.js";
import { VALID_STATUS_TRANSITIONS } from "../domain/signal.js";

interface SignalServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  nowIso: () => string;
}

interface SignalRow {
  signal_id: string;
  project_id: string;
  objective_id: string | null;
  source_type: string;
  signal_type: string;
  title: string;
  summary: string;
  evidence: string | null;
  importance: string;
  freshness: string;
  status: string;
  created_at: string;
  updated_at: string | null;
}

const require = createRequire(import.meta.url);

export class SignalService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly nowIso: () => string;
  private sqlPromise?: Promise<SqlJsStatic>;
  private dbPromise?: Promise<SqlJsDatabase>;
  private dbPath?: string;
  private dbFileFingerprint?: string | null;

  public constructor(deps: SignalServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.nowIso = deps.nowIso;
  }

  public async createSignal(
    paths: OpenGoatPaths,
    options: CreateSignalOptions,
  ): Promise<SignalRecord> {
    const db = await this.getDatabase(paths);
    const now = this.nowIso();
    const signalId = randomUUID();

    this.execute(
      db,
      `INSERT INTO signals (
        signal_id, project_id, objective_id, source_type, signal_type,
        title, summary, evidence, importance, freshness, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        signalId,
        options.projectId,
        options.objectiveId ?? null,
        options.sourceType,
        options.signalType,
        options.title,
        options.summary,
        options.evidence ?? null,
        options.importance,
        options.freshness,
        "new",
        now,
      ],
    );

    await this.persistDatabase(paths, db);

    return this.getSignal(paths, signalId);
  }

  public async getSignal(
    paths: OpenGoatPaths,
    signalId: string,
  ): Promise<SignalRecord> {
    const db = await this.getDatabase(paths);
    const row = this.queryOne<SignalRow>(
      db,
      "SELECT * FROM signals WHERE signal_id = ?",
      [signalId],
    );

    if (!row) {
      throw new Error("Signal not found");
    }

    return toSignalRecord(row);
  }

  public async listSignals(
    paths: OpenGoatPaths,
    options: ListSignalsOptions,
  ): Promise<{ items: SignalRecord[]; total: number; limit: number; offset: number }> {
    const db = await this.getDatabase(paths);

    let whereSql = "WHERE project_id = ?";
    const params: Array<string | number | null> = [options.projectId];

    if (options.objectiveId) {
      whereSql += " AND objective_id = ?";
      params.push(options.objectiveId);
    }

    if (options.status) {
      whereSql += " AND status = ?";
      params.push(options.status);
    }

    if (options.sourceType) {
      whereSql += " AND source_type = ?";
      params.push(options.sourceType);
    }

    const countRow = this.queryOne<{ total: number }>(
      db,
      `SELECT COUNT(*) as total FROM signals ${whereSql}`,
      params,
    );
    const total = countRow?.total ?? 0;

    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const rows = this.queryAll<SignalRow>(
      db,
      `SELECT * FROM signals ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return {
      items: rows.map(toSignalRecord),
      total,
      limit,
      offset,
    };
  }

  public async updateSignalStatus(
    paths: OpenGoatPaths,
    signalId: string,
    newStatus: string,
  ): Promise<SignalRecord> {
    const db = await this.getDatabase(paths);
    const row = this.queryOne<SignalRow>(
      db,
      "SELECT * FROM signals WHERE signal_id = ?",
      [signalId],
    );

    if (!row) {
      throw new Error("Signal not found");
    }

    const validTransitions = VALID_STATUS_TRANSITIONS[row.status];
    if (!validTransitions || !validTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from "${row.status}" to "${newStatus}"`,
      );
    }

    const now = this.nowIso();

    this.execute(
      db,
      "UPDATE signals SET status = ?, updated_at = ? WHERE signal_id = ?",
      [newStatus, now, signalId],
    );

    await this.persistDatabase(paths, db);

    return this.getSignal(paths, signalId);
  }

  public async promoteSignal(
    paths: OpenGoatPaths,
    signalId: string,
    targetObjectiveId?: string,
  ): Promise<SignalRecord> {
    const db = await this.getDatabase(paths);
    const row = this.queryOne<SignalRow>(
      db,
      "SELECT * FROM signals WHERE signal_id = ?",
      [signalId],
    );

    if (!row) {
      throw new Error("Signal not found");
    }

    const validTransitions = VALID_STATUS_TRANSITIONS[row.status];
    if (!validTransitions || !validTransitions.includes("promoted")) {
      throw new Error(
        `Invalid status transition from "${row.status}" to "promoted"`,
      );
    }

    const now = this.nowIso();

    if (targetObjectiveId) {
      this.execute(
        db,
        "UPDATE signals SET status = ?, objective_id = ?, updated_at = ? WHERE signal_id = ?",
        ["promoted", targetObjectiveId, now, signalId],
      );
    } else {
      this.execute(
        db,
        "UPDATE signals SET status = ?, updated_at = ? WHERE signal_id = ?",
        ["promoted", now, signalId],
      );
    }

    await this.persistDatabase(paths, db);

    return this.getSignal(paths, signalId);
  }

  public async dismissSignal(
    paths: OpenGoatPaths,
    signalId: string,
  ): Promise<SignalRecord> {
    const db = await this.getDatabase(paths);
    const row = this.queryOne<SignalRow>(
      db,
      "SELECT * FROM signals WHERE signal_id = ?",
      [signalId],
    );

    if (!row) {
      throw new Error("Signal not found");
    }

    const validTransitions = VALID_STATUS_TRANSITIONS[row.status];
    if (!validTransitions || !validTransitions.includes("dismissed")) {
      throw new Error(
        `Invalid status transition from "${row.status}" to "dismissed"`,
      );
    }

    const now = this.nowIso();

    this.execute(
      db,
      "UPDATE signals SET status = ?, updated_at = ? WHERE signal_id = ?",
      ["dismissed", now, signalId],
    );

    await this.persistDatabase(paths, db);

    return this.getSignal(paths, signalId);
  }

  public async attachToObjective(
    paths: OpenGoatPaths,
    signalId: string,
    objectiveId: string,
  ): Promise<SignalRecord> {
    const db = await this.getDatabase(paths);
    const row = this.queryOne<SignalRow>(
      db,
      "SELECT * FROM signals WHERE signal_id = ?",
      [signalId],
    );

    if (!row) {
      throw new Error("Signal not found");
    }

    const now = this.nowIso();

    this.execute(
      db,
      "UPDATE signals SET objective_id = ?, updated_at = ? WHERE signal_id = ?",
      [objectiveId, now, signalId],
    );

    await this.persistDatabase(paths, db);

    return this.getSignal(paths, signalId);
  }

  private async getDatabase(paths: OpenGoatPaths): Promise<SqlJsDatabase> {
    const dbPath = this.pathPort.join(paths.homeDir, "signals.sqlite");
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
      `CREATE TABLE IF NOT EXISTS signals (
        signal_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        objective_id TEXT,
        source_type TEXT NOT NULL,
        signal_type TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        evidence TEXT,
        importance TEXT NOT NULL,
        freshness TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TEXT NOT NULL,
        updated_at TEXT
      );`,
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_signals_project_id ON signals(project_id);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_signals_source_type ON signals(source_type);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at);",
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
    const dbPath = this.pathPort.join(paths.homeDir, "signals.sqlite");
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

function toSignalRecord(row: SignalRow): SignalRecord {
  return {
    signalId: row.signal_id,
    projectId: row.project_id,
    objectiveId: row.objective_id ?? undefined,
    sourceType: row.source_type as SignalRecord["sourceType"],
    signalType: row.signal_type,
    title: row.title,
    summary: row.summary,
    evidence: row.evidence ?? undefined,
    importance: row.importance as SignalRecord["importance"],
    freshness: row.freshness as SignalRecord["freshness"],
    status: row.status as SignalRecord["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  if (typeof error !== "object" || error === null) return false;
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}
