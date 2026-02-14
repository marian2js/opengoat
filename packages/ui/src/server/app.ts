import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { createHmac, randomBytes, scrypt as scryptWithCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import middie from "@fastify/middie";
import fastifyStatic from "@fastify/static";
import { createOpenGoatRuntime } from "@opengoat/core";

const DEFAULT_AGENT_ID = "ceo";
const execFileAsync = promisify(execFile);
const DEFAULT_TASK_CHECK_FREQUENCY_MINUTES = 1;
const DEFAULT_MAX_INACTIVITY_MINUTES = 30;
const MIN_MAX_INACTIVITY_MINUTES = 1;
const MAX_MAX_INACTIVITY_MINUTES = 10_080;
const UI_SETTINGS_FILENAME = "ui-settings.json";
const OPENGOAT_PACKAGE_NAME = "opengoat";
const VERSION_CACHE_TTL_MS = 5 * 60_000;
const VERSION_CHECK_TIMEOUT_MS = 2_000;
const MAX_UI_LOG_ENTRIES = 4000;
const DEFAULT_LOG_STREAM_LIMIT = 300;
const MAX_LOG_STREAM_LIMIT = 1000;
const LOG_STREAM_HEARTBEAT_MS = 15_000;
const OPENCLAW_LOG_POLL_INTERVAL_MS = 1200;
const DEFAULT_ORGANIZATION_PROJECT_NAME = "Organization";
const DEFAULT_ORGANIZATION_PROJECT_DIRNAME = "organization";
const UI_AUTH_COOKIE_NAME = "opengoat_ui_session";
const UI_AUTH_MIN_PASSWORD_LENGTH = 12;
const UI_AUTH_SESSION_TTL_SECONDS = 12 * 60 * 60;
const UI_AUTH_MAX_FAILED_ATTEMPTS = 5;
const UI_AUTH_ATTEMPT_WINDOW_MS = 10 * 60_000;
const UI_AUTH_BLOCK_MS = 15 * 60_000;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_COST = 32_768;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const scryptAsync = promisify(scryptWithCallback);

interface AgentDescriptor {
  id: string;
  displayName: string;
  workspaceDir: string;
  internalConfigDir: string;
}

interface OrganizationAgent extends AgentDescriptor {
  reportsTo: string | null;
  type: "manager" | "individual" | "unknown";
  role?: string;
}

interface AgentCreationResult {
  agent: AgentDescriptor;
  createdPaths: string[];
  skippedPaths: string[];
  alreadyExisted?: boolean;
}

interface AgentDeletionResult {
  agentId: string;
  existed: boolean;
  removedPaths: string[];
  skippedPaths: string[];
}

interface CreateAgentOptions {
  type?: "manager" | "individual";
  reportsTo?: string | null;
  skills?: string[];
  role?: string;
}

interface DeleteAgentOptions {
  force?: boolean;
}

interface SessionSummary {
  sessionKey: string;
  sessionId: string;
  title: string;
  updatedAt: number;
  transcriptPath: string;
  workspacePath: string;
  projectPath?: string;
  inputChars: number;
  outputChars: number;
  totalChars: number;
  compactionCount: number;
}

interface ResolvedSkill {
  id: string;
  name: string;
  description: string;
  source: string;
}

interface UiImageInput {
  dataUrl?: string;
  mediaType?: string;
  name?: string;
}

interface UiRunEvent {
  stage:
    | "run_started"
    | "provider_invocation_started"
    | "provider_invocation_completed"
    | "run_completed";
  timestamp: string;
  runId: string;
  step?: number;
  agentId?: string;
  targetAgentId?: string;
  providerId?: string;
  actionType?: string;
  mode?: string;
  code?: number;
  detail?: string;
}

interface UiRunHooks {
  onEvent?: (event: UiRunEvent) => void;
}

interface UiRunAgentOptions {
  message: string;
  sessionRef?: string;
  cwd?: string;
  images?: UiImageInput[];
  hooks?: UiRunHooks;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

interface UiOpenClawGatewayConfig {
  mode: "local" | "external";
  gatewayUrl?: string;
  gatewayToken?: string;
  command?: string;
}

type InactiveAgentNotificationTarget = "all-managers" | "ceo-only";

export interface OpenClawUiService {
  initialize?: () => Promise<unknown>;
  getHomeDir: () => string;
  getPaths?: () => unknown;
  listAgents: () => Promise<AgentDescriptor[]>;
  createAgent: (name: string, options?: CreateAgentOptions) => Promise<AgentCreationResult>;
  deleteAgent: (agentId: string, options?: Record<string, unknown>) => Promise<AgentDeletionResult>;
  listSessions: (agentId?: string, options?: { activeMinutes?: number }) => Promise<SessionSummary[]>;
  listSkills: (agentId?: string) => Promise<ResolvedSkill[]>;
  listGlobalSkills: () => Promise<ResolvedSkill[]>;
  getOpenClawGatewayConfig?: () => Promise<UiOpenClawGatewayConfig>;
  prepareSession?: (
    agentId?: string,
    options?: { sessionRef?: string; projectPath?: string; forceNew?: boolean }
  ) => Promise<SessionRunInfo>;
  runAgent?: (agentId: string, options: UiRunAgentOptions) => Promise<AgentRunResult>;
  getSessionHistory?: (
    agentId?: string,
    options?: { sessionRef?: string; limit?: number; includeCompaction?: boolean }
  ) => Promise<SessionHistoryResult>;
  renameSession?: (agentId?: string, title?: string, sessionRef?: string) => Promise<SessionSummary>;
  removeSession?: (agentId?: string, sessionRef?: string) => Promise<SessionRemoveResult>;
  createTask?: (
    actorId: string,
    options: {
      title: string;
      description: string;
      project?: string;
      assignedTo?: string;
      status?: string;
    }
  ) => Promise<TaskRecord>;
  listTasks?: (options?: { assignee?: string; limit?: number }) => Promise<TaskRecord[]>;
  deleteTasks?: (
    actorId: string,
    taskIds: string[]
  ) => Promise<{ deletedTaskIds: string[]; deletedCount: number }>;
  getTask?: (taskId: string) => Promise<TaskRecord>;
  updateTaskStatus?: (actorId: string, taskId: string, status: string, reason?: string) => Promise<TaskRecord>;
  addTaskBlocker?: (actorId: string, taskId: string, blocker: string) => Promise<TaskRecord>;
  addTaskArtifact?: (actorId: string, taskId: string, content: string) => Promise<TaskRecord>;
  addTaskWorklog?: (actorId: string, taskId: string, content: string) => Promise<TaskRecord>;
  runTaskCronCycle?: (options?: {
    inactiveMinutes?: number;
    notificationTarget?: InactiveAgentNotificationTarget;
    notifyInactiveAgents?: boolean;
  }) => Promise<TaskCronRunResult>;
}

interface SessionRunInfo {
  agentId: string;
  sessionKey: string;
  sessionId: string;
  transcriptPath: string;
  workspacePath: string;
  projectPath: string;
  isNewSession: boolean;
}

interface LegacyPreparedSessionRun {
  enabled: boolean;
  info?: SessionRunInfo;
}

interface SessionRemoveResult {
  sessionKey: string;
  sessionId: string;
  title: string;
  transcriptPath: string;
}

interface SessionHistoryItem {
  type: "message" | "compaction";
  role?: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

interface SessionHistoryResult {
  sessionKey: string;
  sessionId?: string;
  transcriptPath?: string;
  messages: SessionHistoryItem[];
}

interface TaskEntry {
  createdAt: string;
  createdBy: string;
  content: string;
}

interface TaskRecord {
  taskId: string;
  createdAt: string;
  project: string;
  owner: string;
  assignedTo: string;
  title: string;
  description: string;
  status: string;
  statusReason?: string;
  blockers: string[];
  artifacts: TaskEntry[];
  worklog: TaskEntry[];
}

interface AgentRunResult {
  code: number;
  stdout: string;
  stderr: string;
  providerId: string;
  providerSessionId?: string;
  session?: SessionRunInfo & {
    preRunCompactionApplied: boolean;
    postRunCompaction: {
      compactedMessages: number;
      summary?: string;
    };
  };
}

interface TaskCronRunResult {
  ranAt: string;
  scannedTasks: number;
  todoTasks: number;
  blockedTasks: number;
  inactiveAgents: number;
  sent: number;
  failed: number;
}

interface UiServerSettings {
  taskCronEnabled: boolean;
  notifyManagersOfInactiveAgents: boolean;
  maxInactivityMinutes: number;
  inactiveAgentNotificationTarget: InactiveAgentNotificationTarget;
  authentication: UiServerAuthenticationSettings;
}

interface UiServerAuthenticationSettings {
  enabled: boolean;
  username?: string;
  passwordHash?: string;
}

interface UiAuthenticationStatus {
  enabled: boolean;
  authenticated: boolean;
}

interface UiAuthenticationSettingsResponse {
  enabled: boolean;
  username: string;
  hasPassword: boolean;
}

interface UiServerSettingsResponse {
  taskCronEnabled: boolean;
  notifyManagersOfInactiveAgents: boolean;
  maxInactivityMinutes: number;
  inactiveAgentNotificationTarget: InactiveAgentNotificationTarget;
  authentication: UiAuthenticationSettingsResponse;
}

interface UiVersionInfo {
  packageName: string;
  installedVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean | null;
  status: "latest" | "update-available" | "unpublished" | "unknown";
  checkedAt: string;
  error?: string;
}

type SessionMessageProgressPhase =
  | "queued"
  | "run_started"
  | "provider_invocation_started"
  | "provider_invocation_completed"
  | "run_completed"
  | "stdout"
  | "stderr"
  | "heartbeat";

interface SessionMessageStreamProgressEvent {
  type: "progress";
  phase: SessionMessageProgressPhase;
  timestamp: string;
  message: string;
}

interface SessionMessageStreamResultEvent {
  type: "result";
  agentId: string;
  sessionRef: string;
  output: string;
  result: {
    code: number;
    stdout: string;
    stderr: string;
  };
  message: string;
}

interface SessionMessageStreamErrorEvent {
  type: "error";
  timestamp: string;
  error: string;
}

type SessionMessageStreamEvent =
  | SessionMessageStreamProgressEvent
  | SessionMessageStreamResultEvent
  | SessionMessageStreamErrorEvent;

type UiLogLevel = "info" | "warn" | "error";
type UiLogSource = "opengoat" | "openclaw";

interface UiLogEntry {
  id: number;
  timestamp: string;
  level: UiLogLevel;
  source: UiLogSource;
  message: string;
}

interface UiLogSnapshotStreamEvent {
  type: "snapshot";
  entries: UiLogEntry[];
}

interface UiLogLineStreamEvent {
  type: "log";
  entry: UiLogEntry;
}

interface UiLogHeartbeatStreamEvent {
  type: "heartbeat";
  timestamp: string;
}

interface UiLogErrorStreamEvent {
  type: "error";
  timestamp: string;
  error: string;
}

type UiLogStreamEvent =
  | UiLogSnapshotStreamEvent
  | UiLogLineStreamEvent
  | UiLogHeartbeatStreamEvent
  | UiLogErrorStreamEvent;

interface UiLogBuffer {
  append: (entry: Omit<UiLogEntry, "id">) => UiLogEntry;
  listRecent: (limit: number) => UiLogEntry[];
  subscribe: (listener: (entry: UiLogEntry) => void) => () => void;
  start: () => void;
  stop: () => void;
}

export interface OpenGoatUiServerOptions {
  logger?: boolean;
  mode?: "development" | "production";
  service?: OpenClawUiService;
  attachFrontend?: boolean;
}

interface RegisterApiRoutesDeps {
  getSettings: () => UiServerSettings;
  updateSettings: (settings: UiServerSettings) => Promise<void>;
  getVersionInfo: () => Promise<UiVersionInfo>;
  logs: UiLogBuffer;
  auth: UiAuthController;
}

interface UiAuthController {
  isAuthenticationRequired: () => boolean;
  isAuthenticatedRequest: (request: { headers: Record<string, unknown> }) => boolean;
  issueSessionCookie: (
    reply: FastifyReply,
    request: { headers: Record<string, unknown> },
    username: string,
  ) => {
    ok: boolean;
    error?: string;
  };
  clearSessionCookie: (reply: FastifyReply, request: { headers: Record<string, unknown> }) => void;
  getStatusForRequest: (request: { headers: Record<string, unknown> }) => UiAuthenticationStatus;
  verifyCredentials: (username: string, password: string) => Promise<boolean>;
  verifyCurrentPassword: (password: string) => Promise<boolean>;
  checkAttemptStatus: (request: { ip?: string }) => { blocked: boolean; retryAfterSeconds?: number };
  registerFailedAttempt: (request: { ip?: string }) => { blocked: boolean; retryAfterSeconds?: number };
  clearFailedAttempts: (request: { ip?: string }) => void;
  validatePasswordStrength: (password: string) => string | undefined;
  hashPassword: (password: string) => Promise<string>;
  getSettingsResponse: () => UiAuthenticationSettingsResponse;
  handleSettingsMutation: (
    previous: UiServerAuthenticationSettings,
    next: UiServerAuthenticationSettings,
  ) => void;
}

function createUiLogBuffer(service: OpenClawUiService): UiLogBuffer {
  const entries: UiLogEntry[] = [];
  const listeners = new Set<(entry: UiLogEntry) => void>();
  let nextId = 1;
  let poller: NodeJS.Timeout | undefined;
  let pollInFlight = false;
  let cursor: number | undefined;
  let reportedPollFailure = false;

  const append = (entry: Omit<UiLogEntry, "id">): UiLogEntry => {
    const next: UiLogEntry = {
      ...entry,
      id: nextId,
    };
    nextId += 1;
    entries.push(next);
    if (entries.length > MAX_UI_LOG_ENTRIES) {
      entries.splice(0, entries.length - MAX_UI_LOG_ENTRIES);
    }
    for (const listener of listeners) {
      listener(next);
    }
    return next;
  };

  const pollOpenClawLogs = async (): Promise<void> => {
    if (pollInFlight || typeof service.getOpenClawGatewayConfig !== "function") {
      return;
    }

    pollInFlight = true;
    try {
      const tailed = await fetchOpenClawGatewayLogTail(service, {
        cursor,
        limit: 200,
        maxBytes: 250000,
      });
      cursor = tailed.cursor;
      for (const line of tailed.lines) {
        const parsed = parseCommandJson(line);
        const message = resolveUiLogMessageFromGatewayLine(parsed, line);
        if (!message) {
          continue;
        }
        append({
          timestamp: resolveUiLogTimestamp(parsed),
          level: resolveUiLogLevel(parsed),
          source: "openclaw",
          message,
        });
      }
      reportedPollFailure = false;
    } catch (error) {
      if (!reportedPollFailure) {
        append({
          timestamp: new Date().toISOString(),
          level: "warn",
          source: "opengoat",
          message:
            error instanceof Error
              ? `OpenClaw log stream unavailable: ${error.message}`
              : "OpenClaw log stream unavailable.",
        });
        reportedPollFailure = true;
      }
    } finally {
      pollInFlight = false;
    }
  };

  const ensurePolling = (): void => {
    if (
      poller ||
      listeners.size === 0 ||
      typeof service.getOpenClawGatewayConfig !== "function"
    ) {
      return;
    }
    void pollOpenClawLogs();
    poller = setInterval(() => {
      void pollOpenClawLogs();
    }, OPENCLAW_LOG_POLL_INTERVAL_MS);
    poller.unref?.();
  };

  const stopPollingIfIdle = (): void => {
    if (listeners.size > 0 || !poller) {
      return;
    }
    clearInterval(poller);
    poller = undefined;
  };

  return {
    append,
    listRecent: (limit: number): UiLogEntry[] => {
      if (entries.length === 0) {
        return [];
      }
      const safeLimit = Math.min(
        Math.max(1, Math.floor(limit || DEFAULT_LOG_STREAM_LIMIT)),
        MAX_LOG_STREAM_LIMIT,
      );
      return entries.slice(-safeLimit);
    },
    subscribe: (listener: (entry: UiLogEntry) => void): (() => void) => {
      listeners.add(listener);
      ensurePolling();
      return () => {
        listeners.delete(listener);
        stopPollingIfIdle();
      };
    },
    start: () => {
      ensurePolling();
    },
    stop: () => {
      if (poller) {
        clearInterval(poller);
        poller = undefined;
      }
    },
  };
}

interface UiLoginAttemptState {
  failures: number[];
  blockedUntil: number;
}

interface ScryptPasswordHashParts {
  cost: number;
  blockSize: number;
  parallelization: number;
  salt: Buffer;
  digest: Buffer;
}

interface UiSignedSessionPayload {
  u: string;
  e: number;
  v: number;
  n: string;
}

function createUiAuthController(
  app: FastifyInstance,
  getSettings: () => UiServerAuthenticationSettings,
): UiAuthController {
  const sessionSecret = randomBytes(32);
  const loginAttemptsByKey = new Map<string, UiLoginAttemptState>();
  let sessionVersion = 1;
  const fallbackPasswordHashPromise = hashUiAuthenticationPassword(
    `fallback-${randomBytes(24).toString("hex")}`,
  );

  const resolveActiveConfiguration = (): {
    enabled: boolean;
    username?: string;
    passwordHash?: string;
  } => {
    const current = getSettings();
    const username = normalizeUiAuthenticationUsername(current.username);
    const passwordHash = normalizeUiAuthenticationPasswordHash(
      current.passwordHash,
    );
    const enabled = current.enabled === true && Boolean(username && passwordHash);
    return {
      enabled,
      username,
      passwordHash,
    };
  };

  return {
    isAuthenticationRequired: () => {
      return resolveActiveConfiguration().enabled;
    },
    isAuthenticatedRequest: (request) => {
      const active = resolveActiveConfiguration();
      if (!active.enabled || !active.username) {
        return true;
      }

      const cookies = parseCookieHeader(request.headers.cookie);
      const token = cookies[UI_AUTH_COOKIE_NAME];
      if (!token) {
        return false;
      }

      return verifySignedUiAuthenticationSession(
        token,
        sessionSecret,
        sessionVersion,
        active.username,
      );
    },
    issueSessionCookie: (reply, request, username) => {
      const active = resolveActiveConfiguration();
      if (!active.enabled || !active.username) {
        return { ok: true };
      }

      const normalizedUsername = normalizeUiAuthenticationUsername(username);
      if (!normalizedUsername || normalizedUsername !== active.username) {
        return {
          ok: false,
          error: "Unable to issue authentication session.",
        };
      }

      const cookieSecurity = resolveUiAuthenticationCookieSecurity(request);
      if (cookieSecurity.requiresHttps && !cookieSecurity.isHttps) {
        return {
          ok: false,
          error:
            "HTTPS is required to sign in when UI authentication is enabled on non-local hosts.",
        };
      }

      const token = signUiAuthenticationSession(
        {
          u: normalizedUsername,
          e: Date.now() + UI_AUTH_SESSION_TTL_SECONDS * 1000,
          v: sessionVersion,
          n: randomBytes(12).toString("base64url"),
        },
        sessionSecret,
      );
      appendSetCookieHeader(
        reply,
        serializeCookie(UI_AUTH_COOKIE_NAME, token, {
          path: "/",
          httpOnly: true,
          sameSite: "Strict",
          secure: cookieSecurity.useSecureCookie,
          maxAge: UI_AUTH_SESSION_TTL_SECONDS,
        }),
      );
      return { ok: true };
    },
    clearSessionCookie: (reply) => {
      appendSetCookieHeader(
        reply,
        serializeCookie(UI_AUTH_COOKIE_NAME, "", {
          path: "/",
          httpOnly: true,
          sameSite: "Strict",
          secure: false,
          maxAge: 0,
        }),
      );
      appendSetCookieHeader(
        reply,
        serializeCookie(UI_AUTH_COOKIE_NAME, "", {
          path: "/",
          httpOnly: true,
          sameSite: "Strict",
          secure: true,
          maxAge: 0,
        }),
      );
    },
    getStatusForRequest: (request) => {
      return {
        enabled: resolveActiveConfiguration().enabled,
        authenticated: resolveActiveConfiguration().enabled
          ? (() => {
              const active = resolveActiveConfiguration();
              if (!active.username) {
                return false;
              }
              const cookies = parseCookieHeader(request.headers.cookie);
              const token = cookies[UI_AUTH_COOKIE_NAME];
              if (!token) {
                return false;
              }
              return verifySignedUiAuthenticationSession(
                token,
                sessionSecret,
                sessionVersion,
                active.username,
              );
            })()
          : true,
      };
    },
    verifyCredentials: async (username, password) => {
      const active = resolveActiveConfiguration();
      if (!active.enabled || !active.username || !active.passwordHash) {
        return false;
      }

      const normalizedUsername = normalizeUiAuthenticationUsername(username);
      const suppliedPassword = normalizePasswordInput(password);
      const expectedHash =
        normalizedUsername === active.username
          ? active.passwordHash
          : await fallbackPasswordHashPromise;
      const passwordMatches = await verifyUiAuthenticationPassword(
        suppliedPassword,
        expectedHash,
      );
      return normalizedUsername === active.username && passwordMatches;
    },
    verifyCurrentPassword: async (password) => {
      const active = resolveActiveConfiguration();
      if (!active.enabled || !active.passwordHash) {
        return false;
      }
      return verifyUiAuthenticationPassword(
        normalizePasswordInput(password),
        active.passwordHash,
      );
    },
    checkAttemptStatus: (request) => {
      const key = resolveLoginAttemptKey(request.ip);
      const now = Date.now();
      const state = loginAttemptsByKey.get(key);
      if (!state) {
        return { blocked: false };
      }
      pruneLoginAttemptFailures(state, now);
      if (state.blockedUntil > now) {
        return {
          blocked: true,
          retryAfterSeconds: Math.ceil((state.blockedUntil - now) / 1000),
        };
      }
      if (state.failures.length === 0) {
        loginAttemptsByKey.delete(key);
      } else {
        loginAttemptsByKey.set(key, state);
      }
      return { blocked: false };
    },
    registerFailedAttempt: (request) => {
      const key = resolveLoginAttemptKey(request.ip);
      const now = Date.now();
      const state = loginAttemptsByKey.get(key) ?? {
        failures: [],
        blockedUntil: 0,
      };
      pruneLoginAttemptFailures(state, now);
      if (state.blockedUntil > now) {
        return {
          blocked: true,
          retryAfterSeconds: Math.ceil((state.blockedUntil - now) / 1000),
        };
      }

      state.failures.push(now);
      if (state.failures.length >= UI_AUTH_MAX_FAILED_ATTEMPTS) {
        state.failures = [];
        state.blockedUntil = now + UI_AUTH_BLOCK_MS;
        loginAttemptsByKey.set(key, state);
        app.log.warn(
          {
            ip: key,
            retryAfterSeconds: Math.ceil(UI_AUTH_BLOCK_MS / 1000),
          },
          "UI authentication temporarily blocked due to repeated failed sign-in attempts.",
        );
        return {
          blocked: true,
          retryAfterSeconds: Math.ceil(UI_AUTH_BLOCK_MS / 1000),
        };
      }
      loginAttemptsByKey.set(key, state);
      return { blocked: false };
    },
    clearFailedAttempts: (request) => {
      const key = resolveLoginAttemptKey(request.ip);
      loginAttemptsByKey.delete(key);
    },
    validatePasswordStrength: (password) => {
      return validateUiAuthenticationPasswordStrength(password);
    },
    hashPassword: (password) => {
      return hashUiAuthenticationPassword(password);
    },
    getSettingsResponse: () => {
      const current = getSettings();
      const username = normalizeUiAuthenticationUsername(current.username) ?? "";
      const hasPassword = Boolean(
        normalizeUiAuthenticationPasswordHash(current.passwordHash),
      );
      return {
        enabled: current.enabled === true && hasPassword && Boolean(username),
        username,
        hasPassword,
      };
    },
    handleSettingsMutation: (previous, next) => {
      const previousUsername = normalizeUiAuthenticationUsername(previous.username);
      const nextUsername = normalizeUiAuthenticationUsername(next.username);
      const previousPasswordHash = normalizeUiAuthenticationPasswordHash(
        previous.passwordHash,
      );
      const nextPasswordHash = normalizeUiAuthenticationPasswordHash(
        next.passwordHash,
      );
      const changed =
        previous.enabled !== next.enabled ||
        previousUsername !== nextUsername ||
        previousPasswordHash !== nextPasswordHash;
      if (changed) {
        sessionVersion += 1;
      }
      if (next.enabled !== true) {
        loginAttemptsByKey.clear();
      }
    },
  };
}

function stripQueryStringFromUrl(url: string): string {
  const separatorIndex = url.indexOf("?");
  if (separatorIndex < 0) {
    return url;
  }
  return url.slice(0, separatorIndex);
}

function parseCookieHeader(rawCookieHeader: unknown): Record<string, string> {
  if (typeof rawCookieHeader !== "string" || !rawCookieHeader.trim()) {
    return {};
  }

  const entries = rawCookieHeader.split(";");
  const parsed: Record<string, string> = {};
  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }
    try {
      parsed[key] = decodeURIComponent(value);
    } catch {
      parsed[key] = value;
    }
  }
  return parsed;
}

function appendSetCookieHeader(reply: FastifyReply, cookie: string): void {
  const existing = reply.getHeader("set-cookie");
  if (!existing) {
    reply.header("set-cookie", cookie);
    return;
  }
  if (Array.isArray(existing)) {
    reply.header("set-cookie", [...existing, cookie]);
    return;
  }
  if (typeof existing === "string") {
    reply.header("set-cookie", [existing, cookie]);
  }
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    path: string;
    httpOnly: boolean;
    sameSite: "Strict" | "Lax" | "None";
    secure: boolean;
    maxAge: number;
  },
): string {
  const encodedValue = encodeURIComponent(value);
  const parts = [`${name}=${encodedValue}`];
  parts.push(`Path=${options.path}`);
  parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  parts.push("Priority=High");
  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  if (options.secure) {
    parts.push("Secure");
  }
  parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}

