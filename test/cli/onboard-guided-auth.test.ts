import { describe, expect, it } from "vitest";
import { resolveGuidedAuth } from "../../packages/cli/src/cli/commands/onboard-guided-auth.js";

describe("onboard guided auth registration", () => {
  it("registers guided flows for OAuth/device providers", () => {
    const providerIds = [
      "qwen-portal",
      "minimax-portal",
      "github-copilot",
      "copilot-proxy",
      "chutes",
      "google-antigravity",
      "google-gemini-cli"
    ];

    for (const providerId of providerIds) {
      expect(resolveGuidedAuth(providerId)).toBeTruthy();
    }
  });

  it("does not register guided flow for plain API-key providers", () => {
    expect(resolveGuidedAuth("openai")).toBeUndefined();
    expect(resolveGuidedAuth("anthropic")).toBeUndefined();
    expect(resolveGuidedAuth("groq")).toBeUndefined();
  });
});
