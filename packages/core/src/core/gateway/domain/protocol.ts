export const OPENGOAT_GATEWAY_PROTOCOL_VERSION = 1 as const;

export const OPENGOAT_GATEWAY_DEFAULTS = {
  path: "/gateway",
  handshakeTimeoutMs: 10_000,
  maxPayloadBytes: 512 * 1024,
  maxBufferedBytes: 1.5 * 1024 * 1024,
  tickIntervalMs: 30_000,
  idempotencyTtlMs: 5 * 60_000,
  idempotencyMaxEntries: 1000,
  rateLimitPerMinute: 180
} as const;

export const OPENGOAT_GATEWAY_SCOPES = {
  read: "operator.read",
  write: "operator.write",
  admin: "operator.admin"
} as const;

export type OpenGoatGatewayScope =
  | (typeof OPENGOAT_GATEWAY_SCOPES)["read"]
  | (typeof OPENGOAT_GATEWAY_SCOPES)["write"]
  | (typeof OPENGOAT_GATEWAY_SCOPES)["admin"];

export const OPENGOAT_GATEWAY_METHODS = [
  "health",
  "agent.list",
  "agent.run",
  "session.list",
  "session.history"
] as const;

export type OpenGoatGatewayMethod = (typeof OPENGOAT_GATEWAY_METHODS)[number];

export const OPENGOAT_GATEWAY_EVENTS = ["connect.challenge", "tick", "agent.stream"] as const;

export type OpenGoatGatewayEvent = (typeof OPENGOAT_GATEWAY_EVENTS)[number];

export const OPENGOAT_GATEWAY_ERROR_CODES = {
  invalidRequest: "INVALID_REQUEST",
  protocolMismatch: "PROTOCOL_MISMATCH",
  unauthorized: "UNAUTHORIZED",
  forbidden: "FORBIDDEN",
  rateLimited: "RATE_LIMITED",
  unavailable: "UNAVAILABLE"
} as const;

export interface OpenGoatGatewayErrorShape {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
}

export interface OpenGoatGatewayRequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

export interface OpenGoatGatewayResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: OpenGoatGatewayErrorShape;
}

export interface OpenGoatGatewayEventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
}

export interface OpenGoatGatewayClientInfo {
  id: string;
  displayName?: string;
  version: string;
  platform: string;
  mode: string;
  instanceId?: string;
}

export interface OpenGoatGatewayConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: OpenGoatGatewayClientInfo;
  role?: "operator";
  scopes?: OpenGoatGatewayScope[];
  auth?: {
    token?: string;
  };
  nonce?: string;
  locale?: string;
  userAgent?: string;
}

export interface OpenGoatGatewayAgentRunParams {
  idempotencyKey: string;
  message: string;
  agentId?: string;
  sessionRef?: string;
  forceNewSession?: boolean;
  disableSession?: boolean;
  cwd?: string;
  model?: string;
}

export interface OpenGoatGatewaySessionListParams {
  agentId?: string;
  activeMinutes?: number;
}

export interface OpenGoatGatewaySessionHistoryParams {
  agentId?: string;
  sessionRef?: string;
  limit?: number;
  includeCompaction?: boolean;
}

interface ParseSuccess<T> {
  ok: true;
  value: T;
}

interface ParseFailure {
  ok: false;
  error: string;
}

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

const CONNECT_PARAMS_KEYS = new Set([
  "minProtocol",
  "maxProtocol",
  "client",
  "role",
  "scopes",
  "auth",
  "nonce",
  "locale",
  "userAgent"
]);

const CONNECT_CLIENT_KEYS = new Set(["id", "displayName", "version", "platform", "mode", "instanceId"]);

const CONNECT_AUTH_KEYS = new Set(["token"]);

const AGENT_RUN_KEYS = new Set([
  "idempotencyKey",
  "message",
  "agentId",
  "sessionRef",
  "forceNewSession",
  "disableSession",
  "cwd",
  "model"
]);

const SESSION_LIST_KEYS = new Set(["agentId", "activeMinutes"]);

const SESSION_HISTORY_KEYS = new Set(["agentId", "sessionRef", "limit", "includeCompaction"]);

export function isOpenGoatGatewayMethod(value: string): value is OpenGoatGatewayMethod {
  return (OPENGOAT_GATEWAY_METHODS as readonly string[]).includes(value);
}

export function isReadMethod(method: OpenGoatGatewayMethod): boolean {
  return method !== "agent.run";
}

export function parseGatewayRequestFrame(input: unknown): ParseResult<OpenGoatGatewayRequestFrame> {
  const record = asRecord(input);
  if (!record) {
    return { ok: false, error: "frame must be an object" };
  }

  if (!hasOnlyKeys(record, new Set(["type", "id", "method", "params"]))) {
    return { ok: false, error: "frame has unknown fields" };
  }

  if (record.type !== "req") {
    return { ok: false, error: "frame.type must be req" };
  }

  const id = parseString(record.id, "id", 1, 200);
  if (!id.ok) {
    return id;
  }

  const method = parseString(record.method, "method", 1, 120);
  if (!method.ok) {
    return method;
  }

  return {
    ok: true,
    value: {
      type: "req",
      id: id.value,
      method: method.value,
      params: record.params
    }
  };
}