function resolveUiAuthenticationCookieSecurity(request: {
  headers: Record<string, unknown>;
  raw?: {
    socket?: {
      encrypted?: boolean;
    };
  };
}): { isHttps: boolean; requiresHttps: boolean; useSecureCookie: boolean } {
  const host = normalizeRequestHost(request.headers.host);
  const forwardedProto = normalizeForwardedProto(request.headers["x-forwarded-proto"]);
  const isHttps =
    request.raw?.socket?.encrypted === true ||
    forwardedProto === "https";
  const isLocalHost =
    host === "" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1";
  const requiresHttps = !isLocalHost;
  return {
    isHttps,
    requiresHttps,
    useSecureCookie: requiresHttps || isHttps,
  };
}

function normalizeForwardedProto(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return normalizeForwardedProto(value[0]);
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const [first] = value.split(",");
  const normalized = first?.trim().toLowerCase();
  return normalized || undefined;
}

function normalizeRequestHost(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("[")) {
    const endBracket = trimmed.indexOf("]");
    if (endBracket > 0) {
      return trimmed.slice(1, endBracket);
    }
    return trimmed;
  }
  const [host] = trimmed.split(":", 1);
  return host ?? "";
}

function signUiAuthenticationSession(
  payload: UiSignedSessionPayload,
  secret: Buffer,
): string {
  const payloadJson = JSON.stringify(payload);
  const payloadEncoded = Buffer.from(payloadJson, "utf8").toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payloadEncoded)
    .digest("base64url");
  return `${payloadEncoded}.${signature}`;
}

function verifySignedUiAuthenticationSession(
  token: string,
  secret: Buffer,
  expectedSessionVersion: number,
  expectedUsername: string,
): boolean {
  const segments = token.split(".");
  if (segments.length !== 2) {
    return false;
  }
  const payloadEncoded = segments[0];
  const signatureEncoded = segments[1];
  if (!payloadEncoded || !signatureEncoded) {
    return false;
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(payloadEncoded)
    .digest("base64url");
  const expectedBuffer = Buffer.from(expectedSignature);
  const signatureBuffer = Buffer.from(signatureEncoded);
  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }
  if (!timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return false;
  }

  try {
    const payloadRaw = Buffer.from(payloadEncoded, "base64url").toString("utf8");
    const payload = JSON.parse(payloadRaw) as UiSignedSessionPayload;
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.u !== "string" ||
      typeof payload.e !== "number" ||
      typeof payload.v !== "number"
    ) {
      return false;
    }
    if (payload.u !== expectedUsername) {
      return false;
    }
    if (payload.v !== expectedSessionVersion) {
      return false;
    }
    if (!Number.isFinite(payload.e) || payload.e <= Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function hashUiAuthenticationPassword(password: string): Promise<string> {
  const normalizedPassword = normalizePasswordInput(password);
  const salt = randomBytes(16);
  const digest = (await scryptAsync(normalizedPassword, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: 128 * 1024 * 1024,
  })) as Buffer;
  return [
    "scrypt",
    String(SCRYPT_COST),
    String(SCRYPT_BLOCK_SIZE),
    String(SCRYPT_PARALLELIZATION),
    salt.toString("base64url"),
    digest.toString("base64url"),
  ].join("$");
}

async function verifyUiAuthenticationPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  const parsed = parseScryptPasswordHash(passwordHash);
  if (!parsed) {
    return false;
  }

  try {
    const computedDigest = (await scryptAsync(
      normalizePasswordInput(password),
      parsed.salt,
      parsed.digest.length,
      {
        N: parsed.cost,
        r: parsed.blockSize,
        p: parsed.parallelization,
        maxmem: 128 * 1024 * 1024,
      },
    )) as Buffer;
    if (computedDigest.length !== parsed.digest.length) {
      return false;
    }
    return timingSafeEqual(computedDigest, parsed.digest);
  } catch {
    return false;
  }
}

function parseScryptPasswordHash(value: string): ScryptPasswordHashParts | undefined {
  const segments = value.split("$");
  if (segments.length !== 6 || segments[0] !== "scrypt") {
    return undefined;
  }

  const cost = Number.parseInt(segments[1] ?? "", 10);
  const blockSize = Number.parseInt(segments[2] ?? "", 10);
  const parallelization = Number.parseInt(segments[3] ?? "", 10);
  const saltSegment = segments[4] ?? "";
  const digestSegment = segments[5] ?? "";
  if (
    !Number.isInteger(cost) ||
    !Number.isInteger(blockSize) ||
    !Number.isInteger(parallelization) ||
    cost < 1_024 ||
    blockSize <= 0 ||
    parallelization <= 0 ||
    !saltSegment ||
    !digestSegment
  ) {
    return undefined;
  }

  try {
    const salt = Buffer.from(saltSegment, "base64url");
    const digest = Buffer.from(digestSegment, "base64url");
    if (salt.length < 8 || digest.length < 16) {
      return undefined;
    }
    return {
      cost,
      blockSize,
      parallelization,
      salt,
      digest,
    };
  } catch {
    return undefined;
  }
}

