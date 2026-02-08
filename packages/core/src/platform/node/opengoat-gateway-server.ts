import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from "node:http";
import { randomUUID, timingSafeEqual, randomBytes } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import { DEFAULT_AGENT_ID } from "../../core/domain/agent-id.js";
import {
  OPENGOAT_GATEWAY_DEFAULTS,
  OPENGOAT_GATEWAY_ERROR_CODES,
  OPENGOAT_GATEWAY_EVENTS,
  OPENGOAT_GATEWAY_METHODS,
  OPENGOAT_GATEWAY_PROTOCOL_VERSION,
  OPENGOAT_GATEWAY_SCOPES,
  isOpenGoatGatewayMethod,
  isReadMethod,
  parseAgentRunParams,
  parseConnectParams,
  parseGatewayRequestFrame,
  parseSessionHistoryParams,
  parseSessionListParams,
  type OpenGoatGatewayClientInfo,
  type OpenGoatGatewayConnectParams,
  type OpenGoatGatewayErrorShape,
  type OpenGoatGatewayMethod,
  type OpenGoatGatewayResponseFrame,
  type OpenGoatGatewayScope
} from "../../core/gateway/index.js";

export interface OpenGoatGatewayService {
  getHomeDir(): string;
  listAgents(): Promise<unknown>;
  listSessions(agentId?: string, options?: { activeMinutes?: number }): Promise<unknown>;
  getSessionHistory(
    agentId?: string,
    options?: {
      sessionRef?: string;
      limit?: number;
      includeCompaction?: boolean;
    }
  ): Promise<unknown>;
  runAgent(
    agentId: string,
    options: {
      message: string;
      sessionRef?: string;
      forceNewSession?: boolean;
      disableSession?: boolean;
      cwd?: string;
      model?: string;
      onStdout?: (chunk: string) => void;
      onStderr?: (chunk: string) => void;
    }
  ): Promise<unknown>;
}

export interface OpenGoatGatewayServerOptions {
  port?: number;
  bindHost?: string;
  path?: string;
  authToken?: string;
  requireAuth?: boolean;
  allowedOrigins?: string[];
  handshakeTimeoutMs?: number;
  maxPayloadBytes?: number;
  maxBufferedBytes?: number;
  tickIntervalMs?: number;
  rateLimitPerMinute?: number;
  idempotencyTtlMs?: number;
  idempotencyMaxEntries?: number;
  logger?: {
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown>): void;
    debug(message: string, context?: Record<string, unknown>): void;
  };
}

export interface OpenGoatGatewayServerHandle {
  readonly url: string;
  readonly port: number;
  readonly bindHost: string;
  readonly path: string;
  readonly authToken?: string;
  readonly closed: Promise<void>;
  close(): Promise<void>;
}

interface GatewayIdempotencyEntry {
  ts: number;
  response?: GatewayResponsePayload;
  pending?: Promise<GatewayResponsePayload>;
}

interface GatewayResponsePayload {
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: OpenGoatGatewayErrorShape;
}

interface ConnectedClient {
  readonly connId: string;
  readonly socket: WebSocket;
  readonly remoteAddress?: string;
  readonly requestHost?: string;
  readonly requestOrigin?: string;
  readonly connectedAtMs: number;
  readonly connectNonce: string;
  readonly requestTimes: number[];
  readonly maxBufferedBytes: number;
  connect?: OpenGoatGatewayConnectParams;
  scopes: OpenGoatGatewayScope[];
}

