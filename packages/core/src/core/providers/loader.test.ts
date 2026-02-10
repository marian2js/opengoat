import { describe, expect, it } from "vitest";
import { ProviderRegistry } from "./registry.js";
import { loadProviderModules } from "./loader.js";

describe("provider loader", () => {
  it("registers OpenClaw provider module", async () => {
    const registry = new ProviderRegistry();
    await loadProviderModules(registry);

    expect(registry.listProviderIds()).toEqual(["openclaw"]);
  });
});
