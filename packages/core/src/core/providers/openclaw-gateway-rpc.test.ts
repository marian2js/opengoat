import { createHash, createPublicKey, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SentFrame = Record<string, unknown>;

const { wsState, MockWebSocket } = vi.hoisted(() => {
  type Socket = {
    trigger: (event: string, ...args: unknown[]) => void;
    sentFrames: SentFrame[];
    instanceIndex: number;
  };
  const wsState = {
    instances: [] as Socket[],
    onSend: undefined as ((socket: Socket, frame: SentFrame) => void) | undefined,
  };
  class MockWebSocket {
    public static readonly OPEN = 1;
    public static readonly CLOSED = 3;

    public readyState = MockWebSocket.OPEN;
    public readonly sentFrames: SentFrame[] = [];
    public readonly instanceIndex: number;
    private readonly handlers = new Map<string, Array<(...args: unknown[]) => void>>();

    public constructor(_url: string, _options?: Record<string, unknown>) {
      this.instanceIndex = wsState.instances.push(this) - 1;
      queueMicrotask(() => {
        this.trigger("open");
      });
    }

    public on(event: string, handler: (...args: unknown[]) => void): this {
      const existing = this.handlers.get(event) ?? [];
      existing.push(handler);
      this.handlers.set(event, existing);
      return this;
    }

    public send(rawFrame: string): void {
      const parsed = JSON.parse(rawFrame) as SentFrame;
      this.sentFrames.push(parsed);
      wsState.onSend?.(this, parsed);
    }

    public close(): void {
      this.readyState = MockWebSocket.CLOSED;
    }

    public trigger(event: string, ...args: unknown[]): void {
      const handlers = this.handlers.get(event) ?? [];
      for (const handler of handlers) {
        handler(...args);
      }
    }
  }

  return { wsState, MockWebSocket };
});

vi.mock("ws", () => ({
  WebSocket: MockWebSocket,
}));

import { callOpenClawGatewayRpc } from "./openclaw-gateway-rpc.js";

describe("callOpenClawGatewayRpc device token recovery", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    wsState.instances.length = 0;
    wsState.onSend = undefined;
  });

  afterEach(() => {
    wsState.onSend = undefined;
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });

  it("retries once without cached device token when gateway closes with mismatch", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "opengoat-gateway-rpc-"));
    tempDirs.push(stateDir);

    writeOpenClawConfig(stateDir, "gateway-password");

    const identity = createIdentity();
    writeDeviceIdentity(stateDir, identity);
    writeDeviceToken(stateDir, identity.deviceId, "stale-device-token");

    wsState.onSend = (socket, frame) => {
      const method = frame.method;
      const id = frame.id;
      if (typeof method !== "string" || typeof id !== "string") {
        return;
      }

      if (socket.instanceIndex === 0 && method === "connect") {
        queueMicrotask(() => {
          socket.trigger(
            "close",
            1008,
            Buffer.from(
              "unauthorized: device token mismatch (rotate/reissue device token)",
            ),
          );
        });
        return;
      }

      if (socket.instanceIndex === 1 && method === "connect") {
        queueMicrotask(() => {
          socket.trigger(
            "message",
            Buffer.from(
              JSON.stringify({
                type: "res",
                id,
                ok: true,
                payload: {
                  auth: {
                    role: "operator",
                    scopes: ["operator.admin", "operator.approvals"],
                    deviceToken: "fresh-device-token",
                  },
                },
              }),
            ),
          );
        });
        return;
      }

      if (socket.instanceIndex === 1 && method === "config.get") {
        queueMicrotask(() => {
          socket.trigger(
            "message",
            Buffer.from(
              JSON.stringify({
                type: "res",
                id,
                ok: true,
                payload: {
                  result: "ok",
                },
              }),
            ),
          );
        });
      }
    };

    const payload = await callOpenClawGatewayRpc({
      env: {
        OPENCLAW_STATE_DIR: stateDir,
        OPENCLAW_GATEWAY_URL: "ws://127.0.0.1:18789",
      },
      method: "config.get",
      params: {},
      options: {
        timeoutMs: 5_000,
      },
    });

    expect(payload).toEqual({ result: "ok" });
    expect(wsState.instances).toHaveLength(2);

    const firstConnectAuth = asRecord(asRecord(wsState.instances[0]?.sentFrames[0]?.params).auth);
    expect(firstConnectAuth.token).toBe("stale-device-token");
    expect(firstConnectAuth.password).toBe("gateway-password");

    const secondConnectAuth = asRecord(asRecord(wsState.instances[1]?.sentFrames[0]?.params).auth);
    expect(secondConnectAuth.token).toBeUndefined();
    expect(secondConnectAuth.password).toBe("gateway-password");

    const storedToken = readStoredToken(stateDir, identity.deviceId);
    expect(storedToken).toBe("fresh-device-token");
  });

  it("does not retry device token mismatch when token is explicitly configured", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "opengoat-gateway-rpc-explicit-token-"));
    tempDirs.push(stateDir);

    wsState.onSend = (socket, frame) => {
      const method = frame.method;
      if (socket.instanceIndex !== 0 || method !== "connect") {
        return;
      }
      queueMicrotask(() => {
        socket.trigger(
          "close",
          1008,
          Buffer.from("unauthorized: device token mismatch (rotate/reissue device token)"),
        );
      });
    };

    await expect(
      callOpenClawGatewayRpc({
        env: {
          OPENCLAW_STATE_DIR: stateDir,
          OPENCLAW_GATEWAY_URL: "ws://127.0.0.1:18789",
          OPENCLAW_GATEWAY_TOKEN: "explicit-token",
          OPENCLAW_GATEWAY_PASSWORD: "gateway-password",
        },
        method: "config.get",
        params: {},
      }),
    ).rejects.toThrow("device token mismatch");

    expect(wsState.instances).toHaveLength(1);
  });
});

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function createIdentity(): {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
} {
  const pair = generateKeyPairSync("ed25519");
  const publicKeyPem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  return {
    deviceId: createFingerprint(publicKeyPem),
    publicKeyPem,
    privateKeyPem,
  };
}

