import { describe, expect, it } from "vitest";
import { createDefaultProviderRegistry } from "./index.js";

describe("provider registry", () => {
  it("loads built-in runtime providers", async () => {
    const registry = await createDefaultProviderRegistry();

    const providerIds = registry.listProviderIds();
    expect(providerIds).toEqual([
      "claude-code",
      "codex",
      "cursor",
      "openclaw",
      "opencode",
    ]);

    expect(registry.getProviderOnboarding("openclaw")?.env?.some((field) => field.key === "OPENCLAW_CMD")).toBe(
      true
    );
    expect(
      registry.getProviderOnboarding("claude-code")?.env?.some((field) => field.key === "CLAUDE_CODE_CMD"),
    ).toBe(true);
    expect(
      registry.getProviderOnboarding("codex")?.env?.some((field) => field.key === "CODEX_CMD"),
    ).toBe(true);
    expect(
      registry.getProviderOnboarding("cursor")?.env?.some((field) => field.key === "CURSOR_CMD"),
    ).toBe(true);
    expect(
      registry.getProviderOnboarding("opencode")?.env?.some((field) => field.key === "OPENCODE_CMD"),
    ).toBe(true);
  });
});
