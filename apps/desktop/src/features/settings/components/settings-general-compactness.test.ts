import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ProjectSettings.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Model section is placed above General section for faster access
// ---------------------------------------------------------------------------

void test("Model section appears before General section in the source", () => {
  const modelIndex = src.indexOf("{/* ---- Model ----");
  const generalIndex = src.indexOf("{/* ---- General ----");
  assert.ok(modelIndex !== -1, "Model section comment must exist");
  assert.ok(generalIndex !== -1, "General section comment must exist");
  assert.ok(
    modelIndex < generalIndex,
    "Model section must appear before General section in the component",
  );
});

// ---------------------------------------------------------------------------
// AC2: General section uses a 2-column grid for Name and Website URL fields
// ---------------------------------------------------------------------------

void test("General section uses a 2-column grid layout for compact fields", () => {
  assert.ok(
    src.includes("grid-cols-2"),
    "General section must use grid-cols-2 to place Name and Website URL side by side",
  );
});

void test("General section uses grid layout container", () => {
  assert.ok(
    src.includes("grid") && src.includes("grid-cols-2"),
    "General section must use CSS grid with 2 columns",
  );
});

// ---------------------------------------------------------------------------
// AC3: General section is still well-structured with adequate spacing
// ---------------------------------------------------------------------------

void test("General section still has Card with CardHeader and CardContent", () => {
  // Extract the General section
  const generalStart = src.indexOf("{/* ---- General ----");
  const dangerStart = src.indexOf("{/* ---- Danger zone ----") || src.indexOf("{/* ---- Skills ----");
  const generalSection = src.slice(generalStart, dangerStart);

  assert.ok(
    generalSection.includes("CardHeader") && generalSection.includes("CardContent"),
    "General section must retain CardHeader and CardContent structure",
  );
});

void test("General section retains Name and Website URL labels", () => {
  assert.ok(
    src.includes("settings-name") && src.includes("settings-website-url"),
    "General section must retain both Name and Website URL field IDs",
  );
});

// ---------------------------------------------------------------------------
// AC4: No truncation or overflow — fields have proper sizing
// ---------------------------------------------------------------------------

void test("Fields use gap spacing within the grid", () => {
  assert.ok(
    src.includes("gap-4") || src.includes("gap-3"),
    "Grid must use gap spacing for proper field separation",
  );
});

void test("Save button remains present and properly aligned", () => {
  assert.ok(
    src.includes("Save") && src.includes("hasGeneralChanges"),
    "Save button must still be present and respect change state",
  );
});
