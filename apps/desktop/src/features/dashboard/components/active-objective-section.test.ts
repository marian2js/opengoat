import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ActiveObjectiveSection.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// ActiveObjectiveSection — design system and structure validation
// ---------------------------------------------------------------------------

void test("ActiveObjectiveSection: uses section-label pattern with teal icon", () => {
  assert.ok(
    src.includes("section-label"),
    "Expected section-label CSS class for mono uppercase heading",
  );
  assert.ok(
    src.includes("text-primary"),
    "Expected teal primary color on section icon",
  );
});

void test("ActiveObjectiveSection: displays ACTIVE OBJECTIVE section header", () => {
  assert.ok(
    src.includes("Active Objective"),
    "Expected 'Active Objective' section heading",
  );
});

void test("ActiveObjectiveSection: uses TargetIcon for section label", () => {
  assert.ok(
    src.includes("TargetIcon"),
    "Expected TargetIcon for the objective section label",
  );
});

void test("ActiveObjectiveSection: shows objective title with Satoshi display font", () => {
  assert.ok(
    src.includes("font-display"),
    "Expected font-display class for Satoshi heading font",
  );
});

void test("ActiveObjectiveSection: shows status badge with mono uppercase styling", () => {
  assert.ok(
    src.includes("uppercase") && src.includes("tracking-wider"),
    "Expected uppercase mono badge for status display",
  );
});

void test("ActiveObjectiveSection: shows stats row with runs, tasks, artifacts", () => {
  assert.ok(src.includes("runs"), "Expected runs count in stats");
  assert.ok(src.includes("tasks"), "Expected tasks count in stats");
  assert.ok(src.includes("artifacts"), "Expected artifacts count in stats");
});

void test("ActiveObjectiveSection: has Open objective, Resume work, and Switch objective actions", () => {
  assert.ok(src.includes("Open objective"), "Expected 'Open objective' action");
  assert.ok(src.includes("Resume work"), "Expected 'Resume work' action");
  assert.ok(src.includes("Switch objective"), "Expected 'Switch objective' action");
});

void test("ActiveObjectiveSection: Resume work button is disabled placeholder", () => {
  assert.ok(
    src.includes("disabled"),
    "Expected 'Resume work' button to be disabled as placeholder",
  );
});

void test("ActiveObjectiveSection: card uses primary border accent", () => {
  assert.ok(
    src.includes("border-primary"),
    "Expected primary border accent on objective card",
  );
});

void test("ActiveObjectiveSection: has loading skeleton state", () => {
  assert.ok(
    src.includes("Skeleton"),
    "Expected Skeleton loading state",
  );
});

void test("ActiveObjectiveSection: uses tabular-nums for stat values", () => {
  assert.ok(
    src.includes("tabular-nums"),
    "Expected tabular-nums font feature for stat alignment",
  );
});
