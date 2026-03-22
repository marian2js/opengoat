import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "BrainWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Paragraphs have increased vertical spacing (16px minimum = mb-4)
// ---------------------------------------------------------------------------

void test("paragraphs have mb-4 (16px) spacing for readable gaps between paragraphs", () => {
  assert.ok(
    src.includes("[&_p]:mb-4"),
    "Expected paragraphs to have mb-4 (16px) spacing, not mb-3 (12px)",
  );
});

// ---------------------------------------------------------------------------
// AC2: H3/H4 subsections have clear top margin creating visual breaks
// ---------------------------------------------------------------------------

void test("h3 sub-headings have mt-6 for clear visual break from preceding content", () => {
  assert.ok(
    src.includes("[&_h3]:mt-6"),
    "Expected h3 sub-headings to have mt-6 (24px) top margin for clear breaks between subsections",
  );
});

void test("h4 sub-headings have styling with mt-6 for visual breaks", () => {
  assert.ok(
    src.includes("[&_h4]:mt-6") || src.includes("[&_h4]:mt-5"),
    "Expected h4 sub-headings to have mt-5 or mt-6 top margin for subsection breaks",
  );
});

// ---------------------------------------------------------------------------
// AC3: Line length is constrained to ~65 characters for comfortable reading
// ---------------------------------------------------------------------------

void test("prose content is constrained to max-w-prose (~65ch) for reading comfort", () => {
  assert.ok(
    src.includes("max-w-prose"),
    "Expected max-w-prose (65ch) for comfortable reading line length",
  );
});

// ---------------------------------------------------------------------------
// AC4: Lists have proper indent and spacing for scanability
// ---------------------------------------------------------------------------

void test("unordered lists have left padding for visual indent", () => {
  assert.ok(
    src.includes("[&_ul]:pl-4") || src.includes("[&_ul]:pl-5"),
    "Expected ul elements to have pl-4 or pl-5 for list indentation",
  );
});

// ---------------------------------------------------------------------------
// AC5: H2 sections have bottom border separators
// ---------------------------------------------------------------------------

void test("h2 headings have bottom padding for section spacing", () => {
  assert.ok(
    src.includes("[&_h2]:border-t") || src.includes("[&_h2]:border-b"),
    "Expected h2 sections to have border separators for visual section breaks",
  );
});

// ---------------------------------------------------------------------------
// AC6: Dark/light mode support maintained
// ---------------------------------------------------------------------------

void test("dark mode prose styling is preserved", () => {
  assert.ok(
    src.includes("dark:prose-invert"),
    "Expected dark:prose-invert to be preserved for dark mode support",
  );
});
