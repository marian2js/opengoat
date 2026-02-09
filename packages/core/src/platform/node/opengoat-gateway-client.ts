import { randomUUID } from "node:crypto";
import { WebSocket, type RawData } from "ws";
import {
  OPENGOAT_GATEWAY_DEFAULTS,
  OPENGOAT_GATEWAY_PROTOCOL_VERSION
} from "../../core/gateway/index.js";

export interface OpenGoatGatewayCallOptions {
  url: string;
  method: string;
  params?: unknown;
  token?: string;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  clientId?: string;
  clientDisplayName?: string;
  clientVersion?: string;
  platform?: string;
  mode?: string;
  instanceId?: string;
}

export interface OpenGoatGatewayConnectResult<T = unknown> {
  hello: unknown;
  payload: T;
}

export async function callOpenGoatGateway<T = unknown>(
  options: OpenGoatGatewayCallOptions
): Promise<OpenGoatGatewayConnectResult<T>> {
  const timeoutMs = resolveTimeout(options.timeoutMs);

  return await new Promise<OpenGoatGatewayConnectResult<T>>((resolve, reject) => {
    if (options.abortSignal?.aborted) {
      reject(createAbortError());
      return;
    }

    const socket = new WebSocket(options.url, {
      maxPayload: OPENGOAT_GATEWAY_DEFAULTS.maxPayloadBytes
    });

    const connectRequestId = randomUUID();
    const callRequestId = randomUUID();

    let settled = false;
    let handshakeSent = false;
    let helloPayload: unknown;

    const timeout = setTimeout(() => {
      finish(new Error(`Gateway timeout after ${timeoutMs}ms.`));
    }, timeoutMs);

    function onAbort() {
      finish(createAbortError());
    }

    const cleanup = () => {
      clearTimeout(timeout);
      socket.removeAllListeners();
      options.abortSignal?.removeEventListener("abort", onAbort);
    };

    const finish = (error?: Error, result?: OpenGoatGatewayConnectResult<T>) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      try {
        socket.close();
      } catch {
        // ignore close failure
      }

      if (error) {
        reject(error);
        return;
      }

      if (!result) {
        reject(new Error("Gateway call completed without a result."));
        return;
      }

      resolve(result);
    };

    options.abortSignal?.addEventListener("abort", onAbort, { once: true });

    socket.on("error", (error) => {
      finish(error instanceof Error ? error : new Error(String(error)));
    });

    socket.on("close", (code, reasonRaw) => {
      if (settled) {
        return;
      }
      const reason = toUtf8String(reasonRaw) ?? "no close reason";
      finish(new Error(`Gateway closed (${code}): ${reason}`));
    });

    socket.on("message", (raw) => {
      const text = toUtf8String(raw);
      if (!text) {
        finish(new Error("Received invalid gateway frame payload."));
        return;
      }

      let frame: unknown;
      try {
        frame = JSON.parse(text);
      } catch {
        finish(new Error("Received invalid JSON from gateway."));
        return;
      }

      if (!isRecord(frame)) {
        return;
      }

      if (frame.type === "event" && frame.event === "connect.challenge") {
        if (handshakeSent) {
          return;
        }
        handshakeSent = true;

        const nonce = extractNonce(frame.payload);
        const connectPayload = {
          minProtocol: OPENGOAT_GATEWAY_PROTOCOL_VERSION,
          maxProtocol: OPENGOAT_GATEWAY_PROTOCOL_VERSION,
          client: {
            id: options.clientId ?? "opengoat-cli",
            displayName: options.clientDisplayName,
            version: options.clientVersion ?? "dev",
            platform: options.platform ?? process.platform,
            mode: options.mode ?? "operator",
            instanceId: options.instanceId
          },
          auth: options.token
            ? {
                token: options.token
              }
            : undefined,
          nonce
        };

        sendFrame(socket, {
          type: "req",
          id: connectRequestId,
          method: "connect",
          params: connectPayload
        });
        return;
      }

      if (frame.type !== "res" || typeof frame.id !== "string") {
        return;
      }

      const ok = frame.ok === true;

      if (frame.id === connectRequestId) {
        if (!ok) {
          finish(new Error(formatGatewayError(frame.error, "Gateway connect failed.")));
          return;
        }

        helloPayload = frame.payload;
        sendFrame(socket, {
          type: "req",
          id: callRequestId,
          method: options.method,
          params: options.params
        });
        return;
      }

      if (frame.id === callRequestId) {
        if (!ok) {
          finish(new Error(formatGatewayError(frame.error, `Gateway method ${options.method} failed.`)));
          return;
        }

        finish(undefined, {
          hello: helloPayload,
          payload: frame.payload as T
        });
      }
    });
  });
}

function createAbortError(): Error {
  const error = new Error("Gateway request aborted.");
  error.name = "AbortError";
  return error;
}

function sendFrame(socket: WebSocket, frame: Record<string, unknown>): void {
  socket.send(JSON.stringify(frame));
}

function formatGatewayError(error: unknown, fallback: string): string {
  if (!isRecord(error)) {
    return fallback;
  }
  const message = typeof error.message === "string" && error.message.trim() ? error.message.trim() : fallback;
  const code = typeof error.code === "string" && error.code.trim() ? error.code.trim() : undefined;
  return code ? `${code}: ${message}` : message;
}

function extractNonce(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }
  const nonce = payload.nonce;
  if (typeof nonce !== "string") {
    return undefined;
  }
  const trimmed = nonce.trim();
  return trimmed || undefined;
}

function resolveTimeout(timeoutMs: number | undefined): number {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return 10_000;
  }
  return Math.floor(timeoutMs);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toUtf8String(raw: RawData): string | null {
  if (typeof raw === "string") {
    return raw;
  }

  if (Buffer.isBuffer(raw)) {
    return raw.toString("utf-8");
  }

  if (Array.isArray(raw)) {
    return Buffer.concat(raw).toString("utf-8");
  }

  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString("utf-8");
  }

  return null;
}
