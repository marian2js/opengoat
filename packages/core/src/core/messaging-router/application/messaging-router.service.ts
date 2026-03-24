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
import type { MessagingConnectionService } from "../../messaging-connections/application/messaging-connection.service.js";
import type { ResolveThreadResult } from "../domain/messaging-router.js";

interface MessagingRouterServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  nowIso: () => string;
  connectionService: MessagingConnectionService;
}

interface ThreadLinkRow {
  thread_link_id: string;
  connection_id: string;
  external_thread_id: string;
  project_id: string;
  chat_thread_id: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

const DB_FILE = "messaging.sqlite";
const require = createRequire(import.meta.url);

export class MessagingRouterService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly nowIso: () => string;
  private readonly connectionService: MessagingConnectionService;
  private sqlPromise?: Promise<SqlJsStatic>;
  private dbPromise?: Promise<SqlJsDatabase>;
  private dbPath?: string;
  private dbFileFingerprint?: string | null;

  public constructor(deps: MessagingRouterServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.nowIso = deps.nowIso;
    this.connectionService = deps.connectionService;
  }

  public async resolveThread(
    paths: OpenGoatPaths,
    connectionId: string,
    externalThreadId: string,
  ): Promise<ResolveThreadResult> {
    const db = await this.getDatabase(paths);

    // Check for existing thread link
    const existing = this.queryOne<ThreadLinkRow>(
      db,
      `SELECT thread_link_id, connection_id, external_thread_id, project_id,
              chat_thread_id, last_seen_at, created_at, updated_at
       FROM messaging_thread_links
       WHERE connection_id = ? AND external_thread_id = ?`,
      [connectionId, externalThreadId],
    );

    if (existing) {
      return {
        projectId: existing.project_id,
        chatThreadId: existing.chat_thread_id,
        isNew: false,
      };
    }

    // Create new thread link using connection's default project
    const connection = await this.connectionService.get(paths, connectionId);
    if (!connection) {
      throw new Error(`Connection "${connectionId}" not found.`);
    }

    const threadLinkId = `tl-${randomUUID().slice(0, 8)}`;
    const chatThreadId = `msg-${randomUUID().slice(0, 8)}`;
    const now = this.nowIso();

    this.execute(
      db,
      `INSERT INTO messaging_thread_links (
         thread_link_id, connection_id, external_thread_id, project_id,
         chat_thread_id, last_seen_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        threadLinkId,
        connectionId,
        externalThreadId,
        connection.defaultProjectId,
        chatThreadId,
        now,
        now,
        now,
      ],
    );
    await this.persistDatabase(paths, db);

    return {
      projectId: connection.defaultProjectId,
      chatThreadId,
      isNew: true,
    };
  }

  public async updateLastSeen(
    paths: OpenGoatPaths,
    chatThreadId: string,
  ): Promise<void> {
    const db = await this.getDatabase(paths);
    const now = this.nowIso();

    this.execute(
      db,
      `UPDATE messaging_thread_links
       SET last_seen_at = ?, updated_at = ?
       WHERE chat_thread_id = ?`,
      [now, now, chatThreadId],
    );
    await this.persistDatabase(paths, db);
  }

  public async listThreadLinks(
    paths: OpenGoatPaths,
    connectionId: string,
  ): Promise<ThreadLinkRow[]> {
    const db = await this.getDatabase(paths);
    return this.queryAll<ThreadLinkRow>(
      db,
      `SELECT thread_link_id, connection_id, external_thread_id, project_id,
              chat_thread_id, last_seen_at, created_at, updated_at
       FROM messaging_thread_links
       WHERE connection_id = ?
       ORDER BY last_seen_at DESC`,
      [connectionId],
    );
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

    // Ensure both tables exist (ConnectionService may have already created them)
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
