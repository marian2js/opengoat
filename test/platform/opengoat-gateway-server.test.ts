import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket, { type RawData } from "ws";
import { startOpenGoatGatewayServer, type OpenGoatGatewayService } from "../../packages/core/src/platform/node/opengoat-gateway-server.js";

interface TestMessage {
  type?: string;
  id?: string;
  ok?: boolean;
  event?: string;
  payload?: unknown;
  error?: {
    code?: string;
    message?: string;
  };
}

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (closers.length > 0) {
    const close = closers.pop();
    if (close) {
      await close();
    }
  }
});

describe("OpenGoat gateway server", () => {
  it("authenticates via connect handshake and serves health", async () => {
    const service = createService();
    const server = await startOpenGoatGatewayServer(service, {
      port: 0,
      authToken: "test-token"
    });
    closers.push(() => server.close());

    const socket = new WebSocket(server.url);
    closers.push(() => closeSocket(socket));

    const challenge = await waitFor(socket, (message) => message.type === "event" && message.event === "connect.challenge");
    const nonce = (challenge.payload as { nonce?: string } | undefined)?.nonce;
    expect(typeof nonce).toBe("string");

    socket.send(
      JSON.stringify({
        type: "req",
        id: "connect-1",
        method: "connect",
        params: {
          minProtocol: 1,
          maxProtocol: 1,
          client: {
            id: "test-client",
            version: "1.0.0",
            platform: "test",
            mode: "operator"
          },
          auth: { token: "test-token" },
          nonce
        }
      })
    );

    const hello = await waitFor(socket, (message) => message.type === "res" && message.id === "connect-1");
    expect(hello.ok).toBe(true);

    socket.send(
      JSON.stringify({
        type: "req",
        id: "health-1",
        method: "health",
        params: {}
      })
    );

    const health = await waitFor(socket, (message) => message.type === "res" && message.id === "health-1");
    expect(health.ok).toBe(true);
    expect((health.payload as { status?: string } | undefined)?.status).toBe("ok");
  });

  it("rejects invalid auth token", async () => {
    const service = createService();
    const server = await startOpenGoatGatewayServer(service, {
      port: 0,
      authToken: "expected-token"
    });
    closers.push(() => server.close());

    const socket = new WebSocket(server.url);
    closers.push(() => closeSocket(socket));

    const challenge = await waitFor(socket, (message) => message.type === "event" && message.event === "connect.challenge");
    const nonce = (challenge.payload as { nonce?: string } | undefined)?.nonce;

    socket.send(
      JSON.stringify({
        type: "req",
        id: "connect-1",
        method: "connect",
        params: {
          minProtocol: 1,
          maxProtocol: 1,
          client: {
            id: "test-client",
            version: "1.0.0",
            platform: "test",
            mode: "operator"
          },
          auth: { token: "wrong-token" },
          nonce
        }
      })
    );

    const response = await waitFor(socket, (message) => message.type === "res" && message.id === "connect-1");
    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe("UNAUTHORIZED");
  });

  it("dedupes agent.run using idempotencyKey", async () => {
    const runAgent = vi.fn(async () => ({ code: 0, stdout: "ok", stderr: "" }));
    const service = createService({ runAgent });

    const server = await startOpenGoatGatewayServer(service, {
      port: 0,
      authToken: "test-token"
    });
    closers.push(() => server.close());

    const socket = new WebSocket(server.url);
    closers.push(() => closeSocket(socket));

    const challenge = await waitFor(socket, (message) => message.type === "event" && message.event === "connect.challenge");
    const nonce = (challenge.payload as { nonce?: string } | undefined)?.nonce;

    socket.send(
      JSON.stringify({
        type: "req",
        id: "connect-1",
        method: "connect",
        params: {
          minProtocol: 1,
          maxProtocol: 1,
          client: {
            id: "test-client",
            version: "1.0.0",
            platform: "test",
            mode: "operator",
            instanceId: "test-instance"
          },
          auth: { token: "test-token" },
          nonce
        }
      })
    );

    await waitFor(socket, (message) => message.type === "res" && message.id === "connect-1");

    socket.send(
      JSON.stringify({
        type: "req",
        id: "run-1",
        method: "agent.run",
        params: {
          idempotencyKey: "same-key",
          message: "hello"
        }
      })
    );

    socket.send(
      JSON.stringify({
        type: "req",
        id: "run-2",
        method: "agent.run",
        params: {
          idempotencyKey: "same-key",
          message: "hello-again"
        }
      })
    );

    const responses = await waitForMany(
      socket,
      (message) => message.type === "res" && (message.id === "run-1" || message.id === "run-2"),
      2
    );
    const first = responses.find((message) => message.id === "run-1");
    const second = responses.find((message) => message.id === "run-2");

    expect(first?.ok).toBe(true);
    expect(second?.ok).toBe(true);
    expect(runAgent).toHaveBeenCalledTimes(1);

    const firstResult = (first?.payload as { result?: unknown } | undefined)?.result;
    const secondResult = (second?.payload as { result?: unknown } | undefined)?.result;
    expect(secondResult).toEqual(firstResult);
  });
});

