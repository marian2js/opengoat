import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "BrainWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Each empty Memory section has a visually distinct empty-state container
//      (dashed border or tinted background)
// ---------------------------------------------------------------------------

void test("MemoryInlineEmpty uses tinted background styling", () => {
  assert.ok(
    src.includes("bg-muted/30") || src.includes("bg-muted/20"),
    "MemoryInlineEmpty must use a tinted background (bg-muted/30 or bg-muted/20)",
  );
});

void test("MemoryInlineEmpty uses dashed border container", () => {
  assert.ok(
    src.includes("border-dashed"),
    "MemoryInlineEmpty must use dashed border styling",
  );
});

// ---------------------------------------------------------------------------
// AC2: Description text in empty sections is visually differentiated
//      from user-added content (italic, lower opacity)
// ---------------------------------------------------------------------------

void test("MemoryContentView hides template description in empty sections", () => {
  // When a section is empty, the raw template description should not be rendered
  // as plain markdown — similar to how KnowledgeContentView hides body text
  assert.ok(
    src.includes("isKeyDecisionsEmpty") && src.includes("isPreferencesEmpty") && src.includes("isContextEmpty"),
    "Must check emptiness per section to conditionally hide template descriptions",
  );
  // The body text should be hidden for empty sections (via isSectionEmpty or individual checks)
  assert.ok(
    src.includes("!isSectionEmpty") || src.includes("!isKeyDecisionsEmpty"),
    "Template descriptions must be hidden for empty sections",
  );
});

// ---------------------------------------------------------------------------
// AC3: Each empty section includes an inline "Edit" affordance or CTA
// ---------------------------------------------------------------------------

void test("MemoryInlineEmpty has a clickable Edit button", () => {
  // Must have a PencilIcon-based Edit button in the inline empty state
  assert.ok(
    src.includes("PencilIcon") &&
    (src.includes("onEdit") || src.includes("onClick")),
    "MemoryInlineEmpty must have a clickable Edit button with PencilIcon",
  );
});

void test("MemoryContentView accepts onEdit callback", () => {
  assert.ok(
    src.includes("onEdit"),
    "MemoryContentView must accept an onEdit callback for the inline Edit button",
  );
});

// ---------------------------------------------------------------------------
// AC4: Sections with user-added content render normally
// ---------------------------------------------------------------------------

void test("getEmptyMemorySections treats template descriptions as empty", () => {
  // Template descriptions should not count as user content
  assert.ok(
    src.includes("isTemplateDescription") || src.includes("MEMORY_TEMPLATE_DESCRIPTIONS") || src.includes("templateDescriptions"),
    "Must have logic to recognize template descriptions as non-content",
  );
});

// ---------------------------------------------------------------------------
// AC5: Works in both light and dark mode
// ---------------------------------------------------------------------------

void test("MemoryInlineEmpty uses theme-aware styling", () => {
  assert.ok(
    src.includes("text-muted-foreground"),
    "Must use theme-aware text color classes",
  );
  assert.ok(
    src.includes("border-muted-foreground") || src.includes("border-border"),
    "Must use theme-aware border classes",
  );
  assert.ok(
    src.includes("bg-muted"),
    "Must use theme-aware background classes",
  );
});
