import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "useRuns.ts"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// useRuns hook structure tests
// ---------------------------------------------------------------------------

void test("useRuns: exports a named function", () => {
  assert.ok(
    src.includes("export function useRuns"),
    "Expected named export 'useRuns'",
  );
});

void test("useRuns: calls listRuns with active statuses filter", () => {
  assert.ok(
    src.includes("listRuns"),
    "Expected hook to call client.listRuns",
  );
  assert.ok(
    src.includes("running") && src.includes("waiting_review") && src.includes("blocked") && src.includes("draft"),
    "Expected hook to filter by active statuses: running, waiting_review, blocked, draft",
  );
});

void test("useRuns: returns runs, isLoading, and isEmpty", () => {
  assert.ok(src.includes("runs"), "Expected 'runs' in return");
  assert.ok(src.includes("isLoading"), "Expected 'isLoading' in return");
  assert.ok(src.includes("isEmpty"), "Expected 'isEmpty' in return");
});

void test("useRuns: uses useState and useEffect hooks", () => {
  assert.ok(src.includes("useState"), "Expected useState usage");
  assert.ok(src.includes("useEffect"), "Expected useEffect usage");
});

void test("useRuns: has cancellation pattern in useEffect", () => {
  assert.ok(
    src.includes("cancelled"),
    "Expected cancellation flag pattern for cleanup",
  );
});

void test("useRuns: handles errors gracefully with catch", () => {
  assert.ok(
    src.includes("catch"),
    "Expected error handling with catch for API failures",
  );
});

void test("useRuns: imports RunRecord from contracts", () => {
  assert.ok(
    src.includes("RunRecord") && src.includes("@opengoat/contracts"),
    "Expected RunRecord type import from contracts",
  );
});

void test("useRuns: depends on agentId and client", () => {
  assert.ok(
    src.includes("agentId") && src.includes("client"),
    "Expected agentId and client as hook parameters/deps",
  );
});
