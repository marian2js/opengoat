import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "BrainWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Memory page sections show a muted icon + descriptive text + action hint when empty
// ---------------------------------------------------------------------------

void test("Memory inline empty states have action-oriented helper text", () => {
  assert.ok(
    src.includes("Chat with your agent or click Edit to add entries") ||
      src.includes("click Edit"),
    "Memory empty state helper text must be action-oriented, not just descriptive",
  );
});

// ---------------------------------------------------------------------------
// AC2: Knowledge page sections show the same empty state pattern when empty
// ---------------------------------------------------------------------------

void test("Knowledge inline empty states have action-oriented helper text", () => {
  assert.ok(
    src.includes("Import a file or click Edit") ||
      src.includes("click Edit to add"),
    "Knowledge empty state helper text must be action-oriented",
  );
});

// ---------------------------------------------------------------------------
// AC3: Empty sections have a subtle dashed border container
// ---------------------------------------------------------------------------

void test("Inline empty state containers use dashed border styling", () => {
  assert.ok(
    src.includes("border-dashed"),
    "Empty state containers must use dashed border",
  );
});

// ---------------------------------------------------------------------------
// AC4: Each section has at least min-h-[120px]
// ---------------------------------------------------------------------------

void test("MemoryInlineEmpty has min-h-[120px]", () => {
  assert.ok(
    src.includes("min-h-[120px]"),
    "Empty state containers must have min-h-[120px] to prevent collapse",
  );
});

void test("KnowledgeInlineEmpty has min-h-[120px]", () => {
  // Both use the same min-h pattern
  const matches = src.match(/min-h-\[120px\]/g);
  assert.ok(
    matches && matches.length >= 2,
    "Both Memory and Knowledge inline empty states must have min-h-[120px]",
  );
});

// ---------------------------------------------------------------------------
// AC5: Empty state text is action-oriented, not just descriptive
// ---------------------------------------------------------------------------

void test("Key Decisions empty state has action-oriented text", () => {
  assert.ok(
    !src.includes('"Add one via Edit above"'),
    "Must not use generic 'Add one via Edit above' — use action-oriented text instead",
  );
});

// ---------------------------------------------------------------------------
// AC6: Works correctly in both dark and light modes
// ---------------------------------------------------------------------------

void test("KNOWLEDGE_PROSE_CLASSES uses dark:prose-invert for light mode compatibility", () => {
  assert.ok(
    src.includes("dark:prose-invert"),
    "Prose classes must use dark:prose-invert (not unconditional prose-invert) for light mode support",
  );
});

void test("Empty state containers use theme-aware colors", () => {
  assert.ok(
    src.includes("text-muted-foreground"),
    "Empty states must use semantic theme-aware text colors",
  );
  assert.ok(
    src.includes("border-muted-foreground"),
    "Empty states must use semantic theme-aware border colors",
  );
});
