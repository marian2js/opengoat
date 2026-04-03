import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "DashboardSpecialistChip.tsx"),
  "utf-8",
);

void test("DashboardSpecialistChip: exports a named function component", () => {
  assert.ok(
    src.includes("export function DashboardSpecialistChip"),
    "Expected named export 'DashboardSpecialistChip'",
  );
});

void test("DashboardSpecialistChip: accepts specialist and onChat props", () => {
  assert.ok(src.includes("specialist"), "Expected 'specialist' prop");
  assert.ok(src.includes("onChat"), "Expected 'onChat' prop");
});

void test("DashboardSpecialistChip: renders specialist name", () => {
  assert.ok(
    src.includes("specialist.name"),
    "Expected specialist name rendering",
  );
});

void test("DashboardSpecialistChip: renders specialist role", () => {
  assert.ok(
    src.includes("specialist.role"),
    "Expected specialist role rendering",
  );
});

void test("DashboardSpecialistChip: renders outputTypes as example jobs", () => {
  assert.ok(
    src.includes("outputTypes"),
    "Expected outputTypes rendering for example jobs",
  );
});

void test("DashboardSpecialistChip: has a Chat shortcut", () => {
  assert.ok(
    src.includes("Chat"),
    "Expected 'Chat' CTA text",
  );
});

void test("DashboardSpecialistChip: uses resolveSpecialistIcon", () => {
  assert.ok(
    src.includes("resolveSpecialistIcon"),
    "Expected resolveSpecialistIcon usage for specialist icon",
  );
});

void test("DashboardSpecialistChip: distinguishes manager from specialist", () => {
  assert.ok(
    src.includes("manager"),
    "Expected manager category check for CMO visual distinction",
  );
});

void test("DashboardSpecialistChip: imports SpecialistAgent type", () => {
  assert.ok(
    src.includes("SpecialistAgent") && src.includes("@opengoat/contracts"),
    "Expected SpecialistAgent type import",
  );
});

// ---------------------------------------------------------------------------
// AC: Non-manager specialist icons use emerald accent color for visual differentiation
// ---------------------------------------------------------------------------

void test("DashboardSpecialistChip: all specialist icons use emerald primary color", () => {
  // The icon color should always be text-primary (emerald) regardless of manager/specialist
  // This ensures visual differentiation through distinct icon shapes rendered in the accent color
  const iconColorLine = src.includes("text-primary");
  assert.ok(
    iconColorLine,
    "Expected all specialist icons to use text-primary (emerald) accent color",
  );
  // Non-manager icons should NOT fall back to muted foreground
  const hasMutedIconFallback =
    /isManager\s*\?\s*"text-primary"\s*:\s*"text-muted-foreground"/.test(src);
  assert.ok(
    !hasMutedIconFallback,
    "Non-manager icons must not use text-muted-foreground — all icons should be emerald",
  );
});

void test("DashboardSpecialistChip: icon container uses emerald tint background", () => {
  // The icon container background should use a primary/emerald tint for all specialists
  assert.ok(
    src.includes("bg-primary/"),
    "Expected icon container to use bg-primary/* emerald tint for all specialists",
  );
});
