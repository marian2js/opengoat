export interface AcpSessionMeta {
  agentId?: string;
  sessionKey?: string;
  forceNewSession?: boolean;
  disableSession?: boolean;
}

export function parseAcpSessionMeta(meta: unknown): AcpSessionMeta {
  if (!meta || typeof meta !== "object") {
    return {};
  }

  const record = meta as Record<string, unknown>;
  return {
    agentId: readString(record, ["agentId", "agent", "targetAgent"]),
    sessionKey: readString(record, ["sessionKey", "sessionRef", "session"]),
    forceNewSession: readBool(record, ["forceNewSession", "newSession"]),
    disableSession: readBool(record, ["disableSession", "noSession"])
  };
}

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function readBool(record: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return undefined;
}
