import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "SuggestedActionGrid.tsx"),
  "utf-8",
);

const dashboardSrc = readFileSync(
  resolve(import.meta.dirname, "DashboardWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Visual separation: SuggestedActionGrid wrapper
// ---------------------------------------------------------------------------

void test("SuggestedActionGrid section wrapper has a top border for visual separation", () => {
  assert.ok(
    src.includes("border-t"),
    "Expected a top border class (border-t) on the suggested section for visual separation from starter actions",
  );
});

void test("SuggestedActionGrid section wrapper has top padding after the border", () => {
  assert.ok(
    src.includes("pt-"),
    "Expected top padding (pt-*) to create spacing below the border",
  );
});

void test("SuggestedActionGrid uses a subtle violet background tint", () => {
  assert.ok(
    src.includes("bg-violet-"),
    "Expected a subtle violet background tint on the suggested section",
  );
});

// ---------------------------------------------------------------------------
// Visual separation: DashboardWorkspace gap
// ---------------------------------------------------------------------------

void test("DashboardWorkspace uses increased gap between starter and suggested sections", () => {
  // The section 2 container should use gap-8 (not gap-6) for more breathing room
  assert.ok(
    dashboardSrc.includes("gap-8"),
    "Expected gap-8 between ActionCardGrid and SuggestedActionGrid for visual separation",
  );
});

// ---------------------------------------------------------------------------
// Dark mode support
// ---------------------------------------------------------------------------

void test("SuggestedActionGrid border works in both light and dark modes", () => {
  // The border should use a color with opacity (border-border/) that adapts to both modes
  // or use a violet shade that is subtle in both contexts
  assert.ok(
    src.includes("border-border/") || src.includes("border-violet-"),
    "Expected border color to use opacity or violet for light/dark mode support",
  );
});

void test("SuggestedActionGrid violet tint opacity is at least 4% for dark mode visibility", () => {
  // At 2% opacity the violet tint is invisible in dark mode.
  // Ensure opacity is >= 0.04 so the section boundary is perceptible.
  const opacityMatch = src.match(/bg-violet-500\/\[0\.(\d+)\]/);
  assert.ok(opacityMatch, "Expected bg-violet-500/[0.XX] opacity class");
  const opacityValue = parseFloat(`0.${opacityMatch![1]}`);
  assert.ok(
    opacityValue >= 0.04,
    `Expected violet tint opacity >= 0.04 for dark mode visibility, got ${opacityValue}`,
  );
});