function normalizeUiAuthenticationUsername(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (!/^[a-z0-9](?:[a-z0-9._-]{1,62}[a-z0-9])?$/.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function normalizeUiAuthenticationPasswordHash(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  return parseScryptPasswordHash(normalized) ? normalized : undefined;
}

function normalizePasswordInput(value: string): string {
  return value.normalize("NFKC");
}

function validateUiAuthenticationPasswordStrength(password: string): string | undefined {
  const normalized = normalizePasswordInput(password);
  if (normalized.length < UI_AUTH_MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${UI_AUTH_MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (!/[A-Z]/.test(normalized)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[a-z]/.test(normalized)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/\d/.test(normalized)) {
    return "Password must include at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(normalized)) {
    return "Password must include at least one symbol.";
  }
  return undefined;
}

function resolveLoginAttemptKey(ipAddress: string | undefined): string {
  const normalized = ipAddress?.trim();
  return normalized || "unknown";
}

function pruneLoginAttemptFailures(state: UiLoginAttemptState, now: number): void {
  state.failures = state.failures.filter((timestamp) => {
    return now - timestamp <= UI_AUTH_ATTEMPT_WINDOW_MS;
  });
}

export async function createOpenGoatUiServer(options: OpenGoatUiServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true });
  const runtime = options.service ? undefined : createOpenGoatRuntime();
  const service = options.service ?? runtime?.service;
  const mode = options.mode ?? resolveMode();
  const attachFrontend = options.attachFrontend ?? true;
  const packageRoot = resolvePackageRoot();

  if (!service) {
    throw new Error("OpenGoat UI service is unavailable.");
  }

  if (typeof service.initialize === "function") {
    await service.initialize();
  }

  const logs = createUiLogBuffer(service);
  logs.append({
    timestamp: new Date().toISOString(),
    level: "info",
    source: "opengoat",
    message: "OpenGoat UI server started.",
  });
  logs.start();
  await ensureDefaultOrganizationWorkspace(service, logs);

  let uiSettings = await readUiServerSettings(service.getHomeDir());
  const auth = createUiAuthController(app, () => uiSettings.authentication);
  const getVersionInfo = createVersionInfoProvider();
  const taskCronScheduler = createTaskCronScheduler(
    app,
    service,
    uiSettings,
    logs,
  );
  app.addHook("onClose", async () => {
    taskCronScheduler.stop();
    logs.stop();
  });

  await app.register(cors, { origin: true });
  app.addHook("onRequest", async (request, reply) => {
    if (!auth.isAuthenticationRequired()) {
      return;
    }

    const pathname = stripQueryStringFromUrl(request.url);
    if (
      pathname === "/api/auth/status" ||
      pathname === "/api/auth/login" ||
      pathname === "/api/auth/logout"
    ) {
      return;
    }

    if (!pathname.startsWith("/api/")) {
      return;
    }

    if (auth.isAuthenticatedRequest(request)) {
      return;
    }

    reply.code(401).send({
      error: "Authentication required.",
      code: "AUTH_REQUIRED",
    });
  });

  registerApiRoutes(app, service, mode, {
    getSettings: () => uiSettings,
    updateSettings: async (nextSettings) => {
      const previousAuth = uiSettings.authentication;
      uiSettings = nextSettings;
      await writeUiServerSettings(service.getHomeDir(), uiSettings);
      auth.handleSettingsMutation(previousAuth, uiSettings.authentication);
      taskCronScheduler.setTaskCronEnabled(uiSettings.taskCronEnabled);
      taskCronScheduler.setNotifyManagersOfInactiveAgents(
        uiSettings.notifyManagersOfInactiveAgents,
      );
      taskCronScheduler.setMaxInactivityMinutes(
        uiSettings.maxInactivityMinutes,
      );
      taskCronScheduler.setInactiveAgentNotificationTarget(
        uiSettings.inactiveAgentNotificationTarget,
      );
    },
    getVersionInfo,
    logs,
    auth,
  });

  if (attachFrontend) {
    await registerFrontend(app, {
      packageRoot,
      mode
    });
  }

  return app;
}

function registerApiRoutes(
  app: FastifyInstance,
  service: OpenClawUiService,
  mode: "development" | "production",
  deps: RegisterApiRoutesDeps
): void {
  app.get("/api/auth/status", async (request, reply) => {
    return safeReply(reply, async () => {
      return {
        authentication: deps.auth.getStatusForRequest(request),
      };
    });
  });

  app.post<{
    Body: {
      username?: string;
      password?: string;
    };
  }>("/api/auth/login", async (request, reply) => {
    return safeReply(reply, async () => {
      if (!deps.auth.isAuthenticationRequired()) {
        return {
          authentication: {
            enabled: false,
            authenticated: true,
          },
          message: "UI authentication is disabled.",
        };
      }

      const blockedAttempt = deps.auth.checkAttemptStatus(request);
      if (blockedAttempt.blocked) {
        const retryAfterSeconds = blockedAttempt.retryAfterSeconds ?? 60;
        reply.code(429);
        reply.header("Retry-After", String(retryAfterSeconds));
        return {
          error: "Too many failed sign-in attempts. Try again later.",
          code: "AUTH_RATE_LIMITED",
          retryAfterSeconds,
        };
      }

      const username = request.body?.username ?? "";
      const password = request.body?.password ?? "";
      const validCredentials = await deps.auth.verifyCredentials(
        username,
        password,
      );
      if (!validCredentials) {
        const lockState = deps.auth.registerFailedAttempt(request);
        if (lockState.blocked) {
          const retryAfterSeconds = lockState.retryAfterSeconds ?? 60;
          reply.code(429);
          reply.header("Retry-After", String(retryAfterSeconds));
          return {
            error: "Too many failed sign-in attempts. Try again later.",
            code: "AUTH_RATE_LIMITED",
            retryAfterSeconds,
          };
        }
        reply.code(401);
        return {
          error: "Invalid username or password.",
          code: "AUTH_INVALID_CREDENTIALS",
        };
      }

      const issueCookieResult = deps.auth.issueSessionCookie(
        reply,
        request,
        username,
      );
      if (!issueCookieResult.ok) {
        reply.code(400);
        return {
          error:
            issueCookieResult.error ??
            "Unable to establish an authentication session.",
          code: "AUTH_SESSION_ISSUE_FAILED",
        };
      }

      deps.auth.clearFailedAttempts(request);
      return {
        authentication: {
          enabled: true,
          authenticated: true,
        },
        message: "Signed in.",
      };
    });
  });

  app.post("/api/auth/logout", async (request, reply) => {
    return safeReply(reply, async () => {
      deps.auth.clearSessionCookie(reply, request);
      deps.auth.clearFailedAttempts(request);
      const status = deps.auth.getStatusForRequest(request);
      return {
        authentication: {
          enabled: status.enabled,
          authenticated: false,
        },
        message: "Signed out.",
      };
    });
  });

  app.get("/api/health", async (_request, reply) => {
    return safeReply(reply, async () => {
      return {
        ok: true,
        mode,
        homeDir: service.getHomeDir(),
        timestamp: new Date().toISOString()
      };
    });
  });

  app.get("/api/settings", async (_request, reply) => {
    return safeReply(reply, async () => {
      return {
        settings: toPublicUiServerSettings(
          deps.getSettings(),
          deps.auth.getSettingsResponse(),
        ),
      };
    });
  });

  app.post<{
    Body: {
      taskCronEnabled?: boolean;
      notifyManagersOfInactiveAgents?: boolean;
      maxInactivityMinutes?: number;
      inactiveAgentNotificationTarget?: InactiveAgentNotificationTarget;
      authentication?: {
        enabled?: boolean;
        username?: string;
        password?: string;
        currentPassword?: string;
      };
    };
  }>("/api/settings", async (request, reply) => {
    return safeReply(reply, async () => {
      const currentSettings = deps.getSettings();
      const hasTaskCronEnabledSetting = Object.prototype.hasOwnProperty.call(
        request.body ?? {},
        "taskCronEnabled",
      );
      const hasNotifyManagersSetting = Object.prototype.hasOwnProperty.call(
        request.body ?? {},
        "notifyManagersOfInactiveAgents",
      );
      const hasMaxInactivitySetting = Object.prototype.hasOwnProperty.call(
        request.body ?? {},
        "maxInactivityMinutes",
      );
      const hasNotificationTargetSetting =
        Object.prototype.hasOwnProperty.call(
          request.body ?? {},
          "inactiveAgentNotificationTarget",
        );
      const hasAuthenticationSetting = Object.prototype.hasOwnProperty.call(
        request.body ?? {},
        "authentication",
      );

      const parsedTaskCronEnabled = hasTaskCronEnabledSetting
        ? parseTaskCronEnabled(request.body?.taskCronEnabled)
        : currentSettings.taskCronEnabled;
      if (parsedTaskCronEnabled === undefined) {
        reply.code(400);
        return {
          error: "taskCronEnabled must be true or false",
        };
      }

      const parsedNotifyManagers = hasNotifyManagersSetting
        ? parseNotifyManagersOfInactiveAgents(
            request.body?.notifyManagersOfInactiveAgents,
          )
        : currentSettings.notifyManagersOfInactiveAgents;
      if (parsedNotifyManagers === undefined) {
        reply.code(400);
        return {
          error: "notifyManagersOfInactiveAgents must be true or false",
        };
      }

      const parsedMaxInactivityMinutes = hasMaxInactivitySetting
        ? parseMaxInactivityMinutes(request.body?.maxInactivityMinutes)
        : currentSettings.maxInactivityMinutes;
      if (!parsedMaxInactivityMinutes) {
        reply.code(400);
        return {
          error: `maxInactivityMinutes must be an integer between ${MIN_MAX_INACTIVITY_MINUTES} and ${MAX_MAX_INACTIVITY_MINUTES}`,
        };
      }
      const parsedNotificationTarget = hasNotificationTargetSetting
        ? parseInactiveAgentNotificationTarget(
            request.body?.inactiveAgentNotificationTarget,
          )
        : currentSettings.inactiveAgentNotificationTarget;
      if (!parsedNotificationTarget) {
        reply.code(400);
        return {
          error:
            "inactiveAgentNotificationTarget must be either all-managers or ceo-only",
        };
      }

      let nextAuthentication: UiServerAuthenticationSettings =
        currentSettings.authentication;
      if (hasAuthenticationSetting) {
        const authenticationBody = request.body?.authentication ?? {};
        const hasEnabled = Object.prototype.hasOwnProperty.call(
          authenticationBody,
          "enabled",
        );
        const hasUsername = Object.prototype.hasOwnProperty.call(
          authenticationBody,
          "username",
        );
        const hasPassword = Object.prototype.hasOwnProperty.call(
          authenticationBody,
          "password",
        );
        const hasCurrentPassword = Object.prototype.hasOwnProperty.call(
          authenticationBody,
          "currentPassword",
        );

        const currentAuthentication = currentSettings.authentication;
        const parsedEnabled = hasEnabled
          ? parseBooleanSetting(authenticationBody.enabled)
          : currentAuthentication.enabled;
        if (parsedEnabled === undefined) {
          reply.code(400);
          return {
            error: "authentication.enabled must be true or false",
          };
        }

        const providedUsername = hasUsername
          ? normalizeUiAuthenticationUsername(authenticationBody.username)
          : normalizeUiAuthenticationUsername(currentAuthentication.username);
        if (hasUsername && !providedUsername) {
          reply.code(400);
          return {
            error:
              "authentication.username must use 3-64 lowercase characters, numbers, dots, dashes, or underscores.",
          };
        }

        const rawNewPassword = hasPassword
          ? normalizePasswordInput(authenticationBody.password ?? "")
          : "";
        const hasNewPassword = rawNewPassword.length > 0;
        if (hasPassword && !hasNewPassword) {
          reply.code(400);
          return {
            error: "authentication.password cannot be empty when provided.",
          };
        }
        if (hasNewPassword) {
          const passwordValidationError =
            deps.auth.validatePasswordStrength(rawNewPassword);
          if (passwordValidationError) {
            reply.code(400);
            return {
              error: passwordValidationError,
            };
          }
        }

        const currentEnabledSettings = deps.auth.getSettingsResponse().enabled;
        const changingEnabledState = parsedEnabled !== currentAuthentication.enabled;
        const changingUsername =
          hasUsername &&
          providedUsername !==
            normalizeUiAuthenticationUsername(currentAuthentication.username);
        const changingPassword = hasNewPassword;
        const requiresCurrentPasswordVerification =
          currentEnabledSettings &&
          (changingEnabledState || changingUsername || changingPassword);
        if (requiresCurrentPasswordVerification) {
          const currentPassword = hasCurrentPassword
            ? normalizePasswordInput(authenticationBody.currentPassword ?? "")
            : "";
          if (!currentPassword) {
            reply.code(400);
            return {
              error:
                "authentication.currentPassword is required to modify UI authentication settings.",
            };
          }
          const currentPasswordValid = await deps.auth.verifyCurrentPassword(
            currentPassword,
          );
          if (!currentPasswordValid) {
            reply.code(401);
            return {
              error: "Current password is incorrect.",
              code: "AUTH_INVALID_CURRENT_PASSWORD",
            };
          }
        }

        const nextUsername =
          providedUsername ??
          normalizeUiAuthenticationUsername(currentAuthentication.username);
        const nextPasswordHash = hasNewPassword
          ? await deps.auth.hashPassword(rawNewPassword)
          : normalizeUiAuthenticationPasswordHash(
              currentAuthentication.passwordHash,
            );
        if (parsedEnabled && (!nextUsername || !nextPasswordHash)) {
          reply.code(400);
          return {
            error:
              "authentication.username and authentication.password are required when enabling UI authentication.",
          };
        }

        nextAuthentication = {
          enabled: parsedEnabled,
          username: nextUsername,
          passwordHash: nextPasswordHash,
        };
      }

      const nextSettings: UiServerSettings = {
        taskCronEnabled: parsedTaskCronEnabled,
        notifyManagersOfInactiveAgents: parsedNotifyManagers,
        maxInactivityMinutes: parsedMaxInactivityMinutes,
        inactiveAgentNotificationTarget: parsedNotificationTarget,
        authentication: nextAuthentication,
      };
      await deps.updateSettings(nextSettings);

      const nextAuthResponse = deps.auth.getSettingsResponse();
      if (nextAuthResponse.enabled) {
        const currentAuthStatus = deps.auth.getStatusForRequest(request);
        let issuedSession = false;
        if (currentAuthStatus.authenticated) {
          const issued = deps.auth.issueSessionCookie(
            reply,
            request,
            nextAuthResponse.username,
          );
          if (!issued.ok) {
            reply.code(400);
            return {
              error:
                issued.error ??
                "Unable to establish an authentication session.",
              code: "AUTH_SESSION_ISSUE_FAILED",
            };
          }
          issuedSession = true;
        } else if (
          hasAuthenticationSetting &&
          normalizeUiAuthenticationUsername(
            request.body?.authentication?.username,
          ) === nextAuthResponse.username &&
          typeof request.body?.authentication?.password === "string" &&
          request.body.authentication.password.length > 0
        ) {
          const issued = deps.auth.issueSessionCookie(
            reply,
            request,
            nextAuthResponse.username,
          );
          if (!issued.ok) {
            reply.code(400);
            return {
              error:
                issued.error ??
                "Unable to establish an authentication session.",
              code: "AUTH_SESSION_ISSUE_FAILED",
            };
          }
          issuedSession = true;
        }
        if (!issuedSession) {
          reply.code(400);
          return {
            error:
              "Sign-in credentials are required when enabling UI authentication.",
            code: "AUTH_LOGIN_REQUIRED",
          };
        }
      }

      deps.logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message: `UI settings updated: taskCronEnabled=${nextSettings.taskCronEnabled} notifyManagersOfInactiveAgents=${nextSettings.notifyManagersOfInactiveAgents} maxInactivityMinutes=${nextSettings.maxInactivityMinutes} inactiveAgentNotificationTarget=${nextSettings.inactiveAgentNotificationTarget} authEnabled=${nextSettings.authentication.enabled}`,
      });
      return {
        settings: toPublicUiServerSettings(nextSettings, nextAuthResponse),
        message: `Task automation checks ${
          nextSettings.taskCronEnabled ? "enabled" : "disabled"
        } (runs every ${DEFAULT_TASK_CHECK_FREQUENCY_MINUTES} minute(s)). Inactive-agent manager notifications ${
          nextSettings.notifyManagersOfInactiveAgents
            ? "enabled"
            : "disabled"
        }; threshold ${nextSettings.maxInactivityMinutes} minute(s); audience ${nextSettings.inactiveAgentNotificationTarget}.`,
      };
    });
  });

  app.get("/api/version", async (_request, reply) => {
    return safeReply(reply, async () => {
      return {
        version: await deps.getVersionInfo()
      };
    });
  });

  app.get<{ Querystring: { limit?: string; follow?: string } }>("/api/logs/stream", async (request, reply) => {
    const limit = parseUiLogStreamLimit(request.query?.limit);
    const follow = parseUiLogStreamFollow(request.query?.follow);
    const raw = reply.raw;

    reply.hijack();
    raw.statusCode = 200;
    raw.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    raw.setHeader("Cache-Control", "no-cache, no-transform");
    raw.setHeader("Connection", "keep-alive");
    raw.setHeader("X-Accel-Buffering", "no");
    raw.flushHeaders?.();

    const writeEvent = (event: UiLogStreamEvent): void => {
      if (raw.destroyed || raw.writableEnded) {
        return;
      }
      raw.write(`${JSON.stringify(event)}\n`);
    };

    writeEvent({
      type: "snapshot",
      entries: deps.logs.listRecent(limit),
    });

    if (!follow) {
      if (!raw.destroyed && !raw.writableEnded) {
        raw.end();
      }
      return;
    }

    const unsubscribe = deps.logs.subscribe((entry) => {
      writeEvent({
        type: "log",
        entry,
      });
    });
    const heartbeat = setInterval(() => {
      writeEvent({
        type: "heartbeat",
        timestamp: new Date().toISOString(),
      });
    }, LOG_STREAM_HEARTBEAT_MS);
    heartbeat.unref?.();

    const cleanup = (): void => {
      unsubscribe();
      clearInterval(heartbeat);
      if (!raw.destroyed && !raw.writableEnded) {
        raw.end();
      }
    };

    raw.on("close", cleanup);
    raw.on("error", cleanup);
  });

  app.get("/api/openclaw/overview", async (_request, reply) => {
    return safeReply(reply, async () => {
      const agents = await resolveOrganizationAgents(service);

      return {
        agents,
        totals: {
          agents: agents.length
        }
      };
    });
  });

  app.get("/api/agents", async (_request, reply) => {
    return safeReply(reply, async () => {
      return {
        agents: await resolveOrganizationAgents(service)
      };
    });
  });

  app.post<{ Body: { name?: string; type?: "manager" | "individual"; reportsTo?: string | null; skills?: string[] | string; role?: string } }>(
    "/api/agents",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const name = request.body?.name?.trim();
        if (!name) {
          reply.code(400);
          return {
            error: "name is required"
          };
        }

        const skills = normalizeSkills(request.body?.skills);
        const createOptions: CreateAgentOptions = {
          type: request.body?.type,
          reportsTo: normalizeReportsTo(request.body?.reportsTo),
          skills
        };
        const role = normalizeRole(request.body?.role);
        if (role) {
          createOptions.role = role;
        }

        const created = await service.createAgent(name, createOptions);

        return {
          agent: created.agent,
          created,
          message: created.alreadyExisted
            ? `Agent \"${created.agent.id}\" already exists.`
            : `Agent \"${created.agent.id}\" created.`
        };
      });
    }
  );

  app.delete<{ Params: { agentId: string }; Querystring: { force?: string } }>("/api/agents/:agentId", async (request, reply) => {
    return safeReply(reply, async () => {
      const force = request.query.force === "1" || request.query.force === "true";
      const removed = await service.deleteAgent(request.params.agentId, { force } satisfies DeleteAgentOptions);
      return {
        removed
      };
    });
  });

  app.get<{ Querystring: { agentId?: string } }>("/api/sessions", async (request, reply) => {
    return safeReply(reply, async () => {
      const agentId = request.query.agentId?.trim() || DEFAULT_AGENT_ID;
      return {
        agentId,
        sessions: await service.listSessions(agentId)
      };
    });
  });

  const handleSessionHistory = async (
    request: {
      query: {
        agentId?: string;
        sessionRef?: string;
        limit?: string;
      };
    },
    reply: FastifyReply
  ): Promise<unknown> => {
    return safeReply(reply, async () => {
      const agentId = request.query.agentId?.trim() || DEFAULT_AGENT_ID;
      const sessionRef = request.query.sessionRef?.trim();
      if (!sessionRef) {
        reply.code(400);
        return {
          error: "sessionRef is required"
        };
      }

      const rawLimit = request.query.limit?.trim();
      const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
      const limit = typeof parsedLimit === "number" && Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;

      const history = await getUiSessionHistory(service, agentId, {
        sessionRef,
        limit
      });
      const sanitizedHistory: SessionHistoryResult = {
        ...history,
        messages: history.messages.map((item) => {
          if (item.type !== "message") {
            return item;
          }
          return {
            ...item,
            content: sanitizeConversationText(item.content)
          };
        })
      };

      return {
        agentId,
        sessionRef: sanitizedHistory.sessionKey,
        history: sanitizedHistory
      };
    });
  };

  app.get<{ Querystring: { agentId?: string; sessionRef?: string; limit?: string } }>("/api/sessions/history", handleSessionHistory);
  app.get<{ Querystring: { agentId?: string; sessionRef?: string; limit?: string } }>("/api/session/history", handleSessionHistory);

  app.get<{ Querystring: { agentId?: string; global?: string } }>("/api/skills", async (request, reply) => {
    return safeReply(reply, async () => {
      const global = request.query.global === "1" || request.query.global === "true";
      if (global) {
        return {
          scope: "global",
          skills: await service.listGlobalSkills()
        };
      }

      const agentId = request.query.agentId?.trim() || DEFAULT_AGENT_ID;
      return {
        scope: "agent",
        agentId,
        skills: await service.listSkills(agentId)
      };
    });
  });

  app.get<{ Querystring: { assignee?: string; limit?: string } }>(
    "/api/tasks",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const assignee = request.query.assignee?.trim();
        const rawLimit = request.query.limit?.trim();
        const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
        const limit = Number.isFinite(parsedLimit) && (parsedLimit ?? 0) > 0 ? parsedLimit : undefined;
        const tasks = await listUiTasks(service, {
          assignee,
          limit
        });
        return {
          tasks
        };
      });
    }
  );

  app.post<{
    Body: {
      actorId?: string;
      title?: string;
      description?: string;
      project?: string;
      assignedTo?: string;
      status?: string;
    };
  }>("/api/tasks", async (request, reply) => {
    return safeReply(reply, async () => {
      const actorId = request.body?.actorId?.trim() || DEFAULT_AGENT_ID;
      const title = request.body?.title?.trim();
      const description = request.body?.description?.trim();
      const project = request.body?.project?.trim();
      const assignedTo = request.body?.assignedTo?.trim();
      const status = request.body?.status?.trim();

      if (!title) {
        reply.code(400);
        return {
          error: "title is required"
        };
      }
      if (!description) {
        reply.code(400);
        return {
          error: "description is required"
        };
      }

      const task = await createUiTask(service, actorId, {
        title,
        description,
        project,
        assignedTo,
        status
      });
      return {
        task,
        message: `Task \"${task.title}\" created.`
      };
    });
  });

  const deleteTasksHandler = async (
    request: {
      body?: {
        actorId?: string;
        taskIds?: unknown;
      };
    },
    reply: FastifyReply
  ): Promise<
    { error: string } | { deletedTaskIds: string[]; deletedCount: number; message: string }
  > => {
    return safeReply(reply, async () => {
      const actorId = request.body?.actorId?.trim() || DEFAULT_AGENT_ID;
      const rawTaskIds = Array.isArray(request.body?.taskIds)
        ? request.body.taskIds
        : [];
      const taskIds = [...new Set(rawTaskIds)]
        .filter((taskId): taskId is string => typeof taskId === "string")
        .map((taskId) => taskId.trim())
        .filter((taskId) => taskId.length > 0);

      if (taskIds.length === 0) {
        reply.code(400);
        return {
          error: "taskIds must be a non-empty array"
        };
      }

      const result = await deleteUiTasks(service, actorId, taskIds);
      return {
        ...result,
        message: `Deleted ${result.deletedCount} task${result.deletedCount === 1 ? "" : "s"}.`
      };
    });
  };

  app.delete<{
    Body: {
      actorId?: string;
      taskIds?: unknown;
    };
  }>("/api/tasks", deleteTasksHandler);

  app.post<{
    Body: {
      actorId?: string;
      taskIds?: unknown;
    };
  }>("/api/tasks/delete", deleteTasksHandler);

  app.post<{ Params: { taskId: string }; Body: { actorId?: string; status?: string; reason?: string } }>(
    "/api/tasks/:taskId/status",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const actorId = request.body?.actorId?.trim() || DEFAULT_AGENT_ID;
        const taskId = request.params.taskId?.trim();
        const status = request.body?.status?.trim();
        const reason = request.body?.reason?.trim();
        if (!taskId) {
          reply.code(400);
          return {
            error: "taskId is required"
          };
        }
        if (!status) {
          reply.code(400);
          return {
            error: "status is required"
          };
        }

        const task = await updateUiTaskStatus(service, actorId, taskId, status, reason);
        return {
          task,
          message: `Task \"${task.taskId}\" updated.`
        };
      });
    }
  );

  app.post<{ Params: { taskId: string }; Body: { actorId?: string; content?: string } }>(
    "/api/tasks/:taskId/blocker",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const actorId = request.body?.actorId?.trim() || DEFAULT_AGENT_ID;
        const taskId = request.params.taskId?.trim();
        const content = request.body?.content?.trim();
        if (!taskId) {
          reply.code(400);
          return {
            error: "taskId is required"
          };
        }
        if (!content) {
          reply.code(400);
          return {
            error: "content is required"
          };
        }

        const task = await addUiTaskBlocker(service, actorId, taskId, content);
        return {
          task,
          message: `Blocker added to \"${task.taskId}\".`
        };
      });
    }
  );

  app.post<{ Params: { taskId: string }; Body: { actorId?: string; content?: string } }>(
    "/api/tasks/:taskId/artifact",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const actorId = request.body?.actorId?.trim() || DEFAULT_AGENT_ID;
        const taskId = request.params.taskId?.trim();
        const content = request.body?.content?.trim();
        if (!taskId) {
          reply.code(400);
          return {
            error: "taskId is required"
          };
        }
        if (!content) {
          reply.code(400);
          return {
            error: "content is required"
          };
        }

        const task = await addUiTaskArtifact(service, actorId, taskId, content);
        return {
          task,
          message: `Artifact added to \"${task.taskId}\".`
        };
      });
    }
  );

  app.post<{ Params: { taskId: string }; Body: { actorId?: string; content?: string } }>(
    "/api/tasks/:taskId/worklog",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const actorId = request.body?.actorId?.trim() || DEFAULT_AGENT_ID;
        const taskId = request.params.taskId?.trim();
        const content = request.body?.content?.trim();
        if (!taskId) {
          reply.code(400);
          return {
            error: "taskId is required"
          };
        }
        if (!content) {
          reply.code(400);
          return {
            error: "content is required"
          };
        }

        const task = await addUiTaskWorklog(service, actorId, taskId, content);
        return {
          task,
          message: `Worklog added to \"${task.taskId}\".`
        };
      });
    }
  );

  app.post<{ Body: { agentId?: string; folderName?: string; folderPath?: string } }>("/api/projects", async (request, reply) => {
    return safeReply(reply, async () => {
      const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
      const project = await resolveProjectFolder(request.body?.folderName, request.body?.folderPath);
      const projectSessionRef = buildProjectSessionRef(project.name, project.path);
      await prepareProjectSession(service, agentId, {
        sessionRef: projectSessionRef,
        projectPath: project.path,
        forceNew: false
      });
      await renameUiSession(service, agentId, project.name, projectSessionRef);

      const workspaceSessionRef = buildWorkspaceSessionRef(project.name, project.path);
      const prepared = await prepareProjectSession(service, agentId, {
        sessionRef: workspaceSessionRef,
        projectPath: project.path,
        forceNew: true
      });
      await renameUiSession(service, agentId, resolveDefaultWorkspaceSessionTitle(), workspaceSessionRef);

      return {
        agentId,
        project: {
          name: project.name,
          path: project.path,
          sessionRef: projectSessionRef
        },
        session: prepared,
        message: `Project \"${project.name}\" added and session created.`
      };
    });
  });

  app.post("/api/projects/pick", async (_request, reply) => {
    return safeReply(reply, async () => {
      const project = await pickProjectFolderFromSystem();
      return {
        project
      };
    });
  });

  app.post<{ Body: { agentId?: string; projectPath?: string; workspaceName?: string } }>(
    "/api/workspaces/session",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
        const projectPath = request.body?.projectPath?.trim();
        if (!projectPath) {
          reply.code(400);
          return {
            error: "projectPath is required"
          };
        }

        const resolvedProjectPath = resolveAbsolutePath(projectPath);
        const stats = await stat(resolvedProjectPath).catch(() => {
          return null;
        });
        if (!stats || !stats.isDirectory()) {
          throw new Error(`Workspace path is not a directory: ${resolvedProjectPath}`);
        }

        const workspaceName = request.body?.workspaceName?.trim() || path.basename(resolvedProjectPath);
        const sessionRef = buildWorkspaceSessionRef(workspaceName, resolvedProjectPath);
        const prepared = await prepareProjectSession(service, agentId, {
          sessionRef,
          projectPath: resolvedProjectPath,
          forceNew: true
        });

        const summary = await renameUiSession(service, agentId, resolveDefaultWorkspaceSessionTitle(), sessionRef);

        return {
          agentId,
          session: prepared,
          summary,
          message: `Session created in \"${workspaceName}\".`
        };
      });
    }
  );

  app.post<{ Body: { agentId?: string; sessionRef?: string; name?: string } }>("/api/workspaces/rename", async (request, reply) => {
    return safeReply(reply, async () => {
      const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
      const sessionRef = request.body?.sessionRef?.trim();
      const name = request.body?.name?.trim();
      if (!sessionRef) {
        reply.code(400);
        return {
          error: "sessionRef is required"
        };
      }
      if (!name) {
        reply.code(400);
        return {
          error: "name is required"
        };
      }

      const renamed = await renameUiSession(service, agentId, name, sessionRef);
      return {
        agentId,
        workspace: {
          name: renamed.title,
          sessionRef
        },
        message: `Workspace renamed to \"${renamed.title}\".`
      };
    });
  });

  app.post<{ Body: { agentId?: string; sessionRef?: string } }>("/api/workspaces/delete", async (request, reply) => {
    return safeReply(reply, async () => {
      const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
      const sessionRef = request.body?.sessionRef?.trim();
      if (!sessionRef) {
        reply.code(400);
        return {
          error: "sessionRef is required"
        };
      }

      const removed = await removeUiSession(service, agentId, sessionRef);

      return {
        agentId,
        removedWorkspace: {
          sessionRef: removed.sessionKey
        },
        message: "Workspace removed."
      };
    });
  });

  app.post<{ Body: { agentId?: string; sessionRef?: string } }>("/api/sessions/remove", async (request, reply) => {
    return safeReply(reply, async () => {
      const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
      const sessionRef = request.body?.sessionRef?.trim();
      if (!sessionRef) {
        reply.code(400);
        return {
          error: "sessionRef is required"
        };
      }

      const removed = await removeUiSession(service, agentId, sessionRef);
      return {
        agentId,
        removedSession: {
          sessionRef: removed.sessionKey
        },
        message: "Session removed."
      };
    });
  });

  app.post<{ Body: { agentId?: string; sessionRef?: string; name?: string } }>("/api/sessions/rename", async (request, reply) => {
    return safeReply(reply, async () => {
      const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
      const sessionRef = request.body?.sessionRef?.trim();
      const name = request.body?.name?.trim();
      if (!sessionRef) {
        reply.code(400);
        return {
          error: "sessionRef is required"
        };
      }
      if (!name) {
        reply.code(400);
        return {
          error: "name is required"
        };
      }

      const renamed = await renameUiSession(service, agentId, name, sessionRef);
      return {
        agentId,
        session: {
          name: renamed.title,
          sessionRef
        },
        message: `Session renamed to \"${renamed.title}\".`
      };
    });
  });

  const handleSessionMessage = async (
    request: {
      body?: {
        agentId?: string;
        sessionRef?: string;
        projectPath?: string;
        message?: string;
        images?: UiImageInput[];
      };
    },
    reply: FastifyReply
  ): Promise<unknown> => {
    return safeReply(reply, async () => {
      const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
      const sessionRef = request.body?.sessionRef?.trim();
      const message = request.body?.message?.trim();
      const images = normalizeUiImages(request.body?.images);

      if (!sessionRef) {
        reply.code(400);
        return {
          error: "sessionRef is required"
        };
      }

      if (!message && images.length === 0) {
        reply.code(400);
        return {
          error: "message or image is required"
        };
      }

      const projectPath = await resolveSessionProjectPathForRequest(
        service,
        agentId,
        sessionRef,
        request.body?.projectPath
      );

      deps.logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message: `Session message request queued for @${agentId} (session=${sessionRef}).`,
      });

      const result = await runUiSessionMessage(service, agentId, {
        sessionRef,
        projectPath,
        message:
          message ||
          (images.length === 1
            ? "Please analyze the attached image."
            : "Please analyze the attached images."),
        images: images.length > 0 ? images : undefined,
        hooks: {
          onEvent: (event) => {
            deps.logs.append({
              timestamp: event.timestamp || new Date().toISOString(),
              level:
                event.stage === "provider_invocation_completed" &&
                typeof event.code === "number" &&
                event.code !== 0
                  ? "warn"
                  : "info",
              source: "opengoat",
              message: formatRunStatusMessage(event),
            });
          },
        },
      });

      const output = sanitizeConversationText(result.stdout.trim() || result.stderr.trim());
      deps.logs.append({
        timestamp: new Date().toISOString(),
        level: result.code === 0 ? "info" : "warn",
        source: "opengoat",
        message:
          result.code === 0
            ? `Session message completed for @${agentId} (session=${sessionRef}).`
            : `Session message completed with code ${result.code} for @${agentId} (session=${sessionRef}).`,
      });

      return {
        agentId,
        sessionRef,
        output,
        result: {
          code: result.code,
          stdout: result.stdout,
          stderr: result.stderr
        },
        message: result.code === 0 ? "Message sent." : "Message completed with non-zero exit code."
      };
    });
  };

  app.post<{
    Body: { agentId?: string; sessionRef?: string; projectPath?: string; message?: string; images?: UiImageInput[] };
  }>(
    "/api/sessions/message",
    handleSessionMessage
  );
  app.post<{
    Body: { agentId?: string; sessionRef?: string; projectPath?: string; message?: string; images?: UiImageInput[] };
  }>(
    "/api/session/message",
    handleSessionMessage
  );

  const handleSessionMessageStream = async (
    request: {
      body?: {
        agentId?: string;
        sessionRef?: string;
        projectPath?: string;
        message?: string;
        images?: UiImageInput[];
      };
    },
    reply: FastifyReply
  ): Promise<void> => {
    const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
    const sessionRef = request.body?.sessionRef?.trim();
    const message = request.body?.message?.trim();
    const images = normalizeUiImages(request.body?.images);

    if (!sessionRef) {
      reply.code(400).send({ error: "sessionRef is required" });
      return;
    }

    if (!message && images.length === 0) {
      reply.code(400).send({ error: "message or image is required" });
      return;
    }

    let projectPath: string | undefined;
    try {
      projectPath = await resolveSessionProjectPathForRequest(
        service,
        agentId,
        sessionRef,
        request.body?.projectPath
      );
    } catch (error) {
      const streamError =
        error instanceof Error ? error.message : "Unexpected server error";
      reply.code(500).send({ error: streamError });
      return;
    }

    const raw = reply.raw;
    reply.hijack();
    raw.statusCode = 200;
    raw.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    raw.setHeader("Cache-Control", "no-cache, no-transform");
    raw.setHeader("Connection", "keep-alive");
    raw.setHeader("X-Accel-Buffering", "no");
    raw.flushHeaders?.();

    const writeEvent = (event: SessionMessageStreamEvent): void => {
      if (raw.destroyed || raw.writableEnded) {
        return;
      }
      raw.write(`${JSON.stringify(event)}\n`);
    };

    const startedAtMs = Date.now();
    let runtimeRunId: string | undefined;
    let fallbackRuntimeRunId: string | undefined;
    let logCursor: number | undefined;
    let logPoller: NodeJS.Timeout | undefined;
    let telemetryWarningEmitted = false;
    let pollRuntimeLogs: (() => Promise<void>) | undefined;
    const seenRuntimeLogMessages = new Set<string>();

    const writeProgress = (
      phase: SessionMessageProgressPhase,
      progressMessage: string,
    ): void => {
      writeEvent({
        type: "progress",
        phase,
        timestamp: new Date().toISOString(),
        message: progressMessage,
      });
    };

    deps.logs.append({
      timestamp: new Date().toISOString(),
      level: "info",
      source: "opengoat",
      message: `Streaming session message request queued for @${agentId} (session=${sessionRef}).`,
    });

    const startRuntimeLogPolling = async (runId: string): Promise<void> => {
      runtimeRunId = runId;
      if (typeof service.getOpenClawGatewayConfig !== "function") {
        return;
      }

      let inFlight = false;
      const poll = async (): Promise<void> => {
        const primaryRunId = runtimeRunId;
        if (inFlight || !primaryRunId) {
          return;
        }
        inFlight = true;
        try {
          const tailed = await fetchOpenClawGatewayLogTail(service, {
            cursor: logCursor,
            limit: 200,
            maxBytes: 250000,
          });
          logCursor = tailed.cursor;
          const extracted = extractRuntimeActivityFromLogLines(tailed.lines, {
            primaryRunId,
            fallbackRunId: fallbackRuntimeRunId,
            startedAtMs,
          });
          if (!fallbackRuntimeRunId && extracted.nextFallbackRunId) {
            fallbackRuntimeRunId = extracted.nextFallbackRunId;
          }
          for (const activity of extracted.activities) {
            const dedupeKey = `${activity.level}:${activity.message}`;
            if (seenRuntimeLogMessages.has(dedupeKey)) {
              continue;
            }
            seenRuntimeLogMessages.add(dedupeKey);
            if (seenRuntimeLogMessages.size > 600) {
              const first = seenRuntimeLogMessages.values().next().value;
              if (first) {
                seenRuntimeLogMessages.delete(first);
              }
            }
            writeProgress(activity.level, activity.message);
          }
        } catch (error) {
          if (!telemetryWarningEmitted) {
            telemetryWarningEmitted = true;
            const details =
              error instanceof Error ? error.message.toLowerCase() : "";
            writeProgress(
              "stderr",
              details.includes("enoent")
                ? "Live activity is unavailable in this environment."
                : "Live activity stream is temporarily unavailable.",
            );
            deps.logs.append({
              timestamp: new Date().toISOString(),
              level: "warn",
              source: "opengoat",
              message: details.includes("enoent")
                ? "Live OpenClaw activity is unavailable in this environment."
                : "Live OpenClaw activity stream is temporarily unavailable.",
            });
          }
        } finally {
          inFlight = false;
        }
      };

      pollRuntimeLogs = poll;
      void poll();
      logPoller = setInterval(() => {
        void poll();
      }, 900);
    };

    const emitRuntimeChunk = (phase: "stdout" | "stderr", chunk: string): void => {
      const cleaned = sanitizeRuntimeProgressChunk(chunk);
      if (!cleaned) {
        return;
      }

      const lines = cleaned
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) {
        return;
      }

      const limit = 6;
      for (const line of lines.slice(0, limit)) {
        writeProgress(phase, truncateProgressLine(line));
      }
      if (lines.length > limit) {
        writeProgress(phase, `... ${lines.length - limit} more line(s)`);
      }
    };

    try {
      const result = await runUiSessionMessage(service, agentId, {
        sessionRef,
        projectPath,
        message:
          message ||
          (images.length === 1
            ? "Please analyze the attached image."
            : "Please analyze the attached images."),
        images: images.length > 0 ? images : undefined,
        hooks: {
          onEvent: (event) => {
            deps.logs.append({
              timestamp: event.timestamp || new Date().toISOString(),
              level:
                event.stage === "provider_invocation_completed" &&
                typeof event.code === "number" &&
                event.code !== 0
                  ? "warn"
                  : "info",
              source: "opengoat",
              message: formatRunStatusMessage(event),
            });
            const phase = mapRunStageToProgressPhase(event.stage);
            writeProgress(phase, formatRunStatusMessage(event));
            if (
              (event.stage === "run_started" ||
                event.stage === "provider_invocation_started") &&
              event.runId &&
              !logPoller
            ) {
              void startRuntimeLogPolling(event.runId);
            }
          },
        },
        onStderr: (chunk) => {
          emitRuntimeChunk("stderr", chunk);
        },
      });

      const output = sanitizeConversationText(
        result.stdout.trim() || result.stderr.trim(),
      );
      writeEvent({
        type: "result",
        agentId,
        sessionRef,
        output,
        result: {
          code: result.code,
          stdout: result.stdout,
          stderr: result.stderr,
        },
        message:
          result.code === 0
            ? "Message sent."
            : "Message completed with non-zero exit code.",
      });
      deps.logs.append({
        timestamp: new Date().toISOString(),
        level: result.code === 0 ? "info" : "warn",
        source: "opengoat",
        message:
          result.code === 0
            ? `Streaming session message completed for @${agentId} (session=${sessionRef}).`
            : `Streaming session message completed with code ${result.code} for @${agentId} (session=${sessionRef}).`,
      });
    } catch (error) {
      const streamError =
        error instanceof Error ? error.message : "Unexpected server error";
      deps.logs.append({
        timestamp: new Date().toISOString(),
        level: "error",
        source: "opengoat",
        message: `Streaming session message failed for @${agentId} (session=${sessionRef}): ${streamError}`,
      });
      writeEvent({
        type: "error",
        timestamp: new Date().toISOString(),
        error: streamError,
      });
    } finally {
      if (logPoller) {
        clearInterval(logPoller);
      }
      if (pollRuntimeLogs) {
        try {
          await pollRuntimeLogs();
        } catch {
          // Best-effort final flush.
        }
      }
      if (!raw.destroyed && !raw.writableEnded) {
        raw.end();
      }
    }
  };

  app.post<{
    Body: { agentId?: string; sessionRef?: string; projectPath?: string; message?: string; images?: UiImageInput[] };
  }>(
    "/api/sessions/message/stream",
    handleSessionMessageStream
  );
  app.post<{
    Body: { agentId?: string; sessionRef?: string; projectPath?: string; message?: string; images?: UiImageInput[] };
  }>(
    "/api/session/message/stream",
    handleSessionMessageStream
  );

}

