import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "BrainWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: h2 section headings have increased top margin and a subtle top border
// ---------------------------------------------------------------------------

void test("h2 headings have increased top margin (mt-8 or higher)", () => {
  // mt-8 = 2rem, a significant upgrade from the original mt-6
  assert.ok(
    src.includes("[&_h2]:mt-8") || src.includes("[&_h2]:mt-10"),
    "Expected h2 headings to have mt-8 or mt-10 for breathing room between sections",
  );
});

void test("h2 headings have a top border divider", () => {
  assert.ok(
    src.includes("[&_h2]:border-t"),
    "Expected h2 headings to have a top border (border-t) for visual section breaks",
  );
});

void test("h2 headings have top padding to space content from divider", () => {
  assert.ok(
    src.includes("[&_h2]:pt-"),
    "Expected h2 headings to have top padding (pt-*) below the border divider",
  );
});

// ---------------------------------------------------------------------------
// AC2: Visible breathing room between sections
// ---------------------------------------------------------------------------

void test("h2 border uses a subtle opacity for visual separation", () => {
  assert.ok(
    src.includes("[&_h2]:border-border/"),
    "Expected h2 border to use border-border/ with opacity for subtle dividers",
  );
});

void test("h2 headings have adequate bottom margin for section spacing", () => {
  // mb-3 or higher to give breathing room after headings
  assert.ok(
    src.includes("[&_h2]:mb-3") || src.includes("[&_h2]:mb-4"),
    "Expected h2 headings to have mb-3 or mb-4 for spacing after heading",
  );
});

// ---------------------------------------------------------------------------
// AC3: Content area uses more horizontal space on wide viewports
// ---------------------------------------------------------------------------

void test("content container has a max-width constraint for readable line lengths", () => {
  // max-w-prose constrains to ~65ch for comfortable reading;
  // wider options (max-w-4xl etc.) are also acceptable
  assert.ok(
    src.includes("max-w-prose") || src.includes("max-w-4xl") || src.includes("max-w-5xl") || src.includes("max-w-6xl") || src.includes("max-w-none"),
    "Expected content area to have a max-width constraint for readable line lengths",
  );
});

void test("content container has responsive horizontal padding", () => {
  // Should have increased padding on larger viewports
  assert.ok(
    src.includes("xl:px-"),
    "Expected xl: responsive horizontal padding on the content container for wider viewports",
  );
});

// ---------------------------------------------------------------------------
// AC4 & AC5: Shared component, dark/light mode
// ---------------------------------------------------------------------------

void test("prose styling is applied to the shared markdown container", () => {
  assert.ok(
    src.includes("prose prose-sm"),
    "Expected prose prose-sm on the markdown container (shared by all Brain pages)",
  );
});

void test("dark mode prose styling is present", () => {
  // prose-invert or dark: prefix for dark mode support
  assert.ok(
    src.includes("prose-invert") || src.includes("dark:prose-invert"),
    "Expected dark mode prose styling (prose-invert) for dark mode support",
  );
});
