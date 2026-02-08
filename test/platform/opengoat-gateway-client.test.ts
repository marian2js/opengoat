import { afterEach, describe, expect, it } from "vitest";
import { callOpenGoatGateway } from "../../packages/core/src/platform/node/opengoat-gateway-client.js";
import { startOpenGoatGatewayServer } from "../../packages/core/src/platform/node/opengoat-gateway-server.js";

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (closers.length > 0) {
    const close = closers.pop();
    if (close) {
      await close();
    }
  }
});

describe("OpenGoat gateway client", () => {
  it("connects and calls remote health", async () => {
    const server = await startOpenGoatGatewayServer(
      {
        getHomeDir: () => "/tmp/opengoat",
        listAgents: async () => [],
        listSessions: async () => [],
        getSessionHistory: async () => ({ sessionKey: "main", messages: [] }),
        runAgent: async () => ({ code: 0, stdout: "", stderr: "" })
      },
      {
        port: 0,
        authToken: "token-123"
      }
    );
    closers.push(() => server.close());

    const result = await callOpenGoatGateway<{ status: string; protocol: number }>({
      url: server.url,
      token: "token-123",
      method: "health",
      params: {}
    });

    expect(result.payload.status).toBe("ok");
    expect(result.payload.protocol).toBe(1);
  });

  it("fails on unauthorized token", async () => {
    const server = await startOpenGoatGatewayServer(
      {
        getHomeDir: () => "/tmp/opengoat",
        listAgents: async () => [],
        listSessions: async () => [],
        getSessionHistory: async () => ({ sessionKey: "main", messages: [] }),
        runAgent: async () => ({ code: 0, stdout: "", stderr: "" })
      },
      {
        port: 0,
        authToken: "token-123"
      }
    );
    closers.push(() => server.close());

    await expect(
      callOpenGoatGateway({
        url: server.url,
        token: "wrong-token",
        method: "health",
        params: {}
      })
    ).rejects.toThrow(/UNAUTHORIZED|connect failed|invalid auth token/i);
  });
});
