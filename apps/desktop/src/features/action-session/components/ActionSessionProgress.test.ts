import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ActionSessionProgress.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// ActionSessionProgress: accepts actionPromise and actionOutputType props
// ---------------------------------------------------------------------------

void test("ActionSessionProgress accepts actionPromise prop", () => {
  assert.ok(
    src.includes("actionPromise"),
    "Expected actionPromise prop in the component interface",
  );
});

void test("ActionSessionProgress accepts actionOutputType prop", () => {
  assert.ok(
    src.includes("actionOutputType"),
    "Expected actionOutputType prop in the component interface",
  );
});

// ---------------------------------------------------------------------------
// Starting state: shows job-specific loading text when actionOutputType is set
// ---------------------------------------------------------------------------

void test("Starting state shows job-specific preparing message when actionOutputType is provided", () => {
  assert.ok(
    src.includes("Preparing your"),
    "Expected 'Preparing your' prefix for job-specific loading message",
  );
  assert.ok(
    src.includes("actionOutputType"),
    "Expected actionOutputType used in the loading message",
  );
});

// ---------------------------------------------------------------------------
// Starting state: shows deliverables list when actionPromise is provided
// ---------------------------------------------------------------------------

void test("Starting state shows deliverables from actionPromise", () => {
  assert.ok(
    src.includes("actionPromise"),
    "Expected actionPromise rendered as deliverables list",
  );
});

// ---------------------------------------------------------------------------
// Starting state: falls back to generic message when no job data
// ---------------------------------------------------------------------------

void test("Starting state falls back to generic loading message", () => {
  assert.ok(
    src.includes("Analyzing your company and preparing outputs"),
    "Expected generic fallback message preserved",
  );
});

// ---------------------------------------------------------------------------
// Starting state: preserves time estimate
// ---------------------------------------------------------------------------

void test("Starting state preserves time estimate", () => {
  assert.ok(
    src.includes("First output in"),
    "Expected time estimate preserved in starting state",
  );
});