interface FrontendOptions {
  packageRoot: string;
  mode: "development" | "production";
}

async function registerFrontend(app: FastifyInstance, options: FrontendOptions): Promise<void> {
  const indexPath = path.resolve(options.packageRoot, "index.html");

  if (options.mode === "development") {
    await app.register(middie);

    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: options.packageRoot,
      appType: "custom",
      server: {
        middlewareMode: true
      }
    });

    app.use(vite.middlewares);
    app.addHook("onClose", async () => {
      await vite.close();
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "Not Found" });
      }

      const template = await readFile(indexPath, "utf8");
      const html = await vite.transformIndexHtml(request.raw.url ?? "/", template);
      return reply.type("text/html").send(html);
    });

    return;
  }

  const clientDist = path.resolve(options.packageRoot, "dist/client");
  await app.register(fastifyStatic, {
    root: clientDist,
    prefix: "/",
    decorateReply: false
  });

  const staticIndexPath = path.resolve(clientDist, "index.html");
  const fallbackTemplate = existsSync(staticIndexPath)
    ? await readFile(staticIndexPath, "utf8")
    : "<!doctype html><html><body><h1>OpenGoat UI build not found</h1></body></html>";

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "Not Found" });
    }
    return reply.type("text/html").send(fallbackTemplate);
  });
}