export function parseConnectParams(input: unknown): ParseResult<OpenGoatGatewayConnectParams> {
  const record = asRecord(input);
  if (!record) {
    return { ok: false, error: "connect params must be an object" };
  }
  if (!hasOnlyKeys(record, CONNECT_PARAMS_KEYS)) {
    return { ok: false, error: "connect params contain unknown fields" };
  }

  const minProtocol = parseInteger(record.minProtocol, "minProtocol", 1, 1000);
  if (!minProtocol.ok) {
    return minProtocol;
  }

  const maxProtocol = parseInteger(record.maxProtocol, "maxProtocol", 1, 1000);
  if (!maxProtocol.ok) {
    return maxProtocol;
  }

  const clientRecord = asRecord(record.client);
  if (!clientRecord) {
    return { ok: false, error: "client must be an object" };
  }
  if (!hasOnlyKeys(clientRecord, CONNECT_CLIENT_KEYS)) {
    return { ok: false, error: "client contains unknown fields" };
  }

  const clientId = parseString(clientRecord.id, "client.id", 1, 120);
  if (!clientId.ok) {
    return clientId;
  }

  const clientVersion = parseString(clientRecord.version, "client.version", 1, 80);
  if (!clientVersion.ok) {
    return clientVersion;
  }

  const clientPlatform = parseString(clientRecord.platform, "client.platform", 1, 80);
  if (!clientPlatform.ok) {
    return clientPlatform;
  }

  const clientMode = parseString(clientRecord.mode, "client.mode", 1, 80);
  if (!clientMode.ok) {
    return clientMode;
  }

  const clientDisplayName = parseOptionalString(clientRecord.displayName, "client.displayName", 1, 120);
  if (!clientDisplayName.ok) {
    return clientDisplayName;
  }

  const clientInstanceId = parseOptionalString(clientRecord.instanceId, "client.instanceId", 1, 120);
  if (!clientInstanceId.ok) {
    return clientInstanceId;
  }

  let role: "operator" | undefined;
  if (record.role !== undefined) {
    if (record.role !== "operator") {
      return { ok: false, error: "role must be operator" };
    }
    role = "operator";
  }

  let scopes: OpenGoatGatewayScope[] | undefined;
  if (record.scopes !== undefined) {
    if (!Array.isArray(record.scopes)) {
      return { ok: false, error: "scopes must be an array" };
    }

    const parsedScopes: OpenGoatGatewayScope[] = [];
    for (const scope of record.scopes) {
      const parsed = parseString(scope, "scopes[]", 1, 80);
      if (!parsed.ok) {
        return parsed;
      }
      if (!isScope(parsed.value)) {
        return { ok: false, error: `unsupported scope: ${parsed.value}` };
      }
      parsedScopes.push(parsed.value);
    }

    scopes = dedupeScopes(parsedScopes);
  }

  let auth: { token?: string } | undefined;
  if (record.auth !== undefined) {
    const authRecord = asRecord(record.auth);
    if (!authRecord) {
      return { ok: false, error: "auth must be an object" };
    }
    if (!hasOnlyKeys(authRecord, CONNECT_AUTH_KEYS)) {
      return { ok: false, error: "auth contains unknown fields" };
    }
    const token = parseOptionalString(authRecord.token, "auth.token", 8, 512);
    if (!token.ok) {
      return token;
    }
    auth = token.value ? { token: token.value } : {};
  }

  const nonce = parseOptionalString(record.nonce, "nonce", 1, 200);
  if (!nonce.ok) {
    return nonce;
  }

  const locale = parseOptionalString(record.locale, "locale", 1, 40);
  if (!locale.ok) {
    return locale;
  }

  const userAgent = parseOptionalString(record.userAgent, "userAgent", 1, 512);
  if (!userAgent.ok) {
    return userAgent;
  }

  return {
    ok: true,
    value: {
      minProtocol: minProtocol.value,
      maxProtocol: maxProtocol.value,
      client: {
        id: clientId.value,
        displayName: clientDisplayName.value,
        version: clientVersion.value,
        platform: clientPlatform.value,
        mode: clientMode.value,
        instanceId: clientInstanceId.value
      },
      role,
      scopes,
      auth,
      nonce: nonce.value,
      locale: locale.value,
      userAgent: userAgent.value
    }
  };
}

