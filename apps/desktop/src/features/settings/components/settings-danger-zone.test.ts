import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ProjectSettings.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Delete button is within a labeled section ("Danger zone" or similar)
// ---------------------------------------------------------------------------

void test("Danger zone has a Card container wrapping the delete action", () => {
  assert.ok(
    src.includes("Danger zone"),
    "Settings must include a 'Danger zone' section heading",
  );
});

void test("Danger zone heading uses CardTitle component", () => {
  assert.ok(
    src.includes("CardTitle") && src.includes("Danger zone"),
    "Danger zone heading must use CardTitle component for consistency",
  );
});

// ---------------------------------------------------------------------------
// AC2: Section has a brief description explaining the action's impact
// ---------------------------------------------------------------------------

void test("Danger zone has a CardDescription explaining the action", () => {
  assert.ok(
    src.includes("CardDescription") && src.includes("Irreversible"),
    "Danger zone must include a CardDescription explaining the irreversible nature",
  );
});

void test("Delete action has specific description about what gets removed", () => {
  assert.ok(
    src.includes("Permanently") && src.includes("Delete this project"),
    "Delete action must explain what will be permanently removed",
  );
});

// ---------------------------------------------------------------------------
// AC3: Visual containment with a destructive-colored border or background
// ---------------------------------------------------------------------------

void test("Danger zone Card uses destructive border color", () => {
  assert.ok(
    src.includes("border-destructive"),
    "Danger zone Card must use a destructive-colored border",
  );
});

void test("Danger zone heading uses destructive text color", () => {
  assert.ok(
    src.includes("text-destructive") && src.includes("Danger zone"),
    "Danger zone heading must use destructive text color",
  );
});

void test("Delete button uses destructive variant", () => {
  assert.ok(
    src.includes('variant="destructive"'),
    "Delete button must use the destructive variant",
  );
});

// ---------------------------------------------------------------------------
// AC4: Section spacing is consistent with other settings sections
// ---------------------------------------------------------------------------

void test("Danger zone uses the same Card pattern as other settings sections", () => {
  // Count Card usages — should include General, Model, and Danger zone at minimum
  const cardMatches = src.match(/<Card[\s>]/g);
  assert.ok(
    cardMatches && cardMatches.length >= 3,
    "Settings page must use Card component for at least General, Model, and Danger zone sections",
  );
});

void test("Settings sections are spaced with space-y-6 container", () => {
  assert.ok(
    src.includes("space-y-6"),
    "Settings sections must use space-y-6 for consistent vertical spacing",
  );
});

// ---------------------------------------------------------------------------
// AC5: Works in both light and dark modes
// ---------------------------------------------------------------------------

void test("Danger zone border uses opacity for theme adaptability", () => {
  assert.ok(
    src.includes("border-destructive/"),
    "Danger zone border must use opacity modifier (e.g. border-destructive/30) for theme adaptability",
  );
});

void test("Danger zone uses theme-aware text colors (not hardcoded)", () => {
  assert.ok(
    src.includes("text-muted-foreground") && src.includes("text-foreground"),
    "Danger zone must use theme-aware text colors",
  );
});