interface LoggerLike {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

interface GatewayRuntimeConfig {
  readonly bindHost: string;
  readonly path: string;
  readonly authToken?: string;
  readonly requireAuth: boolean;
  readonly allowedOrigins: string[];
  readonly handshakeTimeoutMs: number;
  readonly maxPayloadBytes: number;
  readonly maxBufferedBytes: number;
  readonly tickIntervalMs: number;
  readonly rateLimitPerMinute: number;
  readonly idempotencyTtlMs: number;
  readonly idempotencyMaxEntries: number;
}

const DEFAULT_GATEWAY_LOGGER: LoggerLike = {
  info: () => {
    // no-op
  },
  warn: () => {
    // no-op
  },
  error: () => {
    // no-op
  },
  debug: () => {
    // no-op
  }
};

export async function startOpenGoatGatewayServer(
  service: OpenGoatGatewayService,
  options: OpenGoatGatewayServerOptions = {}
): Promise<OpenGoatGatewayServerHandle> {
  const logger = options.logger ?? DEFAULT_GATEWAY_LOGGER;
  const config = buildRuntimeConfig(options);
  const startedAtMs = Date.now();

  const clients = new Map<string, ConnectedClient>();
  const idempotency = new Map<string, GatewayIdempotencyEntry>();
  let eventSeq = 0;

  const httpServer = createServer((request, response) => {
    handleHttpRequest(request, response, {
      startedAtMs,
      clients,
      path: config.path,
      protocolVersion: OPENGOAT_GATEWAY_PROTOCOL_VERSION,
      authRequired: config.requireAuth,
      hasAuthToken: Boolean(config.authToken)
    });
  });

  const websocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: config.maxPayloadBytes
  });

  httpServer.on("upgrade", (request, socket, head) => {
    const requestPath = resolveRequestPath(request);
    if (requestPath !== config.path) {
      socket.write("HTTP/1.1 404 Not Found\\r\\n\\r\\n");
      socket.destroy();
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (ws) => {
      websocketServer.emit("connection", ws, request);
    });
  });

  websocketServer.on("connection", (socket, request) => {
    const connId = randomUUID();
    const remoteAddress = request.socket.remoteAddress;
    const requestHost = headerValue(request.headers.host);
    const requestOrigin = headerValue(request.headers.origin);
    const connectNonce = randomUUID();

    const client: ConnectedClient = {
      connId,
      socket,
      remoteAddress,
      requestHost,
      requestOrigin,
      connectedAtMs: Date.now(),
      connectNonce,
      requestTimes: [],
      maxBufferedBytes: config.maxBufferedBytes,
      scopes: [OPENGOAT_GATEWAY_SCOPES.admin]
    };

    logger.info("Gateway websocket connected.", {
      connId,
      remoteAddress,
      requestHost,
      requestOrigin
    });

    sendEvent(client, {
      event: "connect.challenge",
      payload: { nonce: connectNonce, ts: Date.now() }
    });

    const handshakeTimer = setTimeout(() => {
      if (!client.connect) {
        logger.warn("Gateway websocket handshake timeout.", {
          connId,
          remoteAddress
        });
        closeSocket(client.socket, 1008, "handshake timeout");
      }
    }, config.handshakeTimeoutMs);

    socket.on("message", async (buffer) => {
      const text = toUtf8String(buffer);
      if (!text) {
        closeSocket(socket, 1008, "invalid payload");
        return;
      }

      let parsedFrame: unknown;
      try {
        parsedFrame = JSON.parse(text);
      } catch {
        sendError(client, {
          id: "invalid",
          code: OPENGOAT_GATEWAY_ERROR_CODES.invalidRequest,
          message: "invalid json frame"
        });
        if (!client.connect) {
          closeSocket(socket, 1008, "invalid json frame");
        }
        return;
      }

      const frame = parseGatewayRequestFrame(parsedFrame);
      if (!frame.ok) {
        sendError(client, {
          id: "invalid",
          code: OPENGOAT_GATEWAY_ERROR_CODES.invalidRequest,
          message: frame.error
        });
        if (!client.connect) {
          closeSocket(socket, 1008, frame.error);
        }
        return;
      }

      if (!client.connect) {
        if (frame.value.method !== "connect") {
          sendError(client, {
            id: frame.value.id,
            code: OPENGOAT_GATEWAY_ERROR_CODES.invalidRequest,
            message: "first request must be connect"
          });
          closeSocket(socket, 1008, "first request must be connect");
          return;
        }

        const connect = parseConnectParams(frame.value.params);
        if (!connect.ok) {
          sendError(client, {
            id: frame.value.id,
            code: OPENGOAT_GATEWAY_ERROR_CODES.invalidRequest,
            message: connect.error
          });
          closeSocket(socket, 1008, connect.error);
          return;
        }

        const authResult = authorizeConnect({
          connect: connect.value,
          authToken: config.authToken,
          requireAuth: config.requireAuth,
          challengeNonce: connectNonce,
          remoteAddress,
          allowedOrigins: config.allowedOrigins,
          requestHost,
          requestOrigin
        });

        if (!authResult.ok) {
          sendError(client, {
            id: frame.value.id,
            code: authResult.code,
            message: authResult.message
          });
          closeSocket(socket, 1008, authResult.message);
          return;
        }

        const scoped = resolveScopes(connect.value.scopes);
        client.connect = connect.value;
        client.scopes = scoped;
        clients.set(connId, client);
        clearTimeout(handshakeTimer);

        sendResponse(client, {
          id: frame.value.id,
          ok: true,
          payload: {
            type: "hello-ok",
            protocol: OPENGOAT_GATEWAY_PROTOCOL_VERSION,
            server: {
              version: process.env.npm_package_version ?? "dev",
              connId,
              startedAtMs
            },
            features: {
              methods: OPENGOAT_GATEWAY_METHODS,
              events: OPENGOAT_GATEWAY_EVENTS,
              optionalGateway: true
            },
            policy: {
              maxPayload: config.maxPayloadBytes,
              maxBufferedBytes: config.maxBufferedBytes,
              handshakeTimeoutMs: config.handshakeTimeoutMs,
              tickIntervalMs: config.tickIntervalMs,
              rateLimitPerMinute: config.rateLimitPerMinute,
              idempotencyTtlMs: config.idempotencyTtlMs
            },
            snapshot: {
              connectedClients: clients.size,
              uptimeMs: Date.now() - startedAtMs
            }
          }
        });

        logger.info("Gateway websocket authenticated.", {
          connId,
          clientId: connect.value.client.id,
          clientMode: connect.value.client.mode,
          scopes: scoped
        });

        return;
      }

      if (!checkRateLimit(client, config.rateLimitPerMinute)) {
        const retryAfterMs = resolveRateLimitRetryMs(client);
        sendError(client, {
          id: frame.value.id,
          code: OPENGOAT_GATEWAY_ERROR_CODES.rateLimited,
          message: "rate limit exceeded",
          retryable: true,
          retryAfterMs
        });
        return;
      }

      if (!isOpenGoatGatewayMethod(frame.value.method)) {
        sendError(client, {
          id: frame.value.id,
          code: OPENGOAT_GATEWAY_ERROR_CODES.invalidRequest,
          message: `unknown method: ${frame.value.method}`
        });
        return;
      }

      const method = frame.value.method;
      if (!isAuthorizedForMethod(method, client.scopes)) {
        sendError(client, {
          id: frame.value.id,
          code: OPENGOAT_GATEWAY_ERROR_CODES.forbidden,
          message: "missing scope"
        });
        return;
      }

      try {
        const response = await handleGatewayMethod({
          service,
          method,
          frameId: frame.value.id,
          params: frame.value.params,
          client,
          idempotency,
          idempotencyTtlMs: config.idempotencyTtlMs,
          idempotencyMaxEntries: config.idempotencyMaxEntries,
          logger,
          sendAgentEvent: (payload) => {
            sendEvent(client, {
              event: "agent.stream",
              payload
            });
          }
        });

        sendResponse(client, response);
      } catch (error) {
        logger.error("Gateway method failed.", {
          connId,
          method,
          error: String(error)
        });
        sendError(client, {
          id: frame.value.id,
          code: OPENGOAT_GATEWAY_ERROR_CODES.unavailable,
          message: toErrorMessage(error)
        });
      }
    });

    socket.on("close", () => {
      clearTimeout(handshakeTimer);
      clients.delete(connId);
      logger.info("Gateway websocket closed.", {
        connId,
        remoteAddress
      });
    });

    socket.on("error", (error) => {
      logger.warn("Gateway websocket error.", {
        connId,
        error: String(error)
      });
    });
  });

  const tickTimer = setInterval(() => {
    for (const client of clients.values()) {
      sendEvent(client, {
        event: "tick",
        payload: {
          ts: Date.now(),
          uptimeMs: Date.now() - startedAtMs
        },
        seq: ++eventSeq
      });
    }
  }, config.tickIntervalMs);

  const maintenanceTimer = setInterval(() => {
    cleanupIdempotencyEntries(idempotency, {
      ttlMs: config.idempotencyTtlMs,
      maxEntries: config.idempotencyMaxEntries
    });
  }, 60_000);

  const listenPort = options.port ?? 18789;
  await listen(httpServer, listenPort, config.bindHost);
  const boundPort = resolveServerPort(httpServer);
  const protocol = "ws";
  const url = `${protocol}://${formatHostForUrl(config.bindHost)}:${boundPort}${config.path}`;

  logger.info("OpenGoat gateway started.", {
    url,
    bindHost: config.bindHost,
    port: boundPort,
    authRequired: config.requireAuth,
    hasAuthToken: Boolean(config.authToken)
  });

  let closePromise: Promise<void> | undefined;
  let resolveClosed: (() => void) | undefined;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });

  const close = async (): Promise<void> => {
    if (closePromise) {
      await closePromise;
      return;
    }

    closePromise = (async () => {
      clearInterval(tickTimer);
      clearInterval(maintenanceTimer);
      for (const client of clients.values()) {
        closeSocket(client.socket, 1001, "server shutdown");
      }
      clients.clear();
      await Promise.all([closeWebSocketServer(websocketServer), closeHttpServer(httpServer)]);
      resolveClosed?.();
    })();

    await closePromise;
  };

  return {
    url,
    port: boundPort,
    bindHost: config.bindHost,
    path: config.path,
    authToken: config.authToken,
    closed,
    close
  };
}

