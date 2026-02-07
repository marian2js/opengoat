import { describe, expect, it } from "vitest";
import {
  extendedHttpProviderCatalog,
  resolveExtendedHttpProviderModelEnvVar,
  resolveExtendedHttpProviderOnboarding
} from "./catalog.js";

describe("extended http provider catalog", () => {
  it("registers a broad native provider set", () => {
    const ids = extendedHttpProviderCatalog.map((entry) => entry.id);

    expect(ids).toContain("anthropic");
    expect(ids).toContain("amazon-bedrock");
    expect(ids).toContain("google");
    expect(ids).toContain("moonshot");
    expect(ids).toContain("zai");
    expect(ids.length).toBeGreaterThanOrEqual(25);
  });

  it("exposes model env resolution for onboarding --model mapping", () => {
    expect(resolveExtendedHttpProviderModelEnvVar("anthropic")).toBe("ANTHROPIC_MODEL");
    expect(resolveExtendedHttpProviderModelEnvVar("moonshot")).toBe("MOONSHOT_MODEL");
    expect(resolveExtendedHttpProviderModelEnvVar("missing-provider")).toBeUndefined();
  });

  it("builds onboarding spec with required fields only", () => {
    const spec = extendedHttpProviderCatalog.find((entry) => entry.id === "cloudflare-ai-gateway");
    if (!spec) {
      throw new Error("missing cloudflare-ai-gateway spec");
    }

    const onboarding = resolveExtendedHttpProviderOnboarding(spec);
    const keys = onboarding.env?.map((field) => field.key) ?? [];

    expect(keys).toContain("CLOUDFLARE_AI_GATEWAY_API_KEY");
    expect(keys).toContain("CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID");
    expect(keys).toContain("CLOUDFLARE_AI_GATEWAY_GATEWAY_ID");
    expect(keys).not.toContain("CLOUDFLARE_AI_GATEWAY_MODEL");
  });

  it("marks model as required when provider has no default model", () => {
    const spec = extendedHttpProviderCatalog.find((entry) => entry.id === "cerebras");
    if (!spec) {
      throw new Error("missing cerebras spec");
    }

    const onboarding = resolveExtendedHttpProviderOnboarding(spec);
    const modelField = onboarding.env?.find((field) => field.key === "CEREBRAS_MODEL");
    expect(modelField?.required).toBe(true);
  });
});
