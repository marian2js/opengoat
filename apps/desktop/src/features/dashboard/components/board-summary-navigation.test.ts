import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "BoardSummary.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Board Summary is now a compact count-only strip with a simple anchor link.
// No useRef/addEventListener needed — just a plain <a href="#board">.
// ---------------------------------------------------------------------------

void test("BoardSummary View link renders as an anchor with href=#board", () => {
  assert.ok(
    src.includes('href="#board"') || src.includes("href=\"#board\""),
    "Expected <a href='#board'> for native browser hash navigation",
  );
});

void test("BoardSummary shows total count", () => {
  assert.ok(
    src.includes("total"),
    "Expected total count display",
  );
});

void test("BoardSummary self-hides when empty", () => {
  assert.ok(
    src.includes("isEmpty") && src.includes("return null"),
    "Expected to return null when isEmpty is true",
  );
});