async function handleGatewayMethod(params: {
  service: OpenGoatGatewayService;
  method: OpenGoatGatewayMethod;
  frameId: string;
  params: unknown;
  client: ConnectedClient;
  idempotency: Map<string, GatewayIdempotencyEntry>;
  idempotencyTtlMs: number;
  idempotencyMaxEntries: number;
  logger: LoggerLike;
  sendAgentEvent: (payload: { runId: string; stream: "stdout" | "stderr"; chunk: string }) => void;
}): Promise<GatewayResponsePayload> {
  const {
    service,
    method,
    frameId,
    params: methodParams,
    client,
    idempotency,
    idempotencyTtlMs,
    idempotencyMaxEntries,
    logger,
    sendAgentEvent
  } = params;

  if (method === "health") {
    return {
      id: frameId,
      ok: true,
      payload: {
        status: "ok",
        protocol: OPENGOAT_GATEWAY_PROTOCOL_VERSION,
        homeDir: service.getHomeDir(),
        connectedAtMs: client.connectedAtMs,
        serverTime: new Date().toISOString()
      }
    };
  }

  if (method === "agent.list") {
    return {
      id: frameId,
      ok: true,
      payload: {
        agents: await service.listAgents()
      }
    };
  }

  if (method === "session.list") {
    const parsed = parseSessionListParams(methodParams);
    if (!parsed.ok) {
      return {
        id: frameId,
        ok: false,
        error: toGatewayError({
          code: OPENGOAT_GATEWAY_ERROR_CODES.invalidRequest,
          message: parsed.error
        })
      };
    }

    const sessions = await service.listSessions(parsed.value.agentId ?? DEFAULT_AGENT_ID, {
      activeMinutes: parsed.value.activeMinutes
    });

    return {
      id: frameId,
      ok: true,
      payload: {
        sessions
      }
    };
  }

  if (method === "session.history") {
    const parsed = parseSessionHistoryParams(methodParams);
    if (!parsed.ok) {
      return {
        id: frameId,
        ok: false,
        error: toGatewayError({
          code: OPENGOAT_GATEWAY_ERROR_CODES.invalidRequest,
          message: parsed.error
        })
      };
    }

    const history = await service.getSessionHistory(parsed.value.agentId ?? DEFAULT_AGENT_ID, {
      sessionRef: parsed.value.sessionRef,
      limit: parsed.value.limit,
      includeCompaction: parsed.value.includeCompaction
    });

    return {
      id: frameId,
      ok: true,
      payload: {
        history
      }
    };
  }

  if (method === "agent.run") {
    const parsed = parseAgentRunParams(methodParams);
    if (!parsed.ok) {
      return {
        id: frameId,
        ok: false,
        error: toGatewayError({
          code: OPENGOAT_GATEWAY_ERROR_CODES.invalidRequest,
          message: parsed.error
        })
      };
    }

    const dedupeKey = buildIdempotencyKey({
      client: client.connect?.client,
      method,
      idempotencyKey: parsed.value.idempotencyKey
    });

    const existing = idempotency.get(dedupeKey);
    if (existing && Date.now() - existing.ts <= idempotencyTtlMs) {
      logger.debug("Gateway idempotent response replayed.", {
        method,
        idempotencyKey: parsed.value.idempotencyKey
      });
      if (existing.response) {
        return withResponseId(frameId, existing.response);
      }
      if (existing.pending) {
        const pendingResponse = await existing.pending;
        return withResponseId(frameId, pendingResponse);
      }
    }

    const runId = frameId;
    const pending = (async (): Promise<GatewayResponsePayload> => {
      const result = await service.runAgent(parsed.value.agentId ?? DEFAULT_AGENT_ID, {
        message: parsed.value.message,
        sessionRef: parsed.value.sessionRef,
        forceNewSession: parsed.value.forceNewSession,
        disableSession: parsed.value.disableSession,
        cwd: parsed.value.cwd,
        model: parsed.value.model,
        onStdout: (chunk) => {
          if (chunk) {
            sendAgentEvent({ runId, stream: "stdout", chunk });
          }
        },
        onStderr: (chunk) => {
          if (chunk) {
            sendAgentEvent({ runId, stream: "stderr", chunk });
          }
        }
      });

      return {
        id: frameId,
        ok: true,
        payload: {
          runId,
          result
        }
      };
    })();

    idempotency.set(dedupeKey, {
      ts: Date.now(),
      pending
    });

    try {
      const response = await pending;
      idempotency.set(dedupeKey, {
        ts: Date.now(),
        response
      });
      cleanupIdempotencyEntries(idempotency, {
        ttlMs: idempotencyTtlMs,
        maxEntries: idempotencyMaxEntries
      });
      return response;
    } catch (error) {
      idempotency.delete(dedupeKey);
      throw error;
    }
  }

  return {
    id: frameId,
    ok: false,
    error: toGatewayError({
      code: OPENGOAT_GATEWAY_ERROR_CODES.invalidRequest,
      message: `unknown method: ${method}`
    })
  };
}

