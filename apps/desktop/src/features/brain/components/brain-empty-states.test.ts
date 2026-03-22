import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "BrainWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Empty sections display a visually distinct placeholder
//      (dashed border or muted card) instead of bare headings
// ---------------------------------------------------------------------------

void test("Memory empty state renders subsection placeholder cards", () => {
  // Must have separate cards explaining what goes in each memory subsection
  assert.ok(
    src.includes("MemoryEmptyState") || src.includes("memorySubsections") || src.includes("memory-subsection"),
    "Memory section must have a dedicated empty state with subsection cards",
  );
});

void test("Knowledge empty state renders subsection placeholder cards", () => {
  assert.ok(
    src.includes("KnowledgeEmptyState") || src.includes("knowledgeSubsections") || src.includes("knowledge-subsection"),
    "Knowledge section must have a dedicated empty state with subsection cards",
  );
});

void test("Empty state subsection cards use dashed border styling", () => {
  assert.ok(
    src.includes("border-dashed"),
    "Empty state subsection cards must use dashed border styling",
  );
});

// ---------------------------------------------------------------------------
// AC2: Placeholder text is actionable and explains what will appear
// ---------------------------------------------------------------------------

void test("Memory empty state uses actionable verb language for Key Decisions", () => {
  // Must tell users what to DO, not just label the section
  assert.ok(
    src.includes("Record") || src.includes("Track") || src.includes("Log"),
    "Key Decisions subsection should use actionable language like Record/Track/Log",
  );
});

void test("Memory empty state uses actionable verb language for Preferences", () => {
  assert.ok(
    src.includes("Define") || src.includes("Set") || src.includes("Establish"),
    "Preferences subsection should use actionable language like Define/Set/Establish",
  );
});

void test("Memory empty state uses actionable verb language for Context", () => {
  assert.ok(
    src.includes("Share") || src.includes("Add") || src.includes("Provide"),
    "Context subsection should use actionable language like Share/Add/Provide",
  );
});

// ---------------------------------------------------------------------------
// AC3: Knowledge page has a clear CTA to import content when empty
// ---------------------------------------------------------------------------

void test("Knowledge empty state has a prominent import CTA in the body", () => {
  // Must have a dedicated import card/CTA beyond just the header button
  assert.ok(
    src.includes("Import your first file") || src.includes("Import a file"),
    "Knowledge empty state must have a prominent 'Import your first file' CTA in the body area",
  );
});

// ---------------------------------------------------------------------------
// AC4: Memory page descriptions updated to match marketing platform domain
// ---------------------------------------------------------------------------

void test("Memory placeholder does NOT reference 'Coding style'", () => {
  assert.ok(
    !src.includes("Coding style"),
    "Memory placeholder must not reference 'Coding style' — use marketing-domain language instead",
  );
});

void test("Memory section uses marketing-domain language in its description", () => {
  assert.ok(
    src.includes("brand") || src.includes("Brand"),
    "Memory section should reference 'brand' for marketing-domain relevance",
  );
});

void test("Memory placeholder references product/market context instead of coding", () => {
  // The placeholder or empty state should mention product/market/campaign context
  assert.ok(
    src.includes("positioning") || src.includes("campaign") || src.includes("content tone") || src.includes("content style"),
    "Memory placeholder should reference marketing concepts (positioning, campaigns, content)",
  );
});

// ---------------------------------------------------------------------------
// AC5: Both pages look intentional when empty in light and dark modes
// ---------------------------------------------------------------------------

void test("Empty state uses theme-aware color classes (not hardcoded)", () => {
  assert.ok(
    src.includes("text-muted-foreground"),
    "Empty state must use theme-aware text colors",
  );
  assert.ok(
    src.includes("border-border"),
    "Empty state must use theme-aware border colors",
  );
});

void test("Empty state placeholder cards have hover states", () => {
  assert.ok(
    src.includes("hover:bg-accent") || src.includes("hover:border-border"),
    "Empty state cards should have hover states for interactivity",
  );
});

// ---------------------------------------------------------------------------
// AC6: Knowledge page descriptions updated to match marketing platform domain
// ---------------------------------------------------------------------------

void test("Knowledge placeholder does NOT reference 'API references'", () => {
  assert.ok(
    !src.includes("API references"),
    "Knowledge placeholder must not reference 'API references' — use marketing-domain language instead",
  );
});

void test("Knowledge section uses marketing-domain language in its description", () => {
  assert.ok(
    src.includes("brand guidelines") || src.includes("competitive intelligence") || src.includes("competitive research"),
    "Knowledge section should reference marketing-domain concepts like brand guidelines or competitive research",
  );
});