function createService(overrides: {
  runAgent?: OpenGoatGatewayService["runAgent"];
} = {}): OpenGoatGatewayService {
  return {
    getHomeDir: () => "/tmp/opengoat-home",
    listAgents: async () => [{ id: "orchestrator", displayName: "Orchestrator" }],
    listSessions: async () => [],
    getSessionHistory: async () => ({ sessionKey: "main", messages: [] }),
    runAgent:
      overrides.runAgent ??
      (async () => ({
        code: 0,
        stdout: "ok",
        stderr: ""
      }))
  };
}

async function waitFor(socket: WebSocket, predicate: (message: TestMessage) => boolean): Promise<TestMessage> {
  return await new Promise<TestMessage>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for gateway frame."));
    }, 5_000);

    const onMessage = (raw: RawData) => {
      const text = typeof raw === "string" ? raw : raw.toString();
      let message: TestMessage;
      try {
        message = JSON.parse(text) as TestMessage;
      } catch {
        return;
      }

      if (!predicate(message)) {
        return;
      }

      cleanup();
      resolve(message);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onClose = () => {
      cleanup();
      reject(new Error("Socket closed before matching message."));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("message", onMessage);
      socket.off("error", onError);
      socket.off("close", onClose);
    };

    socket.on("message", onMessage);
    socket.on("error", onError);
    socket.on("close", onClose);
  });
}

async function waitForMany(
  socket: WebSocket,
  predicate: (message: TestMessage) => boolean,
  count: number
): Promise<TestMessage[]> {
  return await new Promise<TestMessage[]>((resolve, reject) => {
    const matches: TestMessage[] = [];
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for gateway frames."));
    }, 5_000);

    const onMessage = (raw: RawData) => {
      const text = typeof raw === "string" ? raw : raw.toString();
      let message: TestMessage;
      try {
        message = JSON.parse(text) as TestMessage;
      } catch {
        return;
      }

      if (!predicate(message)) {
        return;
      }

      matches.push(message);
      if (matches.length < count) {
        return;
      }

      cleanup();
      resolve(matches);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onClose = () => {
      cleanup();
      reject(new Error("Socket closed before matching messages."));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("message", onMessage);
      socket.off("error", onError);
      socket.off("close", onClose);
    };

    socket.on("message", onMessage);
    socket.on("error", onError);
    socket.on("close", onClose);
  });
}

async function closeSocket(socket: WebSocket): Promise<void> {
  if (socket.readyState === socket.CLOSED || socket.readyState === socket.CLOSING) {
    return;
  }

  await new Promise<void>((resolve) => {
    socket.once("close", () => resolve());
    socket.close();
  });
}
