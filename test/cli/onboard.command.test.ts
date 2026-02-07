import { describe, expect, it, vi } from "vitest";
import { onboardCommand } from "../../packages/cli/src/cli/commands/onboard.command.js";
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

describe("onboard command", () => {
  it("configures provider credentials in non-interactive mode", async () => {
    const service = {
      initialize: vi.fn(async () => ({
        defaultAgent: "orchestrator"
      })),
      listProviders: vi.fn(async () => [
        {
          id: "openai",
          displayName: "OpenAI",
          kind: "http",
          capabilities: { agent: false, model: true, auth: false, passthrough: false }
        }
      ]),
      getAgentProvider: vi.fn(async () => ({ agentId: "orchestrator", providerId: "codex" })),
      setAgentProvider: vi.fn(async () => ({ agentId: "orchestrator", providerId: "openai" })),
      getProviderOnboarding: vi.fn(async () => ({
        env: [{ key: "OPENAI_API_KEY", description: "OpenAI key", required: true, secret: true }],
        auth: { supported: false, description: "API key only" }
      })),
      getProviderConfig: vi.fn(async () => null),
      setProviderConfig: vi.fn(async () => ({
        providerId: "openai",
        env: { OPENAI_API_KEY: "sk-test" }
      })),
      authenticateProvider: vi.fn(),
      getPaths: vi.fn(() => ({ providersDir: "/tmp/providers" }))
    };

    const { context, stdout } = createContext(service);
    const code = await onboardCommand.run(
      ["--non-interactive", "--provider", "openai", "--openai-api-key", "sk-test"],
      context
    );

    expect(code).toBe(0);
    expect(service.initialize).toHaveBeenCalledOnce();
    expect(service.setAgentProvider).toHaveBeenCalledWith("orchestrator", "openai");
    expect(service.setProviderConfig).toHaveBeenCalledWith(
      "openai",
      expect.objectContaining({ OPENAI_API_KEY: "sk-test" })
    );
    expect(stdout.output()).toContain("Onboarding complete.");
  });

  it("fails when required provider keys are missing in non-interactive mode", async () => {
    const service = {
      initialize: vi.fn(async () => ({})),
      listProviders: vi.fn(async () => [
        {
          id: "openai",
          displayName: "OpenAI",
          kind: "http",
          capabilities: { agent: false, model: true, auth: false, passthrough: false }
        }
      ]),
      getAgentProvider: vi.fn(async () => ({ agentId: "orchestrator", providerId: "openai" })),
      setAgentProvider: vi.fn(async () => ({ agentId: "orchestrator", providerId: "openai" })),
      getProviderOnboarding: vi.fn(async () => ({
        env: [{ key: "OPENAI_API_KEY", description: "OpenAI key", required: true, secret: true }]
      })),
      getProviderConfig: vi.fn(async () => null),
      setProviderConfig: vi.fn(),
      authenticateProvider: vi.fn(),
      getPaths: vi.fn(() => ({ providersDir: "/tmp/providers" }))
    };

    const { context, stderr } = createContext(service);
    const code = await onboardCommand.run(["--non-interactive", "--provider", "openai"], context);

    expect(code).toBe(1);
    expect(stderr.output()).toContain("Missing required provider settings");
    expect(service.setProviderConfig).not.toHaveBeenCalled();
  });

  it("prints help", async () => {
    const service = {
      initialize: vi.fn(),
      listProviders: vi.fn(),
      getAgentProvider: vi.fn(),
      setAgentProvider: vi.fn(),
      getProviderOnboarding: vi.fn(),
      getProviderConfig: vi.fn(),
      setProviderConfig: vi.fn(),
      authenticateProvider: vi.fn(),
      getPaths: vi.fn(() => ({ providersDir: "/tmp/providers" }))
    };

    const { context, stdout } = createContext(service);
    const code = await onboardCommand.run(["--help"], context);

    expect(code).toBe(0);
    expect(stdout.output()).toContain("Usage:");
    expect(stdout.output()).toContain("opengoat onboard");
  });

  it("runs provider auth flow when requested", async () => {
    const service = {
      initialize: vi.fn(async () => ({})),
      listProviders: vi.fn(async () => [
        {
          id: "codex",
          displayName: "Codex",
          kind: "cli",
          capabilities: { agent: true, model: true, auth: true, passthrough: true }
        }
      ]),
      getAgentProvider: vi.fn(async () => ({ agentId: "developer", providerId: "codex" })),
      setAgentProvider: vi.fn(async () => ({ agentId: "developer", providerId: "codex" })),
      getProviderOnboarding: vi.fn(async () => ({
        auth: { supported: true, description: "Runs codex login" }
      })),
      getProviderConfig: vi.fn(async () => null),
      setProviderConfig: vi.fn(),
      authenticateProvider: vi.fn(async () => ({ code: 0, stdout: "", stderr: "" })),
      getPaths: vi.fn(() => ({ providersDir: "/tmp/providers" }))
    };

    const { context, stdout } = createContext(service);
    const code = await onboardCommand.run(
      ["--non-interactive", "--agent", "developer", "--provider", "codex", "--run-auth"],
      context
    );

    expect(code).toBe(0);
    expect(service.authenticateProvider).toHaveBeenCalledTimes(1);
    expect(service.authenticateProvider).toHaveBeenCalledWith(
      "codex",
      expect.objectContaining({
        env: process.env,
        onStdout: expect.any(Function),
        onStderr: expect.any(Function)
      })
    );
    expect(stdout.output()).toContain("Provider auth flow completed.");
  });

  it("maps --model to provider model env var discovered from onboarding metadata", async () => {
    const service = {
      initialize: vi.fn(async () => ({})),
      listProviders: vi.fn(async () => [
        {
          id: "anthropic",
          displayName: "Anthropic",
          kind: "http",
          capabilities: { agent: false, model: true, auth: false, passthrough: false }
        }
      ]),
      getAgentProvider: vi.fn(async () => ({ agentId: "orchestrator", providerId: "anthropic" })),
      setAgentProvider: vi.fn(async () => ({ agentId: "orchestrator", providerId: "anthropic" })),
      getProviderOnboarding: vi.fn(async () => ({
        env: [
          { key: "ANTHROPIC_API_KEY", description: "Anthropic key", required: true, secret: true },
          { key: "ANTHROPIC_MODEL", description: "Optional model id", required: false, secret: false }
        ],
        auth: { supported: false, description: "API key only" }
      })),
      getProviderConfig: vi.fn(async () => null),
      setProviderConfig: vi.fn(async () => ({
        providerId: "anthropic",
        env: { ANTHROPIC_API_KEY: "ant-test", ANTHROPIC_MODEL: "claude-opus-4-5" }
      })),
      authenticateProvider: vi.fn(),
      getPaths: vi.fn(() => ({ providersDir: "/tmp/providers" }))
    };

    const { context } = createContext(service);
    const code = await onboardCommand.run(
      [
        "--non-interactive",
        "--provider",
        "anthropic",
        "--model",
        "claude-opus-4-5",
        "--env",
        "ANTHROPIC_API_KEY=ant-test"
      ],
      context
    );

    expect(code).toBe(0);
    expect(service.setProviderConfig).toHaveBeenCalledWith(
      "anthropic",
      expect.objectContaining({
        ANTHROPIC_MODEL: "claude-opus-4-5"
      })
    );
  });

  it("defaults orchestrator to OpenGoat-priority internal providers", async () => {
    const service = {
      initialize: vi.fn(async () => ({})),
      listProviders: vi.fn(async () => [
        {
          id: "codex",
          displayName: "Codex CLI",
          kind: "cli",
          capabilities: { agent: false, model: true, auth: true, passthrough: true }
        },
        {
          id: "anthropic",
          displayName: "Anthropic",
          kind: "http",
          capabilities: { agent: false, model: true, auth: false, passthrough: false }
        },
        {
          id: "openai",
          displayName: "OpenAI",
          kind: "http",
          capabilities: { agent: false, model: true, auth: false, passthrough: false }
        }
      ]),
      getAgentProvider: vi.fn(async () => ({ agentId: "orchestrator", providerId: "codex" })),
      setAgentProvider: vi.fn(async () => ({ agentId: "orchestrator", providerId: "openai" })),
      getProviderOnboarding: vi.fn(async () => ({})),
      getProviderConfig: vi.fn(async () => null),
      setProviderConfig: vi.fn(),
      authenticateProvider: vi.fn(),
      getPaths: vi.fn(() => ({ providersDir: "/tmp/providers" }))
    };

    const { context } = createContext(service);
    const code = await onboardCommand.run(["--non-interactive"], context);

    expect(code).toBe(0);
    expect(service.setAgentProvider).toHaveBeenCalledWith("orchestrator", "openai");
  });

  it("rejects explicit external orchestrator provider selections", async () => {
    const service = {
      initialize: vi.fn(async () => ({})),
      listProviders: vi.fn(async () => [
        {
          id: "codex",
          displayName: "Codex CLI",
          kind: "cli",
          capabilities: { agent: false, model: true, auth: true, passthrough: true }
        },
        {
          id: "openai",
          displayName: "OpenAI",
          kind: "http",
          capabilities: { agent: false, model: true, auth: false, passthrough: false }
        }
      ]),
      getAgentProvider: vi.fn(async () => ({ agentId: "orchestrator", providerId: "openai" })),
      setAgentProvider: vi.fn(),
      getProviderOnboarding: vi.fn(),
      getProviderConfig: vi.fn(),
      setProviderConfig: vi.fn(),
      authenticateProvider: vi.fn(),
      getPaths: vi.fn(() => ({ providersDir: "/tmp/providers" }))
    };

    const { context, stderr } = createContext(service);
    const code = await onboardCommand.run(
      ["--non-interactive", "--agent", "orchestrator", "--provider", "codex"],
      context
    );

    expect(code).toBe(1);
    expect(stderr.output()).toContain("not supported for orchestrator onboarding");
    expect(service.setAgentProvider).not.toHaveBeenCalled();
  });

  it("sorts internal providers before external providers", async () => {
    const service = {
      initialize: vi.fn(async () => ({})),
      listProviders: vi.fn(async () => [
        {
          id: "codex",
          displayName: "Codex CLI",
          kind: "cli",
          capabilities: { agent: false, model: true, auth: true, passthrough: true }
        },
        {
          id: "anthropic",
          displayName: "Anthropic",
          kind: "http",
          capabilities: { agent: false, model: true, auth: false, passthrough: false }
        }
      ]),
      getAgentProvider: vi.fn(async () => {
        throw new Error("no current provider");
      }),
      setAgentProvider: vi.fn(async () => ({ agentId: "developer", providerId: "openai" })),
      getProviderOnboarding: vi.fn(async () => ({})),
      getProviderConfig: vi.fn(async () => null),
      setProviderConfig: vi.fn(),
      authenticateProvider: vi.fn(),
      getPaths: vi.fn(() => ({ providersDir: "/tmp/providers" }))
    };

    const { context } = createContext(service);
    const code = await onboardCommand.run(["--non-interactive", "--agent", "developer"], context);

    expect(code).toBe(0);
    expect(service.setAgentProvider).toHaveBeenCalledWith("developer", "anthropic");
  });
});