function createFingerprint(publicKeyPem: string): string {
  return createHash("sha256").update(readPublicKeyRaw(publicKeyPem)).digest("hex");
}

function readPublicKeyRaw(publicKeyPem: string): Buffer {
  const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
  const der = createPublicKey(publicKeyPem).export({
    type: "spki",
    format: "der",
  }) as Buffer;
  if (
    der.length === spkiPrefix.length + 32 &&
    der.subarray(0, spkiPrefix.length).equals(spkiPrefix)
  ) {
    return der.subarray(spkiPrefix.length);
  }
  return der;
}

function writeDeviceIdentity(
  stateDir: string,
  identity: {
    deviceId: string;
    publicKeyPem: string;
    privateKeyPem: string;
  },
): void {
  const identityDir = join(stateDir, "identity");
  mkdirSync(identityDir, { recursive: true });
  writeFileSync(
    join(identityDir, "device.json"),
    `${JSON.stringify(
      {
        version: 1,
        ...identity,
        createdAtMs: Date.now(),
      },
      null,
      2,
    )}\n`,
  );
}

function writeDeviceToken(
  stateDir: string,
  deviceId: string,
  token: string,
): void {
  const identityDir = join(stateDir, "identity");
  mkdirSync(identityDir, { recursive: true });
  writeFileSync(
    join(identityDir, "device-auth.json"),
    `${JSON.stringify(
      {
        version: 1,
        deviceId,
        tokens: {
          operator: {
            token,
            role: "operator",
            scopes: ["operator.admin", "operator.approvals", "operator.pairing"],
            updatedAtMs: Date.now(),
          },
        },
      },
      null,
      2,
    )}\n`,
  );
}

function writeOpenClawConfig(stateDir: string, password: string): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    join(stateDir, "openclaw.json"),
    `${JSON.stringify(
      {
        gateway: {
          auth: {
            password,
          },
        },
      },
      null,
      2,
    )}\n`,
  );
}

function readStoredToken(stateDir: string, deviceId: string): string | undefined {
  const authPath = join(stateDir, "identity", "device-auth.json");
  const parsed = JSON.parse(readFileSync(authPath, "utf8")) as Record<string, unknown>;
  if (parsed.deviceId !== deviceId) {
    return undefined;
  }
  const tokens = asRecord(parsed.tokens);
  const operator = asRecord(tokens.operator);
  return typeof operator.token === "string" ? operator.token : undefined;
}
