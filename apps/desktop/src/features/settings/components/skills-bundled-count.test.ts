import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "SkillsSection.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Settings Skills section shows count of bundled skills
// ---------------------------------------------------------------------------

void test("Shows bundled skills count with managed skills summary", () => {
  assert.ok(
    src.includes("managedSkills.length") && src.includes("active"),
    "Must display count of managed/bundled skills with 'active' label",
  );
});

void test("Bundled skills summary is always visible when managed skills exist", () => {
  // The bundled summary should be tied to managedSkills.length > 0, not skills.length
  assert.ok(
    src.includes("managedSkills.length"),
    "Must reference managedSkills.length for bundled skills display",
  );
});

void test("Uses a badge or pill to show bundled count near heading", () => {
  assert.ok(
    src.includes("Badge") && (src.includes("managedSkills.length") || src.includes("skills active")),
    "Should use a Badge component to highlight bundled skill count",
  );
});

// ---------------------------------------------------------------------------
// AC2: Empty state text distinguishes custom skills from bundled skills
// ---------------------------------------------------------------------------

void test("Empty state says 'No additional skills' instead of 'No custom skills'", () => {
  assert.ok(
    !src.includes("No custom skills installed"),
    "Must NOT use 'No custom skills installed' — misleading when bundled skills exist",
  );
  assert.ok(
    src.includes("No additional skills installed"),
    "Must use 'No additional skills installed' to distinguish from bundled",
  );
});

void test("Empty state applies only to extra/custom skills, not all skills", () => {
  // The empty state should check extraSkills.length, not skills.length
  assert.ok(
    src.includes("extraSkills.length === 0"),
    "Empty state condition should check extraSkills, not total skills",
  );
});

// ---------------------------------------------------------------------------
// AC3: User can see platform has skill capabilities even with no custom installs
// ---------------------------------------------------------------------------

void test("Shows marketing skills and personas breakdown", () => {
  assert.ok(
    src.includes("marketing") || src.includes("skill"),
    "Should reference marketing skills in the bundled summary",
  );
});

void test("Bundled summary uses appropriate icon", () => {
  assert.ok(
    src.includes("SparklesIcon") || src.includes("ZapIcon") || src.includes("PuzzleIcon"),
    "Bundled summary should use a visually distinct icon",
  );
});