function buildRuntimeConfig(options: OpenGoatGatewayServerOptions): GatewayRuntimeConfig {
  const bindHost = (options.bindHost ?? "127.0.0.1").trim();
  const path = normalizePath(options.path ?? OPENGOAT_GATEWAY_DEFAULTS.path);
  const requireAuth = options.requireAuth ?? true;
  const authToken = options.authToken?.trim() || (requireAuth ? createGatewayToken() : undefined);

  if (requireAuth && !authToken) {
    throw new Error("Gateway auth token is required when authentication is enabled.");
  }

  return {
    bindHost,
    path,
    authToken,
    requireAuth,
    allowedOrigins: normalizeOrigins(options.allowedOrigins),
    handshakeTimeoutMs: Math.max(1000, options.handshakeTimeoutMs ?? OPENGOAT_GATEWAY_DEFAULTS.handshakeTimeoutMs),
    maxPayloadBytes: Math.max(1024, options.maxPayloadBytes ?? OPENGOAT_GATEWAY_DEFAULTS.maxPayloadBytes),
    maxBufferedBytes: Math.max(1024, options.maxBufferedBytes ?? OPENGOAT_GATEWAY_DEFAULTS.maxBufferedBytes),
    tickIntervalMs: Math.max(1000, options.tickIntervalMs ?? OPENGOAT_GATEWAY_DEFAULTS.tickIntervalMs),
    rateLimitPerMinute: Math.max(1, options.rateLimitPerMinute ?? OPENGOAT_GATEWAY_DEFAULTS.rateLimitPerMinute),
    idempotencyTtlMs: Math.max(1000, options.idempotencyTtlMs ?? OPENGOAT_GATEWAY_DEFAULTS.idempotencyTtlMs),
    idempotencyMaxEntries: Math.max(1, options.idempotencyMaxEntries ?? OPENGOAT_GATEWAY_DEFAULTS.idempotencyMaxEntries)
  };
}

