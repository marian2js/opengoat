import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ChatWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Each starter prompt has a visible border/container (not floating text)
// ---------------------------------------------------------------------------

void test("Starter prompt buttons have border and rounded-lg container", () => {
  assert.ok(
    src.includes("border") && src.includes("rounded-lg"),
    "Starter prompt buttons must have border and rounded-lg for card-like containers",
  );
});

void test("Starter prompt buttons use bg-card background", () => {
  assert.ok(
    src.includes("bg-card"),
    "Starter prompt buttons must use bg-card background for card-like appearance",
  );
});

// ---------------------------------------------------------------------------
// AC2: Each prompt has a contextual icon before the text
// ---------------------------------------------------------------------------

void test("Starter prompts import contextual Lucide icons", () => {
  assert.ok(
    src.includes("TrendingUp") || src.includes("BarChart3"),
    "Must import a chart/trend icon for growth-related prompt",
  );
  assert.ok(
    src.includes("CalendarIcon") || src.includes("Calendar"),
    "Must import a calendar icon for content calendar prompt",
  );
  assert.ok(
    src.includes("Search") || src.includes("Target") || src.includes("Crosshair"),
    "Must import a search/target icon for competitor analysis prompt",
  );
});

void test("STARTER_PROMPTS includes icon property for each entry", () => {
  // Each prompt in the array should have an associated icon
  const promptCount = (src.match(/icon:/g) || []).length;
  assert.ok(
    promptCount >= 3,
    `Expected at least 3 prompts with icon property, found ${String(promptCount)}`,
  );
});

// ---------------------------------------------------------------------------
// AC3: Hover state provides visual feedback matching action card hover pattern
// ---------------------------------------------------------------------------

void test("Starter prompt buttons have hover:border-primary for hover border", () => {
  assert.ok(
    src.includes("hover:border-primary"),
    "Starter prompt buttons must have hover:border-primary for hover border feedback",
  );
});

void test("Starter prompt buttons have hover:bg-accent for hover background", () => {
  assert.ok(
    src.includes("hover:bg-accent"),
    "Starter prompt buttons must have hover:bg-accent for hover background feedback",
  );
});

void test("Starter prompt buttons have transition-all for smooth hover", () => {
  assert.ok(
    src.includes("transition-all") || src.includes("transition-colors"),
    "Starter prompt buttons must have transition for smooth hover effects",
  );
});

// ---------------------------------------------------------------------------
// AC4: Prompts feel visually consistent with card-based design language
// ---------------------------------------------------------------------------

void test("Starter prompt uses flex layout with icon and text", () => {
  assert.ok(
    src.includes("flex") && (src.includes("items-center") || src.includes("items-start")),
    "Starter prompt must use flex layout with items-center or items-start for icon-text alignment",
  );
});

void test("Starter prompt icon container uses rounded-md with muted background", () => {
  assert.ok(
    src.includes("rounded-md") && src.includes("bg-primary/10"),
    "Starter prompt icon container must use rounded-md with bg-primary/10 background",
  );
});

void test("Starter prompt text uses text-sm font-medium", () => {
  assert.ok(
    src.includes("font-medium"),
    "Starter prompt text must use font-medium for card title styling",
  );
});

// ---------------------------------------------------------------------------
// AC5: Chat empty state feels inviting and draws user toward action
// ---------------------------------------------------------------------------

void test("Starter prompt grid uses grid layout", () => {
  assert.ok(
    src.includes("grid w-full"),
    "Starter prompt grid must use grid layout",
  );
});

void test("Starter prompt buttons have cursor-pointer", () => {
  assert.ok(
    src.includes("cursor-pointer"),
    "Starter prompt buttons must have cursor-pointer for inviting interactivity",
  );
});
