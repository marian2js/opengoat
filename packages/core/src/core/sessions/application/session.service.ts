import { randomUUID } from "node:crypto";
import path from "node:path";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../domain/agent-id.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { CommandRunnerPort } from "../../ports/command-runner.port.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import {
  DEFAULT_SESSION_CONFIG,
  SESSION_STORE_SCHEMA_VERSION,
  SESSION_TRANSCRIPT_SCHEMA_VERSION,
  type SessionConfig,
  type SessionEntry,
  type SessionHistoryItem,
  type SessionRemoveResult,
  type SessionRunInfo,
  type SessionStoreShape,
  type SessionSummary
} from "../domain/session.js";
import {
  isSessionTranscriptCompaction,
  isSessionTranscriptHeader,
  isSessionTranscriptMessage,
  type SessionTranscriptCompaction,
  type SessionTranscriptHeader,
  type SessionTranscriptMessage,
  type SessionTranscriptRecord
} from "../domain/transcript.js";
import { SessionConfigParseError, SessionStoreParseError, SessionTranscriptParseError } from "../errors.js";

interface SessionServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  commandRunner?: CommandRunnerPort;
  nowIso?: () => string;
  nowMs?: () => number;
}

interface AgentConfigShape {
  runtime?: {
    sessions?: Partial<SessionConfig>;
  };
}

export interface PrepareSessionRunRequest {
  sessionRef?: string;
  forceNew?: boolean;
  disableSession?: boolean;
  projectPath?: string;
  userMessage: string;
}

export type PreparedSessionRun =
  | {
      enabled: false;
    }
  | {
      enabled: true;
      info: SessionRunInfo;
      compactionApplied: boolean;
    };

export interface SessionHistoryResult {
  sessionKey: string;
  sessionId?: string;
  transcriptPath?: string;
  messages: SessionHistoryItem[];
}

export interface SessionCompactionResult {
  sessionKey: string;
  sessionId: string;
  transcriptPath: string;
  applied: boolean;
  summary?: string;
  compactedMessages: number;
}

export interface AgentLastAction {
  agentId: string;
  sessionKey: string;
  sessionId: string;
  transcriptPath: string;
  timestamp: number;
}

