import { describe, expect, it, vi } from "vitest";
import { agentProviderGetCommand } from "../../packages/cli/src/cli/commands/agent-provider-get.command.js";
import { agentProviderSetCommand } from "../../packages/cli/src/cli/commands/agent-provider-set.command.js";
import { agentRunCommand } from "../../packages/cli/src/cli/commands/agent-run.command.js";
import { providerCommand } from "../../packages/cli/src/cli/commands/provider.command.js";
import { providerListCommand } from "../../packages/cli/src/cli/commands/provider-list.command.js";
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

describe("provider CLI commands", () => {
  it("provider command prints help", async () => {
    const { context, stdout } = createContext({});
    const code = await providerCommand.run([], context);
    expect(code).toBe(0);
    expect(stdout.output()).toContain("opengoat provider list");
  });

  it("provider list uses OpenGoat provider registry", async () => {
    const listProviders = vi.fn(async () => [
      {
        id: "claude-code",
        displayName: "Claude Code",
        kind: "cli",
        capabilities: {
          agent: false,
          model: true,
          auth: true,
          passthrough: true,
        },
      },
      {
        id: "openclaw",
        displayName: "OpenClaw",
        kind: "cli",
        capabilities: {
          agent: true,
          model: true,
          auth: true,
          passthrough: true,
        },
      },
    ]);
    const { context, stdout } = createContext({ listProviders });
    const code = await providerListCommand.run([], context);
    expect(code).toBe(0);
    expect(listProviders).toHaveBeenCalledTimes(1);
    expect(stdout.output()).toContain("claude-code (Claude Code) [cli]");
    expect(stdout.output()).toContain("openclaw (OpenClaw) [cli]");
  });

  it("agent provider get validates and reads binding", async () => {
    const getAgentProvider = vi.fn(async () => ({
      agentId: "ceo",
      providerId: "openclaw",
    }));
    const { context, stderr } = createContext({ getAgentProvider });

    expect(await agentProviderGetCommand.run([], context)).toBe(1);
    expect(stderr.output()).toContain("Usage: opengoat agent provider get");

    const ok = createContext({ getAgentProvider });
    expect(await agentProviderGetCommand.run(["ceo"], ok.context)).toBe(0);
    expect(getAgentProvider).toHaveBeenLastCalledWith("ceo");
    expect(ok.stdout.output()).toContain("ceo: openclaw");
  });

  it("agent provider set validates and updates binding", async () => {
    const setAgentProvider = vi.fn(async () => ({
      agentId: "ceo",
      providerId: "openclaw",
    }));

    const first = createContext({ setAgentProvider });
    expect(await agentProviderSetCommand.run(["ceo"], first.context)).toBe(1);
    expect(first.stderr.output()).toContain("Usage: opengoat agent provider set");

    const second = createContext({ setAgentProvider });
    expect(await agentProviderSetCommand.run(["ceo", "openclaw"], second.context)).toBe(0);
    expect(setAgentProvider).toHaveBeenLastCalledWith("ceo", "openclaw");
    expect(second.stdout.output()).toContain("ceo: openclaw");
  });

  it("agent run validates required flags", async () => {
    const runAgent = vi.fn();

    const noArgs = createContext({ runAgent });
    expect(await agentRunCommand.run([], noArgs.context)).toBe(1);
    expect(noArgs.stderr.output()).toContain("Missing <agent-id>");

    const missingMessage = createContext({ runAgent });
    expect(await agentRunCommand.run(["ceo"], missingMessage.context)).toBe(1);
    expect(missingMessage.stderr.output()).toContain("--message is required");

    expect(runAgent).not.toHaveBeenCalled();
  });

  it("agent run parses model/passthrough and returns provider code", async () => {
    const runAgent = vi.fn(async () => ({
      code: 0,
      stdout: "done\n",
      stderr: "",
      agentId: "ceo",
      providerId: "openclaw"
    }));

    const first = createContext({ runAgent });
    const code = await agentRunCommand.run(
      ["ceo", "--message", "hi", "--model", "o3", "--project-path", "/tmp/project", "--", "--foo", "bar"],
      first.context
    );

    expect(code).toBe(0);
    expect(runAgent).toHaveBeenCalledWith(
      "ceo",
      expect.objectContaining({
        message: "hi",
        model: "o3",
        cwd: "/tmp/project",
        passthroughArgs: ["--foo", "bar"]
      })
    );

    const failingRunAgent = vi.fn(async () => ({
      code: 2,
      stdout: "",
      stderr: "failed\n",
      agentId: "ceo",
      providerId: "openclaw"
    }));

    const second = createContext({ runAgent: failingRunAgent });
    const failCode = await agentRunCommand.run(["ceo", "--message", "hi", "--no-stream"], second.context);

    expect(failCode).toBe(2);
    expect(second.stderr.output()).toContain("Runtime run failed");
  });

  it("agent run prints provider stderr in stream mode when provider returns final output only", async () => {
    const runAgent = vi.fn(async () => ({
      code: 1,
      stdout: "",
      stderr: "HTTP 401: invalid_api_key\n",
      agentId: "ceo",
      providerId: "openclaw"
    }));

    const { context, stderr } = createContext({ runAgent });
    const code = await agentRunCommand.run(["ceo", "--message", "hi"], context);

    expect(code).toBe(1);
    expect(stderr.output()).toContain("HTTP 401: invalid_api_key");
    expect(stderr.output()).toContain("Runtime run failed for ceo (openclaw).");
  });
});
