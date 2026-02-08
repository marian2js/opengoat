import { describe, expect, it, vi } from "vitest";
import { startOpenGoatGatewayServer } from "../../packages/core/src/platform/node/opengoat-gateway-server.js";
import { gatewayCommand } from "../../packages/cli/src/cli/commands/gateway.command.js";
import { createStreamCapture } from "../helpers/stream-capture.js";

function createContext(service: unknown) {
  const stdout = createStreamCapture();
  const stderr = createStreamCapture();

  return {
    context: {
      service: service as never,
      stdout: stdout.stream,
      stderr: stderr.stream
    },
    stdout,
    stderr
  };
}

describe("gateway command", () => {
  it("prints help output", async () => {
    const { context, stdout } = createContext({});
    const code = await gatewayCommand.run(["--help"], context);

    expect(code).toBe(0);
    expect(stdout.output()).toContain("opengoat gateway");
    expect(stdout.output()).toContain("optional OpenGoat Gateway");
  });

  it("rejects non-loopback bind without explicit allow flag", async () => {
    const initialize = vi.fn();
    const { context, stderr } = createContext({ initialize });

    const code = await gatewayCommand.run(["--bind", "0.0.0.0"], context);

    expect(code).toBe(1);
    expect(stderr.output()).toContain("--allow-remote");
    expect(initialize).not.toHaveBeenCalled();
  });

  it("rejects --no-auth on non-loopback binds", async () => {
    const initialize = vi.fn();
    const { context, stderr } = createContext({ initialize });

    const code = await gatewayCommand.run(["--bind", "0.0.0.0", "--allow-remote", "--no-auth"], context);

    expect(code).toBe(1);
    expect(stderr.output()).toContain("Refusing --no-auth");
    expect(initialize).not.toHaveBeenCalled();
  });

  it("validates --port", async () => {
    const initialize = vi.fn();
    const { context, stderr } = createContext({ initialize });

    const code = await gatewayCommand.run(["--port", "70000"], context);

    expect(code).toBe(1);
    expect(stderr.output()).toContain("Invalid value for --port");
    expect(initialize).not.toHaveBeenCalled();
  });

  it("connects to remote gateway with --url and does not bootstrap local service", async () => {
    const remoteServer = await startOpenGoatGatewayServer(
      {
        getHomeDir: () => "/tmp/opengoat",
        listAgents: async () => [],
        listSessions: async () => [],
        getSessionHistory: async () => ({ sessionKey: "main", messages: [] }),
        runAgent: async () => ({ code: 0, stdout: "", stderr: "" })
      },
      {
        port: 0,
        authToken: "remote-token"
      }
    );

    const initialize = vi.fn();
    const { context, stdout, stderr } = createContext({ initialize });

    try {
      const code = await gatewayCommand.run(
        ["--url", remoteServer.url, "--token", "remote-token", "--timeout", "2000"],
        context
      );
      expect(code).toBe(0);
      expect(initialize).not.toHaveBeenCalled();
      expect(stderr.output()).toBe("");
      expect(stdout.output()).toContain("Connected to remote gateway");
      expect(stdout.output()).toContain("Remote health: status=ok");
    } finally {
      await remoteServer.close();
    }
  });
});
