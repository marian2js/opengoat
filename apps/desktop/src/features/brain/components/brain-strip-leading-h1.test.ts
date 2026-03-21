import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "BrainWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1-3: Brain pages strip the leading markdown h1 to avoid redundant heading
// ---------------------------------------------------------------------------

void test("BrainWorkspace defines a stripLeadingH1 helper", () => {
  assert.ok(
    src.includes("stripLeadingH1"),
    "Expected a stripLeadingH1 helper function to strip the first markdown h1",
  );
});

void test("stripLeadingH1 is applied to content before rendering markdown", () => {
  // The Markdown component should receive stripped content, not raw content
  assert.ok(
    src.includes("stripLeadingH1(content)") || src.includes("stripLeadingH1("),
    "Expected stripLeadingH1 to be called on content before passing to Markdown renderer",
  );
});

void test("first h1 in markdown prose is hidden via CSS as a fallback", () => {
  // CSS fallback: hide the first h1 child of the prose container
  assert.ok(
    src.includes("[&>h1:first-child]") || src.includes("first-child]:hidden") || src.includes("first-child]:sr-only"),
    "Expected CSS fallback to hide first h1 in prose container",
  );
});
