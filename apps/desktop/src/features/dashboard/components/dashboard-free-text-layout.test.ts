import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dashboardSrc = readFileSync(
  resolve(import.meta.dirname, "DashboardWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// DashboardWorkspace: FreeTextInput appears above ActionCardGrid in Mode A
// ---------------------------------------------------------------------------

void test("DashboardWorkspace imports FreeTextInput", () => {
  assert.ok(
    dashboardSrc.includes("FreeTextInput"),
    "Expected DashboardWorkspace to import and use FreeTextInput",
  );
});

void test("FreeTextInput appears before ActionCardGrid in Mode A", () => {
  // In Mode A (no active work), FreeTextInput should come before ActionCardGrid
  // to ensure it's visible without scrolling on 1280x720+
  const modeAMatch = dashboardSrc.match(/Mode A[^]*$/s);
  assert.ok(modeAMatch, "Expected Mode A section in DashboardWorkspace");

  const modeASection = modeAMatch[0];
  const freeTextPos = modeASection.indexOf("FreeTextInput");
  const actionGridPos = modeASection.indexOf("ActionCardGrid");

  assert.ok(freeTextPos !== -1, "Expected FreeTextInput in Mode A section");
  assert.ok(actionGridPos !== -1, "Expected ActionCardGrid in Mode A section");
  assert.ok(
    freeTextPos < actionGridPos,
    "Expected FreeTextInput to appear BEFORE ActionCardGrid in Mode A for above-the-fold visibility",
  );
});

// ---------------------------------------------------------------------------
// DashboardWorkspace: FreeTextInput is present in Mode B as well
// ---------------------------------------------------------------------------

void test("FreeTextInput appears in Mode B (active work)", () => {
  // Mode B should also have a free-text input so users can always start ad-hoc asks
  const modeBMatch = dashboardSrc.match(/Mode B[^]*?Mode A/s);
  assert.ok(modeBMatch, "Expected Mode B section in DashboardWorkspace");

  const modeBSection = modeBMatch[0];
  assert.ok(
    modeBSection.includes("FreeTextInput"),
    "Expected FreeTextInput in Mode B section for persistent access to free-text asks",
  );
});

// ---------------------------------------------------------------------------
// DashboardWorkspace: free-text submit handler routes via onActionClick
// ---------------------------------------------------------------------------

void test("DashboardWorkspace routes free-text submissions via onActionClick", () => {
  assert.ok(
    dashboardSrc.includes("free-text") && dashboardSrc.includes("onActionClick"),
    "Expected free-text submission to route through onActionClick for action session creation",
  );
});

// ---------------------------------------------------------------------------
// DashboardWorkspace: FreeTextInput is in both dashboard modes
// ---------------------------------------------------------------------------

void test("FreeTextInput is rendered in both dashboard modes", () => {
  // Count occurrences of FreeTextInput in the JSX (should be at least 2 — one per mode)
  const matches = dashboardSrc.match(/<FreeTextInput/g);
  assert.ok(matches, "Expected FreeTextInput to be rendered in JSX");
  assert.ok(
    matches.length >= 2,
    `Expected FreeTextInput to appear in both Mode A and Mode B (found ${matches.length} occurrences)`,
  );
});
