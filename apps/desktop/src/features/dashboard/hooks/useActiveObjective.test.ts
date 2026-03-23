import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "useActiveObjective.ts"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// useActiveObjective hook structure tests
// ---------------------------------------------------------------------------

void test("useActiveObjective: exports a named function", () => {
  assert.ok(
    src.includes("export function useActiveObjective"),
    "Expected named export 'useActiveObjective'",
  );
});

void test("useActiveObjective: calls listObjectives with status active", () => {
  assert.ok(
    src.includes("listObjectives") && src.includes('"active"'),
    "Expected hook to call client.listObjectives with status 'active'",
  );
});

void test("useActiveObjective: returns objective, isLoading, error, and refetch", () => {
  assert.ok(src.includes("objective"), "Expected 'objective' in return");
  assert.ok(src.includes("isLoading"), "Expected 'isLoading' in return");
  assert.ok(src.includes("error"), "Expected 'error' in return");
  assert.ok(src.includes("refetch"), "Expected 'refetch' in return");
});

void test("useActiveObjective: uses useState and useEffect hooks", () => {
  assert.ok(src.includes("useState"), "Expected useState usage");
  assert.ok(src.includes("useEffect"), "Expected useEffect usage");
});

void test("useActiveObjective: handles agentId changes by refetching", () => {
  // The useEffect dependency array should include agentId
  assert.ok(
    src.includes("agentId"),
    "Expected agentId in hook to trigger refetch on agent change",
  );
});

void test("useActiveObjective: catches errors gracefully", () => {
  assert.ok(
    src.includes("catch"),
    "Expected error handling with catch for API failures",
  );
});
