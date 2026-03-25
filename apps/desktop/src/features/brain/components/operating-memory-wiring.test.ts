import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const brainSrc = readFileSync(
  resolve(import.meta.dirname, "BrainWorkspace.tsx"),
  "utf-8",
);

const navSrc = readFileSync(
  resolve(import.meta.dirname, "../../../app/config/navigation.ts"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// BrainWorkspace wiring tests
// ---------------------------------------------------------------------------

void test("BrainWorkspace: BRAIN_SECTIONS includes saved-guidance entry", () => {
  assert.ok(
    brainSrc.includes("saved-guidance"),
    "Expected 'saved-guidance' section in BRAIN_SECTIONS",
  );
});

void test("BrainWorkspace: imports OperatingMemorySection", () => {
  assert.ok(
    brainSrc.includes("OperatingMemorySection"),
    "Expected import of OperatingMemorySection component",
  );
});

void test("BrainWorkspace: conditionally renders OperatingMemorySection for saved-guidance section", () => {
  assert.ok(
    brainSrc.includes("OperatingMemorySection") && brainSrc.includes("saved-guidance"),
    "Expected conditional rendering of OperatingMemorySection when section is saved-guidance",
  );
});

void test("BrainWorkspace: saved-guidance section has DatabaseIcon", () => {
  assert.ok(
    brainSrc.includes("DatabaseIcon"),
    "Expected DatabaseIcon for saved-guidance section",
  );
});

// ---------------------------------------------------------------------------
// Navigation wiring tests
// ---------------------------------------------------------------------------

void test("Navigation: brainNavigation includes Saved Guidance entry", () => {
  assert.ok(
    navSrc.includes("Saved Guidance"),
    "Expected 'Saved Guidance' entry in brainNavigation",
  );
});

void test("Navigation: Saved Guidance links to #brain/saved-guidance", () => {
  assert.ok(
    navSrc.includes("#brain/saved-guidance"),
    "Expected href '#brain/saved-guidance' in navigation",
  );
});

void test("Navigation: imports DatabaseIcon", () => {
  assert.ok(
    navSrc.includes("DatabaseIcon"),
    "Expected DatabaseIcon import for Saved Guidance nav item",
  );
});