function resolveMode(): "development" | "production" {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

function createVersionInfoProvider(): () => Promise<UiVersionInfo> {
  let cached: UiVersionInfo | null = null;
  let expiresAt = 0;
  let pending: Promise<UiVersionInfo> | null = null;

  return async () => {
    const now = Date.now();
    if (cached && now < expiresAt) {
      return cached;
    }

    if (pending) {
      return pending;
    }

    pending = (async () => {
      const installedVersion = resolveInstalledVersion();
      let latestVersion: string | null = null;
      let unpublished = false;
      let error: string | undefined;

      try {
        latestVersion = await fetchLatestPackageVersion(OPENGOAT_PACKAGE_NAME);
      } catch (fetchError) {
        if (fetchError instanceof NpmPackageNotFoundError) {
          unpublished = true;
        } else {
          error = fetchError instanceof Error ? fetchError.message : String(fetchError);
        }
      }

      const status = resolveVersionStatus(installedVersion, latestVersion, unpublished);
      const next: UiVersionInfo = {
        packageName: OPENGOAT_PACKAGE_NAME,
        installedVersion,
        latestVersion,
        updateAvailable: status.updateAvailable,
        status: status.status,
        checkedAt: new Date().toISOString(),
        error
      };

      cached = next;
      expiresAt = Date.now() + VERSION_CACHE_TTL_MS;
      return next;
    })();

    try {
      return await pending;
    } finally {
      pending = null;
    }
  };
}

function resolveInstalledVersion(): string | null {
  const envVersion = normalizeVersion(process.env.OPENGOAT_VERSION);
  if (envVersion) {
    return envVersion;
  }

  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);

  const candidates = dedupePathEntries([
    path.resolve(process.cwd(), "packages", "cli", "package.json"),
    path.resolve(currentDir, "../../../../packages/cli/package.json"),
    path.resolve(currentDir, "../../../../../packages/cli/package.json"),
    path.resolve(process.cwd(), "package.json"),
    path.resolve(currentDir, "../../../../package.json"),
    path.resolve(currentDir, "../../../../../package.json")
  ]);

  for (const packageJsonPath of candidates) {
    const version = readOpengoatPackageVersion(packageJsonPath);
    if (version) {
      return version;
    }
  }

  for (const packageJsonPath of candidates) {
    const version = readAnyPackageVersion(packageJsonPath);
    if (version) {
      return version;
    }
  }

  return null;
}

function readOpengoatPackageVersion(packageJsonPath: string): string | null {
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const raw = readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as {
      name?: string;
      version?: string;
      bin?: Record<string, unknown>;
    };
    const isCliPackage =
      parsed.name === OPENGOAT_PACKAGE_NAME ||
      parsed.name === "@opengoat/cli" ||
      Boolean(parsed.bin && typeof parsed.bin === "object" && "opengoat" in parsed.bin);
    if (!isCliPackage) {
      return null;
    }
    return normalizeVersion(parsed.version) ?? null;
  } catch {
    return null;
  }
}

function readAnyPackageVersion(packageJsonPath: string): string | null {
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const raw = readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as {
      version?: string;
    };
    return normalizeVersion(parsed.version) ?? null;
  } catch {
    return null;
  }
}

