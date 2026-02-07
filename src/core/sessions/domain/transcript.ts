import { SESSION_TRANSCRIPT_SCHEMA_VERSION } from "./session.js";

export interface SessionTranscriptHeader {
  type: "session";
  schemaVersion: typeof SESSION_TRANSCRIPT_SCHEMA_VERSION;
  sessionId: string;
  sessionKey: string;
  agentId: string;
  createdAt: string;
}

export interface SessionTranscriptMessage {
  type: "message";
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface SessionTranscriptCompaction {
  type: "compaction";
  summary: string;
  compactedMessages: number;
  keptMessages: number;
  timestamp: number;
}

export type SessionTranscriptRecord =
  | SessionTranscriptHeader
  | SessionTranscriptMessage
  | SessionTranscriptCompaction;

export function isSessionTranscriptHeader(
  value: SessionTranscriptRecord
): value is SessionTranscriptHeader {
  return value.type === "session";
}

export function isSessionTranscriptMessage(
  value: SessionTranscriptRecord
): value is SessionTranscriptMessage {
  return value.type === "message";
}

export function isSessionTranscriptCompaction(
  value: SessionTranscriptRecord
): value is SessionTranscriptCompaction {
  return value.type === "compaction";
}
