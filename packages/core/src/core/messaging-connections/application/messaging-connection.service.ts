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
  CreateConnectionOptions,
  MessagingConnectionRecord,
} from "../domain/messaging-connection.js";

interface MessagingConnectionServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  nowIso: () => string;
}

interface ConnectionRow {
  connection_id: string;
  workspace_id: string;
  type: string;
  status: string;
  display_name: string;
  default_project_id: string;
  config_ref: string | null;
  created_at: string;
  updated_at: string;
}

const DB_FILE = "messaging.sqlite";
const require = createRequire(import.meta.url);

export class MessagingConnectionService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly nowIso: () => string;
  private sqlPromise?: Promise<SqlJsStatic>;
  private dbPromise?: Promise<SqlJsDatabase>;
  private dbPath?: string;
  private dbFileFingerprint?: string | null;

  public constructor(deps: MessagingConnectionServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.nowIso = deps.nowIso;
  }

  public async create(
    paths: OpenGoatPaths,
    options: CreateConnectionOptions,
  ): Promise<MessagingConnectionRecord> {
    const db = await this.getDatabase(paths);
    const connectionId = `conn-${randomUUID().slice(0, 8)}`;
    const now = this.nowIso();

    this.execute(
      db,
      `INSERT INTO messaging_connections (
         connection_id, workspace_id, type, status, display_name,
         default_project_id, config_ref, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        connectionId,
        options.workspaceId,
        options.type,
        "pending",
        options.displayName,
        options.defaultProjectId,
        options.configRef ?? null,
        now,
        now,
      ],
    );
    await this.persistDatabase(paths, db);

    return this.requireConnection(db, connectionId);
  }

  public async list(
    paths: OpenGoatPaths,
    workspaceId: string,
  ): Promise<MessagingConnectionRecord[]> {
    const db = await this.getDatabase(paths);
    const rows = this.queryAll<ConnectionRow>(
      db,
      `SELECT connection_id, workspace_id, type, status, display_name,
              default_project_id, config_ref, created_at, updated_at
       FROM messaging_connections
       WHERE workspace_id = ?
       ORDER BY created_at DESC`,
      [workspaceId],
    );

    return rows.map(toConnectionRecord);
  }

  public async get(
    paths: OpenGoatPaths,
    connectionId: string,
  ): Promise<MessagingConnectionRecord | undefined> {
    const db = await this.getDatabase(paths);
    const row = this.queryOne<ConnectionRow>(
      db,
      `SELECT connection_id, workspace_id, type, status, display_name,
              default_project_id, config_ref, created_at, updated_at
       FROM messaging_connections
       WHERE connection_id = ?`,
      [connectionId],
    );

    return row ? toConnectionRecord(row) : undefined;
  }

  public async updateStatus(
    paths: OpenGoatPaths,
    connectionId: string,
    status: string,
    configRef?: string,
  ): Promise<MessagingConnectionRecord> {
    const db = await this.getDatabase(paths);
    const now = this.nowIso();

    if (configRef !== undefined) {
      this.execute(
        db,
        `UPDATE messaging_connections
         SET status = ?, config_ref = ?, updated_at = ?
         WHERE connection_id = ?`,
        [status, configRef, now, connectionId],
      );
    } else {
      this.execute(
        db,
        `UPDATE messaging_connections
         SET status = ?, updated_at = ?
         WHERE connection_id = ?`,
        [status, now, connectionId],
      );
    }

    await this.persistDatabase(paths, db);
    return this.requireConnection(db, connectionId);
  }

  public async delete(
    paths: OpenGoatPaths,
    connectionId: string,
  ): Promise<void> {
    const db = await this.getDatabase(paths);
    this.execute(
      db,
      "DELETE FROM messaging_connections WHERE connection_id = ?",
      [connectionId],
    );
    await this.persistDatabase(paths, db);
  }

  private requireConnection(
    db: SqlJsDatabase,
    connectionId: string,
  ): MessagingConnectionRecord {
    const row = this.queryOne<ConnectionRow>(
      db,
      `SELECT connection_id, workspace_id, type, status, display_name,
              default_project_id, config_ref, created_at, updated_at
       FROM messaging_connections
       WHERE connection_id = ?`,
      [connectionId],
    );

    if (!row) {
      throw new Error(`Connection "${connectionId}" does not exist.`);
    }

    return toConnectionRecord(row);
  }

  private async getDatabase(paths: OpenGoatPaths): Promise<SqlJsDatabase> {
    const dbPath = this.pathPort.join(paths.homeDir, DB_FILE);
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
      `CREATE TABLE IF NOT EXISTS messaging_connections (
         connection_id TEXT PRIMARY KEY,
         workspace_id TEXT NOT NULL,
         type TEXT NOT NULL,
         status TEXT NOT NULL DEFAULT 'pending',
         display_name TEXT NOT NULL,
         default_project_id TEXT NOT NULL,
         config_ref TEXT,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL
       );`,
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_msg_conn_workspace_id ON messaging_connections(workspace_id);",
    );
    this.execute(
      db,
      "CREATE INDEX IF NOT EXISTS idx_msg_conn_type ON messaging_connections(type);",
    );

    this.execute(
      db,
      `CREATE TABLE IF NOT EXISTS messaging_thread_links (
         thread_link_id TEXT PRIMARY KEY,
         connection_id TEXT NOT NULL,
         external_thread_id TEXT NOT NULL,
         project_id TEXT NOT NULL,
         chat_thread_id TEXT NOT NULL,
         last_seen_at TEXT NOT NULL,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         FOREIGN KEY(connection_id) REFERENCES messaging_connections(connection_id) ON DELETE CASCADE
       );`,
    );
    this.execute(
      db,
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_msg_thread_conn_ext ON messaging_thread_links(connection_id, external_thread_id);",
    );

    await this.persistDatabase(paths, db);
    return db;
  }

  private async getSqlJs(): Promise<SqlJsStatic> {
    if (!this.sqlPromise) {
      const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
      this.sqlPromise = initSqlJs({ locateFile: () => wasmPath });
    }
    return this.sqlPromise;
  }

  private async persistDatabase(
    paths: OpenGoatPaths,
    db: SqlJsDatabase,
  ): Promise<void> {
    const dbPath = this.pathPort.join(paths.homeDir, DB_FILE);
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
    } catch {
      return null;
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

function toConnectionRecord(row: ConnectionRow): MessagingConnectionRecord {
  return {
    connectionId: row.connection_id,
    workspaceId: row.workspace_id,
    type: row.type as MessagingConnectionRecord["type"],
    status: row.status as MessagingConnectionRecord["status"],
    displayName: row.display_name,
    defaultProjectId: row.default_project_id,
    configRef: row.config_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