function normalizeVersion(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveVersionStatus(
  installedVersion: string | null,
  latestVersion: string | null,
  unpublished: boolean
): { updateAvailable: boolean | null; status: UiVersionInfo["status"] } {
  if (unpublished) {
    return {
      updateAvailable: null,
      status: "unpublished"
    };
  }

  if (!installedVersion || !latestVersion) {
    return {
      updateAvailable: null,
      status: "unknown"
    };
  }

  const comparison = compareVersionStrings(latestVersion, installedVersion);
  if (comparison > 0) {
    return {
      updateAvailable: true,
      status: "update-available"
    };
  }

  return {
    updateAvailable: false,
    status: "latest"
  };
}

async function fetchLatestPackageVersion(packageName: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, VERSION_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
      {
        method: "GET",
        headers: {
          accept: "application/json"
        },
        signal: controller.signal
      }
    );

    if (response.status === 404) {
      throw new NpmPackageNotFoundError(`${packageName} is not published on npm yet.`);
    }

    if (!response.ok) {
      throw new Error("Unable to check npm registry for updates.");
    }

    const payload = (await response.json()) as {
      version?: string;
    };
    const version = normalizeVersion(payload.version);
    if (!version) {
      throw new Error("npm registry response did not include a version.");
    }
    return version;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timed out while checking npm for updates.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

class NpmPackageNotFoundError extends Error {}

function compareVersionStrings(left: string, right: string): number {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue > rightValue) {
      return 1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

function parseVersionParts(version: string): number[] {
  return version
    .split(".")
    .map((segment) => Number.parseInt(segment, 10))
    .filter((segment) => Number.isFinite(segment) && segment >= 0);
}

function resolvePackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return path.resolve(currentDir, "../..");
}

function normalizeReportsTo(value: string | null | undefined): string | null | undefined {
  if (value === null) {
    return null;
  }

  const normalized = value?.trim();
  if (!normalized || normalized.toLowerCase() === "none") {
    return undefined;
  }

  return normalized;
}

function normalizeSkills(value: string[] | string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => item.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : undefined;
}

function normalizeRole(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function sanitizeConversationText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withoutAnsi = stripAnsiCodes(trimmed)
    .replace(/\[(?:\d{1,3};)*\d{1,3}m/g, "")
    .replace(/(?:^|\s)(?:\d{1,3};)*\d{1,3}m(?=\s|$)/g, " ")
    .replace(/\r\n?/g, "\n");

  const withoutPrefix = withoutAnsi
    .replace(/^\s*\[agents\/[^\]\n]+\]\s*/iu, "")
    .replace(/^\s*inherited\s+[^\n]*?\s+from\s+main\s+agent\s*/iu, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return withoutPrefix || trimmed;
}

function stripAnsiCodes(value: string): string {
  return value.replace(
    /[\u001B\u009B][[\]()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-ORZcf-ntqry=><]/g,
    ""
  );
}

function sanitizeRuntimeProgressChunk(value: string): string {
  return stripAnsiCodes(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function truncateProgressLine(value: string): string {
  const maxLength = 260;
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}

function mapRunStageToProgressPhase(stage: UiRunEvent["stage"]): SessionMessageProgressPhase {
  switch (stage) {
    case "run_started":
      return "run_started";
    case "provider_invocation_started":
      return "provider_invocation_started";
    case "provider_invocation_completed":
      return "provider_invocation_completed";
    case "run_completed":
      return "run_completed";
    default:
      return "stdout";
  }
}

function formatRunStatusMessage(event: UiRunEvent): string {
  switch (event.stage) {
    case "run_started":
      return `Starting @${event.agentId ?? DEFAULT_AGENT_ID}.`;
    case "provider_invocation_started":
      return "Sending request to OpenClaw.";
    case "provider_invocation_completed":
      return typeof event.code === "number" && event.code !== 0
        ? `Provider finished with code ${event.code}.`
        : "Provider returned a response.";
    case "run_completed":
      return "Run completed.";
    default:
      return "Runtime update.";
  }
}

interface OpenClawGatewayLogTail {
  cursor: number;
  lines: string[];
  reset: boolean;
}

export interface RuntimeLogExtractionOptions {
  primaryRunId: string;
  fallbackRunId?: string;
  startedAtMs: number;
}

export interface RuntimeLogExtractionResult {
  activities: Array<{ level: "stdout" | "stderr"; message: string }>;
  nextFallbackRunId?: string;
}

interface ParsedRuntimeLogLine {
  message: string;
  runId?: string;
  logLevel: string;
  timestampMs?: number;
}

async function fetchOpenClawGatewayLogTail(
  service: OpenClawUiService,
  params: {
    cursor?: number;
    limit: number;
    maxBytes: number;
  }
): Promise<OpenClawGatewayLogTail> {
  if (typeof service.getOpenClawGatewayConfig !== "function") {
    throw new Error("Gateway config lookup is unavailable.");
  }

  const gatewayConfig = await service.getOpenClawGatewayConfig();
  const args = [
    "gateway",
    "call",
    "logs.tail",
    "--json",
    "--timeout",
    "5000",
    "--params",
    JSON.stringify({
      ...(typeof params.cursor === "number" ? { cursor: params.cursor } : {}),
      limit: params.limit,
      maxBytes: params.maxBytes
    })
  ];

  if (
    gatewayConfig.mode === "external" &&
    gatewayConfig.gatewayUrl?.trim() &&
    gatewayConfig.gatewayToken?.trim()
  ) {
    args.push(
      "--url",
      gatewayConfig.gatewayUrl.trim(),
      "--token",
      gatewayConfig.gatewayToken.trim()
    );
  }

  const command =
    gatewayConfig.command?.trim() || process.env.OPENCLAW_CMD?.trim() || "openclaw";
  const env = buildOpenClawExecutionEnv(process.env);
  const { stdout } = await execFileAsync(command, args, {
    timeout: 6000,
    env
  });
  const parsed = parseCommandJson(stdout);
  const payload = resolveCommandPayload(parsed);
  const cursorValue =
    typeof payload?.cursor === "number" && Number.isFinite(payload.cursor)
      ? payload.cursor
      : 0;
  const lines = Array.isArray(payload?.lines)
    ? payload.lines.filter((entry): entry is string => typeof entry === "string")
    : [];
  const reset = payload?.reset === true;

  return {
    cursor: cursorValue,
    lines,
    reset
  };
}

function resolveCommandPayload(
  parsed: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!parsed) {
    return null;
  }

  const result = parsed.result;
  if (result && typeof result === "object") {
    return result as Record<string, unknown>;
  }

  return parsed;
}

function parseCommandJson(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line?.startsWith("{") || !line.endsWith("}")) {
      continue;
    }
    try {
      const parsed = JSON.parse(line) as unknown;
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // keep scanning
    }
  }

  return null;
}

function resolveUiLogMessageFromGatewayLine(
  parsed: Record<string, unknown> | null,
  fallbackLine: string,
): string | null {
  if (!parsed) {
    const cleaned = sanitizeRuntimeProgressChunk(fallbackLine);
    return cleaned || null;
  }

  const preferredCandidates = [
    parsed["1"],
    parsed.message,
    parsed["0"],
  ];
  for (const candidate of preferredCandidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    const cleaned = sanitizeRuntimeProgressChunk(candidate);
    if (cleaned) {
      return cleaned;
    }
  }

  const serialized = sanitizeRuntimeProgressChunk(JSON.stringify(parsed));
  return serialized || null;
}

function resolveUiLogTimestamp(parsed: Record<string, unknown> | null): string {
  const timeRaw = parsed?.time;
  if (
    typeof timeRaw === "string" &&
    Number.isFinite(Date.parse(timeRaw))
  ) {
    return new Date(timeRaw).toISOString();
  }
  return new Date().toISOString();
}

function resolveUiLogLevel(parsed: Record<string, unknown> | null): UiLogLevel {
  const meta = parsed?._meta;
  const levelFromMeta =
    meta &&
    typeof meta === "object" &&
    typeof (meta as Record<string, unknown>).logLevelName === "string"
      ? (meta as Record<string, unknown>).logLevelName
      : undefined;
  const levelText =
    typeof levelFromMeta === "string"
      ? levelFromMeta
      : typeof parsed?.level === "string"
        ? parsed.level
        : "";
  const normalized = levelText.trim().toLowerCase();
  if (normalized === "error" || normalized === "fatal") {
    return "error";
  }
  if (normalized === "warn" || normalized === "warning") {
    return "warn";
  }
  return "info";
}

export function extractRuntimeActivityFromLogLines(
  lines: string[],
  options: RuntimeLogExtractionOptions
): RuntimeLogExtractionResult {
  const primaryRunId = options.primaryRunId.trim();
  if (!primaryRunId) {
    return {
      activities: []
    };
  }

  const fallbackRunId = options.fallbackRunId?.trim();
  const activities: Array<{ level: "stdout" | "stderr"; message: string }> = [];
  let nextFallbackRunId: string | undefined;

  for (const line of lines) {
    const parsed = parseRuntimeLogLine(line);
    if (!parsed) {
      continue;
    }

    const matchesPrimaryRun =
      parsed.runId === primaryRunId || parsed.message.includes(primaryRunId);
    const boundFallbackRunId = fallbackRunId || nextFallbackRunId;
    const matchesFallbackRun = Boolean(
      boundFallbackRunId &&
        (parsed.runId === boundFallbackRunId ||
          parsed.message.includes(boundFallbackRunId)),
    );

    const activeFallback = boundFallbackRunId;
    const shouldAdoptFallback =
      !matchesPrimaryRun &&
      !matchesFallbackRun &&
      !activeFallback &&
      isEmbeddedRunStartMessage(parsed.message) &&
      Boolean(parsed.runId) &&
      isRecentRuntimeLog(parsed.timestampMs, options.startedAtMs);

    if (shouldAdoptFallback) {
      nextFallbackRunId = parsed.runId;
    }

    const matchesRun = matchesPrimaryRun || matchesFallbackRun || shouldAdoptFallback;
    const hasBoundRun = matchesPrimaryRun || matchesFallbackRun || Boolean(activeFallback) || shouldAdoptFallback;
    const isToolFailure = parsed.message.toLowerCase().includes("[tools]");
    if (!matchesRun) {
      if (!isToolFailure || !isRecentRuntimeLog(parsed.timestampMs, options.startedAtMs)) {
        continue;
      }
      if (!hasBoundRun) {
        continue;
      }
    }

    if (!isRuntimeRelevantMessage(parsed.message)) {
      continue;
    }

    const normalizedMessage = normalizeRuntimeLogMessage(parsed.message, [
      primaryRunId,
      fallbackRunId,
      nextFallbackRunId
    ]);
    const userFacingMessage = toUserFacingRuntimeMessage(normalizedMessage);
    if (!userFacingMessage) {
      continue;
    }

    activities.push({
      level: resolveRuntimeLogLevel(parsed.logLevel, normalizedMessage),
      message: truncateProgressLine(userFacingMessage),
    });
  }

  return {
    activities,
    nextFallbackRunId
  };
}

function parseRuntimeLogLine(line: string): ParsedRuntimeLogLine | null {
  const parsed = parseCommandJson(line);
  if (!parsed) {
    return null;
  }

  const message = selectRuntimeLogMessage(parsed);
  if (!message) {
    return null;
  }

  const normalizedMessage = sanitizeRuntimeProgressChunk(
    message.replace(/\s+/g, " "),
  );
  if (!normalizedMessage) {
    return null;
  }

  const meta = parsed._meta;
  const metaRecord =
    meta && typeof meta === "object" ? (meta as Record<string, unknown>) : null;
  const logLevel =
    typeof metaRecord?.logLevelName === "string"
      ? metaRecord.logLevelName.toLowerCase()
      : "";
  const timeRaw = typeof parsed.time === "string" ? parsed.time : undefined;
  const timestampMs =
    typeof timeRaw === "string" && Number.isFinite(Date.parse(timeRaw))
      ? Date.parse(timeRaw)
      : undefined;

  return {
    message: normalizedMessage,
    runId: extractRunIdFromMessage(normalizedMessage),
    logLevel,
    timestampMs
  };
}

function selectRuntimeLogMessage(parsed: Record<string, unknown>): string | null {
  const primaryCandidates = [parsed["1"], parsed.message];
  for (const candidate of primaryCandidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    if (isRuntimeRelevantMessage(candidate)) {
      return candidate;
    }
  }

  const fallbackCandidate = parsed["0"];
  if (typeof fallbackCandidate === "string" && isRuntimeRelevantMessage(fallbackCandidate)) {
    return fallbackCandidate;
  }

  return null;
}

function isRuntimeRelevantMessage(message: string): boolean {
  return /embedded run|session state|lane task|\[tools\]|tool start|tool end|tool failed|prompt start|prompt end|agent start|agent end|run done|aborted/i.test(
    message,
  );
}

function isEmbeddedRunStartMessage(message: string): boolean {
  return /embedded run start/i.test(message);
}

function extractRunIdFromMessage(message: string): string | undefined {
  const equalsMatch = message.match(/\brunId=([^\s]+)/i);
  if (equalsMatch?.[1]) {
    return equalsMatch[1];
  }

  const jsonMatch = message.match(/"runId"\s*:\s*"([^"]+)"/i);
  if (jsonMatch?.[1]) {
    return jsonMatch[1];
  }

  return undefined;
}

function isRecentRuntimeLog(
  timestampMs: number | undefined,
  runStartedAtMs: number
): boolean {
  if (typeof timestampMs !== "number" || !Number.isFinite(timestampMs)) {
    return false;
  }
  return timestampMs >= runStartedAtMs - 2_000;
}

function normalizeRuntimeLogMessage(message: string, runIds: Array<string | undefined>): string {
  let normalized = sanitizeRuntimeProgressChunk(message.replace(/\s+/g, " "));
  for (const runId of runIds) {
    const value = runId?.trim();
    if (!value) {
      continue;
    }
    normalized = sanitizeRuntimeProgressChunk(
      normalized.replace(new RegExp(`\\brunId=${escapeRegExp(value)}\\b\\s*`, "g"), ""),
    );
  }
  normalized = sanitizeRuntimeProgressChunk(
    normalized.replace(/^\{\s*"?subsystem"?\s*:\s*"[^"]+"\s*\}\s*/i, ""),
  );
  return normalized;
}

function toUserFacingRuntimeMessage(message: string): string | null {
  const normalized = message.trim();
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  const toolName = extractTokenFromMessage(normalized, "tool");
  const durationMs = extractTokenFromMessage(normalized, "durationMs");

  if (lower.includes("embedded run start")) {
    return "Run accepted by OpenClaw.";
  }
  if (lower.includes("embedded run prompt start")) {
    return "Preparing prompt and context.";
  }
  if (lower.includes("embedded run agent start")) {
    return "Agent is reasoning.";
  }
  if (lower.includes("embedded run tool start")) {
    return toolName ? `Running tool: ${toolName}.` : "Running a tool.";
  }
  if (lower.includes("embedded run tool end")) {
    if (toolName && durationMs) {
      return `Finished tool: ${toolName} (${durationMs} ms).`;
    }
    return toolName ? `Finished tool: ${toolName}.` : "Finished tool run.";
  }
  if (lower.includes("[tools]") && lower.includes("failed")) {
    return toolName ? `Tool failed: ${toolName}.` : "A tool failed during execution.";
  }
  if (lower.includes("embedded run agent end")) {
    return "Agent finished reasoning.";
  }
  if (lower.includes("embedded run prompt end")) {
    return "Prompt execution completed.";
  }
  if (lower.includes("embedded run done")) {
    if (lower.includes("aborted=true")) {
      return "Run was aborted by the runtime.";
    }
    return "OpenClaw marked the run as done.";
  }
  if (lower.includes("session state")) {
    return "Updating session state.";
  }
  if (lower.includes("lane task")) {
    return "Processing task step.";
  }

  return normalized;
}

function extractTokenFromMessage(message: string, tokenName: string): string | undefined {
  const match = message.match(
    new RegExp(`\\b${escapeRegExp(tokenName)}=([^\\s]+)`, "i"),
  );
  return match?.[1];
}

function resolveRuntimeLogLevel(logLevel: string, message: string): "stdout" | "stderr" {
  const lower = message.toLowerCase();
  if (
    logLevel === "warn" ||
    logLevel === "error" ||
    lower.includes(" failed") ||
    lower.includes(" error") ||
    lower.includes("aborted=true")
  ) {
    return "stderr";
  }
  return "stdout";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildOpenClawExecutionEnv(baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const preferredNodePaths = resolvePreferredOpenClawCommandPaths(baseEnv);
  const existingPathEntries = (baseEnv.PATH ?? "").split(path.delimiter);
  const mergedPath = dedupePathEntries([...preferredNodePaths, ...existingPathEntries]);

  return {
    ...baseEnv,
    PATH: mergedPath.join(path.delimiter),
  };
}

function dedupePathEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry || seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    result.push(entry);
  }

  return result;
}

