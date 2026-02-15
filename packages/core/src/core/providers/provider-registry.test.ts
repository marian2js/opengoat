import { describe, expect, it } from "vitest";
import { createDefaultProviderRegistry } from "./index.js";

describe("provider registry", () => {
  it("loads built-in runtime providers", async () => {
    const registry = await createDefaultProviderRegistry();

    const providerIds = registry.listProviderIds();
    expect(providerIds).toEqual(["claude-code", "openclaw"]);

    expect(registry.getProviderOnboarding("openclaw")?.env?.some((field) => field.key === "OPENCLAW_CMD")).toBe(
      true
    );
    expect(
      registry.getProviderOnboarding("claude-code")?.env?.some((field) => field.key === "CLAUDE_CODE_CMD"),
    ).toBe(true);
  });
});
