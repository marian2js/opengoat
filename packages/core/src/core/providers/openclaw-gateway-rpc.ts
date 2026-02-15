import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";
import { WebSocket } from "ws";

const DEFAULT_GATEWAY_PORT = 18_789;
const DEFAULT_GATEWAY_URL = `ws://127.0.0.1:${DEFAULT_GATEWAY_PORT}`;
const DEFAULT_TIMEOUT_MS = 10_000;
const CONNECT_DELAY_MS = 750;
const AGENT_CALL_TIMEOUT_MS = 630_000;
const PROTOCOL_VERSION = 3;
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

interface GatewayConnectionDetails {
  url: string;
  token?: string;
  password?: string;
  stateDir: string;
}

interface GatewayRequestOptions {
  expectFinal?: boolean;
  timeoutMs?: number;
}

export interface GatewayCallParams {
  env: NodeJS.ProcessEnv;
  method: string;
  params?: unknown;
  options?: GatewayRequestOptions;
}

interface GatewayResponseFrame {
  type: "res";
  id?: unknown;
  ok?: unknown;
  payload?: unknown;
  error?: {
    message?: unknown;
  };
}

interface GatewayEventFrame {
  type: "event";
  event?: unknown;
  payload?: unknown;
}

type GatewayFrame = GatewayResponseFrame | GatewayEventFrame;

export async function callOpenClawGatewayRpc(
  params: GatewayCallParams,
): Promise<unknown> {
  const method = params.method.trim();
  if (!method) {
    throw new Error("Gateway method is required.");
  }

  const connection = resolveGatewayConnectionFromEnv(params.env);
  const timeoutMs = sanitizeTimeout(params.options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const expectFinal = params.options?.expectFinal === true;

  return new Promise<unknown>((resolve, reject) => {
    const socket = new WebSocket(connection.url, {
      maxPayload: 25 * 1024 * 1024,
    });
    let settled = false;
    let closed = false;
    let connectRequestId: string | undefined;
    let requestId: string | undefined;
    let connectSent = false;
    let connectChallengeNonce: string | undefined;
    const identity = loadOrCreateDeviceIdentity(connection.stateDir);
    const role = "operator";
    const scopes = ["operator.admin", "operator.approvals", "operator.pairing"];
    const storedDeviceToken = loadDeviceAuthToken({
      stateDir: connection.stateDir,
      deviceId: identity.deviceId,
      role,
    });
    const authToken = connection.token ?? storedDeviceToken;

    const timer = setTimeout(() => {
      stop(new Error(`OpenClaw gateway timeout after ${timeoutMs}ms.`));
    }, timeoutMs);

    const stop = (error?: Error, payload?: unknown): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (!closed) {
        closed = true;
        socket.close();
      }
      if (error) {
        reject(error);
        return;
      }
      resolve(payload);
    };

    const sendFrame = (frame: Record<string, unknown>): void => {
      if (socket.readyState !== WebSocket.OPEN) {
        stop(new Error("OpenClaw gateway socket is not open."));
        return;
      }
      socket.send(JSON.stringify(frame));
    };

    const sendConnect = (): void => {
      if (settled || connectSent) {
        return;
      }
      connectSent = true;
      connectRequestId = randomUUID();
      const signedAtMs = Date.now();
      const payload = buildDeviceAuthPayload({
        deviceId: identity.deviceId,
        clientId: "gateway-client",
        clientMode: "backend",
        role,
        scopes,
        signedAtMs,
        token: authToken ?? null,
        nonce: connectChallengeNonce,
      });
      const signature = signDevicePayload(identity.privateKeyPem, payload);
      const connectFrame: Record<string, unknown> = {
        type: "req",
        id: connectRequestId,
        method: "connect",
        params: buildConnectParams({
          connection,
          authToken,
          role,
          scopes,
          signedAtMs,
          nonce: connectChallengeNonce,
          deviceId: identity.deviceId,
          publicKey: publicKeyRawBase64UrlFromPem(identity.publicKeyPem),
          signature,
        }),
      };
      sendFrame(connectFrame);
    };

    const sendMethod = (): void => {
      if (settled) {
        return;
      }
      requestId = randomUUID();
      const methodFrame: Record<string, unknown> = {
        type: "req",
        id: requestId,
        method,
        params: params.params ?? {},
      };
      sendFrame(methodFrame);
    };

    socket.on("open", () => {
      setTimeout(() => {
        sendConnect();
      }, CONNECT_DELAY_MS);
    });

    socket.on("message", (raw) => {
      const frame = parseFrame(raw.toString());
      if (!frame || settled) {
        return;
      }

      if (frame.type === "event") {
        if (frame.event === "connect.challenge") {
          const payload = asRecord(frame.payload);
          const nonce = payload.nonce;
          if (typeof nonce === "string" && nonce.trim().length > 0) {
            connectChallengeNonce = nonce.trim();
            if (!connectSent) {
              sendConnect();
            }
          }
        }
        return;
      }

      const frameId = typeof frame.id === "string" ? frame.id : "";
      if (!frameId) {
        return;
      }

      if (connectRequestId && frameId === connectRequestId) {
        if (frame.ok !== true) {
          if (isUnauthorizedDeviceToken(frame.error)) {
            clearDeviceAuthToken({
              stateDir: connection.stateDir,
              deviceId: identity.deviceId,
              role,
            });
          }
          stop(new Error(resolveGatewayError(frame, "OpenClaw gateway connect failed.")));
          return;
        }
        const auth = asRecord(asRecord(frame.payload).auth);
        if (typeof auth.deviceToken === "string" && auth.deviceToken.trim().length > 0) {
          storeDeviceAuthToken({
            stateDir: connection.stateDir,
            deviceId: identity.deviceId,
            role: typeof auth.role === "string" && auth.role.trim().length > 0 ? auth.role : role,
            token: auth.deviceToken.trim(),
            scopes: Array.isArray(auth.scopes) ? auth.scopes.filter((entry): entry is string => typeof entry === "string") : scopes,
          });
        }
        sendMethod();
        return;
      }

      if (requestId && frameId === requestId) {
        if (frame.ok !== true) {
          stop(new Error(resolveGatewayError(frame, `OpenClaw gateway "${method}" failed.`)));
          return;
        }

        if (
          expectFinal &&
          typeof asRecord(frame.payload).status === "string" &&
          asRecord(frame.payload).status === "accepted"
        ) {
          return;
        }

        stop(undefined, frame.payload);
      }
    });

    socket.on("error", (error) => {
      stop(error instanceof Error ? error : new Error(String(error)));
    });

    socket.on("close", (_code, reason) => {
      if (!settled) {
        const text = reason.toString().trim();
        stop(new Error(`OpenClaw gateway connection closed${text ? `: ${text}` : "."}`));
        return;
      }
      closed = true;
    });
  });
}

