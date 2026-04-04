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
import { validateArtifactStatusTransition } from "../domain/artifact-status-machine.js";
import type {
  ArtifactListPage,
  ArtifactRecord,
  ArtifactStatus,
  ArtifactVersion,
  BundleRecord,
  CreateArtifactOptions,
  CreateBundleOptions,
  ListArtifactsOptions,
  UpdateArtifactOptions,
} from "../domain/artifact.js";

interface ArtifactServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  nowIso: () => string;
}

interface ArtifactRow {
  artifact_id: string;
  project_id: string;
  objective_id: string | null;
  run_id: string | null;
  task_id: string | null;
  bundle_id: string | null;
  type: string;
  title: string;
  status: string;
  format: string;
  content_ref: string;
  content: string | null;
  summary: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

interface ArtifactVersionRow {
  version_id: string;
  artifact_id: string;
  version: number;
  content: string;
  content_ref: string;
  summary: string | null;
  created_by: string;
  created_at: string;
  note: string | null;
}

interface BundleRow {
  bundle_id: string;
  project_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const require = createRequire(import.meta.url);

export class ArtifactService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly nowIso: () => string;
  private sqlPromise?: Promise<SqlJsStatic>;
  private dbPromise?: Promise<SqlJsDatabase>;
  private dbPath?: string;
  private dbFileFingerprint?: string | null;

  public constructor(deps: ArtifactServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.nowIso = deps.nowIso;
  }

  public async createArtifact(
    paths: OpenGoatPaths,
    options: CreateArtifactOptions,
  ): Promise<ArtifactRecord> {
    if (!options.title.trim()) {
      throw new Error("Artifact title must not be empty");
    }
    if (!options.projectId.trim()) {
      throw new Error("Artifact projectId must not be empty");
    }
    if (!options.contentRef.trim()) {
      throw new Error("Artifact contentRef must not be empty");
    }
    if (!options.createdBy.trim()) {
      throw new Error("Artifact createdBy must not be empty");
    }

    const db = await this.getDatabase(paths);
    const now = this.nowIso();
    const artifactId = `art-${randomUUID().slice(0, 8)}`;
    const versionId = `artv-${randomUUID().slice(0, 8)}`;

    this.execute(
      db,
      `INSERT INTO artifacts (
        artifact_id, project_id, objective_id, run_id, task_id, bundle_id,
        type, title, status, format, content_ref, content, summary,
        version, created_by, created_at, updated_at, approved_at, approved_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        artifactId,
        options.projectId,
        options.objectiveId ?? null,
        options.runId ?? null,
        options.taskId ?? null,
        options.bundleId ?? null,
        options.type,
        options.title,
        "draft",
        options.format,
        options.contentRef,
        options.content ?? null,
        options.summary ?? null,
        1,
        options.createdBy,
        now,
        now,
        null,
        null,
      ],
    );

    this.execute(
      db,
      `INSERT INTO artifact_versions (
        version_id, artifact_id, version, content, content_ref,
        summary, created_by, created_at, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        versionId,
        artifactId,
        1,
        options.content ?? "",
        options.contentRef,
        options.summary ?? null,
        options.createdBy,
        now,
        null,
      ],
    );

    await this.persistDatabase(paths, db);
    return this.getArtifact(paths, artifactId);
  }

  public async getArtifact(
    paths: OpenGoatPaths,
    artifactId: string,
  ): Promise<ArtifactRecord> {
    const db = await this.getDatabase(paths);
    const row = this.queryOne<ArtifactRow>(
      db,
      "SELECT * FROM artifacts WHERE artifact_id = ?",
      [artifactId],
    );

    if (!row) {
      throw new Error("Artifact not found");
    }

    return toArtifactRecord(row);
  }

  public async listArtifacts(
    paths: OpenGoatPaths,
    options?: ListArtifactsOptions,
  ): Promise<ArtifactListPage> {
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
    if (options?.runId) {
      whereClauses.push("run_id = ?");
      params.push(options.runId);
    }
    if (options?.taskId) {
      whereClauses.push("task_id = ?");
      params.push(options.taskId);
    }
    if (options?.bundleId) {
      whereClauses.push("bundle_id = ?");
      params.push(options.bundleId);
    }
    if (options?.status) {
      whereClauses.push("status = ?");
      params.push(options.status);
    }

    const whereStr =
      whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : "";

    const countRow = this.queryOne<{ total: number }>(
      db,
      `SELECT COUNT(*) as total FROM artifacts${whereStr}`,
      params,
    );
    const total = countRow?.total ?? 0;

    const rows = this.queryAll<ArtifactRow>(
      db,
      `SELECT * FROM artifacts${whereStr} ORDER BY created_at DESC`,
      params,
    );

    return {
      items: rows.map(toArtifactRecord),
      total,
    };
  }