function authorizeConnect(params: {
  connect: OpenGoatGatewayConnectParams;
  authToken?: string;
  requireAuth: boolean;
  challengeNonce: string;
  remoteAddress?: string;
  allowedOrigins: string[];
  requestHost?: string;
  requestOrigin?: string;
}):
  | {
      ok: true;
    }
  | {
      ok: false;
      code: string;
      message: string;
    } {
  const { connect, requireAuth, authToken, challengeNonce, remoteAddress, allowedOrigins, requestHost, requestOrigin } = params;

  if (connect.maxProtocol < OPENGOAT_GATEWAY_PROTOCOL_VERSION || connect.minProtocol > OPENGOAT_GATEWAY_PROTOCOL_VERSION) {
    return {
      ok: false,
      code: OPENGOAT_GATEWAY_ERROR_CODES.protocolMismatch,
      message: "protocol mismatch"
    };
  }

  if (requireAuth) {
    if (!authToken) {
      return {
        ok: false,
        code: OPENGOAT_GATEWAY_ERROR_CODES.unauthorized,
        message: "gateway auth is not configured"
      };
    }

    const providedToken = connect.auth?.token;
    if (!providedToken) {
      return {
        ok: false,
        code: OPENGOAT_GATEWAY_ERROR_CODES.unauthorized,
        message: "missing auth token"
      };
    }

    if (!safeEqual(providedToken, authToken)) {
      return {
        ok: false,
        code: OPENGOAT_GATEWAY_ERROR_CODES.unauthorized,
        message: "invalid auth token"
      };
    }
  }

  const remoteIsLoopback = isLoopbackAddress(remoteAddress);
  if (!remoteIsLoopback) {
    if (!connect.nonce) {
      return {
        ok: false,
        code: OPENGOAT_GATEWAY_ERROR_CODES.unauthorized,
        message: "nonce is required for non-loopback clients"
      };
    }
    if (connect.nonce !== challengeNonce) {
      return {
        ok: false,
        code: OPENGOAT_GATEWAY_ERROR_CODES.unauthorized,
        message: "nonce mismatch"
      };
    }
  } else if (connect.nonce && connect.nonce !== challengeNonce) {
    return {
      ok: false,
      code: OPENGOAT_GATEWAY_ERROR_CODES.unauthorized,
      message: "nonce mismatch"
    };
  }

  if (!isOriginAllowed({
    origin: requestOrigin,
    host: requestHost,
    allowedOrigins
  })) {
    return {
      ok: false,
      code: OPENGOAT_GATEWAY_ERROR_CODES.forbidden,
      message: "origin not allowed"
    };
  }

  return { ok: true };
}

