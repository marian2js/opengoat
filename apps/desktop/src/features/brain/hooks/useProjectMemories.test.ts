import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "useProjectMemories.ts"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// useProjectMemories hook structure tests
// ---------------------------------------------------------------------------

void test("useProjectMemories: exports a named function", () => {
  assert.ok(
    src.includes("export function useProjectMemories"),
    "Expected named export 'useProjectMemories'",
  );
});

void test("useProjectMemories: calls listMemories on client", () => {
  assert.ok(
    src.includes("listMemories"),
    "Expected hook to call client.listMemories",
  );
});

void test("useProjectMemories: filters by project scope", () => {
  assert.ok(
    src.includes("scope: \"project\"") || src.includes("scope: 'project'"),
    "Expected hook to filter by scope: 'project'",
  );
});

void test("useProjectMemories: returns groupedEntries, isLoading, isEmpty, refresh", () => {
  assert.ok(src.includes("groupedEntries"), "Expected 'groupedEntries' in return");
  assert.ok(src.includes("isLoading"), "Expected 'isLoading' in return");
  assert.ok(src.includes("isEmpty"), "Expected 'isEmpty' in return");
  assert.ok(src.includes("refresh"), "Expected 'refresh' in return");
});

void test("useProjectMemories: uses useState and useEffect hooks", () => {
  assert.ok(src.includes("useState"), "Expected useState usage");
  assert.ok(src.includes("useEffect"), "Expected useEffect usage");
});

void test("useProjectMemories: has cancellation pattern in useEffect", () => {
  assert.ok(
    src.includes("cancelled"),
    "Expected cancellation flag pattern for cleanup",
  );
});

void test("useProjectMemories: handles errors gracefully with catch", () => {
  assert.ok(
    src.includes("catch"),
    "Expected error handling with catch for API failures",
  );
});

void test("useProjectMemories: imports MemoryRecord from contracts", () => {
  assert.ok(
    src.includes("MemoryRecord") && src.includes("@opengoat/contracts"),
    "Expected MemoryRecord type import from contracts",
  );
});

void test("useProjectMemories: defines CATEGORY_DISPLAY_NAMES mapping", () => {
  assert.ok(
    src.includes("CATEGORY_DISPLAY_NAMES"),
    "Expected CATEGORY_DISPLAY_NAMES mapping for human-readable labels",
  );
});

void test("useProjectMemories: defines CATEGORY_ORDER for consistent display", () => {
  assert.ok(
    src.includes("CATEGORY_ORDER"),
    "Expected CATEGORY_ORDER array for consistent ordering",
  );
});

void test("useProjectMemories: groups entries by category", () => {
  assert.ok(
    src.includes("groupedEntries"),
    "Expected entries to be grouped by category",
  );
});

void test("useProjectMemories: includes all 11 project memory categories", () => {
  const categories = [
    "brand_voice",
    "product_facts",
    "icp_facts",
    "competitors",
    "channels_tried",
    "channels_to_avoid",
    "founder_preferences",
    "approval_preferences",
    "messaging_constraints",
    "legal_compliance",
    "team_process",
  ];
  for (const cat of categories) {
    assert.ok(
      src.includes(cat),
      `Expected category '${cat}' in CATEGORY_ORDER or CATEGORY_DISPLAY_NAMES`,
    );
  }
});