  public async updateArtifact(
    paths: OpenGoatPaths,
    artifactId: string,
    updates: UpdateArtifactOptions,
  ): Promise<ArtifactRecord> {
    const db = await this.getDatabase(paths);
    const row = this.requireArtifact(db, artifactId);

    const now = this.nowIso();
    const newVersion = row.version + 1;
    const versionId = `artv-${randomUUID().slice(0, 8)}`;

    const newTitle = updates.title ?? row.title;
    const newContent = updates.content ?? row.content;
    const newContentRef = updates.contentRef ?? row.content_ref;
    const newSummary = updates.summary ?? row.summary;

    this.execute(
      db,
      `UPDATE artifacts SET title = ?, content = ?, content_ref = ?, summary = ?, version = ?, updated_at = ? WHERE artifact_id = ?`,
      [newTitle, newContent, newContentRef, newSummary, newVersion, now, artifactId],
    );

    this.execute(
      db,
      `INSERT INTO artifact_versions (
        version_id, artifact_id, version, content, content_ref,
        summary, created_by, created_at, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        versionId,
        artifactId,
        newVersion,
        newContent ?? "",
        newContentRef,
        newSummary,
        row.created_by,
        now,
        null,
      ],
    );

    await this.persistDatabase(paths, db);
    return this.getArtifact(paths, artifactId);
  }

  public async updateArtifactStatus(
    paths: OpenGoatPaths,
    artifactId: string,
    newStatus: ArtifactStatus,
    actor?: string,
  ): Promise<ArtifactRecord> {
    const db = await this.getDatabase(paths);
    const row = this.requireArtifact(db, artifactId);

    validateArtifactStatusTransition(
      row.status as ArtifactStatus,
      newStatus,
    );

    const now = this.nowIso();
    const approvedAt = newStatus === "approved" ? now : row.approved_at;
    const approvedBy = newStatus === "approved" ? (actor ?? null) : row.approved_by;

    this.execute(
      db,
      `UPDATE artifacts SET status = ?, approved_at = ?, approved_by = ?, updated_at = ? WHERE artifact_id = ?`,
      [newStatus, approvedAt, approvedBy, now, artifactId],
    );

    await this.persistDatabase(paths, db);
    return this.getArtifact(paths, artifactId);
  }

  public async getVersionHistory(
    paths: OpenGoatPaths,
    artifactId: string,
  ): Promise<ArtifactVersion[]> {
    const db = await this.getDatabase(paths);

    // Ensure artifact exists
    this.requireArtifact(db, artifactId);

    const rows = this.queryAll<ArtifactVersionRow>(
      db,
      "SELECT * FROM artifact_versions WHERE artifact_id = ? ORDER BY version DESC",
      [artifactId],
    );

    return rows.map(toArtifactVersion);
  }

  public async createBundle(
    paths: OpenGoatPaths,
    options: CreateBundleOptions,
  ): Promise<BundleRecord> {
    if (!options.title.trim()) {
      throw new Error("Bundle title must not be empty");
    }
    if (!options.projectId.trim()) {
      throw new Error("Bundle projectId must not be empty");
    }

    const db = await this.getDatabase(paths);
    const now = this.nowIso();
    const bundleId = `bnd-${randomUUID().slice(0, 8)}`;

    this.execute(
      db,
      `INSERT INTO bundles (
        bundle_id, project_id, title, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        bundleId,
        options.projectId,
        options.title,
        options.description ?? null,
        now,
        now,
      ],
    );

    await this.persistDatabase(paths, db);

    const row = this.queryOne<BundleRow>(
      db,
      "SELECT * FROM bundles WHERE bundle_id = ?",
      [bundleId],
    );

    if (!row) {
      throw new Error("Bundle not found after creation");
    }

    return toBundleRecord(row);
  }

  public async listBundleArtifacts(
    paths: OpenGoatPaths,
    bundleId: string,
  ): Promise<ArtifactRecord[]> {
    const db = await this.getDatabase(paths);

    const rows = this.queryAll<ArtifactRow>(
      db,
      "SELECT * FROM artifacts WHERE bundle_id = ? ORDER BY created_at DESC",
      [bundleId],
    );

    return rows.map(toArtifactRecord);
  }

