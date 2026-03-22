import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ConnectionsWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC2: Connections page has an "Add connection" CTA button in the header area
// ---------------------------------------------------------------------------

void test("ConnectionsWorkspace has an Add connection button", () => {
  assert.ok(
    src.includes("Add connection"),
    "Must have an 'Add connection' CTA button in the header area",
  );
});

void test("Add connection button uses outline variant", () => {
  assert.ok(
    src.includes('variant="outline"'),
    "Add connection button must use outline variant (secondary) to not overshadow Refresh",
  );
});

// ---------------------------------------------------------------------------
// AC3: Below existing items, a muted guidance placeholder indicates more can be added
// ---------------------------------------------------------------------------

void test("ConnectionsWorkspace has guidance placeholder text", () => {
  assert.ok(
    src.includes("Add more connections") || src.includes("different AI providers"),
    "Must have a muted guidance placeholder below existing connections",
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

void test("ConnectionsWorkspace uses semantic theme-aware colors", () => {
  assert.ok(
    src.includes("text-foreground"),
    "Must use semantic foreground color tokens for theme compatibility",
  );
  assert.ok(
    src.includes("border-border"),
    "Must use semantic border color tokens for theme compatibility",
  );
});

// ---------------------------------------------------------------------------
// AC6: Layout doesn't feel sparse
// ---------------------------------------------------------------------------

void test("ConnectionsWorkspace has guidance section with dashed or muted border styling", () => {
  assert.ok(
    src.includes("border-dashed") || src.includes("bg-muted"),
    "Must have visual treatment (dashed border or muted bg) for the guidance section",
  );
});
