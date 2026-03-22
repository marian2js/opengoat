import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "BrainWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: h2 headings are visually larger than body text
// ---------------------------------------------------------------------------

void test("h2 headings use text-lg (18px) for strong visual hierarchy", () => {
  assert.ok(
    src.includes("[&_h2]:text-lg"),
    "Expected h2 headings to use text-lg (18px), not text-base (16px), for clear size distinction from body text",
  );
});

void test("h2 headings do NOT use text-base (too close to body text)", () => {
  assert.ok(
    !src.includes("[&_h2]:text-base"),
    "h2 headings should not use text-base (16px) — only 2px larger than body text-sm (14px), creating weak hierarchy",
  );
});

// ---------------------------------------------------------------------------
// AC2: h3 sub-headings are clearly smaller than h2
// ---------------------------------------------------------------------------

void test("h3 sub-headings remain at text-sm, smaller than h2 text-lg", () => {
  assert.ok(
    src.includes("[&_h3]:text-sm"),
    "Expected h3 sub-headings to stay at text-sm (14px) to differentiate from h2 (18px)",
  );
});

// ---------------------------------------------------------------------------
// AC3: Body text remains at its current size
// ---------------------------------------------------------------------------

void test("body text (paragraphs) remains at text-sm", () => {
  assert.ok(
    src.includes("[&_p]:text-sm"),
    "Expected paragraph body text to remain at text-sm (14px)",
  );
});

// ---------------------------------------------------------------------------
// AC4: Both light and dark mode display correctly
// ---------------------------------------------------------------------------

void test("prose-invert styling is present for dark mode support", () => {
  assert.ok(
    src.includes("prose-invert"),
    "Expected prose-invert for dark mode support in KNOWLEDGE_PROSE_CLASSES",
  );
});