function isAuthorizedForMethod(method: OpenGoatGatewayMethod, scopes: OpenGoatGatewayScope[]): boolean {
  if (scopes.includes(OPENGOAT_GATEWAY_SCOPES.admin)) {
    return true;
  }

  if (isReadMethod(method)) {
    return scopes.includes(OPENGOAT_GATEWAY_SCOPES.read) || scopes.includes(OPENGOAT_GATEWAY_SCOPES.write);
  }

  return scopes.includes(OPENGOAT_GATEWAY_SCOPES.write);
}

function resolveScopes(scopes?: OpenGoatGatewayScope[]): OpenGoatGatewayScope[] {
  if (!scopes || scopes.length === 0) {
    return [OPENGOAT_GATEWAY_SCOPES.admin];
  }
  return [...new Set(scopes)];
}

function buildIdempotencyKey(params: {
  client?: OpenGoatGatewayClientInfo;
  method: OpenGoatGatewayMethod;
  idempotencyKey: string;
}): string {
  const clientId = params.client?.id ?? "unknown";
  const instanceId = params.client?.instanceId ?? "unknown";
  return `${clientId}:${instanceId}:${params.method}:${params.idempotencyKey}`;
}

function cleanupIdempotencyEntries(
  entries: Map<string, GatewayIdempotencyEntry>,
  options: {
    ttlMs: number;
    maxEntries: number;
  }
): void {
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (now - entry.ts > options.ttlMs) {
      entries.delete(key);
    }
  }

  if (entries.size <= options.maxEntries) {
    return;
  }

  const sorted = [...entries.entries()].sort((left, right) => left[1].ts - right[1].ts);
  const excess = sorted.length - options.maxEntries;
  for (let index = 0; index < excess; index += 1) {
    const key = sorted[index]?.[0];
    if (key) {
      entries.delete(key);
    }
  }
}

