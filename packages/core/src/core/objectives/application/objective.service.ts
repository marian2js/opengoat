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
  CreateObjectiveOptions,
  ListObjectivesOptions,
  ObjectiveRecord,
  UpdateObjectiveOptions,
} from "../domain/objective.js";

interface ObjectiveServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  nowIso: () => string;
}

interface ObjectiveRow {
  objective_id: string;
  project_id: string;
  title: string;
  goal_type: string;
  status: string;
  summary: string;
  why_now: string | null;
  success_definition: string | null;
  timeframe: string | null;
  already_tried: string | null;
  avoid: string | null;
  constraints: string | null;
  preferred_channels: string | null;
  created_from: string;
  is_primary: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

const require = createRequire(import.meta.url);

export class ObjectiveService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly nowIso: () => string;
  private sqlPromise?: Promise<SqlJsStatic>;
  private dbPromise?: Promise<SqlJsDatabase>;
  private dbPath?: string;
  private dbFileFingerprint?: string | null;

  public constructor(deps: ObjectiveServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.nowIso = deps.nowIso;
  }

  public async create(
    paths: OpenGoatPaths,
    projectId: string,
    options: CreateObjectiveOptions,
  ): Promise<ObjectiveRecord> {
    const db = await this.getDatabase(paths);
    const now = this.nowIso();
    const objectiveId = randomUUID();

    const preferredChannels = options.preferredChannels
      ? JSON.stringify(options.preferredChannels)
      : null;

    this.execute(
      db,
      `INSERT INTO objectives (
        objective_id, project_id, title, goal_type, status, summary,
        why_now, success_definition, timeframe, already_tried, avoid,
        constraints, preferred_channels, created_from, is_primary,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        objectiveId,
        projectId,
        options.title,
        options.goalType ?? "",
        "draft",
        options.summary ?? "",
        options.whyNow ?? null,
        options.successDefinition ?? null,
        options.timeframe ?? null,
        options.alreadyTried ?? null,
        options.avoid ?? null,
        options.constraints ?? null,
        preferredChannels,
        "manual",
        0,
        now,
        now,
      ],
    );

    await this.persistDatabase(paths, db);

    return this.get(paths, objectiveId);
  }

  public async get(
    paths: OpenGoatPaths,
    objectiveId: string,
  ): Promise<ObjectiveRecord> {
    const db = await this.getDatabase(paths);
    const row = this.queryOne<ObjectiveRow>(
      db,
      "SELECT * FROM objectives WHERE objective_id = ?",
      [objectiveId],
    );

    if (!row) {
      throw new Error("Objective not found");
    }

    return toObjectiveRecord(row);
  }

  public async list(
    paths: OpenGoatPaths,
    options: ListObjectivesOptions,
  ): Promise<ObjectiveRecord[]> {
    const db = await this.getDatabase(paths);

    let sql = "SELECT * FROM objectives WHERE project_id = ?";
    const params: Array<string | number | null> = [options.projectId];

    if (options.status) {
      sql += " AND status = ?";
      params.push(options.status);
    }

    sql += " ORDER BY created_at ASC";

    const rows = this.queryAll<ObjectiveRow>(db, sql, params);
    return rows.map(toObjectiveRecord);
  }

  public async update(
    paths: OpenGoatPaths,
    objectiveId: string,
    changes: UpdateObjectiveOptions,
  ): Promise<ObjectiveRecord> {
    const db = await this.getDatabase(paths);

    const existing = this.queryOne<ObjectiveRow>(
      db,
      "SELECT * FROM objectives WHERE objective_id = ?",
      [objectiveId],
    );
    if (!existing) {
      throw new Error("Objective not found");
    }

    const setClauses: string[] = [];
    const params: Array<string | number | null> = [];

    const fieldMap: Array<[keyof UpdateObjectiveOptions, string]> = [
      ["title", "title"],
      ["goalType", "goal_type"],
      ["status", "status"],
      ["summary", "summary"],
      ["whyNow", "why_now"],
      ["successDefinition", "success_definition"],
      ["timeframe", "timeframe"],
      ["alreadyTried", "already_tried"],
      ["avoid", "avoid"],
      ["constraints", "constraints"],
    ];

    for (const [tsKey, sqlCol] of fieldMap) {
      if (changes[tsKey] !== undefined) {
        setClauses.push(`${sqlCol} = ?`);
        params.push(changes[tsKey] as string);
      }
    }

    if (changes.preferredChannels !== undefined) {
      setClauses.push("preferred_channels = ?");
      params.push(JSON.stringify(changes.preferredChannels));
    }

    if (changes.isPrimary !== undefined) {
      setClauses.push("is_primary = ?");
      params.push(changes.isPrimary ? 1 : 0);
    }

    setClauses.push("updated_at = ?");
    params.push(this.nowIso());

    params.push(objectiveId);

    this.execute(
      db,
      `UPDATE objectives SET ${setClauses.join(", ")} WHERE objective_id = ?`,
      params,
    );

    await this.persistDatabase(paths, db);

    return this.get(paths, objectiveId);
  }

  public async archive(
    paths: OpenGoatPaths,
    objectiveId: string,
  ): Promise<ObjectiveRecord> {
    const db = await this.getDatabase(paths);

    const existing = this.queryOne<ObjectiveRow>(
      db,
      "SELECT * FROM objectives WHERE objective_id = ?",
      [objectiveId],
    );
    if (!existing) {
      throw new Error("Objective not found");
    }

    const now = this.nowIso();

    this.execute(
      db,
      `UPDATE objectives SET status = ?, archived_at = ?, updated_at = ? WHERE objective_id = ?`,
      ["abandoned", now, now, objectiveId],
    );

    await this.persistDatabase(paths, db);

    return this.get(paths, objectiveId);
  }

  public async setPrimaryActive(
    paths: OpenGoatPaths,
    projectId: string,
    objectiveId: string,
  ): Promise<ObjectiveRecord> {
    const db = await this.getDatabase(paths);

    const existing = this.queryOne<ObjectiveRow>(
      db,
      "SELECT * FROM objectives WHERE objective_id = ?",
      [objectiveId],
    );
    if (!existing) {
      throw new Error("Objective not found");
    }
    if (existing.project_id !== projectId) {
      throw new Error("Objective does not belong to project");
    }

    const now = this.nowIso();

    this.execute(
      db,
      "UPDATE objectives SET is_primary = 0, updated_at = ? WHERE project_id = ? AND is_primary = 1",
      [now, projectId],
    );

    this.execute(
      db,
      "UPDATE objectives SET is_primary = 1, status = 'active', updated_at = ? WHERE objective_id = ?",
      [now, objectiveId],
    );

    await this.persistDatabase(paths, db);

    return this.get(paths, objectiveId);
  }

  private async getDatabase(paths: OpenGoatPaths): Promise<SqlJsDatabase> {
    const dbPath = this.pathPort.join(paths.homeDir, "objectives.sqlite");
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
      `CREATE TABLE IF NOT EXISTS objectives (
        objective_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        goal_type TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        summary TEXT NOT NULL DEFAULT '',
        why_now TEXT,
        success_definition TEXT,
        timeframe TEXT,
        already_tried TEXT,
        avoid TEXT,
        constraints TEXT,
        preferred_channels TEXT,
        created_from TEXT NOT NULL DEFAULT 'manual',
        is_primary INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
      );`,
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_objectives_project ON objectives(project_id);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_objectives_status ON objectives(project_id, status);",
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
    const dbPath = this.pathPort.join(paths.homeDir, "objectives.sqlite");
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

function toObjectiveRecord(row: ObjectiveRow): ObjectiveRecord {
  let preferredChannels: string[] | undefined;
  if (row.preferred_channels) {
    try {
      preferredChannels = JSON.parse(row.preferred_channels);
    } catch {
      preferredChannels = [];
    }
  }

  return {
    objectiveId: row.objective_id,
    projectId: row.project_id,
    title: row.title,
    goalType: row.goal_type,
    status: row.status as ObjectiveRecord["status"],
    summary: row.summary,
    whyNow: row.why_now ?? undefined,
    successDefinition: row.success_definition ?? undefined,
    timeframe: row.timeframe ?? undefined,
    alreadyTried: row.already_tried ?? undefined,
    avoid: row.avoid ?? undefined,
    constraints: row.constraints ?? undefined,
    preferredChannels,
    createdFrom: row.created_from as ObjectiveRecord["createdFrom"],
    isPrimary: row.is_primary === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
  };
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  if (typeof error !== "object" || error === null) return false;
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}