function resolvePreferredOpenClawCommandPaths(env: NodeJS.ProcessEnv): string[] {
  const preferredPaths: string[] = [
    path.dirname(process.execPath),
    path.join(homedir(), ".npm-global", "bin"),
    path.join(homedir(), ".npm", "bin"),
    path.join(homedir(), ".local", "bin"),
    path.join(homedir(), ".volta", "bin"),
    path.join(homedir(), ".fnm", "current", "bin"),
    path.join(homedir(), ".asdf", "shims"),
    path.join(homedir(), "bin"),
  ];

  const npmPrefixCandidates = dedupePathEntries([
    env.npm_config_prefix ?? "",
    env.NPM_CONFIG_PREFIX ?? "",
    process.env.npm_config_prefix ?? "",
    process.env.NPM_CONFIG_PREFIX ?? "",
  ]);
  for (const prefix of npmPrefixCandidates) {
    preferredPaths.push(path.join(prefix, "bin"));
  }

  if (process.platform === "darwin") {
    preferredPaths.push(
      "/opt/homebrew/bin",
      "/opt/homebrew/opt/node@22/bin",
      "/usr/local/opt/node@22/bin",
    );
  }

  return preferredPaths;
}

async function prepareProjectSession(
  service: OpenClawUiService,
  agentId: string,
  options: {
    sessionRef: string;
    projectPath: string;
    forceNew: boolean;
  }
): Promise<SessionRunInfo> {
  if (typeof service.prepareSession === "function") {
    return service.prepareSession(agentId, options);
  }

  // Backward-compatible path: older @opengoat/core builds don't expose prepareSession
  // but still expose getPaths() and sessionService.prepareRunSession(...) on the service instance.
  const legacy = service as OpenClawUiService & {
    sessionService?: {
      prepareRunSession?: (
        paths: unknown,
        legacyAgentId: string,
        request: { sessionRef?: string; forceNew?: boolean; projectPath?: string; userMessage: string }
      ) => Promise<LegacyPreparedSessionRun>;
      renameSession?: (paths: unknown, legacyAgentId: string, title: string, sessionRef?: string) => Promise<SessionSummary>;
      removeSession?: (paths: unknown, legacyAgentId: string, sessionRef?: string) => Promise<SessionRemoveResult>;
    };
  };

  if (typeof legacy.getPaths === "function" && typeof legacy.sessionService?.prepareRunSession === "function") {
    const prepared = await legacy.sessionService.prepareRunSession(legacy.getPaths(), agentId, {
      sessionRef: options.sessionRef,
      forceNew: options.forceNew,
      projectPath: options.projectPath,
      userMessage: ""
    });

    if (!prepared.enabled || !prepared.info) {
      throw new Error("Session preparation was disabled.");
    }
    return prepared.info;
  }

  throw new Error("Project session preparation is unavailable. Restart the UI server after updating dependencies.");
}

async function ensureDefaultOrganizationWorkspace(
  service: OpenClawUiService,
  logs: UiLogBuffer
): Promise<void> {
  try {
    const organizationPath = path.resolve(
      service.getHomeDir(),
      DEFAULT_ORGANIZATION_PROJECT_DIRNAME
    );
    await mkdir(organizationPath, { recursive: true });

    const sessions = await service.listSessions(DEFAULT_AGENT_ID);
    const normalizedOrganizationPath = normalizeComparableProjectPath(organizationPath);
    const existingProjectSession = sessions.find((session) => {
      return (
        session.sessionKey.startsWith("project:") &&
        normalizeComparableProjectPath(session.projectPath) === normalizedOrganizationPath
      );
    });
    const hasOrganizationWorkspaceSession = sessions.some((session) => {
      return (
        session.sessionKey.startsWith("workspace:") &&
        normalizeComparableProjectPath(session.projectPath) === normalizedOrganizationPath
      );
    });

    if (existingProjectSession) {
      const hasExpectedProjectName =
        existingProjectSession.title.trim() === DEFAULT_ORGANIZATION_PROJECT_NAME;
      if (!hasExpectedProjectName) {
        await renameUiSession(
          service,
          DEFAULT_AGENT_ID,
          DEFAULT_ORGANIZATION_PROJECT_NAME,
          existingProjectSession.sessionKey
        );
      }
    } else {
      const projectSessionRef = buildProjectSessionRef(
        DEFAULT_ORGANIZATION_PROJECT_NAME,
        organizationPath
      );
      await prepareProjectSession(service, DEFAULT_AGENT_ID, {
        sessionRef: projectSessionRef,
        projectPath: organizationPath,
        forceNew: false
      });
      await renameUiSession(
        service,
        DEFAULT_AGENT_ID,
        DEFAULT_ORGANIZATION_PROJECT_NAME,
        projectSessionRef
      );
    }

    if (!hasOrganizationWorkspaceSession) {
      const workspaceSessionRef = buildWorkspaceSessionRef(
        DEFAULT_ORGANIZATION_PROJECT_NAME,
        organizationPath
      );
      await prepareProjectSession(service, DEFAULT_AGENT_ID, {
        sessionRef: workspaceSessionRef,
        projectPath: organizationPath,
        forceNew: true
      });
      await renameUiSession(
        service,
        DEFAULT_AGENT_ID,
        resolveDefaultWorkspaceSessionTitle(),
        workspaceSessionRef
      );
    }
  } catch (error) {
    logs.append({
      timestamp: new Date().toISOString(),
      level: "warn",
      source: "opengoat",
      message:
        error instanceof Error
          ? `Default Organization workspace setup skipped: ${error.message}`
          : "Default Organization workspace setup skipped."
    });
  }
}

async function renameUiSession(
  service: OpenClawUiService,
  agentId: string,
  title: string,
  sessionRef: string
): Promise<SessionSummary> {
  if (typeof service.renameSession === "function") {
    return service.renameSession(agentId, title, sessionRef);
  }

  const legacy = service as OpenClawUiService & {
    sessionService?: {
      renameSession?: (paths: unknown, legacyAgentId: string, nextTitle: string, legacySessionRef?: string) => Promise<SessionSummary>;
    };
  };
  if (typeof legacy.getPaths === "function" && typeof legacy.sessionService?.renameSession === "function") {
    return legacy.sessionService.renameSession(legacy.getPaths(), agentId, title, sessionRef);
  }

  throw new Error("Session rename is unavailable on this runtime.");
}

async function removeUiSession(
  service: OpenClawUiService,
  agentId: string,
  sessionRef: string
): Promise<SessionRemoveResult> {
  if (typeof service.removeSession === "function") {
    return service.removeSession(agentId, sessionRef);
  }

  const legacy = service as OpenClawUiService & {
    sessionService?: {
      removeSession?: (paths: unknown, legacyAgentId: string, legacySessionRef?: string) => Promise<SessionRemoveResult>;
    };
  };
  if (typeof legacy.getPaths === "function" && typeof legacy.sessionService?.removeSession === "function") {
    return legacy.sessionService.removeSession(legacy.getPaths(), agentId, sessionRef);
  }

  throw new Error("Session removal is unavailable on this runtime.");
}

async function getUiSessionHistory(
  service: OpenClawUiService,
  agentId: string,
  options: {
    sessionRef: string;
    limit?: number;
  }
): Promise<SessionHistoryResult> {
  if (typeof service.getSessionHistory === "function") {
    return service.getSessionHistory(agentId, {
      sessionRef: options.sessionRef,
      limit: options.limit
    });
  }

  const legacy = service as OpenClawUiService & {
    sessionService?: {
      getSessionHistory?: (
        paths: unknown,
        legacyAgentId: string,
        request: {
          sessionRef?: string;
          limit?: number;
          includeCompaction?: boolean;
        }
      ) => Promise<SessionHistoryResult>;
    };
  };
  if (typeof legacy.getPaths === "function" && typeof legacy.sessionService?.getSessionHistory === "function") {
    return legacy.sessionService.getSessionHistory(legacy.getPaths(), agentId, {
      sessionRef: options.sessionRef,
      limit: options.limit
    });
  }

  throw new Error("Session history is unavailable on this runtime.");
}

async function runUiSessionMessage(
  service: OpenClawUiService,
  agentId: string,
  options: {
    sessionRef: string;
    projectPath?: string;
    message: string;
    images?: UiImageInput[];
    hooks?: UiRunHooks;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
  }
): Promise<AgentRunResult> {
  if (typeof service.runAgent === "function") {
    return service.runAgent(agentId, {
      message: options.message,
      sessionRef: options.sessionRef,
      cwd: options.projectPath,
      images: options.images,
      ...(options.hooks ? { hooks: options.hooks } : {}),
      ...(options.onStdout ? { onStdout: options.onStdout } : {}),
      ...(options.onStderr ? { onStderr: options.onStderr } : {})
    });
  }

  throw new Error("Session messaging is unavailable on this runtime.");
}

async function resolveSessionProjectPathForRequest(
  service: OpenClawUiService,
  agentId: string,
  sessionRef: string,
  requestedProjectPath: string | undefined
): Promise<string | undefined> {
  const explicitPath = normalizeOptionalAbsolutePath(requestedProjectPath);
  if (explicitPath) {
    return explicitPath;
  }

  const storedProjectPath = await resolveStoredSessionProjectPath(
    service,
    agentId,
    sessionRef
  );
  if (storedProjectPath) {
    return storedProjectPath;
  }

  const organizationPath = resolveAbsolutePath(
    path.join(service.getHomeDir(), DEFAULT_ORGANIZATION_PROJECT_DIRNAME)
  );
  const organizationStats = await stat(organizationPath).catch(() => {
    return null;
  });
  if (organizationStats?.isDirectory()) {
    return organizationPath;
  }

  const homePath = resolveAbsolutePath(service.getHomeDir());
  const homeStats = await stat(homePath).catch(() => {
    return null;
  });
  if (homeStats?.isDirectory()) {
    return homePath;
  }

  return undefined;
}

async function resolveStoredSessionProjectPath(
  service: OpenClawUiService,
  agentId: string,
  sessionRef: string
): Promise<string | undefined> {
  const normalizedSessionRef = sessionRef.trim();
  if (!normalizedSessionRef) {
    return undefined;
  }

  try {
    const sessions = await service.listSessions(agentId);
    const matchingSession = sessions.find((session) => {
      return (
        session.sessionKey === normalizedSessionRef ||
        session.sessionId === normalizedSessionRef
      );
    });
    return normalizeOptionalAbsolutePath(matchingSession?.projectPath);
  } catch {
    return undefined;
  }
}

async function createUiTask(
  service: OpenClawUiService,
  actorId: string,
  options: {
    title: string;
    description: string;
    project?: string;
    assignedTo?: string;
    status?: string;
  }
): Promise<TaskRecord> {
  if (typeof service.createTask === "function") {
    return service.createTask(actorId, options);
  }

  throw new Error("Task creation is unavailable on this runtime.");
}

async function listUiTasks(
  service: OpenClawUiService,
  options: { assignee?: string; limit?: number } = {}
): Promise<TaskRecord[]> {
  if (typeof service.listTasks === "function") {
    return service.listTasks(options);
  }

  throw new Error("Task listing is unavailable on this runtime.");
}

async function deleteUiTasks(
  service: OpenClawUiService,
  actorId: string,
  taskIds: string[]
): Promise<{ deletedTaskIds: string[]; deletedCount: number }> {
  if (typeof service.deleteTasks === "function") {
    return service.deleteTasks(actorId, taskIds);
  }

  throw new Error("Task deletion is unavailable on this runtime.");
}

async function updateUiTaskStatus(
  service: OpenClawUiService,
  actorId: string,
  taskId: string,
  status: string,
  reason?: string
): Promise<TaskRecord> {
  if (typeof service.updateTaskStatus === "function") {
    return service.updateTaskStatus(actorId, taskId, status, reason);
  }

  throw new Error("Task status updates are unavailable on this runtime.");
}

async function addUiTaskBlocker(service: OpenClawUiService, actorId: string, taskId: string, content: string): Promise<TaskRecord> {
  if (typeof service.addTaskBlocker === "function") {
    return service.addTaskBlocker(actorId, taskId, content);
  }

  throw new Error("Task blocker updates are unavailable on this runtime.");
}

async function addUiTaskArtifact(service: OpenClawUiService, actorId: string, taskId: string, content: string): Promise<TaskRecord> {
  if (typeof service.addTaskArtifact === "function") {
    return service.addTaskArtifact(actorId, taskId, content);
  }

  throw new Error("Task artifact updates are unavailable on this runtime.");
}

async function addUiTaskWorklog(service: OpenClawUiService, actorId: string, taskId: string, content: string): Promise<TaskRecord> {
  if (typeof service.addTaskWorklog === "function") {
    return service.addTaskWorklog(actorId, taskId, content);
  }

  throw new Error("Task worklog updates are unavailable on this runtime.");
}

async function resolveProjectFolder(
  folderName: string | undefined,
  folderPath: string | undefined
): Promise<{ name: string; path: string }> {
  const explicitPath = folderPath?.trim();
  if (explicitPath) {
    const resolvedPath = resolveAbsolutePath(explicitPath);
    const stats = await stat(resolvedPath).catch(() => {
      return null;
    });
    if (!stats || !stats.isDirectory()) {
      throw new Error(`Project path is not a directory: ${resolvedPath}`);
    }

    const explicitName = folderName?.trim();
    return {
      name: explicitName || path.basename(resolvedPath),
      path: resolvedPath
    };
  }

  const normalizedFolderName = normalizeDesktopFolderName(folderName);
  if (!normalizedFolderName) {
    throw new Error("folderName is required.");
  }

  const desktopDir = path.resolve(homedir(), "Desktop");
  const projectPath = path.resolve(desktopDir, normalizedFolderName);
  const stats = await stat(projectPath).catch(() => {
    return null;
  });
  if (!stats || !stats.isDirectory()) {
    throw new Error(`Desktop folder does not exist: ${projectPath}`);
  }

  return {
    name: normalizedFolderName,
    path: projectPath
  };
}

function normalizeDesktopFolderName(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed === "." || trimmed === "..") {
    return null;
  }

  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    return null;
  }

  return trimmed;
}

function buildProjectSessionRef(projectName: string, projectPath: string): string {
  const segment = normalizeProjectSegment(projectName);
  const suffix = normalizeProjectSegment(projectPath).slice(-10) || "session";
  return `project:${segment}-${suffix}`;
}

function normalizeUiImages(images: UiImageInput[] | undefined): UiImageInput[] {
  if (!images || images.length === 0) {
    return [];
  }

  return images.filter((image) => {
    if (!image || typeof image !== "object") {
      return false;
    }

    const dataUrl = image.dataUrl?.trim();
    const mediaType = image.mediaType?.trim();
    return Boolean(dataUrl && dataUrl.startsWith("data:") && mediaType?.toLowerCase().startsWith("image/"));
  });
}

