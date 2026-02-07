import { describe, expect, it } from "vitest";
import { ProviderCommandNotFoundError } from "../../errors.js";
import {
  openClawCompatProviderCatalog,
  resolveOpenClawCompatModelEnvVar
} from "./catalog.js";
import { providerModules } from "./index.js";
import { OpenClawCompatProvider } from "./provider.js";

describe("openclaw compat provider", () => {
  it("invokes openclaw with explicit model and message", async () => {
    const requests: Array<{ command: string; args: string[] }> = [];
    const provider = new OpenClawCompatProvider(findSpec("openai"), {
      execute: async (request) => {
        requests.push({ command: request.command, args: request.args });
        return { code: 0, stdout: "ok\n", stderr: "" };
      }
    });

    const result = await provider.invoke({
      message: "hello",
      model: "openai/gpt-5.1-codex",
      env: {
        OPENCLAW_CMD: "openclaw-dev"
      }
    });

    expect(result.code).toBe(0);
    expect(requests).toEqual([
      {
        command: "openclaw-dev",
        args: ["agent", "--model", "openai/gpt-5.1-codex", "--message", "hello"]
      }
    ]);
  });

  it("passes provider session id through --session-id", async () => {
    const requests: Array<{ command: string; args: string[] }> = [];
    const provider = new OpenClawCompatProvider(findSpec("openai"), {
      execute: async (request) => {
        requests.push({ command: request.command, args: request.args });
        return { code: 0, stdout: "ok\n", stderr: "" };
      }
    });

    const result = await provider.invoke({
      message: "continue",
      model: "openai/gpt-5.1-codex",
      providerSessionId: "provider-session-9"
    });

    expect(requests[0]?.args).toEqual([
      "agent",
      "--session-id",
      "provider-session-9",
      "--model",
      "openai/gpt-5.1-codex",
      "--message",
      "continue"
    ]);
    expect(result.providerSessionId).toBe("provider-session-9");
  });

  it("uses provider model env var fallback when --model is missing", async () => {
    const requests: Array<{ command: string; args: string[] }> = [];
    const modelEnvVar = resolveOpenClawCompatModelEnvVar("openrouter");
    const provider = new OpenClawCompatProvider(findSpec("openrouter"), {
      execute: async (request) => {
        requests.push({ command: request.command, args: request.args });
        return { code: 0, stdout: "ok\n", stderr: "" };
      }
    });

    await provider.invoke({
      message: "route this",
      env: {
        [modelEnvVar]: "openrouter/anthropic/claude-sonnet-4-5"
      }
    });

    expect(requests[0]?.args).toEqual([
      "agent",
      "--model",
      "openrouter/anthropic/claude-sonnet-4-5",
      "--message",
      "route this"
    ]);
  });

  it("discovers provider default model from openclaw models list", async () => {
    const requests: Array<{ command: string; args: string[] }> = [];
    const provider = new OpenClawCompatProvider(findSpec("google"), {
      execute: async (request) => {
        requests.push({ command: request.command, args: request.args });
        if (request.args[0] === "models") {
          return {
            code: 0,
            stdout: JSON.stringify({
              models: [
                { key: "google/gemini-3-pro-preview", tags: ["default"] },
                { key: "google/gemini-3-flash-preview", tags: [] }
              ]
            }),
            stderr: ""
          };
        }
        return { code: 0, stdout: "done\n", stderr: "" };
      }
    });

    await provider.invoke({
      message: "summarize",
      cwd: "/tmp/opengoat-test-google"
    });

    expect(requests[0]?.args).toEqual(["models", "list", "--all", "--provider", "google", "--json"]);
    expect(requests[1]?.args).toEqual([
      "agent",
      "--model",
      "google/gemini-3-pro-preview",
      "--message",
      "summarize"
    ]);
  });

  it("returns actionable error when no model can be resolved", async () => {
    const provider = new OpenClawCompatProvider(
      {
        ...findSpec("openai"),
        defaultModel: undefined
      },
      {
        execute: async () => ({
          code: 1,
          stdout: "",
          stderr: "models list failed"
        })
      }
    );

    const result = await provider.invoke({
      message: "hello",
      cwd: "/tmp/opengoat-test-no-model"
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Missing model for provider \"openai\"");
  });

  it("maps auth to openclaw onboard auth-choice", async () => {
    const requests: Array<{ command: string; args: string[] }> = [];
    const provider = new OpenClawCompatProvider(findSpec("openai"), {
      execute: async (request) => {
        requests.push({ command: request.command, args: request.args });
        return { code: 0, stdout: "ok\n", stderr: "" };
      }
    });

    await provider.invokeAuth();

    expect(requests).toEqual([
      {
        command: "openclaw",
        args: ["onboard", "--auth-choice", "openai-api-key"]
      }
    ]);
  });

  it("allows passthrough auth args for provider-specific debug flows", async () => {
    const requests: Array<{ command: string; args: string[] }> = [];
    const provider = new OpenClawCompatProvider(findSpec("openai-codex"), {
      execute: async (request) => {
        requests.push({ command: request.command, args: request.args });
        return { code: 0, stdout: "ok\n", stderr: "" };
      }
    });

    await provider.invokeAuth({
      passthroughArgs: ["models", "auth", "login", "--provider", "openai-codex", "--method", "oauth"]
    });

    expect(requests[0]?.args).toEqual([
      "models",
      "auth",
      "login",
      "--provider",
      "openai-codex",
      "--method",
      "oauth"
    ]);
  });

  it("maps ENOENT to ProviderCommandNotFoundError", async () => {
    const provider = new OpenClawCompatProvider(findSpec("openai"), {
      execute: async () => {
        const error = new Error("spawn openclaw ENOENT") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
    });

    await expect(
      provider.invoke({
        message: "hello",
        model: "openai/gpt-5.1-codex"
      })
    ).rejects.toBeInstanceOf(ProviderCommandNotFoundError);
  });
});

describe("openclaw compat provider modules", () => {
  it("registers provider modules for each OpenClaw-compatible provider", () => {
    expect(providerModules.length).toBe(openClawCompatProviderCatalog.length);
    expect(providerModules.some((module) => module.id === "openclaw-openai")).toBe(true);
    expect(providerModules.some((module) => module.id === "openclaw-openai-codex")).toBe(true);
    expect(providerModules.some((module) => module.id === "openclaw-openrouter")).toBe(true);
  });

  it("includes onboarding env keys for model overrides", () => {
    const module = providerModules.find((entry) => entry.id === "openclaw-openai");
    expect(module?.onboarding?.env?.some((entry) => entry.key === "OPENCLAW_CMD")).toBe(true);
    expect(module?.onboarding?.env?.some((entry) => entry.key === "OPENGOAT_OPENCLAW_OPENAI_MODEL")).toBe(
      true
    );
  });
});

function findSpec(providerId: string) {
  const spec = openClawCompatProviderCatalog.find((entry) => entry.providerId === providerId);
  if (!spec) {
    throw new Error(`OpenClaw compat spec not found: ${providerId}`);
  }
  return spec;
}
