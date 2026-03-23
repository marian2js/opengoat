import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "OperatingMemorySection.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// OperatingMemorySection structure tests
// ---------------------------------------------------------------------------

void test("OperatingMemorySection: exports a named function", () => {
  assert.ok(
    src.includes("export function OperatingMemorySection"),
    "Expected named export 'OperatingMemorySection'",
  );
});

void test("OperatingMemorySection: accepts agentId and client props", () => {
  assert.ok(src.includes("agentId"), "Expected 'agentId' prop");
  assert.ok(src.includes("client"), "Expected 'client' prop");
});

void test("OperatingMemorySection: uses useProjectMemories hook", () => {
  assert.ok(
    src.includes("useProjectMemories"),
    "Expected useProjectMemories hook usage",
  );
});

void test("OperatingMemorySection: manages editingId state", () => {
  assert.ok(
    src.includes("editingId"),
    "Expected editingId state for tracking which entry is being edited",
  );
});

void test("OperatingMemorySection: manages creatingCategory state", () => {
  assert.ok(
    src.includes("creatingCategory"),
    "Expected creatingCategory state for tracking which category has create form open",
  );
});

void test("OperatingMemorySection: manages deletingId state", () => {
  assert.ok(
    src.includes("deletingId"),
    "Expected deletingId state for delete confirmation",
  );
});

void test("OperatingMemorySection: manages conflictState", () => {
  assert.ok(
    src.includes("conflictState"),
    "Expected conflictState for conflict dialog",
  );
});

void test("OperatingMemorySection: renders loading skeleton state", () => {
  assert.ok(
    src.includes("isLoading") && (src.includes("Skeleton") || src.includes("skeleton") || src.includes("animate-pulse")),
    "Expected loading skeleton state",
  );
});

void test("OperatingMemorySection: renders empty state with guidance", () => {
  assert.ok(
    src.includes("isEmpty") || src.includes("empty"),
    "Expected empty state rendering",
  );
  assert.ok(
    src.includes("DatabaseIcon") || src.includes("Database") || src.includes("memory is empty") || src.includes("no memory"),
    "Expected empty state with guidance icon/text",
  );
});

void test("OperatingMemorySection: renders MemoryCategoryGroup components", () => {
  assert.ok(
    src.includes("MemoryCategoryGroup"),
    "Expected MemoryCategoryGroup component for category rendering",
  );
});

void test("OperatingMemorySection: renders MemoryConflictDialog", () => {
  assert.ok(
    src.includes("MemoryConflictDialog"),
    "Expected MemoryConflictDialog for conflict resolution",
  );
});

void test("OperatingMemorySection: has CRUD handlers", () => {
  assert.ok(
    src.includes("createMemory") || src.includes("handleCreate"),
    "Expected create handler",
  );
  assert.ok(
    src.includes("updateMemory") || src.includes("handleUpdate"),
    "Expected update handler",
  );
  assert.ok(
    src.includes("deleteMemory") || src.includes("handleDelete"),
    "Expected delete handler",
  );
});

void test("OperatingMemorySection: uses SidecarClient for API calls", () => {
  assert.ok(
    src.includes("SidecarClient") && src.includes("@/lib/sidecar/client"),
    "Expected SidecarClient import for API calls",
  );
});

void test("OperatingMemorySection: handles delete confirmation dialog", () => {
  assert.ok(
    src.includes("deletingId") && src.includes("Dialog"),
    "Expected delete confirmation dialog with deletingId state",
  );
});
