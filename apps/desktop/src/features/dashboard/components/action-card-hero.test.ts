import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const gridSrc = readFileSync(
  resolve(import.meta.dirname, "ActionCardGrid.tsx"),
  "utf-8",
);

const itemSrc = readFileSync(
  resolve(import.meta.dirname, "ActionCardItem.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// ActionCardGrid: Hero cards — first 3 cards should be marked as hero
// ---------------------------------------------------------------------------

void test("ActionCardGrid passes isHero prop to the first 3 cards", () => {
  // The grid should distinguish hero cards by index
  assert.ok(
    gridSrc.includes("isHero"),
    "Expected ActionCardGrid to pass isHero prop to ActionCardItem",
  );
});

void test("ActionCardGrid hero logic uses index to determine hero status", () => {
  // Should use index < 3 or similar logic
  assert.match(
    gridSrc,
    /index\s*<\s*3|i\s*<\s*3/,
    "Expected hero logic based on index < 3",
  );
});

// ---------------------------------------------------------------------------
// ActionCardItem: Hero variant — visually distinct from standard cards
// ---------------------------------------------------------------------------

void test("ActionCardItem accepts isHero prop", () => {
  assert.ok(
    itemSrc.includes("isHero"),
    "Expected ActionCardItem to accept isHero prop",
  );
});

void test("ActionCardItem hero cards have bolder title font weight", () => {
  // Hero cards should use font-bold (700) vs standard font-medium (500)
  assert.ok(
    itemSrc.includes("font-bold"),
    "Expected hero card title to use font-bold (700) for visual prominence",
  );
});

void test("ActionCardItem hero cards have a persistent teal top border", () => {
  // Hero cards should have a persistent teal top border accent
  assert.ok(
    itemSrc.includes("border-t-2") || itemSrc.includes("border-t-primary"),
    "Expected hero cards to have a persistent teal top border accent",
  );
});

void test("ActionCardItem standard cards still have hover translateY", () => {
  assert.ok(
    itemSrc.includes("hover:-translate-y-px"),
    "Expected standard cards to retain hover:-translate-y-px hover state",
  );
});

void test("ActionCardItem hero cards have larger padding", () => {
  // Hero cards should have increased padding compared to standard cards
  assert.ok(
    itemSrc.includes("py-5") || itemSrc.includes("py-6") || itemSrc.includes("p-5") || itemSrc.includes("p-6"),
    "Expected hero cards to have increased padding for visual prominence",
  );
});

// ---------------------------------------------------------------------------
// Grid still works correctly with hero rows
// ---------------------------------------------------------------------------

void test("ActionCardGrid still uses responsive grid columns", () => {
  assert.ok(
    gridSrc.includes("sm:grid-cols-2"),
    "Expected sm:grid-cols-2 for responsive 2-column layout",
  );
  assert.ok(
    gridSrc.includes("xl:grid-cols-3"),
    "Expected xl:grid-cols-3 for responsive 3-column layout",
  );
});