export function resolveGatewayConnectionFromEnv(
  env: NodeJS.ProcessEnv,
): GatewayConnectionDetails {
  const stateDir = resolveStateDir(env);
  const config = readOpenClawConfig(env, stateDir);
  const parsedArgs = parseOpenClawArguments(env.OPENCLAW_ARGUMENTS ?? "");
  const gateway = asRecord(config.gateway);
  const remote = asRecord(gateway.remote);
  const mode = typeof gateway.mode === "string" ? gateway.mode.trim().toLowerCase() : "";
  const localPort = resolveGatewayPort(gateway.port);
  const localScheme = gateway.tls && asRecord(gateway.tls).enabled === true ? "wss" : "ws";
  const rawUrl =
    env.OPENCLAW_GATEWAY_URL?.trim() ||
    parsedArgs.remoteUrl ||
    (mode === "remote" && typeof remote.url === "string" && remote.url.trim().length > 0
      ? remote.url.trim()
      : undefined) ||
    `${localScheme}://127.0.0.1:${localPort}` ||
    DEFAULT_GATEWAY_URL;
  const url = normalizeGatewayUrl(rawUrl);
  const gatewayAuth = asRecord(gateway.auth);
  const token =
    env.OPENCLAW_GATEWAY_TOKEN?.trim() ||
    parsedArgs.token ||
    (mode === "remote" && typeof remote.token === "string" && remote.token.trim().length > 0
      ? remote.token.trim()
      : undefined) ||
    (typeof gatewayAuth.token === "string" && gatewayAuth.token.trim().length > 0
      ? gatewayAuth.token.trim()
      : undefined) ||
    env.OPENCLAW_GATEWAY_PASSWORD?.trim() ||
    undefined;
  const password =
    env.OPENCLAW_GATEWAY_PASSWORD?.trim() ||
    parsedArgs.password ||
    (mode === "remote" && typeof remote.password === "string" && remote.password.trim().length > 0
      ? remote.password.trim()
      : undefined) ||
    (typeof gatewayAuth.password === "string" && gatewayAuth.password.trim().length > 0
      ? gatewayAuth.password.trim()
      : undefined) ||
    undefined;

  return {
    url,
    token,
    password,
    stateDir,
  };
}

