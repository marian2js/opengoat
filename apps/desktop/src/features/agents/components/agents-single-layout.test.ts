import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "AgentsWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Single agent card has more visual weight (larger padding, prominent layout)
// ---------------------------------------------------------------------------

void test("Single agent card applies enhanced padding when only one agent", () => {
  assert.ok(
    src.includes("agents.length === 1"),
    "Must conditionally check for single-agent layout",
  );
});

void test("Single agent card uses larger padding for prominence", () => {
  assert.ok(
    src.includes("p-6") || src.includes("p-8") || src.includes("px-6") || src.includes("py-5"),
    "Single agent card must use larger padding (p-6/p-8/px-6/py-5) for visual weight",
  );
});

void test("Single agent has a prominent BotIcon avatar", () => {
  assert.ok(
    src.includes("size-10") || src.includes("size-8") || src.includes("size-9"),
    "Single agent must display a larger icon for visual weight",
  );
});

void test("Default badge is more prominent with larger styling", () => {
  assert.ok(
    src.includes("text-[11px]") && src.includes("px-2"),
    "Default badge must use larger font (text-[11px]) and padding (px-2) when in single-agent view",
  );
});

// ---------------------------------------------------------------------------
// AC2: Empty space below the agent includes a subtle prompt encouraging users
//      to create more agents
// ---------------------------------------------------------------------------

void test("Single agent view has a CTA to create specialized agents", () => {
  assert.ok(
    src.includes("Create specialized agents") ||
    src.includes("Add specialized agents") ||
    src.includes("specialized agents for"),
    "Must include guidance encouraging users to create specialized agents",
  );
});

void test("Single agent guidance area has a New agent CTA button", () => {
  assert.ok(
    src.includes("New agent"),
    "Must have a secondary '+ New agent' CTA in the guidance area",
  );
});

// ---------------------------------------------------------------------------
// AC3: Page feels intentional rather than sparse
// ---------------------------------------------------------------------------

void test("Single agent layout uses centered or featured card styling", () => {
  assert.ok(
    src.includes("rounded-xl") || src.includes("rounded-lg"),
    "Single agent card must use rounded styling for a polished look",
  );
});

// ---------------------------------------------------------------------------
// AC4: Layout adapts gracefully when multiple agents are present
// ---------------------------------------------------------------------------

void test("Multiple agents retain the original compact list layout", () => {
  assert.ok(
    src.includes("grid-cols-[minmax(0,1.1fr)"),
    "Multiple agents must retain the original grid layout",
  );
});

// ---------------------------------------------------------------------------
// AC5: Works in both light and dark mode — semantic color tokens only
// ---------------------------------------------------------------------------

void test("Single agent layout uses semantic theme-aware color tokens", () => {
  assert.ok(
    src.includes("bg-muted") || src.includes("bg-card"),
    "Must use semantic background tokens for theme compatibility",
  );
  assert.ok(
    src.includes("text-primary"),
    "Must use semantic primary color tokens",
  );
});