function sendResponse(client: ConnectedClient, response: GatewayResponsePayload): void {
  safeSend(client, {
    type: "res",
    id: response.id,
    ok: response.ok,
    payload: response.payload,
    error: response.error
  } satisfies OpenGoatGatewayResponseFrame);
}

function withResponseId(id: string, response: GatewayResponsePayload): GatewayResponsePayload {
  return {
    id,
    ok: response.ok,
    payload: response.payload,
    error: response.error
  };
}

function sendError(
  client: ConnectedClient,
  params: {
    id: string;
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
  }
): void {
  const frame: OpenGoatGatewayResponseFrame = {
    type: "res",
    id: params.id,
    ok: false,
    error: toGatewayError(params)
  };
  sendResponse(client, frame);
}

function sendEvent(
  client: ConnectedClient,
  event: {
    event: string;
    payload?: unknown;
    seq?: number;
  }
): void {
  safeSend(client, {
    type: "event",
    event: event.event,
    payload: event.payload,
    seq: event.seq
  });
}

function safeSend(client: ConnectedClient, payload: unknown): void {
  if (client.socket.readyState !== client.socket.OPEN) {
    return;
  }

  if (client.socket.bufferedAmount > client.maxBufferedBytes) {
    closeSocket(client.socket, 1008, "slow consumer");
    return;
  }

  try {
    client.socket.send(JSON.stringify(payload));
  } catch {
    closeSocket(client.socket, 1011, "send failed");
  }
}

function closeSocket(socket: WebSocket, code: number, reason: string): void {
  try {
    socket.close(code, reason);
  } catch {
    // ignore close failure
  }
}

function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: {
    startedAtMs: number;
    clients: Map<string, ConnectedClient>;
    path: string;
    protocolVersion: number;
    authRequired: boolean;
    hasAuthToken: boolean;
  }
): void {
  const requestPath = resolveRequestPath(request);
  if (requestPath === "/health") {
    response.statusCode = 200;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(
      JSON.stringify({
        status: "ok",
        protocol: options.protocolVersion,
        connectedClients: options.clients.size,
        uptimeMs: Date.now() - options.startedAtMs,
        authRequired: options.authRequired,
        hasAuthToken: options.hasAuthToken
      })
    );
    return;
  }

  if (requestPath === options.path) {
    response.statusCode = 426;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: "Upgrade Required" }));
    return;
  }

  response.statusCode = 404;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify({ error: "Not Found" }));
}

