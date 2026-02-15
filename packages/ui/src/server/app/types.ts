import type { FastifyReply } from "fastify";

export interface AgentDescriptor {
  id: string;
  displayName: string;
  workspaceDir: string;
  internalConfigDir: string;
}

export interface OrganizationAgent extends AgentDescriptor {
  reportsTo: string | null;
  type: "manager" | "individual" | "unknown";
  role?: string;
}

export interface AgentCreationResult {
  agent: AgentDescriptor;
  createdPaths: string[];
  skippedPaths: string[];
  alreadyExisted?: boolean;
}

export interface AgentDeletionResult {
  agentId: string;
  existed: boolean;
  removedPaths: string[];
  skippedPaths: string[];
}

export interface CreateAgentOptions {
  type?: "manager" | "individual";
  reportsTo?: string | null;
  skills?: string[];
  role?: string;
}

export interface DeleteAgentOptions {
  force?: boolean;
}

export interface SessionSummary {
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

export interface ResolvedSkill {
  id: string;
  name: string;
  description: string;
  source: string;
}

export interface UiImageInput {
  dataUrl?: string;
  mediaType?: string;
  name?: string;
}

export interface UiRunEvent {
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

export interface UiRunHooks {
  onEvent?: (event: UiRunEvent) => void;
}

export interface UiRunAgentOptions {
  message: string;
  sessionRef?: string;
  cwd?: string;
  images?: UiImageInput[];
  abortSignal?: AbortSignal;
  hooks?: UiRunHooks;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface UiOpenClawGatewayConfig {
  mode: "local" | "external";
  gatewayUrl?: string;
  gatewayToken?: string;
  command?: string;
}

export type InactiveAgentNotificationTarget = "all-managers" | "ceo-only";

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

export interface SessionRunInfo {
  agentId: string;
  sessionKey: string;
  sessionId: string;
  transcriptPath: string;
  workspacePath: string;
  projectPath: string;
  isNewSession: boolean;
}

export interface LegacyPreparedSessionRun {
  enabled: boolean;
  info?: SessionRunInfo;
}

export interface SessionRemoveResult {
  sessionKey: string;
  sessionId: string;
  title: string;
  transcriptPath: string;
}

export interface SessionHistoryItem {
  type: "message" | "compaction";
  role?: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface SessionHistoryResult {
  sessionKey: string;
  sessionId?: string;
  transcriptPath?: string;
  messages: SessionHistoryItem[];
}

export interface TaskEntry {
  createdAt: string;
  createdBy: string;
  content: string;
}

export interface TaskRecord {
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

export interface AgentRunResult {
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

export interface TaskCronRunResult {
  ranAt: string;
  scannedTasks: number;
  todoTasks: number;
  blockedTasks: number;
  inactiveAgents: number;
  sent: number;
  failed: number;
}

export interface UiServerSettings {
  taskCronEnabled: boolean;
  notifyManagersOfInactiveAgents: boolean;
  maxInactivityMinutes: number;
  inactiveAgentNotificationTarget: InactiveAgentNotificationTarget;
  authentication: UiServerAuthenticationSettings;
}

export interface UiServerAuthenticationSettings {
  enabled: boolean;
  username?: string;
  passwordHash?: string;
}

export interface UiAuthenticationStatus {
  enabled: boolean;
  authenticated: boolean;
}

export interface UiAuthenticationSettingsResponse {
  enabled: boolean;
  username: string;
  hasPassword: boolean;
}

export interface UiServerSettingsResponse {
  taskCronEnabled: boolean;
  notifyManagersOfInactiveAgents: boolean;
  maxInactivityMinutes: number;
  inactiveAgentNotificationTarget: InactiveAgentNotificationTarget;
  authentication: UiAuthenticationSettingsResponse;
  ceoBootstrapPending: boolean;
}

export interface UiVersionInfo {
  packageName: string;
  installedVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean | null;
  status: "latest" | "update-available" | "unpublished" | "unknown";
  checkedAt: string;
  error?: string;
}

export type SessionMessageProgressPhase =
  | "queued"
  | "run_started"
  | "provider_invocation_started"
  | "provider_invocation_completed"
  | "run_completed"
  | "stdout"
  | "stderr"
  | "heartbeat";

export interface SessionMessageStreamProgressEvent {
  type: "progress";
  phase: SessionMessageProgressPhase;
  timestamp: string;
  message: string;
}

export interface SessionMessageStreamResultEvent {
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

export interface SessionMessageStreamErrorEvent {
  type: "error";
  timestamp: string;
  error: string;
}

export type SessionMessageStreamEvent =
  | SessionMessageStreamProgressEvent
  | SessionMessageStreamResultEvent
  | SessionMessageStreamErrorEvent;

export type UiLogLevel = "info" | "warn" | "error";
export type UiLogSource = "opengoat" | "openclaw";

export interface UiLogEntry {
  id: number;
  timestamp: string;
  level: UiLogLevel;
  source: UiLogSource;
  message: string;
}

export interface UiLogSnapshotStreamEvent {
  type: "snapshot";
  entries: UiLogEntry[];
}

export interface UiLogLineStreamEvent {
  type: "log";
  entry: UiLogEntry;
}

export interface UiLogHeartbeatStreamEvent {
  type: "heartbeat";
  timestamp: string;
}

export interface UiLogErrorStreamEvent {
  type: "error";
  timestamp: string;
  error: string;
}

export type UiLogStreamEvent =
  | UiLogSnapshotStreamEvent
  | UiLogLineStreamEvent
  | UiLogHeartbeatStreamEvent
  | UiLogErrorStreamEvent;

export interface UiLogBuffer {
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

export interface RegisterApiRoutesDeps {
  getSettings: () => UiServerSettings;
  updateSettings: (settings: UiServerSettings) => Promise<void>;
  getVersionInfo: () => Promise<UiVersionInfo>;
  logs: UiLogBuffer;
  auth: UiAuthController;
}

export interface UiAuthController {
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

export interface RuntimeLogExtractionOptions {
  primaryRunId: string;
  fallbackRunId?: string;
  startedAtMs: number;
}

export interface RuntimeLogExtractionResult {
  activities: Array<{ level: "stdout" | "stderr"; message: string }>;
  nextFallbackRunId?: string;
}

export interface TaskCronScheduler {
  setTaskCronEnabled: (enabled: boolean) => void;
  setNotifyManagersOfInactiveAgents: (enabled: boolean) => void;
  setMaxInactivityMinutes: (maxInactivityMinutes: number) => void;
  setInactiveAgentNotificationTarget: (
    target: InactiveAgentNotificationTarget,
  ) => void;
  stop: () => void;
}

export interface OpenClawGatewayLogTail {
  cursor: number;
  lines: string[];
  reset: boolean;
}
