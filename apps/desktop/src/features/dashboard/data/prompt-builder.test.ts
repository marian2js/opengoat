import assert from "node:assert/strict";
import test from "node:test";
import {
  buildActionPrompt,
  QUALITY_GATE_TEMPLATE,
  CONTEXT_INSTRUCTION,
} from "./prompt-builder";
import type { ActionCard } from "./actions";
import { SparklesIcon } from "lucide-react";

function makeCard(overrides: Partial<ActionCard> = {}): ActionCard {
  return {
    id: "test-card",
    title: "Test Card",
    promise: "Test promise",
    description: "Test description",
    icon: SparklesIcon,
    category: "seo",
    skills: [],
    prompt: "Do the specific task here.",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildActionPrompt — full card with skills + persona
// ---------------------------------------------------------------------------

void test("buildActionPrompt: includes all sections when skills and persona are present", () => {
  const card = makeCard({
    skills: ["seo-audit", "page-cro"],
    persona: "seo-specialist",
    prompt: "Analyze the landing page.",
  });
  const result = buildActionPrompt(card);

  // Missing-file preamble
  assert.ok(result.includes("skip it silently"), "Should include missing-file preamble");

  // Skills section (conditional wording)
  assert.ok(result.includes("./skills/marketing/seo-audit/SKILL.md"), "Should include seo-audit skill path");
  assert.ok(result.includes("./skills/marketing/page-cro/SKILL.md"), "Should include page-cro skill path");
  assert.ok(result.includes("If it exists, read and follow"), "Skills should use conditional wording");

  // Persona section (conditional wording)
  assert.ok(result.includes("./skills/personas/seo-specialist/SKILL.md"), "Should include persona path");
  assert.ok(result.includes("If it exists, read ./skills/personas/"), "Persona should use conditional wording");

  // Context section
  assert.ok(result.includes("PRODUCT.md"), "Should reference PRODUCT.md");
  assert.ok(result.includes("MARKET.md"), "Should reference MARKET.md");
  assert.ok(result.includes("GROWTH.md"), "Should reference GROWTH.md");

  // Task section
  assert.ok(result.includes("Analyze the landing page."), "Should include task prompt");

  // Format instructions
  assert.ok(result.includes("structured markdown"), "Should include format instructions");

  // Quality gate section
  assert.ok(result.includes("NEEDS IMPROVEMENT"), "Should include quality gate");
});

// ---------------------------------------------------------------------------
// buildActionPrompt — no persona
// ---------------------------------------------------------------------------

void test("buildActionPrompt: omits persona section when persona is not set", () => {
  const card = makeCard({
    skills: ["copywriting"],
    prompt: "Write hero copy.",
  });
  const result = buildActionPrompt(card);

  assert.ok(!result.includes("./skills/personas/"), "Should not include persona path");
  assert.ok(result.includes("./skills/marketing/copywriting/SKILL.md"), "Should include skill path");
  assert.ok(result.includes("Write hero copy."), "Should include task prompt");
  assert.ok(result.includes("NEEDS IMPROVEMENT"), "Should include quality gate");
});

// ---------------------------------------------------------------------------
// buildActionPrompt — empty skills
// ---------------------------------------------------------------------------

void test("buildActionPrompt: no skill-reading lines when skills array is empty", () => {
  const card = makeCard({
    skills: [],
    prompt: "Do something general.",
  });
  const result = buildActionPrompt(card);

  assert.ok(!result.includes("./skills/marketing/"), "Should not include any skill paths");
  assert.ok(result.includes("Do something general."), "Should include task prompt");
  assert.ok(result.includes("NEEDS IMPROVEMENT"), "Should include quality gate");
});

// ---------------------------------------------------------------------------
// buildActionPrompt — multiple skills
// ---------------------------------------------------------------------------

void test("buildActionPrompt: each skill gets its own reading instruction", () => {
  const card = makeCard({
    skills: ["seo-audit", "page-cro", "content-strategy"],
    prompt: "Full analysis.",
  });
  const result = buildActionPrompt(card);

  assert.ok(result.includes("./skills/marketing/seo-audit/SKILL.md"), "seo-audit");
  assert.ok(result.includes("./skills/marketing/page-cro/SKILL.md"), "page-cro");
  assert.ok(result.includes("./skills/marketing/content-strategy/SKILL.md"), "content-strategy");
});

// ---------------------------------------------------------------------------
// buildActionPrompt — section ordering
// ---------------------------------------------------------------------------

void test("buildActionPrompt: sections appear in correct order", () => {
  const card = makeCard({
    skills: ["seo-audit"],
    persona: "seo-specialist",
    prompt: "TASK_MARKER_HERE",
  });
  const result = buildActionPrompt(card);

  const missingFileIdx = result.indexOf("skip it silently");
  const skillIdx = result.indexOf("./skills/marketing/seo-audit/SKILL.md");
  const personaIdx = result.indexOf("./skills/personas/seo-specialist/SKILL.md");
  const contextIdx = result.indexOf("PRODUCT.md");
  const taskIdx = result.indexOf("TASK_MARKER_HERE");
  const formatIdx = result.indexOf("structured markdown");
  const qualityIdx = result.indexOf("NEEDS IMPROVEMENT");

  assert.ok(missingFileIdx < skillIdx, "Missing-file preamble before skills");
  assert.ok(skillIdx < personaIdx, "Skills before persona");
  assert.ok(personaIdx < contextIdx, "Persona before context");
  assert.ok(contextIdx < taskIdx, "Context before task");
  assert.ok(taskIdx < formatIdx, "Task before format instructions");
  assert.ok(formatIdx < qualityIdx, "Format instructions before quality gate");
});

// ---------------------------------------------------------------------------
// Quality gate content
// ---------------------------------------------------------------------------

void test("QUALITY_GATE_TEMPLATE contains key quality phrases", () => {
  assert.ok(QUALITY_GATE_TEMPLATE.includes("NEEDS IMPROVEMENT"), "Should mention NEEDS IMPROVEMENT");
  assert.ok(QUALITY_GATE_TEMPLATE.includes("confidence"), "Should mention confidence");
  assert.ok(QUALITY_GATE_TEMPLATE.includes("evidence"), "Should mention evidence");
  assert.ok(QUALITY_GATE_TEMPLATE.includes("self-critique"), "Should mention self-critique");
});

// ---------------------------------------------------------------------------
// Context instruction content
// ---------------------------------------------------------------------------

void test("CONTEXT_INSTRUCTION references all three workspace files", () => {
  assert.ok(CONTEXT_INSTRUCTION.includes("PRODUCT.md"), "Should reference PRODUCT.md");
  assert.ok(CONTEXT_INSTRUCTION.includes("MARKET.md"), "Should reference MARKET.md");
  assert.ok(CONTEXT_INSTRUCTION.includes("GROWTH.md"), "Should reference GROWTH.md");
});
