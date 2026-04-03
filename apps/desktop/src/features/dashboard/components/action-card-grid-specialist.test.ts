import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ActionCardGrid.tsx"),
  "utf-8",
);

void test("ActionCardGrid: accepts specialists prop", () => {
  assert.ok(
    src.includes("specialists"),
    "Expected ActionCardGrid to accept specialists prop",
  );
});

void test("ActionCardGrid: passes specialistName to ActionCardItem", () => {
  assert.ok(
    src.includes("specialistName"),
    "Expected ActionCardGrid to pass specialistName to ActionCardItem",
  );
});

void test("ActionCardGrid: imports getSpecialistName from useSpecialistRoster", () => {
  assert.ok(
    src.includes("getSpecialistName"),
    "Expected getSpecialistName import for specialist name resolution",
  );
});
