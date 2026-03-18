export const DEFAULT_AGENT_ID = "main";

const VALID_AGENT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const INVALID_AGENT_ID_RE = /[^a-z0-9_-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;

export interface StoredAgentRecord {
  id: string;
  name: string;
  description?: string | undefined;
  instructions: string;
  providerId?: string | undefined;
  modelId?: string | undefined;
  workspaceDir: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentStore {
  version: 1;
  agents: Record<string, StoredAgentRecord>;
  order: string[];
  defaultAgentId?: string | undefined;
}

export interface AgentStoreLocation {
  agentsRootDir: string;
  catalogPath: string;
  configDir: string;
}

export interface AgentRecord extends StoredAgentRecord {
  agentDir: string;
  isDefault: boolean;
}

export interface AgentCatalog {
  agents: AgentRecord[];
  defaultAgentId: string;
  storePath: string;
}

export interface StoredAgentSessionRecord {
  id: string;
  sessionKey: string;
  label?: string | undefined;
  sessionFile: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSessionStore {
  version: 1;
  order: string[];
  sessions: Record<string, StoredAgentSessionRecord>;
}

export interface AgentSessionSummary extends StoredAgentSessionRecord {
  agentId: string;
  agentName: string;
  workspaceDir: string;
}

export interface AgentTranscriptMessage {
  id: string;
  modelId?: string | undefined;
  providerId?: string | undefined;
  role: "assistant" | "system" | "user";
  text: string;
  createdAt: string;
}

export interface AgentSessionList {
  agentId?: string | undefined;
  sessions: AgentSessionSummary[];
}

export interface AgentDeleteSummary {
  agentId: string;
  deletedSessions: number;
  removedPaths: string[];
}

export interface AgentServiceOptions {
  env?: NodeJS.ProcessEnv | undefined;
  now?: (() => Date) | undefined;
  storePath?: string | undefined;
}

export interface CreateAgentParams {
  id?: string | undefined;
  name: string;
  description?: string | undefined;
  instructions?: string | undefined;
  providerId?: string | undefined;
  modelId?: string | undefined;
  setAsDefault?: boolean | undefined;
  workspaceDir?: string | undefined;
}

export interface UpdateAgentParams {
  description?: string | undefined;
  instructions?: string | undefined;
  modelId?: string | undefined;
  name?: string | undefined;
  providerId?: string | undefined;
  setAsDefault?: boolean | undefined;
  workspaceDir?: string | undefined;
}

export interface CreateAgentSessionParams {
  agentId: string;
  initialPrompt?: string | undefined;
  label?: string | undefined;
}

export interface AppendSessionMessagesParams {
  agentId: string;
  messages: AgentTranscriptMessage[];
  sessionId: string;
}

export interface AgentFilesystemLayout {
  agentDir: string;
  sessionsDir: string;
  sessionsIndexPath: string;
  transcriptsDir: string;
  workspaceDir: string;
}

export function normalizeAgentId(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return DEFAULT_AGENT_ID;
  }

  if (VALID_AGENT_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return (
    trimmed
      .toLowerCase()
      .replace(INVALID_AGENT_ID_RE, "-")
      .replace(LEADING_DASH_RE, "")
      .replace(TRAILING_DASH_RE, "")
      .slice(0, 64) || DEFAULT_AGENT_ID
  );
}

export function isValidAgentId(value: string | undefined | null): boolean {
  const trimmed = (value ?? "").trim();
  return Boolean(trimmed) && VALID_AGENT_ID_RE.test(trimmed);
}

export function buildAgentSessionKey(agentId: string, sessionId: string): string {
  return `agent:${normalizeAgentId(agentId)}:session:${sessionId}`;
}

export function createEmptyAgentStore(): AgentStore {
  return {
    version: 1,
    agents: {},
    order: [],
  };
}

export function createEmptyAgentSessionStore(): AgentSessionStore {
  return {
    version: 1,
    order: [],
    sessions: {},
  };
}
