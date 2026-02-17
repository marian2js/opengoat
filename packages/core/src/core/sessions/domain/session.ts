export type SessionResetMode = "daily" | "idle";

export interface SessionResetPolicy {
  mode: SessionResetMode;
  atHour: number;
  idleMinutes?: number;
}

export interface SessionPruningConfig {
  enabled: boolean;
  maxMessages: number;
  maxChars: number;
  keepRecentMessages: number;
}

export interface SessionCompactionConfig {
  enabled: boolean;
  triggerMessageCount: number;
  triggerChars: number;
  keepRecentMessages: number;
  summaryMaxChars: number;
}

export interface SessionConfig {
  mainKey: string;
  contextMaxChars: number;
  reset: SessionResetPolicy;
  pruning: SessionPruningConfig;
  compaction: SessionCompactionConfig;
}

export interface SessionEntry {
  sessionId: string;
  updatedAt: number;
  title?: string;
  transcriptFile?: string;
  workspacePath?: string;
  inputChars?: number;
  outputChars?: number;
  totalChars?: number;
  contextChars?: number;
  compactionCount?: number;
}

export interface SessionStoreShape {
  schemaVersion: 1;
  sessions: Record<string, SessionEntry>;
}

export interface SessionRunInfo {
  agentId: string;
  sessionKey: string;
  sessionId: string;
  transcriptPath: string;
  workspacePath: string;
  isNewSession: boolean;
}

export interface SessionSummary {
  sessionKey: string;
  sessionId: string;
  title: string;
  updatedAt: number;
  transcriptPath: string;
  workspacePath: string;
  inputChars: number;
  outputChars: number;
  totalChars: number;
  compactionCount: number;
}

export interface SessionHistoryItem {
  type: "message" | "compaction";
  role?: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface SessionRemoveResult {
  sessionKey: string;
  sessionId: string;
  title: string;
  transcriptPath: string;
}

export const SESSION_STORE_SCHEMA_VERSION = 1 as const;
export const SESSION_TRANSCRIPT_SCHEMA_VERSION = 1 as const;

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  mainKey: "main",
  contextMaxChars: 12_000,
  reset: {
    mode: "daily",
    atHour: 4
  },
  pruning: {
    enabled: true,
    maxMessages: 40,
    maxChars: 16_000,
    keepRecentMessages: 12
  },
  compaction: {
    enabled: true,
    triggerMessageCount: 80,
    triggerChars: 32_000,
    keepRecentMessages: 20,
    summaryMaxChars: 4_000
  }
};
