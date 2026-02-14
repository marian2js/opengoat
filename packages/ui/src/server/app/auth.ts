import {
  createHmac,
  randomBytes,
  scrypt as scryptWithCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  SCRYPT_BLOCK_SIZE,
  SCRYPT_COST,
  SCRYPT_KEY_LENGTH,
  SCRYPT_PARALLELIZATION,
  UI_AUTH_ATTEMPT_WINDOW_MS,
  UI_AUTH_BLOCK_MS,
  UI_AUTH_COOKIE_NAME,
  UI_AUTH_MAX_FAILED_ATTEMPTS,
  UI_AUTH_MIN_PASSWORD_LENGTH,
  UI_AUTH_SESSION_TTL_SECONDS,
} from "./constants.js";
import type {
  UiAuthController,
  UiAuthenticationSettingsResponse,
  UiAuthenticationStatus,
  UiServerAuthenticationSettings,
} from "./types.js";

const scryptAsync = promisify(scryptWithCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: { N?: number; r?: number; p?: number; maxmem?: number },
) => Promise<Buffer>;

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

export function createUiAuthController(
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
  const isHttps = request.raw?.socket?.encrypted === true || forwardedProto === "https";
  const isLocalHost =
    host === "" || host === "localhost" || host === "127.0.0.1" || host === "::1";
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

export async function hashUiAuthenticationPassword(password: string): Promise<string> {
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

export async function verifyUiAuthenticationPassword(
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

function parseScryptPasswordHash(
  value: string,
): ScryptPasswordHashParts | undefined {
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

export function normalizeUiAuthenticationUsername(
  value: unknown,
): string | undefined {
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

export function normalizeUiAuthenticationPasswordHash(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  return parseScryptPasswordHash(normalized) ? normalized : undefined;
}

export function normalizePasswordInput(value: string): string {
  return value.normalize("NFKC");
}

export function validateUiAuthenticationPasswordStrength(
  password: string,
): string | undefined {
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

export function toAuthenticationSettingsResponse(
  current: UiServerAuthenticationSettings,
): UiAuthenticationSettingsResponse {
  const username = normalizeUiAuthenticationUsername(current.username) ?? "";
  const hasPassword = Boolean(
    normalizeUiAuthenticationPasswordHash(current.passwordHash),
  );
  return {
    enabled: current.enabled === true && hasPassword && Boolean(username),
    username,
    hasPassword,
  };
}

export function toAuthenticationStatus(
  enabled: boolean,
  authenticated: boolean,
): UiAuthenticationStatus {
  return {
    enabled,
    authenticated,
  };
}