export function parseAgentRunParams(input: unknown): ParseResult<OpenGoatGatewayAgentRunParams> {
  const record = asRecord(input);
  if (!record) {
    return { ok: false, error: "agent.run params must be an object" };
  }
  if (!hasOnlyKeys(record, AGENT_RUN_KEYS)) {
    return { ok: false, error: "agent.run params contain unknown fields" };
  }

  const idempotencyKey = parseString(record.idempotencyKey, "idempotencyKey", 1, 200);
  if (!idempotencyKey.ok) {
    return idempotencyKey;
  }

  const message = parseString(record.message, "message", 1, 100_000);
  if (!message.ok) {
    return message;
  }

  const agentId = parseOptionalString(record.agentId, "agentId", 1, 120);
  if (!agentId.ok) {
    return agentId;
  }

  const sessionRef = parseOptionalString(record.sessionRef, "sessionRef", 1, 200);
  if (!sessionRef.ok) {
    return sessionRef;
  }

  const forceNewSession = parseOptionalBoolean(record.forceNewSession, "forceNewSession");
  if (!forceNewSession.ok) {
    return forceNewSession;
  }

  const disableSession = parseOptionalBoolean(record.disableSession, "disableSession");
  if (!disableSession.ok) {
    return disableSession;
  }

  const cwd = parseOptionalString(record.cwd, "cwd", 1, 4096);
  if (!cwd.ok) {
    return cwd;
  }

  const model = parseOptionalString(record.model, "model", 1, 160);
  if (!model.ok) {
    return model;
  }

  return {
    ok: true,
    value: {
      idempotencyKey: idempotencyKey.value,
      message: message.value,
      agentId: agentId.value,
      sessionRef: sessionRef.value,
      forceNewSession: forceNewSession.value,
      disableSession: disableSession.value,
      cwd: cwd.value,
      model: model.value
    }
  };
}

export function parseSessionListParams(input: unknown): ParseResult<OpenGoatGatewaySessionListParams> {
  if (input === undefined || input === null) {
    return { ok: true, value: {} };
  }

  const record = asRecord(input);
  if (!record) {
    return { ok: false, error: "session.list params must be an object" };
  }
  if (!hasOnlyKeys(record, SESSION_LIST_KEYS)) {
    return { ok: false, error: "session.list params contain unknown fields" };
  }

  const agentId = parseOptionalString(record.agentId, "agentId", 1, 120);
  if (!agentId.ok) {
    return agentId;
  }

  let activeMinutes: number | undefined;
  if (record.activeMinutes !== undefined) {
    const value = parseInteger(record.activeMinutes, "activeMinutes", 1, 60 * 24 * 365);
    if (!value.ok) {
      return value;
    }
    activeMinutes = value.value;
  }

  return {
    ok: true,
    value: {
      agentId: agentId.value,
      activeMinutes
    }
  };
}

export function parseSessionHistoryParams(input: unknown): ParseResult<OpenGoatGatewaySessionHistoryParams> {
  if (input === undefined || input === null) {
    return { ok: true, value: {} };
  }

  const record = asRecord(input);
  if (!record) {
    return { ok: false, error: "session.history params must be an object" };
  }
  if (!hasOnlyKeys(record, SESSION_HISTORY_KEYS)) {
    return { ok: false, error: "session.history params contain unknown fields" };
  }

  const agentId = parseOptionalString(record.agentId, "agentId", 1, 120);
  if (!agentId.ok) {
    return agentId;
  }

  const sessionRef = parseOptionalString(record.sessionRef, "sessionRef", 1, 200);
  if (!sessionRef.ok) {
    return sessionRef;
  }

  let limit: number | undefined;
  if (record.limit !== undefined) {
    const parsedLimit = parseInteger(record.limit, "limit", 1, 5000);
    if (!parsedLimit.ok) {
      return parsedLimit;
    }
    limit = parsedLimit.value;
  }

  const includeCompaction = parseOptionalBoolean(record.includeCompaction, "includeCompaction");
  if (!includeCompaction.ok) {
    return includeCompaction;
  }

  return {
    ok: true,
    value: {
      agentId: agentId.value,
      sessionRef: sessionRef.value,
      limit,
      includeCompaction: includeCompaction.value
    }
  };
}

function parseString(value: unknown, field: string, minLength: number, maxLength: number): ParseResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a string` };
  }
  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    return { ok: false, error: `${field} must be at least ${minLength} character(s)` };
  }
  if (trimmed.length > maxLength) {
    return { ok: false, error: `${field} must be at most ${maxLength} character(s)` };
  }
  return { ok: true, value: trimmed };
}

function parseOptionalString(
  value: unknown,
  field: string,
  minLength: number,
  maxLength: number
): ParseResult<string | undefined> {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }
  return parseString(value, field, minLength, maxLength);
}

function parseInteger(value: unknown, field: string, min: number, max: number): ParseResult<number> {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return { ok: false, error: `${field} must be an integer` };
  }
  if (value < min || value > max) {
    return { ok: false, error: `${field} must be between ${min} and ${max}` };
  }
  return { ok: true, value };
}

function parseOptionalBoolean(value: unknown, field: string): ParseResult<boolean | undefined> {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }
  if (typeof value !== "boolean") {
    return { ok: false, error: `${field} must be a boolean` };
  }
  return { ok: true, value };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isScope(value: string): value is OpenGoatGatewayScope {
  return (
    value === OPENGOAT_GATEWAY_SCOPES.read ||
    value === OPENGOAT_GATEWAY_SCOPES.write ||
    value === OPENGOAT_GATEWAY_SCOPES.admin
  );
}

function dedupeScopes(scopes: OpenGoatGatewayScope[]): OpenGoatGatewayScope[] {
  return [...new Set(scopes)];
}