export class SessionService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly commandRunner?: CommandRunnerPort;
  private readonly nowIso: () => string;
  private readonly nowMs: () => number;

  public constructor(deps: SessionServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.commandRunner = deps.commandRunner;
    this.nowIso = deps.nowIso ?? (() => new Date().toISOString());
    this.nowMs = deps.nowMs ?? (() => Date.now());
  }

  public async prepareRunSession(
    paths: OpenGoatPaths,
    agentId: string,
    request: PrepareSessionRunRequest
  ): Promise<PreparedSessionRun> {
    if (request.disableSession) {
      return { enabled: false };
    }

    const normalizedAgentId = normalizeAgentId(agentId) || DEFAULT_AGENT_ID;
    const workspacePath = this.pathPort.join(paths.workspacesDir, normalizedAgentId);
    const config = await this.readSessionConfig(paths, normalizedAgentId);
    const store = await this.readStore(paths, normalizedAgentId);
    const sessionKey = resolveSessionKey({
      agentId: normalizedAgentId,
      mainKey: config.mainKey,
      sessions: store.sessions,
      reference: request.sessionRef
    });

    const existingEntry = store.sessions[sessionKey];
    const existingProjectPath = resolveStoredProjectPath(existingEntry?.projectPath);
    const projectPath = resolveProjectPath(request.projectPath, existingProjectPath);
    if (!existingEntry || existingProjectPath !== projectPath) {
      await this.ensureProjectPathGitRepository(projectPath);
    }
    const fresh = existingEntry ? isSessionFresh(existingEntry.updatedAt, config.reset, this.nowMs()) : false;
    const projectPathChanged = Boolean(existingProjectPath && existingProjectPath !== projectPath);
    const isNewSession = request.forceNew || !existingEntry || !fresh || projectPathChanged;
    const sessionId = isNewSession ? newSessionId() : existingEntry.sessionId;
    const transcriptPath = isNewSession
      ? this.pathPort.join(resolveSessionsDir(paths, normalizedAgentId), `${sessionId}.jsonl`)
      : existingEntry?.transcriptFile?.trim() ||
        this.pathPort.join(resolveSessionsDir(paths, normalizedAgentId), `${sessionId}.jsonl`);
    const baseEntry = isNewSession ? {} : existingEntry ?? {};

    const nextEntry: SessionEntry = {
      ...baseEntry,
      sessionId,
      updatedAt: this.nowMs(),
      transcriptFile: transcriptPath,
      workspacePath,
      projectPath
    };
    store.sessions[sessionKey] = nextEntry;

    await this.persistStore(paths, normalizedAgentId, store);
    await this.ensureTranscriptHeader({
      transcriptPath,
      agentId: normalizedAgentId,
      sessionId,
      sessionKey,
      workspacePath,
      projectPath
    });

    const compaction = await this.compactSessionInternal({
      paths,
      agentId: normalizedAgentId,
      sessionKey,
      force: false,
      config,
      store
    });

    await this.appendMessage({
      paths,
      agentId: normalizedAgentId,
      sessionKey,
      role: "user",
      content: request.userMessage
    });

    return {
      enabled: true,
      info: {
        agentId: normalizedAgentId,
        sessionId,
        sessionKey,
        transcriptPath,
        workspacePath,
        projectPath,
        isNewSession
      },
      compactionApplied: compaction.applied
    };
  }

  public async recordAssistantReply(
    paths: OpenGoatPaths,
    info: SessionRunInfo,
    content: string
  ): Promise<SessionCompactionResult> {
    await this.appendMessage({
      paths,
      agentId: info.agentId,
      sessionKey: info.sessionKey,
      role: "assistant",
      content
    });

    const config = await this.readSessionConfig(paths, info.agentId);
    const store = await this.readStore(paths, info.agentId);
    const compaction = await this.compactSessionInternal({
      paths,
      agentId: info.agentId,
      sessionKey: info.sessionKey,
      force: false,
      config,
      store
    });

    return compaction;
  }

  public async listSessions(
    paths: OpenGoatPaths,
    agentId: string,
    options: { activeMinutes?: number } = {}
  ): Promise<SessionSummary[]> {
    const normalizedAgentId = normalizeAgentId(agentId) || DEFAULT_AGENT_ID;
    const store = await this.readStore(paths, normalizedAgentId);
    const now = this.nowMs();
    const activeWindowMs =
      typeof options.activeMinutes === "number" && Number.isFinite(options.activeMinutes) && options.activeMinutes > 0
        ? Math.floor(options.activeMinutes) * 60_000
        : undefined;

    const summaries = Object.entries(store.sessions)
      .map(([sessionKey, entry]): SessionSummary =>
        toSessionSummary({
          paths,
          pathPort: this.pathPort,
          agentId: normalizedAgentId,
          sessionKey,
          entry
        })
      )
      .filter((entry) => {
        if (!activeWindowMs) {
          return true;
        }
        return now - entry.updatedAt <= activeWindowMs;
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);

    return summaries;
  }

  public async getLastAgentAction(
    paths: OpenGoatPaths,
    agentId: string
  ): Promise<AgentLastAction | null> {
    const normalizedAgentId = normalizeAgentId(agentId) || DEFAULT_AGENT_ID;
    const store = await this.readStore(paths, normalizedAgentId);
    let latest: AgentLastAction | null = null;

    for (const [sessionKey, entry] of Object.entries(store.sessions)) {
      if (typeof entry.outputChars === "number" && entry.outputChars <= 0) {
        continue;
      }

      const sessionId = entry.sessionId?.trim();
      if (!sessionId) {
        continue;
      }

      const transcriptPath =
        entry.transcriptFile?.trim() ||
        this.pathPort.join(resolveSessionsDir(paths, normalizedAgentId), `${sessionId}.jsonl`);
      const records = await this.readTranscriptRecords(transcriptPath);

      for (const record of records) {
        if (!isSessionTranscriptMessage(record) || record.role !== "assistant") {
          continue;
        }

        if (!latest || record.timestamp > latest.timestamp) {
          latest = {
            agentId: normalizedAgentId,
            sessionKey,
            sessionId,
            transcriptPath,
            timestamp: record.timestamp
          };
        }
      }
    }

    return latest;
  }

  public async renameSession(
    paths: OpenGoatPaths,
    agentId: string,
    title: string,
    sessionRef?: string
  ): Promise<SessionSummary> {
    const normalizedAgentId = normalizeAgentId(agentId) || DEFAULT_AGENT_ID;
    const config = await this.readSessionConfig(paths, normalizedAgentId);
    const store = await this.readStore(paths, normalizedAgentId);
    const sessionKey = resolveSessionKey({
      agentId: normalizedAgentId,
      mainKey: config.mainKey,
      sessions: store.sessions,
      reference: sessionRef
    });
    const entry = store.sessions[sessionKey];
    if (!entry) {
      throw new Error(`Session not found: ${sessionRef ?? sessionKey}`);
    }

    const updatedAt = this.nowMs();
    const nextEntry: SessionEntry = {
      ...entry,
      title: normalizeSessionTitle(title),
      updatedAt
    };
    store.sessions[sessionKey] = nextEntry;
    await this.persistStore(paths, normalizedAgentId, store);

    return toSessionSummary({
      paths,
      pathPort: this.pathPort,
      agentId: normalizedAgentId,
      sessionKey,
      entry: nextEntry
    });
  }

  public async removeSession(
    paths: OpenGoatPaths,
    agentId: string,
    sessionRef?: string
  ): Promise<SessionRemoveResult> {
    const normalizedAgentId = normalizeAgentId(agentId) || DEFAULT_AGENT_ID;
    const config = await this.readSessionConfig(paths, normalizedAgentId);
    const store = await this.readStore(paths, normalizedAgentId);
    const sessionKey = resolveSessionKey({
      agentId: normalizedAgentId,
      mainKey: config.mainKey,
      sessions: store.sessions,
      reference: sessionRef
    });
    const entry = store.sessions[sessionKey];
    if (!entry) {
      throw new Error(`Session not found: ${sessionRef ?? sessionKey}`);
    }

    delete store.sessions[sessionKey];
    await this.persistStore(paths, normalizedAgentId, store);

    return {
      sessionKey,
      sessionId: entry.sessionId,
      title: resolveSessionTitle(sessionKey, entry.title),
      transcriptPath:
        entry.transcriptFile?.trim() ||
        this.pathPort.join(resolveSessionsDir(paths, normalizedAgentId), `${entry.sessionId}.jsonl`)
    };
  }

  public async getSessionHistory(
    paths: OpenGoatPaths,
    agentId: string,
    options: {
      sessionRef?: string;
      limit?: number;
      includeCompaction?: boolean;
    } = {}
  ): Promise<SessionHistoryResult> {
    const normalizedAgentId = normalizeAgentId(agentId) || DEFAULT_AGENT_ID;
    const config = await this.readSessionConfig(paths, normalizedAgentId);
    const store = await this.readStore(paths, normalizedAgentId);
    const sessionKey = resolveSessionKey({
      agentId: normalizedAgentId,
      mainKey: config.mainKey,
      sessions: store.sessions,
      reference: options.sessionRef
    });

    const entry = store.sessions[sessionKey];
    if (!entry) {
      return { sessionKey, messages: [] };
    }

    const transcriptPath =
      entry.transcriptFile?.trim() || this.pathPort.join(resolveSessionsDir(paths, normalizedAgentId), `${entry.sessionId}.jsonl`);
    const records = await this.readTranscriptRecords(transcriptPath);

    let messages = records
      .filter((record) => isSessionTranscriptMessage(record) || isSessionTranscriptCompaction(record))
      .map((record): SessionHistoryItem => {
        if (isSessionTranscriptCompaction(record)) {
          return {
            type: "compaction",
            content: record.summary,
            timestamp: record.timestamp
          };
        }

        return {
          type: "message",
          role: record.role,
          content: record.content,
          timestamp: record.timestamp
        };
      });

    if (!options.includeCompaction) {
      messages = messages.filter((message) => message.type !== "compaction");
    }

    if (typeof options.limit === "number" && Number.isFinite(options.limit) && options.limit > 0) {
      messages = messages.slice(-Math.floor(options.limit));
    }

    return {
      sessionKey,
      sessionId: entry.sessionId,
      transcriptPath,
      messages
    };
  }

  public async resetSession(
    paths: OpenGoatPaths,
    agentId: string,
    sessionRef?: string
  ): Promise<SessionRunInfo> {
    const normalizedAgentId = normalizeAgentId(agentId) || DEFAULT_AGENT_ID;
    const workspacePath = this.pathPort.join(paths.workspacesDir, normalizedAgentId);
    const config = await this.readSessionConfig(paths, normalizedAgentId);
    const store = await this.readStore(paths, normalizedAgentId);
    const sessionKey = resolveSessionKey({
      agentId: normalizedAgentId,
      mainKey: config.mainKey,
      sessions: store.sessions,
      reference: sessionRef
    });
    const existingEntry = store.sessions[sessionKey];
    const sessionId = newSessionId();
    const projectPath = existingEntry?.projectPath?.trim() || process.cwd();
    const transcriptPath = this.pathPort.join(resolveSessionsDir(paths, normalizedAgentId), `${sessionId}.jsonl`);

    store.sessions[sessionKey] = {
      sessionId,
      updatedAt: this.nowMs(),
      transcriptFile: transcriptPath,
      workspacePath,
      projectPath
    };

    await this.persistStore(paths, normalizedAgentId, store);
    await this.ensureTranscriptHeader({
      transcriptPath,
      agentId: normalizedAgentId,
      sessionId,
      sessionKey,
      workspacePath,
      projectPath
    });

    return {
      agentId: normalizedAgentId,
      sessionId,
      sessionKey,
      transcriptPath,
      workspacePath,
      projectPath,
      isNewSession: true
    };
  }

  public async compactSession(
    paths: OpenGoatPaths,
    agentId: string,
    sessionRef?: string
  ): Promise<SessionCompactionResult> {
    const normalizedAgentId = normalizeAgentId(agentId) || DEFAULT_AGENT_ID;
    const config = await this.readSessionConfig(paths, normalizedAgentId);
    const store = await this.readStore(paths, normalizedAgentId);
    const sessionKey = resolveSessionKey({
      agentId: normalizedAgentId,
      mainKey: config.mainKey,
      sessions: store.sessions,
      reference: sessionRef
    });

    return this.compactSessionInternal({
      paths,
      agentId: normalizedAgentId,
      sessionKey,
      force: true,
      config,
      store
    });
  }

  private async compactSessionInternal(params: {
    paths: OpenGoatPaths;
    agentId: string;
    sessionKey: string;
    force: boolean;
    config: SessionConfig;
    store: SessionStoreShape;
  }): Promise<SessionCompactionResult> {
    const entry = params.store.sessions[params.sessionKey];
    if (!entry) {
      const sessionId = newSessionId();
      const transcriptPath = this.pathPort.join(resolveSessionsDir(params.paths, params.agentId), `${sessionId}.jsonl`);
      return {
        sessionKey: params.sessionKey,
        sessionId,
        transcriptPath,
        applied: false,
        compactedMessages: 0
      };
    }

    const transcriptPath =
      entry.transcriptFile?.trim() || this.pathPort.join(resolveSessionsDir(params.paths, params.agentId), `${entry.sessionId}.jsonl`);
    const records = await this.readTranscriptRecords(transcriptPath);
    const header = ensureHeaderRecord(records, {
      sessionId: entry.sessionId,
      sessionKey: params.sessionKey,
      agentId: params.agentId,
      nowIso: this.nowIso(),
      workspacePath: entry.workspacePath?.trim() || this.pathPort.join(params.paths.workspacesDir, params.agentId),
      projectPath: entry.projectPath?.trim() || process.cwd()
    });
    const messages = records.filter(isSessionTranscriptMessage);
    const messageChars = messages.reduce((total, message) => total + message.content.length, 0);
    const trigger = params.config.compaction;

    if (!params.force) {
      if (!trigger.enabled) {
        return {
          sessionKey: params.sessionKey,
          sessionId: entry.sessionId,
          transcriptPath,
          applied: false,
          compactedMessages: 0
        };
      }
      if (messages.length < trigger.triggerMessageCount && messageChars < trigger.triggerChars) {
        return {
          sessionKey: params.sessionKey,
          sessionId: entry.sessionId,
          transcriptPath,
          applied: false,
          compactedMessages: 0
        };
      }
    }

    const keepRecentMessages = clampPositive(trigger.keepRecentMessages, 1);
    if (messages.length <= keepRecentMessages) {
      return {
        sessionKey: params.sessionKey,
        sessionId: entry.sessionId,
        transcriptPath,
        applied: false,
        compactedMessages: 0
      };
    }

    const compactedMessages = messages.slice(0, messages.length - keepRecentMessages);
    const keptMessages = messages.slice(-keepRecentMessages);
    const summary = summarizeCompactedMessages(compactedMessages, trigger.summaryMaxChars);

    const existingCompactions = records.filter(isSessionTranscriptCompaction).slice(-3);
    const nextCompaction: SessionTranscriptCompaction = {
      type: "compaction",
      summary,
      compactedMessages: compactedMessages.length,
      keptMessages: keptMessages.length,
      timestamp: this.nowMs()
    };

    const nextRecords: SessionTranscriptRecord[] = [header, ...existingCompactions, nextCompaction, ...keptMessages];
    await this.writeTranscriptRecords(transcriptPath, nextRecords);

    params.store.sessions[params.sessionKey] = {
      ...entry,
      transcriptFile: transcriptPath,
      updatedAt: this.nowMs(),
      compactionCount: (entry.compactionCount ?? 0) + 1
    };
    await this.persistStore(params.paths, params.agentId, params.store);

    return {
      sessionKey: params.sessionKey,
      sessionId: entry.sessionId,
      transcriptPath,
      applied: true,
      summary,
      compactedMessages: compactedMessages.length
    };
  }

  private async appendMessage(params: {
    paths: OpenGoatPaths;
    agentId: string;
    sessionKey: string;
    role: SessionTranscriptMessage["role"];
    content: string;
  }): Promise<void> {
    const normalizedContent = params.content.trim();
    if (!normalizedContent) {
      return;
    }

    const store = await this.readStore(params.paths, params.agentId);
    const entry = store.sessions[params.sessionKey];
    if (!entry) {
      return;
    }

    const transcriptPath =
      entry.transcriptFile?.trim() ||
      this.pathPort.join(resolveSessionsDir(params.paths, params.agentId), `${entry.sessionId}.jsonl`);
    const records = await this.readTranscriptRecords(transcriptPath);
    const header = ensureHeaderRecord(records, {
      sessionId: entry.sessionId,
      sessionKey: params.sessionKey,
      agentId: params.agentId,
      nowIso: this.nowIso(),
      workspacePath: entry.workspacePath?.trim() || this.pathPort.join(params.paths.workspacesDir, params.agentId),
      projectPath: entry.projectPath?.trim() || process.cwd()
    });

    const message: SessionTranscriptMessage = {
      type: "message",
      role: params.role,
      content: normalizedContent,
      timestamp: this.nowMs()
    };

    const nextRecords: SessionTranscriptRecord[] = [header, ...records.filter((record) => !isSessionTranscriptHeader(record)), message];
    await this.writeTranscriptRecords(transcriptPath, nextRecords);

    const inputChars = params.role === "user" ? (entry.inputChars ?? 0) + normalizedContent.length : entry.inputChars ?? 0;
    const outputChars =
      params.role === "assistant" ? (entry.outputChars ?? 0) + normalizedContent.length : entry.outputChars ?? 0;
    store.sessions[params.sessionKey] = {
      ...entry,
      transcriptFile: transcriptPath,
      updatedAt: this.nowMs(),
      inputChars,
      outputChars,
      totalChars: inputChars + outputChars
    };

    await this.persistStore(params.paths, params.agentId, store);
  }

  private async ensureTranscriptHeader(params: {
    transcriptPath: string;
    agentId: string;
    sessionId: string;
    sessionKey: string;
    workspacePath: string;
    projectPath: string;
  }): Promise<void> {
    const records = await this.readTranscriptRecords(params.transcriptPath);
    const header = ensureHeaderRecord(records, {
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      agentId: params.agentId,
      nowIso: this.nowIso(),
      workspacePath: params.workspacePath,
      projectPath: params.projectPath
    });
    const first = records[0];
    if (!first || !isSessionTranscriptHeader(first)) {
      const next: SessionTranscriptRecord[] = [header, ...records.filter((record) => !isSessionTranscriptHeader(record))];
      await this.writeTranscriptRecords(params.transcriptPath, next);
    }
  }

  private async readStore(paths: OpenGoatPaths, agentId: string): Promise<SessionStoreShape> {
    const sessionsDir = resolveSessionsDir(paths, agentId);
    const storePath = this.pathPort.join(sessionsDir, "sessions.json");
    const exists = await this.fileSystem.exists(storePath);
    if (!exists) {
      return {
        schemaVersion: SESSION_STORE_SCHEMA_VERSION,
        sessions: {}
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(await this.fileSystem.readFile(storePath)) as unknown;
    } catch {
      throw new SessionStoreParseError(storePath);
    }

    if (!parsed || typeof parsed !== "object") {
      throw new SessionStoreParseError(storePath);
    }

    const record = parsed as { schemaVersion?: unknown; sessions?: unknown };
    if (record.schemaVersion === SESSION_STORE_SCHEMA_VERSION && isSessionEntryMap(record.sessions)) {
      return {
        schemaVersion: SESSION_STORE_SCHEMA_VERSION,
        sessions: normalizeSessionEntries(record.sessions)
      };
    }

    if (isSessionEntryMap(parsed)) {
      return {
        schemaVersion: SESSION_STORE_SCHEMA_VERSION,
        sessions: normalizeSessionEntries(parsed)
      };
    }

    throw new SessionStoreParseError(storePath);
  }

  private async persistStore(paths: OpenGoatPaths, agentId: string, store: SessionStoreShape): Promise<void> {
    const sessionsDir = resolveSessionsDir(paths, agentId);
    const storePath = this.pathPort.join(sessionsDir, "sessions.json");
    await this.fileSystem.ensureDir(sessionsDir);
    await this.fileSystem.writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`);
  }

  private async readTranscriptRecords(transcriptPath: string): Promise<SessionTranscriptRecord[]> {
    const exists = await this.fileSystem.exists(transcriptPath);
    if (!exists) {
      return [];
    }

    const raw = await this.fileSystem.readFile(transcriptPath);
    const lines = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return [];
    }

    const records: SessionTranscriptRecord[] = [];
    for (const line of lines) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line) as unknown;
      } catch {
        throw new SessionTranscriptParseError(transcriptPath);
      }

      const normalized = normalizeTranscriptRecord(parsed);
      if (normalized) {
        records.push(normalized);
      }
    }

    return records;
  }

  private async writeTranscriptRecords(transcriptPath: string, records: SessionTranscriptRecord[]): Promise<void> {
    await this.fileSystem.ensureDir(path.dirname(transcriptPath));
    const payload = records.map((record) => JSON.stringify(record)).join("\n");
    await this.fileSystem.writeFile(transcriptPath, payload ? `${payload}\n` : "");
  }

  private async readSessionConfig(paths: OpenGoatPaths, agentId: string): Promise<SessionConfig> {
    const configPath = this.pathPort.join(paths.agentsDir, agentId, "config.json");
    const exists = await this.fileSystem.exists(configPath);
    if (!exists) {
      return DEFAULT_SESSION_CONFIG;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(await this.fileSystem.readFile(configPath)) as unknown;
    } catch {
      throw new SessionConfigParseError(configPath);
    }

    const sessionConfigRaw = (parsed as AgentConfigShape)?.runtime?.sessions;
    return mergeSessionConfig(DEFAULT_SESSION_CONFIG, sessionConfigRaw);
  }

  private async ensureProjectPathGitRepository(projectPath: string): Promise<void> {
    if (!this.commandRunner) {
      return;
    }
    if (!(await this.fileSystem.exists(projectPath))) {
      return;
    }
    try {
      const probe = await this.commandRunner.run({
        command: "git",
        args: ["rev-parse", "--is-inside-work-tree"],
        cwd: projectPath
      });
      if (probe.code === 0) {
        return;
      }

      await this.commandRunner.run({
        command: "git",
        args: ["init", "--quiet"],
        cwd: projectPath
      });
    } catch {
      // Git tooling might not be installed; session setup remains functional without VCS bootstrap.
    }
  }
}

function normalizeTranscriptRecord(value: unknown): SessionTranscriptRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as {
    type?: unknown;
    schemaVersion?: unknown;
    sessionId?: unknown;
    sessionKey?: unknown;
    agentId?: unknown;
    createdAt?: unknown;
    workspacePath?: unknown;
    projectPath?: unknown;
    workingPath?: unknown;
    role?: unknown;
    content?: unknown;
    timestamp?: unknown;
    summary?: unknown;
    compactedMessages?: unknown;
    keptMessages?: unknown;
  };

  if (record.type === "session") {
    if (
      record.schemaVersion === SESSION_TRANSCRIPT_SCHEMA_VERSION &&
      typeof record.sessionId === "string" &&
      typeof record.sessionKey === "string" &&
      typeof record.agentId === "string" &&
      typeof record.createdAt === "string"
    ) {
      return {
        type: "session",
        schemaVersion: SESSION_TRANSCRIPT_SCHEMA_VERSION,
        sessionId: record.sessionId,
        sessionKey: record.sessionKey,
        agentId: record.agentId,
        createdAt: record.createdAt,
        workspacePath: typeof record.workspacePath === "string" ? record.workspacePath : undefined,
        projectPath:
          typeof record.projectPath === "string"
            ? record.projectPath
            : typeof record.workingPath === "string"
              ? record.workingPath
              : undefined
      };
    }
    return null;
  }

  if (record.type === "message") {
    if (
      (record.role === "user" || record.role === "assistant" || record.role === "system") &&
      typeof record.content === "string" &&
      typeof record.timestamp === "number" &&
      Number.isFinite(record.timestamp)
    ) {
      return {
        type: "message",
        role: record.role,
        content: record.content,
        timestamp: record.timestamp
      };
    }
    return null;
  }

  if (record.type === "compaction") {
    if (
      typeof record.summary === "string" &&
      typeof record.timestamp === "number" &&
      Number.isFinite(record.timestamp) &&
      typeof record.compactedMessages === "number" &&
      Number.isFinite(record.compactedMessages) &&
      typeof record.keptMessages === "number" &&
      Number.isFinite(record.keptMessages)
    ) {
      return {
        type: "compaction",
        summary: record.summary,
        compactedMessages: record.compactedMessages,
        keptMessages: record.keptMessages,
        timestamp: record.timestamp
      };
    }
    return null;
  }

  return null;
}

function ensureHeaderRecord(
  records: SessionTranscriptRecord[],
  params: {
    sessionId: string;
    sessionKey: string;
    agentId: string;
    nowIso: string;
    workspacePath: string;
    projectPath: string;
  }
): SessionTranscriptHeader {
  const existing = records.find(isSessionTranscriptHeader);
  if (existing) {
    return existing;
  }

  return {
    type: "session",
    schemaVersion: SESSION_TRANSCRIPT_SCHEMA_VERSION,
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    agentId: params.agentId,
    createdAt: params.nowIso,
    workspacePath: params.workspacePath,
    projectPath: params.projectPath
  };
}

function resolveSessionsDir(paths: OpenGoatPaths, agentId: string): string {
  return path.join(paths.agentsDir, agentId, "sessions");
}

function resolveSessionKey(params: {
  agentId: string;
  mainKey: string;
  sessions: Record<string, SessionEntry>;
  reference?: string;
}): string {
  const mainKey = buildMainSessionKey(params.agentId, params.mainKey);
  const reference = params.reference?.trim().toLowerCase();
  if (!reference) {
    return mainKey;
  }

  if (reference === "main") {
    return mainKey;
  }

  const byId = Object.entries(params.sessions).find(([, entry]) => entry.sessionId === reference);
  if (byId) {
    return byId[0];
  }

  if (params.sessions[reference]) {
    return reference;
  }

  if (reference.includes(":")) {
    return reference;
  }

  return `agent:${params.agentId}:${normalizeSessionSegment(reference) || "main"}`;
}

function buildMainSessionKey(agentId: string, mainKey: string): string {
  const normalizedMainKey = normalizeSessionSegment(mainKey) || "main";
  return `agent:${normalizeAgentId(agentId) || DEFAULT_AGENT_ID}:${normalizedMainKey}`;
}

function normalizeSessionSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isSessionFresh(updatedAt: number, reset: SessionConfig["reset"], nowMs: number): boolean {
  const staleDaily =
    reset.mode === "daily" ? updatedAt < resolveMostRecentDailyReset(nowMs, normalizeHour(reset.atHour)) : false;
  const idleMinutes = resolveIdleMinutes(reset);
  const staleIdle = idleMinutes !== undefined ? nowMs > updatedAt + idleMinutes * 60_000 : false;
  return !(staleDaily || staleIdle);
}

function resolveMostRecentDailyReset(nowMs: number, atHour: number): number {
  const resetAt = new Date(nowMs);
  resetAt.setHours(atHour, 0, 0, 0);
  if (nowMs < resetAt.getTime()) {
    resetAt.setDate(resetAt.getDate() - 1);
  }
  return resetAt.getTime();
}

function normalizeHour(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SESSION_CONFIG.reset.atHour;
  }
  return Math.min(23, Math.max(0, Math.floor(value)));
}

function resolveIdleMinutes(reset: SessionConfig["reset"]): number | undefined {
  if (typeof reset.idleMinutes === "number" && Number.isFinite(reset.idleMinutes) && reset.idleMinutes > 0) {
    return Math.floor(reset.idleMinutes);
  }
  if (reset.mode === "idle") {
    return 60;
  }
  return undefined;
}

function mergeSessionConfig(base: SessionConfig, override?: Partial<SessionConfig>): SessionConfig {
  if (!override) {
    return base;
  }

  const reset: Partial<SessionConfig["reset"]> = override.reset ?? {};
  const pruning: Partial<SessionConfig["pruning"]> = override.pruning ?? {};
  const compaction: Partial<SessionConfig["compaction"]> = override.compaction ?? {};

  return {
    mainKey: normalizeSessionSegment(override.mainKey ?? base.mainKey) || base.mainKey,
    contextMaxChars: clampPositive(override.contextMaxChars ?? base.contextMaxChars, base.contextMaxChars),
    reset: {
      mode: reset.mode === "idle" ? "idle" : reset.mode === "daily" ? "daily" : base.reset.mode,
      atHour: normalizeHour(reset.atHour ?? base.reset.atHour),
      idleMinutes:
        typeof reset.idleMinutes === "number" && Number.isFinite(reset.idleMinutes) && reset.idleMinutes > 0
          ? Math.floor(reset.idleMinutes)
          : base.reset.idleMinutes
    },
    pruning: {
      enabled: pruning.enabled ?? base.pruning.enabled,
      maxMessages: clampPositive(pruning.maxMessages ?? base.pruning.maxMessages, base.pruning.maxMessages),
      maxChars: clampPositive(pruning.maxChars ?? base.pruning.maxChars, base.pruning.maxChars),
      keepRecentMessages: clampPositive(
        pruning.keepRecentMessages ?? base.pruning.keepRecentMessages,
        base.pruning.keepRecentMessages
      )
    },
    compaction: {
      enabled: compaction.enabled ?? base.compaction.enabled,
      triggerMessageCount: clampPositive(
        compaction.triggerMessageCount ?? base.compaction.triggerMessageCount,
        base.compaction.triggerMessageCount
      ),
      triggerChars: clampPositive(compaction.triggerChars ?? base.compaction.triggerChars, base.compaction.triggerChars),
      keepRecentMessages: clampPositive(
        compaction.keepRecentMessages ?? base.compaction.keepRecentMessages,
        base.compaction.keepRecentMessages
      ),
      summaryMaxChars: clampPositive(
        compaction.summaryMaxChars ?? base.compaction.summaryMaxChars,
        base.compaction.summaryMaxChars
      )
    }
  };
}

function clampPositive(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function summarizeCompactedMessages(messages: SessionTranscriptMessage[], maxChars: number): string {
  const lines: string[] = ["Compaction summary of earlier messages:"];
  for (const message of messages) {
    const flattened = message.content.replace(/\s+/g, " ").trim();
    if (!flattened) {
      continue;
    }
    lines.push(`- ${message.role}: ${flattened}`);
    const rendered = lines.join("\n");
    if (rendered.length >= maxChars) {
      break;
    }
  }

  return clampText(lines.join("\n"), maxChars);
}

function clampText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  const marker = "\n...[truncated]...\n";
  const tailChars = Math.max(64, maxChars - marker.length);
  return `${value.slice(-tailChars).trimStart()}${marker}`;
}

function newSessionId(): string {
  return randomUUID().toLowerCase();
}

function resolveProjectPath(input: string | undefined, fallback?: string): string {
  const normalized = input?.trim();
  if (normalized) {
    return path.resolve(normalized);
  }
  const fallbackPath = resolveStoredProjectPath(fallback);
  if (fallbackPath) {
    return fallbackPath;
  }
  return process.cwd();
}

function resolveStoredProjectPath(input: string | undefined): string | undefined {
  const normalized = input?.trim();
  if (!normalized) {
    return undefined;
  }
  return path.resolve(normalized);
}

function normalizeSessionTitle(input: string): string {
  const value = input.trim();
  if (!value) {
    throw new Error("Session title cannot be empty.");
  }
  if (value.length <= 120) {
    return value;
  }
  return `${value.slice(0, 117)}...`;
}

function resolveSessionTitle(sessionKey: string, title?: string): string {
  const explicit = title?.trim();
  if (explicit) {
    return explicit;
  }

  const segment = sessionKey.split(":").at(-1)?.trim() || "session";
  const normalized = segment.replace(/[-_]+/g, " ").trim();
  if (!normalized) {
    return "Session";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function toSessionSummary(params: {
  paths: OpenGoatPaths;
  pathPort: PathPort;
  agentId: string;
  sessionKey: string;
  entry: SessionEntry;
}): SessionSummary {
  return {
    sessionKey: params.sessionKey,
    sessionId: params.entry.sessionId,
    title: resolveSessionTitle(params.sessionKey, params.entry.title),
    updatedAt: params.entry.updatedAt,
    transcriptPath:
      params.entry.transcriptFile?.trim() ||
      params.pathPort.join(resolveSessionsDir(params.paths, params.agentId), `${params.entry.sessionId}.jsonl`),
    workspacePath:
      params.entry.workspacePath?.trim() ||
      params.pathPort.join(params.paths.workspacesDir, params.agentId),
    projectPath: params.entry.projectPath?.trim() || undefined,
    inputChars: params.entry.inputChars ?? 0,
    outputChars: params.entry.outputChars ?? 0,
    totalChars: params.entry.totalChars ?? 0,
    compactionCount: params.entry.compactionCount ?? 0
  };
}

function isSessionEntryMap(value: unknown): value is Record<string, SessionEntry> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    const record = entry as {
      sessionId?: unknown;
      updatedAt?: unknown;
      title?: unknown;
      workspacePath?: unknown;
      projectPath?: unknown;
      workingPath?: unknown;
    };

    if (typeof record.sessionId !== "string" || typeof record.updatedAt !== "number") {
      return false;
    }
    if (record.workspacePath !== undefined && typeof record.workspacePath !== "string") {
      return false;
    }
    if (record.projectPath !== undefined && typeof record.projectPath !== "string") {
      return false;
    }
    if (record.workingPath !== undefined && typeof record.workingPath !== "string") {
      return false;
    }
    if (record.title !== undefined && typeof record.title !== "string") {
      return false;
    }
    return true;
  });
}

function normalizeSessionEntries(entries: Record<string, SessionEntry>): Record<string, SessionEntry> {
  const normalized: Record<string, SessionEntry> = {};
  for (const [sessionKey, entry] of Object.entries(entries)) {
    const record = entry as SessionEntry & { workingPath?: string };
    normalized[sessionKey] = {
      ...record,
      projectPath: record.projectPath ?? record.workingPath
    };
  }
  return normalized;
}