function resolveRequestPath(request: IncomingMessage): string {
  const rawPath = request.url ?? "/";
  const host = request.headers.host ?? "127.0.0.1";
  try {
    const url = new URL(rawPath, `http://${host}`);
    return url.pathname;
  } catch {
    return "/";
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function toUtf8String(buffer: unknown): string | null {
  if (typeof buffer === "string") {
    return buffer;
  }

  if (buffer instanceof ArrayBuffer) {
    return Buffer.from(buffer).toString("utf-8");
  }

  if (Array.isArray(buffer)) {
    return Buffer.concat(buffer.map((chunk) => Buffer.from(chunk))).toString("utf-8");
  }

  if (Buffer.isBuffer(buffer)) {
    return buffer.toString("utf-8");
  }

  return null;
}

function checkRateLimit(client: ConnectedClient, limitPerMinute: number): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  while (client.requestTimes.length > 0) {
    const first = client.requestTimes[0];
    if (first === undefined || first >= windowStart) {
      break;
    }
    client.requestTimes.shift();
  }

  if (client.requestTimes.length >= limitPerMinute) {
    return false;
  }

  client.requestTimes.push(now);
  return true;
}

function resolveRateLimitRetryMs(client: ConnectedClient): number {
  const now = Date.now();
  const first = client.requestTimes[0];
  if (!first) {
    return 1000;
  }
  const retryAfter = first + 60_000 - now;
  return retryAfter > 0 ? retryAfter : 1000;
}

function toGatewayError(params: {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
}): OpenGoatGatewayErrorShape {
  return {
    code: params.code,
    message: params.message,
    details: params.details,
    retryable: params.retryable,
    retryAfterMs: params.retryAfterMs
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "request failed";
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  return timingSafeEqual(leftBytes, rightBytes);
}

function isLoopbackAddress(ip: string | undefined): boolean {
  if (!ip) {
    return false;
  }

  const value = ip.trim().toLowerCase();
  return (
    value === "127.0.0.1" ||
    value.startsWith("127.") ||
    value === "::1" ||
    value.startsWith("::ffff:127.") ||
    value === "localhost"
  );
}

function isOriginAllowed(params: {
  origin?: string;
  host?: string;
  allowedOrigins: string[];
}): boolean {
  const origin = params.origin?.trim();
  if (!origin) {
    return true;
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  const normalizedOrigin = parsedOrigin.origin.toLowerCase();
  if (params.allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  const host = (params.host ?? "").trim().toLowerCase();
  if (host && parsedOrigin.host.toLowerCase() === host) {
    return true;
  }

  return isLoopbackHost(parsedOrigin.hostname) && isLoopbackHost(resolveHostName(host));
}

function isLoopbackHost(hostname: string): boolean {
  const value = hostname.trim().toLowerCase();
  return value === "localhost" || value === "::1" || value === "127.0.0.1" || value.startsWith("127.");
}

function resolveHostName(hostHeader: string): string {
  const trimmed = hostHeader.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("[")) {
    const closeBracket = trimmed.indexOf("]");
    if (closeBracket > 1) {
      return trimmed.slice(1, closeBracket);
    }
  }

  const [host] = trimmed.split(":");
  return host ?? "";
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") {
    return OPENGOAT_GATEWAY_DEFAULTS.path;
  }
  if (!trimmed.startsWith("/")) {
    return `/${trimmed}`;
  }
  return trimmed;
}

function normalizeOrigins(origins: string[] | undefined): string[] {
  if (!origins) {
    return [];
  }
  return [...new Set(origins.map((origin) => origin.trim().toLowerCase()).filter(Boolean))];
}

function createGatewayToken(): string {
  return randomBytes(32).toString("base64url");
}

function formatHostForUrl(host: string): string {
  if (host.includes(":")) {
    return `[${host}]`;
  }
  return host;
}

async function listen(server: HttpServer, port: number, host: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };

    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function resolveServerPort(server: HttpServer): number {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve gateway port.");
  }
  return address.port;
}

async function closeHttpServer(server: HttpServer): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

async function closeWebSocketServer(server: WebSocketServer): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}
