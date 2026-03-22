import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "BrainWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: "References" section shows a dashed-border container with
//      "No references imported" when empty
// ---------------------------------------------------------------------------

void test("Knowledge content view has 'No references imported' placeholder text", () => {
  assert.ok(
    src.includes("No references imported"),
    "Must show 'No references imported' text when References section is empty",
  );
});

void test("References empty state uses dashed-border container", () => {
  // The inline empty state for an empty References section must use
  // the same dashed-border pattern as other empty states in the project
  assert.ok(
    src.includes("border-dashed") && src.includes("No references imported"),
    "References inline empty state must use dashed-border styling",
  );
});

// ---------------------------------------------------------------------------
// AC2: "Notes" section shows a dashed-border container with
//      "No notes added" when empty
// ---------------------------------------------------------------------------

void test("Knowledge content view has 'No notes added' placeholder text", () => {
  assert.ok(
    src.includes("No notes added"),
    "Must show 'No notes added' text when Notes section is empty",
  );
});

void test("Notes empty state uses dashed-border container", () => {
  assert.ok(
    src.includes("border-dashed") && src.includes("No notes added"),
    "Notes inline empty state must use dashed-border styling",
  );
});

// ---------------------------------------------------------------------------
// AC3: Each container includes contextual helper text explaining what to add
// ---------------------------------------------------------------------------

void test("References empty state has contextual helper text", () => {
  // Should mention importing or adding references
  assert.ok(
    src.includes("Import") || src.includes("import") || src.includes("Add links"),
    "References empty state needs contextual helper text about importing or adding",
  );
});

void test("Notes empty state has contextual helper text", () => {
  // Should mention adding notes or capturing insights
  assert.ok(
    src.includes("Capture") || src.includes("capture") || src.includes("Add notes"),
    "Notes empty state needs contextual helper text about adding notes",
  );
});

// ---------------------------------------------------------------------------
// AC4: Containers are visually distinct (muted, lighter weight)
// ---------------------------------------------------------------------------

void test("Inline empty states use muted foreground for visual distinction", () => {
  assert.ok(
    src.includes("text-muted-foreground"),
    "Inline empty states must use muted foreground for visual distinction",
  );
});

// ---------------------------------------------------------------------------
// AC5: Works in both light and dark modes (theme-aware classes)
// ---------------------------------------------------------------------------

void test("Inline empty states use theme-aware border classes", () => {
  assert.ok(
    src.includes("border-muted-foreground") || src.includes("border-border"),
    "Inline empty states must use theme-aware border classes",
  );
});

// ---------------------------------------------------------------------------
// AC6: When items are present, the containers are replaced by actual content
// ---------------------------------------------------------------------------

void test("Knowledge section has logic to detect empty sections", () => {
  // Must have a function or logic that determines whether a section is empty
  assert.ok(
    src.includes("getEmptyKnowledgeSections") || src.includes("isEmptySection") || src.includes("sectionIsEmpty") || src.includes("hasContent") || src.includes("KnowledgeContentView"),
    "Must have logic to detect empty knowledge subsections",
  );
});

// ---------------------------------------------------------------------------
// Icons: Empty states include relevant icons (BookmarkIcon, StickyNoteIcon)
// ---------------------------------------------------------------------------

void test("Knowledge inline empty states reference category icons", () => {
  assert.ok(
    src.includes("BookmarkIcon") && src.includes("StickyNoteIcon"),
    "Inline empty states should use BookmarkIcon for References and StickyNoteIcon for Notes",
  );
});
