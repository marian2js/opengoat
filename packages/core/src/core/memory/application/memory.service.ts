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
  CreateMemoryOptions,
  ListMemoriesOptions,
  MemoryRecord,
  UpdateMemoryOptions,
} from "../domain/memory.js";

interface MemoryServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  nowIso: () => string;
}

interface MemoryRow {
  memory_id: string;
  project_id: string;
  objective_id: string | null;
  specialist_id: string | null;
  category: string;
  scope: string;
  content: string;
  source: string;
  confidence: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  user_confirmed: number;
  supersedes: string | null;
  replaced_by: string | null;
}

const require = createRequire(import.meta.url);

export class MemoryService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly nowIso: () => string;
  private sqlPromise?: Promise<SqlJsStatic>;
  private dbPromise?: Promise<SqlJsDatabase>;
  private dbPath?: string;
  private dbFileFingerprint?: string | null;

  public constructor(deps: MemoryServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.nowIso = deps.nowIso;
  }

  public async createMemory(
    paths: OpenGoatPaths,
    options: CreateMemoryOptions,
  ): Promise<MemoryRecord> {
    const db = await this.getDatabase(paths);
    const memoryId = randomUUID();
    const now = this.nowIso();
    const confidence = options.confidence ?? 1.0;
    const userConfirmed = options.userConfirmed ?? false;

    this.execute(
      db,
      `INSERT INTO memories (
        memory_id, project_id, objective_id, specialist_id, category, scope,
        content, source, confidence, created_by,
        created_at, updated_at, user_confirmed, supersedes, replaced_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memoryId,
        options.projectId,
        options.objectiveId ?? null,
        options.specialistId ?? null,
        options.category,
        options.scope,
        options.content,
        options.source,
        confidence,
        options.createdBy,
        now,
        now,
        userConfirmed ? 1 : 0,
        options.supersedes ?? null,
        null,
      ],
    );

    await this.persistDatabase(paths, db);
    return this.hydrateMemoryRow(
      this.requireRow(db, memoryId),
    );
  }

  public async getMemory(
    paths: OpenGoatPaths,
    memoryId: string,
  ): Promise<MemoryRecord | undefined> {
    const db = await this.getDatabase(paths);
    const row = this.queryOne<MemoryRow>(
      db,
      "SELECT * FROM memories WHERE memory_id = ?",
      [memoryId],
    );
    return row ? this.hydrateMemoryRow(row) : undefined;
  }

  public async listMemories(
    paths: OpenGoatPaths,
    options: ListMemoriesOptions,
  ): Promise<MemoryRecord[]> {
    const db = await this.getDatabase(paths);
    const conditions: string[] = ["project_id = ?"];
    const params: Array<string | number | null> = [options.projectId];

    if (options.objectiveId !== undefined) {
      conditions.push("objective_id = ?");
      params.push(options.objectiveId);
    }
    if (options.specialistId !== undefined) {
      conditions.push("specialist_id = ?");
      params.push(options.specialistId);
    }
    if (options.category !== undefined) {
      conditions.push("category = ?");
      params.push(options.category);
    }
    if (options.scope !== undefined) {
      conditions.push("scope = ?");
      params.push(options.scope);
    }
    if (options.activeOnly !== false) {
      conditions.push("replaced_by IS NULL");
    }

    const rows = this.queryAll<MemoryRow>(
      db,
      `SELECT * FROM memories WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
      params,
    );

    return rows.map((row) => this.hydrateMemoryRow(row));
  }

  public async updateMemory(
    paths: OpenGoatPaths,
    memoryId: string,
    options: UpdateMemoryOptions,
  ): Promise<MemoryRecord> {
    const db = await this.getDatabase(paths);
    const existing = this.queryOne<MemoryRow>(
      db,
      "SELECT * FROM memories WHERE memory_id = ?",
      [memoryId],
    );
    if (!existing) {
      throw new Error(`Memory "${memoryId}" not found`);
    }

    const sets: string[] = ["updated_at = ?"];
    const params: Array<string | number | null> = [this.nowIso()];

    if (options.content !== undefined) {
      sets.push("content = ?");
      params.push(options.content);
    }
    if (options.confidence !== undefined) {
      sets.push("confidence = ?");
      params.push(options.confidence);
    }
    if (options.userConfirmed !== undefined) {
      sets.push("user_confirmed = ?");
      params.push(options.userConfirmed ? 1 : 0);
    }

    params.push(memoryId);
    this.execute(
      db,
      `UPDATE memories SET ${sets.join(", ")} WHERE memory_id = ?`,
      params,
    );

    await this.persistDatabase(paths, db);
    return this.hydrateMemoryRow(this.requireRow(db, memoryId));
  }

  public async deleteMemory(
    paths: OpenGoatPaths,
    memoryId: string,
  ): Promise<void> {
    const db = await this.getDatabase(paths);
    const existing = this.queryOne<MemoryRow>(
      db,
      "SELECT * FROM memories WHERE memory_id = ?",
      [memoryId],
    );
    if (!existing) {
      throw new Error(`Memory "${memoryId}" not found`);
    }

    this.execute(db, "DELETE FROM memories WHERE memory_id = ?", [memoryId]);
    await this.persistDatabase(paths, db);
  }

  public async detectConflicts(
    paths: OpenGoatPaths,
    projectId: string,
    scope: string,
    category: string,
    objectiveId?: string,
  ): Promise<MemoryRecord[]> {
    const db = await this.getDatabase(paths);
    const conditions: string[] = [
      "project_id = ?",
      "scope = ?",
      "category = ?",
      "replaced_by IS NULL",
    ];
    const params: Array<string | number | null> = [
      projectId,
      scope,
      category,
    ];

    if (objectiveId !== undefined) {
      conditions.push("objective_id = ?");
      params.push(objectiveId);
    }

    const rows = this.queryAll<MemoryRow>(
      db,
      `SELECT * FROM memories WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
      params,
    );

    return rows.map((row) => this.hydrateMemoryRow(row));
  }

  public async resolveConflict(
    paths: OpenGoatPaths,
    keepMemoryId: string,
    replaceMemoryId: string,
  ): Promise<void> {
    const db = await this.getDatabase(paths);
    const keepRow = this.queryOne<MemoryRow>(
      db,
      "SELECT * FROM memories WHERE memory_id = ?",
      [keepMemoryId],
    );
    if (!keepRow) {
      throw new Error(`Memory "${keepMemoryId}" not found`);
    }
    const replaceRow = this.queryOne<MemoryRow>(
      db,
      "SELECT * FROM memories WHERE memory_id = ?",
      [replaceMemoryId],
    );
    if (!replaceRow) {
      throw new Error(`Memory "${replaceMemoryId}" not found`);
    }

    const now = this.nowIso();
    this.execute(
      db,
      "UPDATE memories SET replaced_by = ?, updated_at = ? WHERE memory_id = ?",
      [keepMemoryId, now, replaceMemoryId],
    );
    this.execute(
      db,
      "UPDATE memories SET supersedes = ?, updated_at = ? WHERE memory_id = ?",
      [replaceMemoryId, now, keepMemoryId],
    );

    await this.persistDatabase(paths, db);
  }

  private requireRow(db: SqlJsDatabase, memoryId: string): MemoryRow {
    const row = this.queryOne<MemoryRow>(
      db,
      "SELECT * FROM memories WHERE memory_id = ?",
      [memoryId],
    );
    if (!row) {
      throw new Error(`Memory "${memoryId}" not found`);
    }
    return row;
  }

  private hydrateMemoryRow(row: MemoryRow): MemoryRecord {
    return {
      memoryId: row.memory_id,
      projectId: row.project_id,
      objectiveId: row.objective_id ?? null,
      specialistId: row.specialist_id ?? null,
      category: row.category as MemoryRecord["category"],
      scope: row.scope as MemoryRecord["scope"],
      content: row.content,
      source: row.source,
      confidence: row.confidence,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      userConfirmed: row.user_confirmed === 1,
      supersedes: row.supersedes ?? null,
      replacedBy: row.replaced_by ?? null,
    };
  }

  private async getDatabase(paths: OpenGoatPaths): Promise<SqlJsDatabase> {
    const dbPath = this.pathPort.join(paths.homeDir, "memory.sqlite");
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
      `CREATE TABLE IF NOT EXISTS memories (
        memory_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        objective_id TEXT,
        category TEXT NOT NULL,
        scope TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 1.0,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        user_confirmed INTEGER NOT NULL DEFAULT 0,
        supersedes TEXT,
        replaced_by TEXT
      );`,
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_memories_project_scope ON memories(project_id, scope);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_memories_project_objective ON memories(project_id, objective_id);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_memories_project_category ON memories(project_id, category);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_memories_active ON memories(project_id, scope, category, replaced_by);",
    );

    // Migration: add specialist_id column if missing
    const columns = this.queryAll<{ name: string }>(
      db,
      "PRAGMA table_info(memories)",
    );
    if (!columns.some((c) => c.name === "specialist_id")) {
      this.execute(db, "ALTER TABLE memories ADD COLUMN specialist_id TEXT;");
      this.execute(
        db,
        "CREATE INDEX IF NOT EXISTS idx_memories_specialist ON memories(project_id, specialist_id);",
      );
    }

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
    const dbPath = this.pathPort.join(paths.homeDir, "memory.sqlite");
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
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
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
