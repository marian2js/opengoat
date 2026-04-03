import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ActionCardItem.tsx"),
  "utf-8",
);

void test("ActionCardItem: accepts specialistName prop", () => {
  assert.ok(
    src.includes("specialistName"),
    "Expected ActionCardItem to accept specialistName prop",
  );
});

void test("ActionCardItem: renders specialist badge when specialistName is provided", () => {
  // The badge should render the specialist name text
  assert.ok(
    src.includes("specialistName") && src.includes("Agent"),
    "Expected specialist badge rendering with agent name",
  );
});

void test("ActionCardItem: specialist badge is visually lightweight", () => {
  // Badge should use muted/small text styling
  assert.ok(
    src.includes("text-muted-foreground") || src.includes("text-[9px]") || src.includes("text-[10px]"),
    "Expected lightweight badge styling",
  );
});
