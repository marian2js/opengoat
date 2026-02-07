import { createDefaultProviderRegistry } from "@opengoat/core";
import { describe, expect, it } from "vitest";

const LIVE = isTruthy(process.env.LIVE) || isTruthy(process.env.OPENGOAT_LIVE_TEST);
const REQUIRE_CONFIG = isTruthy(process.env.OPENGOAT_LIVE_REQUIRE_CONFIG);
const INCLUDE_OPTIONAL = isTruthy(process.env.OPENGOAT_LIVE_INCLUDE_OPTIONAL);
const PROVIDER_FILTER = parseFilter(process.env.OPENGOAT_LIVE_PROVIDERS);
const TIMEOUT_MS = parsePositiveInt(process.env.OPENGOAT_LIVE_PROVIDER_TIMEOUT_MS, 30_000);

const describeLive = LIVE ? describe : describe.skip;

describeLive("live provider smoke", () => {
  it(
    "runs selected native HTTP providers",
    async () => {
      const registry = await createDefaultProviderRegistry();
      const allProviders = registry
        .listProviders()
        .filter((provider) => provider.kind === "http")
        .filter((provider) => (PROVIDER_FILTER ? PROVIDER_FILTER.has(provider.id) : true));

      const explicitFilter = PROVIDER_FILTER !== null;
      const candidates: Array<{ id: string; run: () => Promise<void> }> = [];
      const skipped: Array<{ id: string; reason: string }> = [];
      const failures: Array<{ id: string; reason: string }> = [];

      for (const provider of allProviders) {
        const onboarding = registry.getProviderOnboarding(provider.id);
        const requiredFields = (onboarding?.env ?? []).filter((field) => Boolean(field.required));
        const missing = requiredFields
          .map((field) => field.key)
          .filter((key) => !process.env[key]?.trim());

        if (requiredFields.length === 0 && !INCLUDE_OPTIONAL && !explicitFilter) {
          skipped.push({
            id: provider.id,
            reason: "no required env fields (set OPENGOAT_LIVE_INCLUDE_OPTIONAL=1 to include)"
          });
          continue;
        }

        if (missing.length > 0) {
          const reason = `missing required env: ${missing.join(", ")}`;
          if (REQUIRE_CONFIG) {
            failures.push({ id: provider.id, reason });
          } else {
            skipped.push({ id: provider.id, reason });
          }
          continue;
        }

        candidates.push({
          id: provider.id,
          run: async () => {
            const result = await withTimeout(
              provider.invoke({
                message: "Reply with the word ok.",
                env: process.env
              }),
              TIMEOUT_MS,
              `${provider.id} timed out after ${TIMEOUT_MS}ms`
            );

            if (result.code !== 0) {
              throw new Error(result.stderr.trim() || "provider returned non-zero exit code");
            }

            const output = result.stdout.trim();
            if (!output) {
              throw new Error("provider returned empty output");
            }
          }
        });
      }

      if (candidates.length === 0 && failures.length === 0) {
        log("no configured providers selected; skipping");
        if (skipped.length > 0) {
          log(`skipped providers:\n${formatList(skipped)}`);
        }
        return;
      }

      for (const candidate of candidates) {
        log(`running ${candidate.id}`);
        try {
          await candidate.run();
        } catch (error) {
          failures.push({
            id: candidate.id,
            reason: error instanceof Error ? error.message : String(error)
          });
        }
      }

      if (skipped.length > 0) {
        log(`skipped providers:\n${formatList(skipped)}`);
      }

      if (failures.length > 0) {
        throw new Error(`provider smoke failures:\n${formatList(failures)}`);
      }

      expect(candidates.length).toBeGreaterThan(0);
    },
    10 * 60_000
  );
});

function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parseFilter(value: string | undefined): Set<string> | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "all") {
    return null;
  }

  const ids = trimmed
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return ids.length > 0 ? new Set(ids) : null;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value?.trim()) {
    return fallback;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function formatList(items: Array<{ id: string; reason: string }>): string {
  return items.map((item) => `- ${item.id}: ${item.reason}`).join("\n");
}

function log(message: string): void {
  console.log(`[live-providers] ${message}`);
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race<T>([
      operation,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
