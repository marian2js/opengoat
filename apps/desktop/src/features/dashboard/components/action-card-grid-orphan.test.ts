import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ActionCardGrid.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Orphan card handling: last card in a partial row should span full width
// ---------------------------------------------------------------------------

void test("ActionCardGrid grid handles orphan card in 3-column layout (xl)", () => {
  // When the last child is at position 3n+1 (alone in last row of 3-col grid),
  // it should span the full grid width
  assert.ok(
    src.includes("last-child:nth-child(3n+1)") && src.includes("col-span-full"),
    "Expected a CSS rule targeting :last-child:nth-child(3n+1) with col-span-full for 3-column orphan handling",
  );
});

void test("ActionCardGrid grid handles orphan card in 2-column layout (sm)", () => {
  // When the last child is at position 2n+1 (alone in last row of 2-col grid),
  // it should span the full grid width
  assert.ok(
    src.includes("last-child:nth-child(2n+1)") && src.includes("col-span-full"),
    "Expected a CSS rule targeting :last-child:nth-child(2n+1) with col-span-full for 2-column orphan handling",
  );
});

void test("ActionCardGrid grid still uses the standard responsive column classes", () => {
  assert.ok(
    src.includes("sm:grid-cols-2"),
    "Expected sm:grid-cols-2 for responsive 2-column layout",
  );
  assert.ok(
    src.includes("xl:grid-cols-3"),
    "Expected xl:grid-cols-3 for responsive 3-column layout",
  );
});