function buildWorkspaceSessionRef(workspaceName: string, workspacePath: string): string {
  const segment = normalizeProjectSegment(workspaceName);
  const suffix = normalizeProjectSegment(workspacePath).slice(-10) || "workspace";
  const nonce = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296)
    .toString(36)
    .padStart(2, "0")}`;
  return `workspace:${segment}-${suffix}-${nonce}`;
}

function resolveDefaultWorkspaceSessionTitle(): string {
  return "New Session";
}

function normalizeComparableProjectPath(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }
  const resolved = resolveAbsolutePath(trimmed);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function resolveAbsolutePath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "~") {
    return homedir();
  }
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return path.resolve(homedir(), trimmed.slice(2));
  }
  return path.resolve(trimmed);
}

function normalizeOptionalAbsolutePath(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return resolveAbsolutePath(trimmed);
}

function normalizeProjectSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "project";
}

async function pickProjectFolderFromSystem(): Promise<{ name: string; path: string }> {
  if (process.platform === "darwin") {
    const script = 'POSIX path of (choose folder with prompt "Select a project folder")';
    const { stdout } = await execFileAsync("osascript", ["-e", script], {
      timeout: 120_000
    });
    const selectedPath = stdout.trim().replace(/[\\/]+$/, "");
    if (!selectedPath) {
      throw new Error("No folder was selected.");
    }
    const resolvedPath = path.resolve(selectedPath);
    const stats = await stat(resolvedPath).catch(() => {
      return null;
    });
    if (!stats || !stats.isDirectory()) {
      throw new Error(`Selected folder is not accessible: ${resolvedPath}`);
    }
    return {
      name: path.basename(resolvedPath),
      path: resolvedPath
    };
  }

  throw new Error("Native folder picker is currently supported on macOS only.");
}

async function resolveOrganizationAgents(service: OpenClawUiService): Promise<OrganizationAgent[]> {
  const agents = await service.listAgents();
  const agentIds = new Set(agents.map((agent) => agent.id));

  return Promise.all(
    agents.map(async (agent) => {
      const fallbackReportsTo = agent.id === DEFAULT_AGENT_ID ? null : DEFAULT_AGENT_ID;
      const fallbackType: OrganizationAgent["type"] = agent.id === DEFAULT_AGENT_ID ? "manager" : "individual";

      try {
        const configPath = path.resolve(agent.internalConfigDir, "config.json");
        const raw = await readFile(configPath, "utf8");
        const parsed = JSON.parse(raw) as {
          role?: string;
          organization?: {
            reportsTo?: string | null;
            type?: string;
          };
        };

        const organization = parsed.organization;
        const reportsTo = normalizeReportsToValue(organization?.reportsTo, fallbackReportsTo, agentIds);
        const type = normalizeTypeValue(organization?.type, fallbackType);
        const role = normalizeRoleValue(parsed.role);

        return {
          ...agent,
          reportsTo,
          type,
          role
        };
      } catch {
        return {
          ...agent,
          reportsTo: fallbackReportsTo,
          type: fallbackType,
          role: undefined
        };
      }
    })
  );
}

function normalizeReportsToValue(
  value: string | null | undefined,
  fallback: string | null,
  knownAgentIds: Set<string>
): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "null" || normalized === "none") {
    return null;
  }

  return knownAgentIds.has(normalized) ? normalized : fallback;
}

function normalizeTypeValue(rawType: string | undefined, fallback: OrganizationAgent["type"]): OrganizationAgent["type"] {
  const normalized = rawType?.trim().toLowerCase();
  if (normalized === "manager" || normalized === "individual") {
    return normalized;
  }
  return fallback;
}

function normalizeRoleValue(rawRole: string | undefined): string | undefined {
  const normalized = rawRole?.trim();
  if (normalized) {
    const genericRole = normalized.toLowerCase();
    if (genericRole === "manager" || genericRole === "individual contributor" || genericRole === "team member") {
      return undefined;
    }
    return normalized;
  }
  return undefined;
}

function defaultUiServerSettings(): UiServerSettings {
  return {
    taskCronEnabled: true,
    notifyManagersOfInactiveAgents: true,
    maxInactivityMinutes: DEFAULT_MAX_INACTIVITY_MINUTES,
    inactiveAgentNotificationTarget: "all-managers",
    authentication: {
      enabled: false,
      username: undefined,
      passwordHash: undefined,
    },
  };
}

function parseBooleanSetting(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  return undefined;
}

function parseNotifyManagersOfInactiveAgents(value: unknown): boolean | undefined {
  return parseBooleanSetting(value);
}

function parseTaskCronEnabled(value: unknown): boolean | undefined {
  return parseBooleanSetting(value);
}

function parseInactiveAgentNotificationTarget(
  value: unknown,
): InactiveAgentNotificationTarget | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "all-managers") {
    return "all-managers";
  }
  if (normalized === "ceo-only") {
    return "ceo-only";
  }
  return undefined;
}

function parseUiLogStreamLimit(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_LOG_STREAM_LIMIT;
  }
  return Math.min(parsed, MAX_LOG_STREAM_LIMIT);
}

function parseUiLogStreamFollow(value: unknown): boolean {
  if (value === undefined || value === null || value === "") {
    return true;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
  }
  return true;
}

function parseMaxInactivityMinutes(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isInteger(parsed)) {
    return undefined;
  }
  if (
    parsed < MIN_MAX_INACTIVITY_MINUTES ||
    parsed > MAX_MAX_INACTIVITY_MINUTES
  ) {
    return undefined;
  }
  return parsed;
}

async function readUiServerSettings(homeDir: string): Promise<UiServerSettings> {
  const settingsPath = path.resolve(homeDir, UI_SETTINGS_FILENAME);
  if (!existsSync(settingsPath)) {
    return defaultUiServerSettings();
  }

  try {
    const raw = await readFile(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as {
      taskCronEnabled?: unknown;
      notifyManagersOfInactiveAgents?: unknown;
      maxInactivityMinutes?: unknown;
      inactiveAgentNotificationTarget?: unknown;
      authentication?: {
        enabled?: unknown;
        username?: unknown;
        passwordHash?: unknown;
      };
    };
    const taskCronEnabled = parseTaskCronEnabled(parsed?.taskCronEnabled);
    const notifyManagersOfInactiveAgents =
      parseNotifyManagersOfInactiveAgents(
        parsed?.notifyManagersOfInactiveAgents,
      ) ?? taskCronEnabled;
    const maxInactivityMinutes = parseMaxInactivityMinutes(
      parsed?.maxInactivityMinutes,
    );
    const inactiveAgentNotificationTarget =
      parseInactiveAgentNotificationTarget(
        parsed?.inactiveAgentNotificationTarget,
      );
    const authEnabled = parseBooleanSetting(parsed.authentication?.enabled);
    const authUsername = normalizeUiAuthenticationUsername(
      parsed.authentication?.username,
    );
    const authPasswordHash = normalizeUiAuthenticationPasswordHash(
      parsed.authentication?.passwordHash,
    );
    const defaults = defaultUiServerSettings();
    return {
      taskCronEnabled: taskCronEnabled ?? defaults.taskCronEnabled,
      notifyManagersOfInactiveAgents:
        notifyManagersOfInactiveAgents ??
        defaults.notifyManagersOfInactiveAgents,
      maxInactivityMinutes:
        maxInactivityMinutes ?? defaults.maxInactivityMinutes,
      inactiveAgentNotificationTarget:
        inactiveAgentNotificationTarget ??
        defaults.inactiveAgentNotificationTarget,
      authentication: {
        enabled:
          authEnabled === true &&
          Boolean(authUsername && authPasswordHash),
        username: authUsername,
        passwordHash: authPasswordHash,
      },
    };
  } catch {
    return defaultUiServerSettings();
  }
}

async function writeUiServerSettings(homeDir: string, settings: UiServerSettings): Promise<void> {
  const settingsPath = path.resolve(homeDir, UI_SETTINGS_FILENAME);
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function toPublicUiServerSettings(
  settings: UiServerSettings,
  authentication: UiAuthenticationSettingsResponse,
): UiServerSettingsResponse {
  return {
    taskCronEnabled: settings.taskCronEnabled,
    notifyManagersOfInactiveAgents: settings.notifyManagersOfInactiveAgents,
    maxInactivityMinutes: settings.maxInactivityMinutes,
    inactiveAgentNotificationTarget: settings.inactiveAgentNotificationTarget,
    authentication,
  };
}

interface TaskCronScheduler {
  setTaskCronEnabled: (enabled: boolean) => void;
  setNotifyManagersOfInactiveAgents: (enabled: boolean) => void;
  setMaxInactivityMinutes: (maxInactivityMinutes: number) => void;
  setInactiveAgentNotificationTarget: (
    target: InactiveAgentNotificationTarget,
  ) => void;
  stop: () => void;
}

function createTaskCronScheduler(
  app: FastifyInstance,
  service: OpenClawUiService,
  initialSettings: UiServerSettings,
  logs: UiLogBuffer,
): TaskCronScheduler {
  if (typeof service.runTaskCronCycle !== "function") {
    return {
      setTaskCronEnabled: () => {
        // no-op when runtime task cron is unavailable.
      },
      setNotifyManagersOfInactiveAgents: () => {
        // no-op when runtime task cron is unavailable.
      },
      setMaxInactivityMinutes: () => {
        // no-op when runtime task cron is unavailable.
      },
      setInactiveAgentNotificationTarget: () => {
        // no-op when runtime task cron is unavailable.
      },
      stop: () => {
        // no-op when runtime task cron is unavailable.
      }
    };
  }

  let taskCronEnabled =
    parseTaskCronEnabled(initialSettings.taskCronEnabled) ??
    defaultUiServerSettings().taskCronEnabled;
  let notifyManagersOfInactiveAgents =
    parseNotifyManagersOfInactiveAgents(
      initialSettings.notifyManagersOfInactiveAgents,
    ) ?? defaultUiServerSettings().notifyManagersOfInactiveAgents;
  let maxInactivityMinutes =
    parseMaxInactivityMinutes(initialSettings.maxInactivityMinutes) ??
    defaultUiServerSettings().maxInactivityMinutes;
  let inactiveAgentNotificationTarget =
    parseInactiveAgentNotificationTarget(
      initialSettings.inactiveAgentNotificationTarget,
    ) ?? defaultUiServerSettings().inactiveAgentNotificationTarget;
  let intervalHandle: NodeJS.Timeout | undefined;
  let running = false;

  const syncFromPersistedSettings = async (): Promise<void> => {
    const persisted = await readUiServerSettings(service.getHomeDir()).catch(() => {
      return null;
    });
    if (!persisted) {
      return;
    }

    const persistedNotifyManagers =
      parseNotifyManagersOfInactiveAgents(
        persisted.notifyManagersOfInactiveAgents,
      ) ?? notifyManagersOfInactiveAgents;
    const persistedTaskCronEnabled =
      parseTaskCronEnabled(persisted.taskCronEnabled) ?? taskCronEnabled;
    const persistedMaxInactivityMinutes =
      parseMaxInactivityMinutes(persisted.maxInactivityMinutes) ??
      maxInactivityMinutes;
    const persistedNotificationTarget =
      parseInactiveAgentNotificationTarget(
        persisted.inactiveAgentNotificationTarget,
      ) ?? inactiveAgentNotificationTarget;

    const hasTaskCronEnabledChange =
      persistedTaskCronEnabled !== taskCronEnabled;
    const hasNotifyManagersChange =
      persistedNotifyManagers !== notifyManagersOfInactiveAgents;
    const hasMaxInactivityChange =
      persistedMaxInactivityMinutes !== maxInactivityMinutes;
    const hasNotificationTargetChange =
      persistedNotificationTarget !== inactiveAgentNotificationTarget;
    if (
      !hasTaskCronEnabledChange &&
      !hasNotifyManagersChange &&
      !hasMaxInactivityChange &&
      !hasNotificationTargetChange
    ) {
      return;
    }

    taskCronEnabled = persistedTaskCronEnabled;
    notifyManagersOfInactiveAgents = persistedNotifyManagers;
    maxInactivityMinutes = persistedMaxInactivityMinutes;
    inactiveAgentNotificationTarget = persistedNotificationTarget;
    if (hasTaskCronEnabledChange) {
      schedule();
    }
    app.log.info(
      {
        taskCronEnabled,
        notifyManagersOfInactiveAgents,
        maxInactivityMinutes,
        inactiveAgentNotificationTarget,
      },
      "[task-cron] scheduler synchronized from persisted settings"
    );
  };

  const runCycle = async (): Promise<void> => {
    if (running) {
      return;
    }
    running = true;
    try {
      await syncFromPersistedSettings();
      if (!taskCronEnabled) {
        return;
      }
      const cycle = await service.runTaskCronCycle?.({
        inactiveMinutes: maxInactivityMinutes,
        notificationTarget: inactiveAgentNotificationTarget,
        notifyInactiveAgents: notifyManagersOfInactiveAgents,
      });
      if (cycle) {
        app.log.info(
          {
            ranAt: cycle.ranAt,
            scanned: cycle.scannedTasks,
            todo: cycle.todoTasks,
            blocked: cycle.blockedTasks,
            inactive: cycle.inactiveAgents,
            sent: cycle.sent,
            failed: cycle.failed
          },
          "[task-cron] cycle completed"
        );
        logs.append({
          timestamp: new Date().toISOString(),
          level: cycle.failed > 0 ? "warn" : "info",
          source: "opengoat",
          message: `[task-cron] cycle completed ran=${cycle.ranAt} scanned=${cycle.scannedTasks} todo=${cycle.todoTasks} blocked=${cycle.blockedTasks} inactive=${cycle.inactiveAgents} sent=${cycle.sent} failed=${cycle.failed}`,
        });
      }
    } catch (error) {
      app.log.error(
        {
          error: error instanceof Error ? error.message : String(error)
        },
        "[task-cron] cycle failed"
      );
      logs.append({
        timestamp: new Date().toISOString(),
        level: "error",
        source: "opengoat",
        message:
          error instanceof Error
            ? `[task-cron] cycle failed: ${error.message}`
            : "[task-cron] cycle failed.",
      });
    } finally {
      running = false;
    }
  };

  const schedule = (): void => {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = undefined;
    }
    if (!taskCronEnabled) {
      return;
    }
    intervalHandle = setInterval(() => {
      void runCycle();
    }, DEFAULT_TASK_CHECK_FREQUENCY_MINUTES * 60_000);
    intervalHandle.unref?.();
  };

  schedule();

  return {
    setTaskCronEnabled: (nextEnabled: boolean) => {
      const parsed = parseTaskCronEnabled(nextEnabled);
      if (parsed === undefined || parsed === taskCronEnabled) {
        return;
      }
      taskCronEnabled = parsed;
      schedule();
      app.log.info(
        {
          taskCronEnabled,
        },
        "[task-cron] scheduler state updated"
      );
      logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message: `[task-cron] automation checks ${
          taskCronEnabled ? "enabled" : "disabled"
        }.`,
      });
    },
    setNotifyManagersOfInactiveAgents: (nextEnabled: boolean) => {
      const parsed = parseNotifyManagersOfInactiveAgents(nextEnabled);
      if (parsed === undefined || parsed === notifyManagersOfInactiveAgents) {
        return;
      }
      notifyManagersOfInactiveAgents = parsed;
      app.log.info(
        {
          notifyManagersOfInactiveAgents,
        },
        "[task-cron] inactivity notification state updated"
      );
      logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message: `[task-cron] inactive-manager notifications ${
          notifyManagersOfInactiveAgents ? "enabled" : "disabled"
        }.`,
      });
    },
    setMaxInactivityMinutes: (nextMaxInactivityMinutes: number) => {
      const parsed = parseMaxInactivityMinutes(nextMaxInactivityMinutes);
      if (!parsed || parsed === maxInactivityMinutes) {
        return;
      }
      maxInactivityMinutes = parsed;
      app.log.info(
        {
          maxInactivityMinutes,
        },
        "[task-cron] inactivity threshold updated"
      );
      logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message: `[task-cron] inactivity threshold updated to ${maxInactivityMinutes} minute(s).`,
      });
    },
    setInactiveAgentNotificationTarget: (
      nextTarget: InactiveAgentNotificationTarget,
    ) => {
      const parsed = parseInactiveAgentNotificationTarget(nextTarget);
      if (!parsed || parsed === inactiveAgentNotificationTarget) {
        return;
      }
      inactiveAgentNotificationTarget = parsed;
      app.log.info(
        {
          inactiveAgentNotificationTarget,
        },
        "[task-cron] inactivity notification target updated"
      );
      logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message: `[task-cron] inactivity notification target set to ${inactiveAgentNotificationTarget}.`,
      });
    },
    stop: () => {
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = undefined;
      }
    }
  };
}

async function safeReply<T>(reply: FastifyReply, operation: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    reply.code(500);
    return {
      error: message
    };
  }
}