export function resolveGatewayAgentCallTimeoutMs(
  timeoutMs?: number,
): number {
  return sanitizeTimeout(timeoutMs ?? AGENT_CALL_TIMEOUT_MS);
}

function buildConnectParams(params: {
  connection: GatewayConnectionDetails;
  authToken?: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  nonce?: string;
  deviceId: string;
  publicKey: string;
  signature: string;
}): Record<string, unknown> {
  const result: Record<string, unknown> = {
    minProtocol: PROTOCOL_VERSION,
    maxProtocol: PROTOCOL_VERSION,
    client: {
      id: "gateway-client",
      displayName: "OpenGoat",
      version: "opengoat",
      platform: process.platform,
      mode: "backend",
      instanceId: randomUUID(),
    },
    caps: [],
    role: params.role,
    scopes: params.scopes,
    device: {
      id: params.deviceId,
      publicKey: params.publicKey,
      signature: params.signature,
      signedAt: params.signedAtMs,
      nonce: params.nonce,
    },
  };

  if (params.authToken || params.connection.password) {
    result.auth = {
      ...(params.authToken ? { token: params.authToken } : {}),
      ...(params.connection.password ? { password: params.connection.password } : {}),
    };
  }

  return result;
}

function parseOpenClawArguments(raw: string): {
  remoteUrl?: string;
  token?: string;
  password?: string;
} {
  const parts = raw
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  let remoteUrl: string | undefined;
  let token: string | undefined;
  let password: string | undefined;
  for (let index = 0; index < parts.length; index += 1) {
    const tokenValue = parts[index];
    const next = parts[index + 1];
    if (!tokenValue) {
      continue;
    }

    if (tokenValue === "--remote" && next) {
      remoteUrl = next;
      index += 1;
      continue;
    }
    if (tokenValue === "--token" && next) {
      token = next;
      index += 1;
      continue;
    }
    if (tokenValue === "--password" && next) {
      password = next;
      index += 1;
      continue;
    }
  }

  return {
    remoteUrl: remoteUrl?.trim() || undefined,
    token: token?.trim() || undefined,
    password: password?.trim() || undefined,
  };
}

function normalizeGatewayUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("http://")) {
    return `ws://${trimmed.slice("http://".length)}`;
  }
  if (trimmed.startsWith("https://")) {
    return `wss://${trimmed.slice("https://".length)}`;
  }
  return trimmed;
}

function resolveGatewayError(frame: GatewayResponseFrame, fallback: string): string {
  const record = asRecord(frame.error);
  const message = record.message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message.trim();
  }
  return fallback;
}

function isUnauthorizedDeviceToken(errorPayload: unknown): boolean {
  const message = asRecord(errorPayload).message;
  if (typeof message !== "string") {
    return false;
  }
  const normalized = message.toLowerCase();
  return normalized.includes("invalid device token") || normalized.includes("device token mismatch");
}

function parseFrame(raw: string): GatewayFrame | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const record = asRecord(parsed);
    const type = record.type;
    if (type === "event" || type === "res") {
      return {
        ...record,
        type,
      } as unknown as GatewayFrame;
    }
  } catch {
    // Ignore malformed frames.
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function resolveGatewayPort(value: unknown): number {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value.trim())
        : NaN;
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_GATEWAY_PORT;
  }
  return Math.floor(raw);
}

function resolveStateDir(env: NodeJS.ProcessEnv): string {
  const raw =
    env.OPENCLAW_STATE_DIR?.trim() || env.CLAWDBOT_STATE_DIR?.trim() || "";
  if (raw.length > 0) {
    return resolveUserPath(raw, env);
  }
  return resolvePath(homedir(), ".openclaw");
}

