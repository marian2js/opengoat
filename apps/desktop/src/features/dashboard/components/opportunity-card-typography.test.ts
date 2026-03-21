import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "OpportunityCard.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Typography hierarchy: title must visually dominate explanation
// ---------------------------------------------------------------------------

void test("OpportunityCard title uses font-semibold for strong visual weight", () => {
  // The h3 title element should use font-semibold (not font-medium)
  assert.ok(
    src.includes("font-semibold"),
    "Expected font-semibold on the insight card title for visual dominance over explanation text",
  );
});

void test("OpportunityCard title uses full text-foreground color (no opacity)", () => {
  // The title should use text-foreground without /80 opacity
  // Match the h3 line to ensure it has text-foreground without opacity suffix
  const h3Match = src.match(/<h3[^>]*className="([^"]*)"/);
  assert.ok(h3Match, "Expected to find an h3 element with a className");
  const className = h3Match[1];
  assert.ok(
    className.includes("text-foreground") && !className.includes("text-foreground/"),
    `Expected h3 to have 'text-foreground' without opacity, got: ${className}`,
  );
});

void test("OpportunityCard title does NOT use font-medium", () => {
  // font-medium should be replaced by font-semibold on the title
  const h3Match = src.match(/<h3[^>]*className="([^"]*)"/);
  assert.ok(h3Match, "Expected to find an h3 element with a className");
  const className = h3Match[1];
  assert.ok(
    !className.includes("font-medium"),
    `Expected h3 NOT to use font-medium (should be font-semibold), got: ${className}`,
  );
});
