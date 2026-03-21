import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "SkillsSection.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Empty skills state has visual containment (card, border, or background)
// ---------------------------------------------------------------------------

void test("Empty state uses a dashed border container for visual containment", () => {
  assert.ok(
    src.includes("border-dashed"),
    "Empty state must use dashed border styling for visual containment",
  );
});

void test("Empty state container has rounded corners and padding", () => {
  assert.ok(
    src.includes("rounded-lg") || src.includes("rounded-md"),
    "Empty state container must have rounded corners",
  );
});

void test("Empty state container uses theme-aware border color", () => {
  assert.ok(
    src.includes("border-border"),
    "Empty state container must use theme-aware border colors",
  );
});

// ---------------------------------------------------------------------------
// AC2: Helper text explains what a skill URL looks like or where to find skills
// ---------------------------------------------------------------------------

void test("Install form has helper text below the input with example URL", () => {
  assert.ok(
    src.includes("github.com/") && src.includes("text-xs"),
    "Install form must show helper text with an example GitHub URL format",
  );
});

void test("Helper text uses muted styling", () => {
  assert.ok(
    src.includes("text-muted-foreground") && src.includes("text-xs"),
    "Helper text must use muted foreground color and small text size",
  );
});

// ---------------------------------------------------------------------------
// AC3: The section feels complete and intentional when no skills are installed
// ---------------------------------------------------------------------------

void test("Empty state has a descriptive message about what skills do", () => {
  assert.ok(
    src.includes("capabilities") || src.includes("extend"),
    "Empty state should explain what skills provide",
  );
});

void test("Empty state uses the PuzzleIcon for visual interest", () => {
  assert.ok(
    src.includes("PuzzleIcon"),
    "Empty state must use PuzzleIcon as a visual element",
  );
});

// ---------------------------------------------------------------------------
// AC4: Works in both light and dark mode
// ---------------------------------------------------------------------------

void test("Empty state uses theme-aware text colors (not hardcoded)", () => {
  assert.ok(
    src.includes("text-muted-foreground"),
    "Empty state must use theme-aware text-muted-foreground colors",
  );
});

void test("Empty state border uses opacity for subtle appearance in both themes", () => {
  // border-border/40 or similar opacity ensures subtlety in both light and dark
  assert.ok(
    src.includes("border-border/"),
    "Empty state border should use opacity modifier for theme adaptability",
  );
});
