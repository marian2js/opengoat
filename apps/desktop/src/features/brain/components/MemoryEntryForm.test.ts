import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "MemoryEntryForm.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// MemoryEntryForm structure tests
// ---------------------------------------------------------------------------

void test("MemoryEntryForm: exports a named function", () => {
  assert.ok(
    src.includes("export function MemoryEntryForm"),
    "Expected named export 'MemoryEntryForm'",
  );
});

void test("MemoryEntryForm: accepts mode prop for create/edit", () => {
  assert.ok(
    src.includes("mode") && (src.includes("'create'") || src.includes('"create"')),
    "Expected 'mode' prop with create/edit options",
  );
});

void test("MemoryEntryForm: has content textarea field", () => {
  assert.ok(
    src.includes("textarea") || src.includes("Textarea") || src.includes("<textarea"),
    "Expected textarea for content input",
  );
});

void test("MemoryEntryForm: has source input field", () => {
  assert.ok(
    src.includes("source"),
    "Expected source input field",
  );
});

void test("MemoryEntryForm: has confidence selector", () => {
  assert.ok(
    src.includes("confidence"),
    "Expected confidence selector",
  );
});

void test("MemoryEntryForm: has Save and Cancel buttons", () => {
  assert.ok(
    src.includes("Save") || src.includes("save"),
    "Expected Save button",
  );
  assert.ok(
    src.includes("Cancel") || src.includes("onCancel"),
    "Expected Cancel button or onCancel callback",
  );
});

void test("MemoryEntryForm: accepts onSubmit and onCancel callbacks", () => {
  assert.ok(src.includes("onSubmit"), "Expected onSubmit callback");
  assert.ok(src.includes("onCancel"), "Expected onCancel callback");
});

void test("MemoryEntryForm: has isSubmitting prop for loading state", () => {
  assert.ok(
    src.includes("isSubmitting"),
    "Expected isSubmitting prop for loading state",
  );
});
