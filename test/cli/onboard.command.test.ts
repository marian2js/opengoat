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

  it("maps --model to OpenClaw compatibility model env var", async () => {
    const service = {
      initialize: vi.fn(async () => ({})),
      listProviders: vi.fn(async () => [
        {
          id: "openclaw-openai",
          displayName: "OpenAI (OpenClaw Compat)",
          kind: "cli",
          capabilities: { agent: true, model: true, auth: true, passthrough: true }
        }
      ]),
      getAgentProvider: vi.fn(async () => ({ agentId: "orchestrator", providerId: "openclaw-openai" })),
      setAgentProvider: vi.fn(async () => ({ agentId: "orchestrator", providerId: "openclaw-openai" })),
      getProviderOnboarding: vi.fn(async () => ({
        env: [{ key: "OPENAI_API_KEY", description: "OpenAI key", required: false, secret: true }],
        auth: { supported: true, description: "Runs openclaw onboard" }
      })),
      getProviderConfig: vi.fn(async () => null),
      setProviderConfig: vi.fn(async () => ({
        providerId: "openclaw-openai",
        env: { OPENGOAT_OPENCLAW_OPENAI_MODEL: "openai/gpt-5.1-codex" }
      })),
      authenticateProvider: vi.fn(),
      getPaths: vi.fn(() => ({ providersDir: "/tmp/providers" }))
    };

    const { context } = createContext(service);
    const code = await onboardCommand.run(
      ["--non-interactive", "--provider", "openclaw-openai", "--model", "openai/gpt-5.1-codex"],
      context
    );

    expect(code).toBe(0);
    expect(service.setProviderConfig).toHaveBeenCalledWith(
      "openclaw-openai",
      expect.objectContaining({
        OPENGOAT_OPENCLAW_OPENAI_MODEL: "openai/gpt-5.1-codex"
      })
    );
  });

  it("defaults orchestrator to eligible providers and deduplicates compat/native overlaps", async () => {
    const service = {
      initialize: vi.fn(async () => ({})),
      listProviders: vi.fn(async () => [
        {
          id: "openclaw-openai",
          displayName: "OpenAI (OpenClaw Compat)",
          kind: "cli",
          capabilities: { agent: true, model: true, auth: true, passthrough: true }
        },
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
});
