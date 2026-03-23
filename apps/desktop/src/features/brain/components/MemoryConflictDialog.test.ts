import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "MemoryConflictDialog.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// MemoryConflictDialog structure tests
// ---------------------------------------------------------------------------

void test("MemoryConflictDialog: exports a named function", () => {
  assert.ok(
    src.includes("export function MemoryConflictDialog"),
    "Expected named export 'MemoryConflictDialog'",
  );
});

void test("MemoryConflictDialog: uses Dialog component from ui", () => {
  assert.ok(
    src.includes("Dialog") && src.includes("@/components/ui/dialog"),
    "Expected Dialog component from UI library",
  );
});

void test("MemoryConflictDialog: shows existing entry content", () => {
  assert.ok(
    src.includes("existingEntry"),
    "Expected to display existing entry for comparison",
  );
});

void test("MemoryConflictDialog: shows new entry content", () => {
  assert.ok(
    src.includes("newContent"),
    "Expected to display new content for comparison",
  );
});

void test("MemoryConflictDialog: has Keep existing action", () => {
  assert.ok(
    src.includes("onKeepExisting") || src.includes("Keep existing"),
    "Expected 'Keep existing' action",
  );
});

void test("MemoryConflictDialog: has Replace with new action", () => {
  assert.ok(
    src.includes("onReplace") || src.includes("Replace"),
    "Expected 'Replace with new' action",
  );
});

void test("MemoryConflictDialog: has Keep both action", () => {
  assert.ok(
    src.includes("onKeepBoth") || src.includes("Keep both"),
    "Expected 'Keep both' action",
  );
});

void test("MemoryConflictDialog: accepts open and onOpenChange props", () => {
  assert.ok(src.includes("open"), "Expected 'open' prop");
  assert.ok(src.includes("onOpenChange"), "Expected 'onOpenChange' prop");
});

void test("MemoryConflictDialog: has isResolving loading state", () => {
  assert.ok(
    src.includes("isResolving"),
    "Expected 'isResolving' prop for loading state",
  );
});

void test("MemoryConflictDialog: shows conflict warning header", () => {
  assert.ok(
    src.includes("conflict") || src.includes("Conflict"),
    "Expected conflict warning messaging",
  );
});