  public async listUnbundledArtifacts(
    paths: OpenGoatPaths,
    projectId: string,
  ): Promise<ArtifactRecord[]> {
    const db = await this.getDatabase(paths);

    const rows = this.queryAll<ArtifactRow>(
      db,
      "SELECT * FROM artifacts WHERE project_id = ? AND bundle_id IS NULL ORDER BY created_at DESC",
      [projectId],
    );

    return rows.map(toArtifactRecord);
  }

  public async assignBundle(
    paths: OpenGoatPaths,
    artifactIds: string[],
    bundleId: string,
  ): Promise<void> {
    if (artifactIds.length === 0) return;

    const db = await this.getDatabase(paths);
    const now = this.nowIso();

    for (const artifactId of artifactIds) {
      this.execute(
        db,
        "UPDATE artifacts SET bundle_id = ?, updated_at = ? WHERE artifact_id = ?",
        [bundleId, now, artifactId],
      );
    }

    await this.persistDatabase(paths, db);
  }

  // ---------------------------------------------------------------------------
  // Private database helpers
  // ---------------------------------------------------------------------------

  private requireArtifact(db: SqlJsDatabase, artifactId: string): ArtifactRow {
    const row = this.queryOne<ArtifactRow>(
      db,
      "SELECT * FROM artifacts WHERE artifact_id = ?",
      [artifactId],
    );
    if (!row) {
      throw new Error("Artifact not found");
    }
    return row;
  }

  private async getDatabase(paths: OpenGoatPaths): Promise<SqlJsDatabase> {
    const dbPath = this.pathPort.join(paths.homeDir, "artifacts.sqlite");
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
      `CREATE TABLE IF NOT EXISTS artifacts (
        artifact_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        objective_id TEXT,
        run_id TEXT,
        task_id TEXT,
        bundle_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        format TEXT NOT NULL,
        content_ref TEXT NOT NULL,
        content TEXT,
        summary TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        approved_at TEXT,
        approved_by TEXT
      );`,
    );

    this.execute(
      db,
      `CREATE TABLE IF NOT EXISTS artifact_versions (
        version_id TEXT PRIMARY KEY,
        artifact_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        content TEXT NOT NULL,
        content_ref TEXT NOT NULL,
        summary TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        note TEXT,
        FOREIGN KEY (artifact_id) REFERENCES artifacts(artifact_id)
      );`,
    );

    this.execute(
      db,
      `CREATE TABLE IF NOT EXISTS bundles (
        bundle_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
    );

    this.execute(db, "CREATE INDEX IF NOT EXISTS idx_artifacts_project ON artifacts(project_id);");
    this.execute(db, "CREATE INDEX IF NOT EXISTS idx_artifacts_objective ON artifacts(objective_id);");
    this.execute(db, "CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(run_id);");
    this.execute(db, "CREATE INDEX IF NOT EXISTS idx_artifacts_task ON artifacts(task_id);");
    this.execute(db, "CREATE INDEX IF NOT EXISTS idx_artifacts_status ON artifacts(status);");
    this.execute(db, "CREATE INDEX IF NOT EXISTS idx_artifacts_bundle ON artifacts(bundle_id);");
    this.execute(db, "CREATE INDEX IF NOT EXISTS idx_artifact_versions_artifact ON artifact_versions(artifact_id);");
    this.execute(db, "CREATE INDEX IF NOT EXISTS idx_bundles_project ON bundles(project_id);");

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
    const dbPath = this.pathPort.join(paths.homeDir, "artifacts.sqlite");
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

function toArtifactRecord(row: ArtifactRow): ArtifactRecord {
  return {
    artifactId: row.artifact_id,
    projectId: row.project_id,
    objectiveId: row.objective_id ?? undefined,
    runId: row.run_id ?? undefined,
    taskId: row.task_id ?? undefined,
    bundleId: row.bundle_id ?? undefined,
    type: row.type as ArtifactRecord["type"],
    title: row.title,
    status: row.status as ArtifactRecord["status"],
    format: row.format as ArtifactRecord["format"],
    contentRef: row.content_ref,
    content: row.content ?? undefined,
    summary: row.summary ?? undefined,
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at ?? undefined,
    approvedBy: row.approved_by ?? undefined,
  };
}

function toArtifactVersion(row: ArtifactVersionRow): ArtifactVersion {
  return {
    versionId: row.version_id,
    artifactId: row.artifact_id,
    version: row.version,
    content: row.content,
    contentRef: row.content_ref,
    summary: row.summary ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    note: row.note ?? undefined,
  };
}

function toBundleRecord(row: BundleRow): BundleRecord {
  return {
    bundleId: row.bundle_id,
    projectId: row.project_id,
    title: row.title,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  if (typeof error !== "object" || error === null) return false;
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}
