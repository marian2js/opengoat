import { describe, expect, it } from "vitest";
import { BaseProvider } from "./base-provider.js";
import { createDefaultProviderRegistry } from "./index.js";
import { ProviderRegistry } from "./registry.js";
import type { ProviderCapabilities, ProviderExecutionResult, ProviderInvokeOptions, ProviderKind } from "./types.js";

describe("provider registry", () => {
  it("auto-loads provider modules from provider folders", async () => {
    const registry = await createDefaultProviderRegistry();

    expect(registry.listProviderIds()).toEqual([
      "claude",
      "codex",
      "cursor",
      "gemini",
      "grok",
      "openai",
      "openclaw",
      "opencode",
      "openrouter"
    ]);

    expect(registry.getProviderOnboarding("openai")?.env?.some((field) => field.key === "OPENAI_API_KEY")).toBe(
      true
    );
    expect(registry.getProviderOnboarding("gemini")?.env?.some((field) => field.key === "GEMINI_CMD")).toBe(true);
    expect(registry.getProviderOnboarding("opencode")?.env?.some((field) => field.key === "OPENCODE_CMD")).toBe(
      true
    );
  });

  it("supports custom registration", async () => {
    const registry = new ProviderRegistry();
    registry.register("mock", () => new MockProvider());

    const provider = registry.create("mock");
    const result = await provider.invoke({ message: "ping" });

    expect(provider.id).toBe("mock");
    expect(result.stdout).toContain("ping");
  });
});

class MockProvider extends BaseProvider {
  public readonly kind: ProviderKind = "cli";
  public readonly capabilities: ProviderCapabilities = {
    agent: false,
    model: false,
    auth: false,
    passthrough: false
  };

  public constructor() {
    super({
      id: "mock",
      displayName: "Mock",
      kind: "cli",
      capabilities: {
        agent: false,
        model: false,
        auth: false,
        passthrough: false
      }
    });
  }

  public async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    this.validateInvokeOptions(options);
    return {
      code: 0,
      stdout: `mock:${options.message}\n`,
      stderr: ""
    };
  }
}
