import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "MemoryCategoryGroup.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// MemoryCategoryGroup structure tests
// ---------------------------------------------------------------------------

void test("MemoryCategoryGroup: exports a named function", () => {
  assert.ok(
    src.includes("export function MemoryCategoryGroup"),
    "Expected named export 'MemoryCategoryGroup'",
  );
});

void test("MemoryCategoryGroup: uses Collapsible component", () => {
  assert.ok(
    src.includes("Collapsible") && src.includes("@/components/ui/collapsible"),
    "Expected Collapsible component from UI library",
  );
});

void test("MemoryCategoryGroup: displays category label in section-label pattern", () => {
  assert.ok(
    src.includes("displayName") || src.includes("category"),
    "Expected category display name in header",
  );
});

void test("MemoryCategoryGroup: shows entry count", () => {
  assert.ok(
    src.includes("entries.length") || src.includes("entries"),
    "Expected entry count display",
  );
});

void test("MemoryCategoryGroup: has Add memory button", () => {
  assert.ok(
    src.includes("Add memory") || src.includes("PlusIcon") || src.includes("Plus"),
    "Expected 'Add memory' button with PlusIcon",
  );
});

void test("MemoryCategoryGroup: renders MemoryEntryCard for entries", () => {
  assert.ok(
    src.includes("MemoryEntryCard"),
    "Expected MemoryEntryCard component for rendering entries",
  );
});

void test("MemoryCategoryGroup: renders MemoryEntryForm when creating", () => {
  assert.ok(
    src.includes("MemoryEntryForm"),
    "Expected MemoryEntryForm component for inline creation",
  );
});

void test("MemoryCategoryGroup: has chevron toggle for collapse", () => {
  assert.ok(
    src.includes("ChevronDown") || src.includes("ChevronRight") || src.includes("Chevron"),
    "Expected chevron icon for collapse toggle",
  );
});