function resolveConfigPath(env: NodeJS.ProcessEnv, stateDir: string): string {
  const raw = env.OPENCLAW_CONFIG_PATH?.trim() || env.CLAWDBOT_CONFIG_PATH?.trim() || "";
  if (raw.length > 0) {
    return resolveUserPath(raw, env);
  }
  return join(stateDir, "openclaw.json");
}

function resolveUserPath(input: string, env: NodeJS.ProcessEnv): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("~")) {
    return resolvePath(trimmed);
  }
  if (trimmed === "~") {
    return homedir();
  }
  if (trimmed.startsWith("~/")) {
    return resolvePath(homedir(), trimmed.slice(2));
  }
  const slashIndex = trimmed.indexOf("/");
  const variableName = slashIndex >= 0 ? trimmed.slice(1, slashIndex) : trimmed.slice(1);
  const remainder = slashIndex >= 0 ? trimmed.slice(slashIndex + 1) : "";
  const resolvedVariable = env[variableName];
  if (resolvedVariable && resolvedVariable.trim().length > 0) {
    return resolvePath(resolvedVariable.trim(), remainder);
  }
  return resolvePath(trimmed.replace(/^~+/, homedir()));
}

function readOpenClawConfig(
  env: NodeJS.ProcessEnv,
  stateDir: string,
): Record<string, unknown> {
  const configPath = resolveConfigPath(env, stateDir);
  try {
    if (!existsSync(configPath)) {
      return {};
    }
    return parseLooseJson(readFileSync(configPath, "utf8")) ?? {};
  } catch {
    return {};
  }
}

type DeviceIdentity = {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
};

function resolveDeviceIdentityPath(stateDir: string): string {
  return join(stateDir, "identity", "device.json");
}

function resolveDeviceAuthPath(stateDir: string): string {
  return join(stateDir, "identity", "device-auth.json");
}

function loadOrCreateDeviceIdentity(stateDir: string): DeviceIdentity {
  const filePath = resolveDeviceIdentityPath(stateDir);
  try {
    if (existsSync(filePath)) {
      const parsed = parseLooseJson(readFileSync(filePath, "utf8"));
      const deviceId =
        typeof parsed?.deviceId === "string" ? parsed.deviceId : "";
      const publicKeyPem =
        typeof parsed?.publicKeyPem === "string" ? parsed.publicKeyPem : "";
      const privateKeyPem =
        typeof parsed?.privateKeyPem === "string" ? parsed.privateKeyPem : "";
      if (deviceId && publicKeyPem && privateKeyPem) {
        const derivedId = fingerprintPublicKey(publicKeyPem);
        if (derivedId !== deviceId) {
          const updated = {
            ...(parsed ?? {}),
            version: 1,
            deviceId: derivedId,
            publicKeyPem,
            privateKeyPem,
          };
          writeSecureJson(filePath, updated);
          return { deviceId: derivedId, publicKeyPem, privateKeyPem };
        }
        return { deviceId, publicKeyPem, privateKeyPem };
      }
    }
  } catch {
    // Fall through and regenerate.
  }

  const identity = generateIdentity();
  writeSecureJson(filePath, {
    version: 1,
    deviceId: identity.deviceId,
    publicKeyPem: identity.publicKeyPem,
    privateKeyPem: identity.privateKeyPem,
    createdAtMs: Date.now(),
  });
  return identity;
}

function generateIdentity(): DeviceIdentity {
  const pair = generateKeyPairSync("ed25519");
  const publicKeyPem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  return {
    deviceId: fingerprintPublicKey(publicKeyPem),
    publicKeyPem,
    privateKeyPem,
  };
}

function publicKeyRawFromPem(publicKeyPem: string): Buffer {
  const der = createPublicKey(publicKeyPem).export({
    type: "spki",
    format: "der",
  }) as Buffer;
  if (
    der.length === ED25519_SPKI_PREFIX.length + 32 &&
    der.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return der.subarray(ED25519_SPKI_PREFIX.length);
  }
  return der;
}

function publicKeyRawBase64UrlFromPem(publicKeyPem: string): string {
  return base64UrlEncode(publicKeyRawFromPem(publicKeyPem));
}

function fingerprintPublicKey(publicKeyPem: string): string {
  return createHash("sha256").update(publicKeyRawFromPem(publicKeyPem)).digest("hex");
}

