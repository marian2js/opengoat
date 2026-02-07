import { describe, expect, it, vi } from "vitest";
import { agentProviderGetCommand } from "../../src/apps/cli/commands/agent-provider-get.command.js";
import { agentProviderSetCommand } from "../../src/apps/cli/commands/agent-provider-set.command.js";
import { agentRunCommand } from "../../src/apps/cli/commands/agent-run.command.js";
import { providerListCommand } from "../../src/apps/cli/commands/provider-list.command.js";
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
  it("provider list prints capability rows", async () => {
    const listProviders = vi.fn(() => [
      {
        id: "codex",
        kind: "cli",
        capabilities: { agent: false, model: true, auth: true }
      }
    ]);

    const { context, stdout } = createContext({ listProviders });

    const code = await providerListCommand.run([], context);

    expect(code).toBe(0);
    expect(stdout.output()).toContain("codex\tcli\tagent=false model=true auth=true");
  });

  it("agent provider get validates and prints binding", async () => {
    const getAgentProvider = vi.fn(async () => ({ agentId: "orchestrator", providerId: "codex" }));
    const { context, stdout, stderr } = createContext({ getAgentProvider });

    expect(await agentProviderGetCommand.run([], context)).toBe(1);
    expect(stderr.output()).toContain("Usage: opengoat agent provider get");

    const ok = createContext({ getAgentProvider });
    expect(await agentProviderGetCommand.run(["orchestrator"], ok.context)).toBe(0);
    expect(ok.stdout.output()).toContain("orchestrator\tcodex");
  });

  it("agent provider set validates and persists binding", async () => {
    const setAgentProvider = vi.fn(async () => ({ agentId: "orchestrator", providerId: "claude" }));

    const first = createContext({ setAgentProvider });
    expect(await agentProviderSetCommand.run(["orchestrator"], first.context)).toBe(1);
    expect(first.stderr.output()).toContain("Usage: opengoat agent provider set");

    const second = createContext({ setAgentProvider });
    expect(await agentProviderSetCommand.run(["orchestrator", "claude"], second.context)).toBe(0);
    expect(setAgentProvider).toHaveBeenCalledWith("orchestrator", "claude");
    expect(second.stdout.output()).toContain("Provider for orchestrator set to claude");
  });

  it("agent run validates required flags", async () => {
    const runAgent = vi.fn();

    const noArgs = createContext({ runAgent });
    expect(await agentRunCommand.run([], noArgs.context)).toBe(1);
    expect(noArgs.stderr.output()).toContain("Missing <agent-id>");

    const missingMessage = createContext({ runAgent });
    expect(await agentRunCommand.run(["orchestrator"], missingMessage.context)).toBe(1);
    expect(missingMessage.stderr.output()).toContain("--message is required");

    expect(runAgent).not.toHaveBeenCalled();
  });

  it("agent run parses model/passthrough and returns provider code", async () => {
    const runAgent = vi.fn(async () => ({
      code: 0,
      stdout: "done\n",
      stderr: "",
      agentId: "orchestrator",
      providerId: "codex"
    }));

    const first = createContext({ runAgent });
    const code = await agentRunCommand.run(
      ["orchestrator", "--message", "hi", "--model", "o3", "--cwd", "/tmp/project", "--", "--foo", "bar"],
      first.context
    );

    expect(code).toBe(0);
    expect(runAgent).toHaveBeenCalledWith(
      "orchestrator",
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
      agentId: "orchestrator",
      providerId: "codex"
    }));

    const second = createContext({ runAgent: failingRunAgent });
    const failCode = await agentRunCommand.run(["orchestrator", "--message", "hi", "--no-stream"], second.context);

    expect(failCode).toBe(2);
    expect(second.stderr.output()).toContain("Provider run failed");
  });

  it("agent run prints provider stderr in stream mode when provider returns final output only", async () => {
    const runAgent = vi.fn(async () => ({
      code: 1,
      stdout: "",
      stderr: "HTTP 401: invalid_api_key\n",
      agentId: "orchestrator",
      providerId: "openai"
    }));

    const { context, stderr } = createContext({ runAgent });
    const code = await agentRunCommand.run(["orchestrator", "--message", "hi"], context);

    expect(code).toBe(1);
    expect(stderr.output()).toContain("HTTP 401: invalid_api_key");
    expect(stderr.output()).toContain("Provider run failed for orchestrator (openai).");
  });
});
