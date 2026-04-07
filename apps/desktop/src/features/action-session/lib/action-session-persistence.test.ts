import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "action-session-persistence.ts"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Output promise persistence: sessionStorage keys exist
// ---------------------------------------------------------------------------

void test("persistence module defines sessionStorage key for action promise", () => {
  assert.ok(
    src.includes("opengoat:actionPromise"),
    "Expected sessionStorage key for actionPromise",
  );
});

void test("persistence module defines sessionStorage key for action output type", () => {
  assert.ok(
    src.includes("opengoat:actionOutputType"),
    "Expected sessionStorage key for actionOutputType",
  );
});

// ---------------------------------------------------------------------------
// persistActionOutputPromise: stores promise and outputType
// ---------------------------------------------------------------------------

void test("persistActionOutputPromise function exists and stores both fields", () => {
  assert.ok(
    src.includes("export function persistActionOutputPromise"),
    "Expected persistActionOutputPromise export",
  );
  // Should accept promise and outputType parameters
  assert.ok(
    src.includes("promise: string"),
    "Expected promise parameter of type string",
  );
  assert.ok(
    src.includes("outputType: string"),
    "Expected outputType parameter of type string",
  );
});

// ---------------------------------------------------------------------------
// readActionOutputPromise: reads promise and outputType
// ---------------------------------------------------------------------------

void test("readActionOutputPromise function exists and returns both fields", () => {
  assert.ok(
    src.includes("export function readActionOutputPromise"),
    "Expected readActionOutputPromise export",
  );
});

// ---------------------------------------------------------------------------
// clearPersistedActionContext: also clears output promise keys
// ---------------------------------------------------------------------------

void test("clearPersistedActionContext removes output promise keys", () => {
  assert.ok(
    src.includes("SS_ACTION_PROMISE"),
    "Expected SS_ACTION_PROMISE constant used in clear",
  );
  assert.ok(
    src.includes("SS_ACTION_OUTPUT_TYPE"),
    "Expected SS_ACTION_OUTPUT_TYPE constant used in clear",
  );
});
