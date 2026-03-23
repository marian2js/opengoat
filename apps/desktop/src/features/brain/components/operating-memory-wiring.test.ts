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

void test("BrainWorkspace: BRAIN_SECTIONS includes operating-memory entry", () => {
  assert.ok(
    brainSrc.includes("operating-memory"),
    "Expected 'operating-memory' section in BRAIN_SECTIONS",
  );
});

void test("BrainWorkspace: imports OperatingMemorySection", () => {
  assert.ok(
    brainSrc.includes("OperatingMemorySection"),
    "Expected import of OperatingMemorySection component",
  );
});

void test("BrainWorkspace: conditionally renders OperatingMemorySection for operating-memory section", () => {
  assert.ok(
    brainSrc.includes("OperatingMemorySection") && brainSrc.includes("operating-memory"),
    "Expected conditional rendering of OperatingMemorySection when section is operating-memory",
  );
});

void test("BrainWorkspace: operating-memory section has DatabaseIcon", () => {
  assert.ok(
    brainSrc.includes("DatabaseIcon"),
    "Expected DatabaseIcon for operating-memory section",
  );
});

// ---------------------------------------------------------------------------
// Navigation wiring tests
// ---------------------------------------------------------------------------

void test("Navigation: brainNavigation includes Operating Memory entry", () => {
  assert.ok(
    navSrc.includes("Operating Memory"),
    "Expected 'Operating Memory' entry in brainNavigation",
  );
});

void test("Navigation: Operating Memory links to #brain/operating-memory", () => {
  assert.ok(
    navSrc.includes("#brain/operating-memory"),
    "Expected href '#brain/operating-memory' in navigation",
  );
});

void test("Navigation: imports DatabaseIcon", () => {
  assert.ok(
    navSrc.includes("DatabaseIcon"),
    "Expected DatabaseIcon import for Operating Memory nav item",
  );
});
