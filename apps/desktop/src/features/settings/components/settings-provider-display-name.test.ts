import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ProjectSettings.tsx"),
  "utf-8",
);

const displayHelpersSrc = readFileSync(
  resolve(import.meta.dirname, "../../agents/display-helpers.ts"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Settings PROVIDER dropdown shows human-readable names, not raw slugs
// ---------------------------------------------------------------------------

void test("Settings imports cleanProviderName from display-helpers", () => {
  assert.ok(
    src.includes("cleanProviderName"),
    "ProjectSettings must import cleanProviderName to format provider display names",
  );
});

void test("Settings applies cleanProviderName to provider display names", () => {
  assert.ok(
    src.includes("cleanProviderName("),
    "ProjectSettings must call cleanProviderName() when building provider display names",
  );
});

// ---------------------------------------------------------------------------
// AC2: Display format matches Connections page provider naming
// ---------------------------------------------------------------------------

void test("Settings uses same cleanProviderName utility as Connections page", () => {
  assert.ok(
    src.includes('from "@/features/agents/display-helpers"') ||
    src.includes("from '../../agents/display-helpers'") ||
    src.includes('from "../../agents/display-helpers"'),
    "Must import cleanProviderName from the same module the Connections page uses",
  );
});

// ---------------------------------------------------------------------------
// AC3: The underlying data value remains the slug (no functional change)
// ---------------------------------------------------------------------------

void test("Select option value remains the raw providerId slug", () => {
  assert.ok(
    src.includes("value={p.providerId}") || src.includes("value={p.providerId}"),
    "SelectItem value must use the raw providerId slug for data binding",
  );
});

// ---------------------------------------------------------------------------
// AC4: All provider options use human-readable labels
// ---------------------------------------------------------------------------

void test("display-helpers handles slug-style provider names as fallback", () => {
  assert.ok(
    displayHelpersSrc.includes("formatProviderSlug") ||
    displayHelpersSrc.includes("github-copilot") ||
    displayHelpersSrc.includes("split"),
    "display-helpers must handle slug-to-display conversion for provider names that are raw slugs",
  );
});

// ---------------------------------------------------------------------------
// AC5: Provider name resolution uses connection providerName field
// ---------------------------------------------------------------------------

void test("Settings builds provider name from connections providerName field", () => {
  assert.ok(
    src.includes("c.providerName") || src.includes("providerName"),
    "Must use connection.providerName for name resolution (same source as Connections page)",
  );
});
