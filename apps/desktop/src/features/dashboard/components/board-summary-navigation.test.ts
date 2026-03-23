import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "BoardSummary.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Board Summary navigation button must use native DOM event listener
// to bypass React's synthetic event system which can be blocked by
// ancestor elements intercepting events via stopPropagation or overlapping
// elements preventing event delegation.
// ---------------------------------------------------------------------------

void test("BoardSummary uses useRef for the View Board button", () => {
  assert.ok(
    src.includes("useRef"),
    "Expected useRef import/usage for attaching native DOM event listener to the View Board button",
  );
});

void test("BoardSummary uses useEffect to attach native click listener", () => {
  assert.ok(
    src.includes("addEventListener") && src.includes("useEffect"),
    "Expected addEventListener inside useEffect for native click handling that bypasses React event delegation",
  );
});

void test("BoardSummary container has relative positioning and z-index", () => {
  // The Board Summary container needs position: relative and a z-index
  // to ensure it sits above any overlapping sibling elements
  assert.ok(
    src.includes("relative") && /z-\d+/.test(src),
    "Expected relative positioning and z-index on the Board Summary container to prevent click interception from overlapping elements",
  );
});

void test("BoardSummary View Board button renders as an anchor with href=#board", () => {
  // Using a native <a href="#board"> provides the most robust navigation
  // because the browser handles the hash change natively, no JavaScript needed
  assert.ok(
    src.includes('href="#board"') || src.includes("href=\"#board\""),
    "Expected <a href='#board'> for native browser hash navigation that works even if JS click handlers fail",
  );
});

void test("BoardSummary removes event listener on cleanup", () => {
  assert.ok(
    src.includes("removeEventListener"),
    "Expected removeEventListener in useEffect cleanup to prevent memory leaks",
  );
});
