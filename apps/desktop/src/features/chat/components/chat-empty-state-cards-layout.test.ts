import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ChatWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Suggestion card text is at least 14px and readable at a glance
// ---------------------------------------------------------------------------

void test("Suggestion card text uses text-sm (14px) for readability", () => {
  // text-sm is 14px in Tailwind — verify the card text span uses it
  assert.ok(
    src.includes("text-sm") && src.includes("leading-relaxed"),
    "Card text must use text-sm (14px) with leading-relaxed for readability",
  );
});

// ---------------------------------------------------------------------------
// AC2: Cards have sufficient internal padding (at least 16px / p-4)
// ---------------------------------------------------------------------------

void test("Suggestion cards have at least p-4 padding", () => {
  // The card button must use p-4 or px-4 py-4 (or larger) for breathing room
  assert.ok(
    src.includes("p-4") || (src.includes("px-4") && src.includes("py-4")),
    "Suggestion cards must have at least p-4 (16px) padding for breathing room",
  );
});

// ---------------------------------------------------------------------------
// AC3: Text wraps to maximum 2 lines per card — achieved via wider layout
// ---------------------------------------------------------------------------

void test("Suggestion cards use a wider container for reduced text wrapping", () => {
  // Using max-w-2xl or max-w-3xl ensures cards are wide enough for short text
  assert.ok(
    src.includes("max-w-2xl") || src.includes("max-w-3xl"),
    "Empty state must use max-w-2xl or max-w-3xl for wider card container",
  );
});

// ---------------------------------------------------------------------------
// AC4: Empty state is vertically centered in the viewport
// ---------------------------------------------------------------------------

void test("Empty state uses flex-1 and justify-center for vertical centering", () => {
  assert.ok(
    src.includes("flex-1") && src.includes("justify-center"),
    "Empty state container must use flex-1 justify-center for vertical centering",
  );
});

// ---------------------------------------------------------------------------
// AC5: Cards use stacked layout for better readability
// ---------------------------------------------------------------------------

void test("Suggestion card grid uses gap-3 for comfortable spacing between cards", () => {
  assert.ok(
    src.includes("gap-3"),
    "Suggestion card grid must use gap-3 for comfortable spacing between stacked cards",
  );
});
