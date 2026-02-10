import { describe, expect, it } from "vitest";
import { createDefaultProviderRegistry } from "./index.js";

describe("provider registry", () => {
  it("loads only the OpenClaw runtime provider", async () => {
    const registry = await createDefaultProviderRegistry();

    const providerIds = registry.listProviderIds();
    expect(providerIds).toEqual(["openclaw"]);

    expect(registry.getProviderOnboarding("openclaw")?.env?.some((field) => field.key === "OPENCLAW_CMD")).toBe(
      true
    );
  });
});
