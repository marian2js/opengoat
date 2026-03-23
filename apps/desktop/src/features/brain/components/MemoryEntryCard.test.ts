import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "MemoryEntryCard.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// MemoryEntryCard structure tests
// ---------------------------------------------------------------------------

void test("MemoryEntryCard: exports a named function", () => {
  assert.ok(
    src.includes("export function MemoryEntryCard"),
    "Expected named export 'MemoryEntryCard'",
  );
});

void test("MemoryEntryCard: accepts entry, onEdit, onDelete props", () => {
  assert.ok(src.includes("entry"), "Expected 'entry' prop");
  assert.ok(src.includes("onEdit"), "Expected 'onEdit' callback prop");
  assert.ok(src.includes("onDelete"), "Expected 'onDelete' callback prop");
});

void test("MemoryEntryCard: renders content from entry", () => {
  assert.ok(
    src.includes("entry.content"),
    "Expected to display entry.content",
  );
});

void test("MemoryEntryCard: renders source badge", () => {
  assert.ok(
    src.includes("entry.source"),
    "Expected to display entry.source as a badge",
  );
});

void test("MemoryEntryCard: renders confidence indicator", () => {
  assert.ok(
    src.includes("confidence") || src.includes("entry.confidence"),
    "Expected confidence indicator display",
  );
});

void test("MemoryEntryCard: shows confirmed/unconfirmed status", () => {
  assert.ok(
    src.includes("userConfirmed") || src.includes("CONFIRMED") || src.includes("UNCONFIRMED"),
    "Expected confirmed/unconfirmed status display",
  );
});

void test("MemoryEntryCard: shows superseded state when replacedBy is set", () => {
  assert.ok(
    src.includes("replacedBy"),
    "Expected replacedBy check for superseded state",
  );
});

void test("MemoryEntryCard: has edit and delete action buttons", () => {
  assert.ok(
    src.includes("PencilIcon") || src.includes("Pencil"),
    "Expected edit icon for edit action",
  );
  assert.ok(
    src.includes("TrashIcon") || src.includes("Trash"),
    "Expected trash icon for delete action",
  );
});

void test("MemoryEntryCard: imports MemoryRecord type from contracts", () => {
  assert.ok(
    src.includes("MemoryRecord") && src.includes("@opengoat/contracts"),
    "Expected MemoryRecord type import",
  );
});
