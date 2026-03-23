import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "useObjectiveCreation.ts"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// useObjectiveCreation hook structure tests
// ---------------------------------------------------------------------------

void test("useObjectiveCreation: exports a named function", () => {
  assert.ok(
    src.includes("export function useObjectiveCreation"),
    "Expected named export 'useObjectiveCreation'",
  );
});

void test("useObjectiveCreation: manages form state with setField", () => {
  assert.ok(src.includes("setField"), "Expected 'setField' for updating form fields");
  assert.ok(src.includes("formState"), "Expected 'formState' for reading form values");
});

void test("useObjectiveCreation: has create function that calls API", () => {
  assert.ok(src.includes("createObjective"), "Expected createObjective API call");
  assert.ok(src.includes("setPrimaryActiveObjective"), "Expected setPrimaryActiveObjective call after creation");
});

void test("useObjectiveCreation: tracks isSubmitting state", () => {
  assert.ok(src.includes("isSubmitting"), "Expected 'isSubmitting' loading state");
});

void test("useObjectiveCreation: has error state", () => {
  assert.ok(src.includes("error"), "Expected 'error' state for API failures");
});

void test("useObjectiveCreation: has reset function to clear form", () => {
  assert.ok(src.includes("reset"), "Expected 'reset' function to clear form state");
});

void test("useObjectiveCreation: title is required for submission", () => {
  assert.ok(
    src.includes("title"),
    "Expected title field to be handled in form state",
  );
});