function signDevicePayload(privateKeyPem: string, payload: string): string {
  const key = createPrivateKey(privateKeyPem);
  return base64UrlEncode(sign(null, Buffer.from(payload, "utf8"), key));
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string | null;
  nonce?: string;
}): string {
  const version = params.nonce ? "v2" : "v1";
  const base = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAtMs),
    params.token ?? "",
  ];
  if (version === "v2") {
    base.push(params.nonce ?? "");
  }
  return base.join("|");
}

function loadDeviceAuthToken(params: {
  stateDir: string;
  deviceId: string;
  role: string;
}): string | undefined {
  const store = readDeviceAuthStore(params.stateDir);
  if (!store || store.deviceId !== params.deviceId) {
    return undefined;
  }
  const entry = asRecord(store.tokens)[params.role];
  const token = asRecord(entry).token;
  if (typeof token === "string" && token.trim().length > 0) {
    return token.trim();
  }
  return undefined;
}

function storeDeviceAuthToken(params: {
  stateDir: string;
  deviceId: string;
  role: string;
  token: string;
  scopes: string[];
}): void {
  const filePath = resolveDeviceAuthPath(params.stateDir);
  const existing = readDeviceAuthStore(params.stateDir);
  const normalizedRole = params.role.trim() || "operator";
  const next: Record<string, unknown> = {
    version: 1,
    deviceId: params.deviceId,
    tokens: {},
  };
  if (existing && existing.deviceId === params.deviceId && existing.tokens && typeof existing.tokens === "object") {
    next.tokens = { ...(existing.tokens as Record<string, unknown>) };
  }
  (next.tokens as Record<string, unknown>)[normalizedRole] = {
    token: params.token,
    role: normalizedRole,
    scopes: [...new Set(params.scopes.map((scope) => scope.trim()).filter(Boolean))].sort(),
    updatedAtMs: Date.now(),
  };
  writeSecureJson(filePath, next);
}

function clearDeviceAuthToken(params: {
  stateDir: string;
  deviceId: string;
  role: string;
}): void {
  const filePath = resolveDeviceAuthPath(params.stateDir);
  const existing = readDeviceAuthStore(params.stateDir);
  if (!existing || existing.deviceId !== params.deviceId) {
    return;
  }
  const tokens = existing.tokens && typeof existing.tokens === "object"
    ? { ...(existing.tokens as Record<string, unknown>) }
    : {};
  delete tokens[params.role];
  writeSecureJson(filePath, {
    version: 1,
    deviceId: existing.deviceId,
    tokens,
  });
}

function readDeviceAuthStore(
  stateDir: string,
): { deviceId: string; tokens: Record<string, unknown> } | undefined {
  const filePath = resolveDeviceAuthPath(stateDir);
  try {
    if (!existsSync(filePath)) {
      return undefined;
    }
    const parsed = parseLooseJson(readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed.deviceId !== "string" || !parsed.deviceId.trim()) {
      return undefined;
    }
    const tokens = parsed.tokens;
    if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) {
      return undefined;
    }
    return {
      deviceId: parsed.deviceId.trim(),
      tokens: tokens as Record<string, unknown>,
    };
  } catch {
    return undefined;
  }
}

function writeSecureJson(filePath: string, payload: Record<string, unknown>): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Ignore chmod failures on platforms where mode adjustments are unsupported.
  }
}

function parseLooseJson(raw: string): Record<string, unknown> | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return asRecord(parsed);
  } catch {
    // Continue trying from likely JSON starts.
  }

  const starts = [
    trimmed.indexOf("{"),
    trimmed.lastIndexOf("{"),
    trimmed.indexOf("["),
    trimmed.lastIndexOf("["),
  ].filter((value, index, arr) => value >= 0 && arr.indexOf(value) === index);
  for (const start of starts) {
    const candidate = trimmed.slice(start).trim();
    if (!candidate) {
      continue;
    }
    try {
      const parsed = JSON.parse(candidate) as unknown;
      return asRecord(parsed);
    } catch {
      // Keep trying.
    }
  }
  return undefined;
}

function sanitizeTimeout(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  const floored = Math.floor(raw);
  return Math.min(Math.max(floored, 1), 2_147_483_647);
}
