import { describe, expect, it } from "vitest";
import {
  callWithProcedureFallback,
  isMissingProcedureError,
  resolveOnboardingDraftProviderId
} from "./workbench-store";

describe("workbench store", () => {
  it("retries on missing procedure errors and returns first successful result", async () => {
    const result = await callWithProcedureFallback<string>([
      async () => {
        throw new Error('No "query"-procedure on path "bootstrap"');
      },
      async () => {
        throw new Error('No "mutation"-procedure on path "bootstrapMutate"');
      },
      async () => "ok"
    ]);

    expect(result).toBe("ok");
  });

  it("does not swallow non-procedure errors", async () => {
    await expect(
      callWithProcedureFallback([
        async () => {
          throw new Error("Network timeout");
        },
        async () => "never reached"
      ])
    ).rejects.toThrow("Network timeout");
  });

  it("recognizes both query and mutation missing-procedure errors", () => {
    expect(isMissingProcedureError(new Error('No "query"-procedure on path "a"'))).toBe(true);
    expect(isMissingProcedureError(new Error('No "mutation"-procedure on path "b"'))).toBe(true);
    expect(
      isMissingProcedureError({
        message: 'No "query"-procedure on path "legacy.bootstrap"'
      })
    ).toBe(true);
    expect(isMissingProcedureError(new Error("Something else"))).toBe(false);
  });

  it("keeps preferred onboarding provider if still available", () => {
    const providerId = resolveOnboardingDraftProviderId(
      {
        activeProviderId: "openai",
        needsOnboarding: true,
        providers: [
          {
            id: "openai",
            displayName: "OpenAI",
            kind: "http",
            envFields: [],
            configuredEnvKeys: [],
            configuredEnvValues: {},
            missingRequiredEnv: [],
            hasConfig: true
          },
          {
            id: "codex",
            displayName: "Codex",
            kind: "cli",
            envFields: [],
            configuredEnvKeys: [],
            configuredEnvValues: {},
            missingRequiredEnv: [],
            hasConfig: true
          }
        ]
      },
      "codex"
    );

    expect(providerId).toBe("codex");
  });

  it("falls back to active onboarding provider when preferred is unavailable", () => {
    const providerId = resolveOnboardingDraftProviderId(
      {
        activeProviderId: "openai",
        needsOnboarding: true,
        providers: [
          {
            id: "openai",
            displayName: "OpenAI",
            kind: "http",
            envFields: [],
            configuredEnvKeys: [],
            configuredEnvValues: {},
            missingRequiredEnv: [],
            hasConfig: true
          }
        ]
      },
      "codex"
    );

    expect(providerId).toBe("openai");
  });
});
