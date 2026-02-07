import { describe, expect, it, vi } from "vitest";
import { ProviderRegistry } from "./registry.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readdir: vi.fn(async () => {
      const error = new Error("no providers directory") as Error & { code?: string };
      error.code = "ENOENT";
      throw error;
    })
  };
});

describe("provider loader", () => {
  it("falls back to statically imported providers when providers dir is unavailable", async () => {
    const { loadProviderModules } = await import("./loader.js");
    const registry = new ProviderRegistry();

    await loadProviderModules(registry);

    const ids = registry.listProviderIds();
    expect(ids).toContain("codex");
    expect(ids).toContain("openai");
    expect(ids).toContain("anthropic");
    expect(ids).toContain("vercel-ai-gateway");
  });
});
