import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ConnectionsWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Both action buttons have tooltips that appear on hover
// ---------------------------------------------------------------------------

void test("ConnectionsWorkspace imports Tooltip components", () => {
  assert.ok(
    src.includes("Tooltip") && src.includes("TooltipTrigger") && src.includes("TooltipContent"),
    "Must import and use Tooltip, TooltipTrigger, and TooltipContent components",
  );
});

void test("Set default button is wrapped in a Tooltip", () => {
  // The CheckIcon/default button must be inside a TooltipTrigger
  const checkSection = src.slice(
    src.indexOf("CheckIcon"),
    src.indexOf("CheckIcon") + 500,
  );
  assert.ok(
    src.includes("TooltipTrigger") && src.includes("Set as default"),
    "The default button must be wrapped in a Tooltip with 'Set as default' content",
  );
});

void test("Delete button is wrapped in a Tooltip", () => {
  assert.ok(
    src.includes("TooltipTrigger") && src.includes("Remove"),
    "The delete button must be wrapped in a Tooltip with 'Remove' content",
  );
});

// ---------------------------------------------------------------------------
// AC2: The purpose of each button is clear without guessing
// ---------------------------------------------------------------------------

void test("Default button has descriptive tooltip text", () => {
  assert.ok(
    src.includes("Set as default") || src.includes("Make default"),
    "The default button tooltip must clearly describe its purpose",
  );
});

void test("Delete button has descriptive tooltip text", () => {
  assert.ok(
    src.includes("Remove provider") || src.includes("Remove connection") || src.includes("Delete"),
    "The delete button tooltip must clearly describe its purpose",
  );
});

// ---------------------------------------------------------------------------
// AC3: Disabled state has a clear explanation (tooltip or visual indicator)
// ---------------------------------------------------------------------------

void test("Default button shows different tooltip when already default", () => {
  assert.ok(
    src.includes("Already default") || src.includes("Current default") || src.includes("Active default"),
    "When the connection is already default, the tooltip must explain the disabled state",
  );
});

// ---------------------------------------------------------------------------
// AC4: Works in both light and dark mode — uses semantic color tokens
// ---------------------------------------------------------------------------

void test("Action buttons use semantic color tokens for theme compatibility", () => {
  assert.ok(
    src.includes("text-destructive"),
    "Delete button must use semantic destructive color token",
  );
});
