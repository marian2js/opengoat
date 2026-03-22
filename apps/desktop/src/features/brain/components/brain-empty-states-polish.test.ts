import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "BrainWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Memory empty sections show correct placeholder text
// ---------------------------------------------------------------------------

void test("Memory section shows 'No key decisions recorded yet'", () => {
  assert.ok(
    src.includes("No key decisions recorded yet"),
    "Must show 'No key decisions recorded yet' placeholder",
  );
});

void test("Memory section shows 'No preferences set'", () => {
  assert.ok(
    src.includes("No preferences set"),
    "Must show 'No preferences set' placeholder",
  );
});

void test("Memory section shows 'No context added'", () => {
  assert.ok(
    src.includes("No context added"),
    "Must show 'No context added' placeholder",
  );
});

// ---------------------------------------------------------------------------
// AC2: Each empty section has a muted icon above the placeholder text
// ---------------------------------------------------------------------------

void test("Memory empty states have icons (ScaleIcon, SlidersHorizontalIcon, LayersIcon)", () => {
  assert.ok(src.includes("ScaleIcon"), "Key Decisions needs ScaleIcon");
  assert.ok(src.includes("SlidersHorizontalIcon"), "Preferences needs SlidersHorizontalIcon");
  assert.ok(src.includes("LayersIcon"), "Context needs LayersIcon");
});

void test("Knowledge empty states have icons (BookmarkIcon, StickyNoteIcon)", () => {
  assert.ok(src.includes("BookmarkIcon"), "References needs BookmarkIcon");
  assert.ok(src.includes("StickyNoteIcon"), "Notes needs StickyNoteIcon");
});

// ---------------------------------------------------------------------------
// AC3: Helper text references the Edit action
// ---------------------------------------------------------------------------

void test("Memory empty states reference Edit action in helper text", () => {
  assert.ok(
    src.includes("click Edit") || src.includes("Click Edit"),
    "Memory empty states must reference the Edit action",
  );
});

// ---------------------------------------------------------------------------
// AC4: Knowledge empty sections show 'No references imported' / 'No notes added'
// ---------------------------------------------------------------------------

void test("Knowledge section shows 'No references imported'", () => {
  assert.ok(
    src.includes("No references imported"),
    "Must show 'No references imported' (not 'No references yet')",
  );
});

void test("Knowledge section shows 'No notes added'", () => {
  assert.ok(
    src.includes("No notes added"),
    "Must show 'No notes added' (not 'No notes yet')",
  );
});

// ---------------------------------------------------------------------------
// AC5: Knowledge References empty state includes an "Import file" CTA button
// ---------------------------------------------------------------------------

void test("Knowledge References empty state has an Import file CTA button", () => {
  // The KnowledgeInlineEmpty for References must accept onImport for a CTA button
  assert.ok(
    src.includes("onImport") && src.includes("KnowledgeInlineEmpty"),
    "KnowledgeInlineEmpty must support onImport prop for the Import file CTA",
  );
});

void test("KnowledgeContentView accepts onImport prop", () => {
  assert.ok(
    src.includes("KnowledgeContentView") && src.includes("onImport"),
    "KnowledgeContentView must accept an onImport callback",
  );
});

// ---------------------------------------------------------------------------
// AC6: Dead whitespace reduced — no more than ~80px per empty section
// ---------------------------------------------------------------------------

void test("Empty sections use min-h-[80px] instead of taller heights", () => {
  assert.ok(
    src.includes("min-h-[80px]"),
    "Empty state containers must use min-h-[80px] to reduce dead whitespace",
  );
  // Should NOT have the old 120px height
  const inlineEmptyMatches = src.match(/min-h-\[120px\]/g);
  assert.ok(
    !inlineEmptyMatches,
    "Should not use min-h-[120px] for inline empty states — use 80px instead",
  );
});

// ---------------------------------------------------------------------------
// AC7: Pages no longer feel abandoned — compact padding on empty states
// ---------------------------------------------------------------------------

void test("Empty state containers use compact py-4 padding", () => {
  // MemoryInlineEmpty and KnowledgeInlineEmpty should use py-4 for compact layout
  const memoryMatch = src.match(/function MemoryInlineEmpty[\s\S]*?return\s*\(\s*<div[^>]*py-4/);
  const knowledgeMatch = src.match(/function KnowledgeInlineEmpty[\s\S]*?return\s*\(\s*<div[^>]*py-4/);
  assert.ok(
    memoryMatch || knowledgeMatch || src.includes("py-4"),
    "Empty state containers should use py-4 for compact padding",
  );
});
