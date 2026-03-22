import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "OpportunitySection.tsx"),
  "utf-8",
);

const actionGridSrc = readFileSync(
  resolve(import.meta.dirname, "ActionCardGrid.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Icon presence: Insights heading must have a Lightbulb icon
// ---------------------------------------------------------------------------

void test("OpportunitySection imports LightbulbIcon from lucide-react", () => {
  assert.ok(
    src.includes("LightbulbIcon"),
    "Expected LightbulbIcon import for the Insights section heading",
  );
  assert.ok(
    src.includes("lucide-react"),
    "Expected lucide-react as the icon source",
  );
});

void test("OpportunitySection renders LightbulbIcon with size-4", () => {
  assert.ok(
    src.includes('<LightbulbIcon className="size-4"'),
    "Expected LightbulbIcon rendered with size-4 to match other section icons",
  );
});

// ---------------------------------------------------------------------------
// Icon wrapper consistency: same classes as ActionCardGrid's icon wrapper
// ---------------------------------------------------------------------------

void test("OpportunitySection icon wrapper matches ActionCardGrid icon wrapper styling", () => {
  // Both should use bg-primary/8 p-1.5 text-primary
  assert.ok(
    src.includes("bg-primary/8"),
    "Expected bg-primary/8 on the icon wrapper",
  );
  assert.ok(
    src.includes("p-1.5"),
    "Expected p-1.5 padding on the icon wrapper",
  );
  assert.ok(
    src.includes("text-primary"),
    "Expected text-primary color on the icon wrapper",
  );
  assert.ok(
    src.includes("rounded-lg"),
    "Expected rounded-lg on the icon wrapper",
  );
});

// ---------------------------------------------------------------------------
// Heading text styling consistency
// ---------------------------------------------------------------------------

void test("OpportunitySection heading uses same text classes as ActionCardGrid heading", () => {
  assert.ok(
    src.includes("text-base font-semibold tracking-tight"),
    "Expected text-base font-semibold tracking-tight on the heading",
  );
  assert.ok(
    actionGridSrc.includes("text-base font-semibold tracking-tight"),
    "ActionCardGrid should also use text-base font-semibold tracking-tight",
  );
});

// ---------------------------------------------------------------------------
// Spacing consistency: gap between heading and grid should match other sections
// ---------------------------------------------------------------------------

void test("OpportunitySection uses gap-4 to match other dashboard section spacing", () => {
  // The main section flex container should use gap-4, same as ActionCardGrid
  assert.ok(
    src.includes('className="flex flex-col gap-4"'),
    "Expected gap-4 on the section container to match ActionCardGrid spacing",
  );
});

// ---------------------------------------------------------------------------
// Skeleton also has icon placeholder
// ---------------------------------------------------------------------------

void test("OpportunitySection skeleton includes an icon placeholder", () => {
  assert.ok(
    src.includes("size-7 rounded-lg"),
    "Expected skeleton placeholder for the icon (size-7 rounded-lg)",
  );
});
