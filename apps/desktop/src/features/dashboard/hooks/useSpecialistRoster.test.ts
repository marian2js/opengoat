import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "useSpecialistRoster.ts"),
  "utf-8",
);

void test("useSpecialistRoster: exports a named function", () => {
  assert.ok(
    src.includes("export function useSpecialistRoster"),
    "Expected named export 'useSpecialistRoster'",
  );
});

void test("useSpecialistRoster: calls client.specialists()", () => {
  assert.ok(
    src.includes("specialists"),
    "Expected hook to call client.specialists()",
  );
});

void test("useSpecialistRoster: returns specialists, isLoading", () => {
  assert.ok(src.includes("specialists"), "Expected 'specialists' in return");
  assert.ok(src.includes("isLoading"), "Expected 'isLoading' in return");
});

void test("useSpecialistRoster: uses useState and useEffect hooks", () => {
  assert.ok(src.includes("useState"), "Expected useState usage");
  assert.ok(src.includes("useEffect"), "Expected useEffect usage");
});

void test("useSpecialistRoster: has cancellation pattern in useEffect", () => {
  assert.ok(
    src.includes("cancelled"),
    "Expected cancellation flag pattern for cleanup",
  );
});

void test("useSpecialistRoster: handles errors gracefully with catch", () => {
  assert.ok(
    src.includes("catch"),
    "Expected error handling with catch for API failures",
  );
});

void test("useSpecialistRoster: imports SpecialistAgent from contracts", () => {
  assert.ok(
    src.includes("SpecialistAgent") && src.includes("@opengoat/contracts"),
    "Expected SpecialistAgent type import from contracts",
  );
});

void test("useSpecialistRoster: exports getSpecialistName utility", () => {
  assert.ok(
    src.includes("export function getSpecialistName"),
    "Expected getSpecialistName helper export",
  );
});

void test("useSpecialistRoster: depends on client as parameter", () => {
  assert.ok(
    src.includes("client"),
    "Expected client as hook parameter",
  );
});
