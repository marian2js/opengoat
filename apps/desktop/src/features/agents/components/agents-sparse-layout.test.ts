import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "AgentsWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Agents page has an "Add agent" CTA button in the header area
// ---------------------------------------------------------------------------

void test("AgentsWorkspace has an Add agent button", () => {
  assert.ok(
    src.includes("Add agent"),
    "Must have an 'Add agent' CTA button in the header area",
  );
});

void test("Add agent button uses outline variant to keep Refresh as main action", () => {
  assert.ok(
    src.includes('variant="outline"'),
    "Add agent button must use outline variant (secondary) to not overshadow Refresh",
  );
});

// ---------------------------------------------------------------------------
// AC3: Below existing items, a muted guidance placeholder indicates more can be added
// ---------------------------------------------------------------------------

void test("AgentsWorkspace has guidance placeholder text", () => {
  assert.ok(
    src.includes("Add another agent") || src.includes("expand your library"),
    "Must have a muted guidance placeholder below existing items",
  );
});

void test("Guidance placeholder uses dashed border styling", () => {
  assert.ok(
    src.includes("border-dashed"),
    "Guidance placeholder must use dashed border",
  );
});

// ---------------------------------------------------------------------------
// AC4: Guidance text uses muted styling
// ---------------------------------------------------------------------------

void test("Guidance text uses muted-foreground styling", () => {
  assert.ok(
    src.includes("text-muted-foreground"),
    "Guidance text must use text-muted-foreground for muted styling",
  );
});

// ---------------------------------------------------------------------------
// AC5: Works in both dark and light modes — semantic color tokens only
// ---------------------------------------------------------------------------

void test("AgentsWorkspace uses semantic theme-aware colors", () => {
  assert.ok(
    src.includes("text-foreground"),
    "Must use semantic foreground color tokens for theme compatibility",
  );
  assert.ok(
    src.includes("border-border"),
    "Must use semantic border color tokens for theme compatibility",
  );
});
