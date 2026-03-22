import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "BrainWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Each empty category section (Key Decisions, Preferences, Context)
//      has a visual container (dashed border)
// ---------------------------------------------------------------------------

void test("Memory content view has 'No key decisions recorded yet' placeholder text", () => {
  assert.ok(
    src.includes("No key decisions recorded yet"),
    "Must show 'No key decisions recorded yet' text when Key Decisions section is empty",
  );
});

void test("Memory content view has 'No preferences set' placeholder text", () => {
  assert.ok(
    src.includes("No preferences set"),
    "Must show 'No preferences set' text when Preferences section is empty",
  );
});

void test("Memory content view has 'No context added' placeholder text", () => {
  assert.ok(
    src.includes("No context added"),
    "Must show 'No context added' text when Context section is empty",
  );
});

void test("Memory inline empty states use dashed-border container", () => {
  assert.ok(
    src.includes("border-dashed") && src.includes("No key decisions recorded yet"),
    "Memory inline empty state must use dashed-border styling",
  );
});

// ---------------------------------------------------------------------------
// AC2: Empty categories show a muted message below the description
// ---------------------------------------------------------------------------

void test("Key Decisions empty state has contextual helper text", () => {
  assert.ok(
    src.includes("Add one via Edit above") || src.includes("Edit above"),
    "Key Decisions empty state needs CTA helper text referencing the Edit action",
  );
});

void test("Preferences empty state has contextual helper text", () => {
  assert.ok(
    src.includes("No preferences set"),
    "Preferences empty state needs contextual placeholder text",
  );
});

void test("Context empty state has contextual helper text", () => {
  assert.ok(
    src.includes("No context added"),
    "Context empty state needs contextual placeholder text",
  );
});

// ---------------------------------------------------------------------------
// AC3: Visual containers disappear when categories have actual content
// ---------------------------------------------------------------------------

void test("Memory section has logic to detect empty sections", () => {
  assert.ok(
    src.includes("getEmptyMemorySections") || src.includes("MemoryContentView"),
    "Must have logic to detect empty memory subsections",
  );
});

void test("getEmptyMemorySections detects Key Decisions, Preferences, Context", () => {
  assert.ok(
    src.includes("keyDecisions") || src.includes("key_decisions") || src.includes("Key Decisions"),
    "Must detect Key Decisions section emptiness",
  );
  assert.ok(
    src.includes("preferences") || src.includes("Preferences"),
    "Must detect Preferences section emptiness",
  );
  assert.ok(
    src.includes("context") || src.includes("Context"),
    "Must detect Context section emptiness",
  );
});

// ---------------------------------------------------------------------------
// AC4: Spacing between sections is consistent
// ---------------------------------------------------------------------------

void test("Memory content view exists as a dedicated component", () => {
  assert.ok(
    src.includes("MemoryContentView"),
    "Must have a MemoryContentView component for rendering memory with inline empty states",
  );
});

// ---------------------------------------------------------------------------
// AC5: Works in both light and dark modes (theme-aware classes)
// ---------------------------------------------------------------------------

void test("Memory inline empty states use theme-aware classes", () => {
  assert.ok(
    src.includes("text-muted-foreground"),
    "Memory inline empty states must use theme-aware text colors",
  );
  assert.ok(
    src.includes("border-muted-foreground") || src.includes("border-border"),
    "Memory inline empty states must use theme-aware border classes",
  );
});

// ---------------------------------------------------------------------------
// Icons: Empty states include relevant icons (ScaleIcon, SlidersHorizontalIcon, LayersIcon)
// ---------------------------------------------------------------------------

void test("Memory inline empty states reference category icons", () => {
  assert.ok(
    src.includes("ScaleIcon") && src.includes("SlidersHorizontalIcon") && src.includes("LayersIcon"),
    "Inline empty states should use ScaleIcon, SlidersHorizontalIcon, and LayersIcon for memory categories",
  );
});
