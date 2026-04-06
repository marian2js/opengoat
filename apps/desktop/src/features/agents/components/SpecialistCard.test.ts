import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "SpecialistCard.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC: Each specialist card shows name, role, reasonToExist
// ---------------------------------------------------------------------------

void test("SpecialistCard renders specialist name", () => {
  assert.ok(
    src.includes("specialist.name"),
    "Card must render the specialist's name",
  );
});

void test("SpecialistCard renders specialist role", () => {
  assert.ok(
    src.includes("specialist.role"),
    "Card must render the specialist's role",
  );
});

void test("SpecialistCard renders reasonToExist", () => {
  assert.ok(
    src.includes("specialist.reasonToExist"),
    "Card must render the specialist's reason to exist",
  );
});

// ---------------------------------------------------------------------------
// AC: Each card shows example deliverables (outputTypes)
// ---------------------------------------------------------------------------

void test("SpecialistCard renders outputTypes as deliverable chips", () => {
  assert.ok(
    src.includes("specialist.outputTypes"),
    "Card must render outputTypes as deliverable items",
  );
});

// ---------------------------------------------------------------------------
// AC: Each card has a prominent 'Chat with [Agent Name]' CTA
// ---------------------------------------------------------------------------

void test("SpecialistCard has Chat CTA button", () => {
  assert.ok(
    src.includes("Chat with"),
    "Card must have a 'Chat with [Agent Name]' CTA",
  );
});

void test("SpecialistCard CTA calls onChat with specialist id", () => {
  assert.ok(
    src.includes("onChat"),
    "Card must call onChat callback",
  );
  assert.ok(
    src.includes("specialist.id"),
    "Card must pass specialist.id to onChat",
  );
});

// ---------------------------------------------------------------------------
// AC: CMO card gets visual distinction as manager
// ---------------------------------------------------------------------------

void test("SpecialistCard distinguishes manager category visually", () => {
  assert.ok(
    src.includes("specialist.category") || src.includes('"manager"'),
    "Card must check specialist category for manager distinction",
  );
});

// ---------------------------------------------------------------------------
// AC: Cards follow DESIGN.md emerald accent, General Sans headings
// ---------------------------------------------------------------------------

void test("SpecialistCard uses emerald accent on CTA", () => {
  assert.ok(
    src.includes("bg-primary") || src.includes("text-primary"),
    "CTA must use primary (emerald) accent color",
  );
});

void test("SpecialistCard uses font-display for heading", () => {
  assert.ok(
    src.includes("font-display"),
    "Specialist name heading must use font-display (General Sans)",
  );
});

// ---------------------------------------------------------------------------
// AC: Uses specialist icon
// ---------------------------------------------------------------------------

void test("SpecialistCard uses resolveSpecialistIcon", () => {
  assert.ok(
    src.includes("resolveSpecialistIcon"),
    "Card must use resolveSpecialistIcon to render the specialist's icon",
  );
});

// ---------------------------------------------------------------------------
// AC: Non-manager specialist icons use emerald accent color for visual differentiation
// ---------------------------------------------------------------------------

void test("SpecialistCard: all specialist icons use emerald primary color", () => {
  // All specialist icons (not just manager) must render in the emerald primary color
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

void test("SpecialistCard: icon container uses emerald tint for all specialists", () => {
  // Icon container should have emerald tint background regardless of category
  assert.ok(
    src.includes("bg-primary/"),
    "Expected icon container to use bg-primary/* emerald tint for all specialists",
  );
});

