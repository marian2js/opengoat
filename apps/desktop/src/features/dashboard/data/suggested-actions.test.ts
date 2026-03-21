import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSuggestedActions,
  resolveIcon,
  toActionCard,
  SUGGESTED_ACTIONS_PROMPT,
  SUGGESTED_ACTIONS_FILENAME,
} from "./suggested-actions";

// ---------------------------------------------------------------------------
// parseSuggestedActions
// ---------------------------------------------------------------------------

void test("parseSuggestedActions: valid JSON array returns parsed cards", () => {
  const input = JSON.stringify([
    {
      id: "draft-comparison",
      title: "Draft comparison page",
      promise: "Create a comparison page",
      description: "Analyzes competitors and creates a comparison page.",
      category: "messaging",
      skills: ["copywriting"],
      prompt: "Read PRODUCT.md, MARKET.md, GROWTH.md and draft a comparison.",
    },
  ]);
  const result = parseSuggestedActions(input);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "draft-comparison");
  assert.equal(result[0]!.category, "messaging");
  assert.deepEqual(result[0]!.skills, ["copywriting"]);
});

void test("parseSuggestedActions: JSON wrapped in markdown code fences", () => {
  const input = '```json\n[{"id":"test","title":"Test","promise":"p","description":"d","category":"seo","skills":[],"prompt":"pr"}]\n```';
  const result = parseSuggestedActions(input);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "test");
});

void test("parseSuggestedActions: JSON with plain code fences (no json label)", () => {
  const input = '```\n[{"id":"test","title":"Test","promise":"p","description":"d","category":"research","skills":[],"prompt":"pr"}]\n```';
  const result = parseSuggestedActions(input);
  assert.equal(result.length, 1);
});

void test("parseSuggestedActions: invalid JSON returns empty array", () => {
  const result = parseSuggestedActions("this is not json at all");
  assert.deepEqual(result, []);
});

void test("parseSuggestedActions: empty string returns empty array", () => {
  assert.deepEqual(parseSuggestedActions(""), []);
});

void test("parseSuggestedActions: null-ish input returns empty array", () => {
  assert.deepEqual(parseSuggestedActions(null as unknown as string), []);
  assert.deepEqual(parseSuggestedActions(undefined as unknown as string), []);
});

void test("parseSuggestedActions: missing required fields filters out invalid cards", () => {
  const input = JSON.stringify([
    { id: "valid", title: "Valid", promise: "p", description: "d", category: "seo", skills: [], prompt: "pr" },
    { id: "no-title", promise: "p", description: "d", category: "seo", skills: [], prompt: "pr" },
    { id: "no-category", title: "T", promise: "p", description: "d", category: "invalid", skills: [], prompt: "pr" },
    { id: "", title: "Empty id", promise: "p", description: "d", category: "seo", skills: [], prompt: "pr" },
    { id: "no-skills", title: "No skills", promise: "p", description: "d", category: "seo", prompt: "pr" },
  ]);
  const result = parseSuggestedActions(input);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "valid");
});

void test("parseSuggestedActions: non-array JSON returns empty array", () => {
  assert.deepEqual(parseSuggestedActions('{"key": "value"}'), []);
});

void test("parseSuggestedActions: JSON array with surrounding text", () => {
  const input = 'Here are the suggestions:\n[{"id":"x","title":"X","promise":"p","description":"d","category":"distribution","skills":["launch-strategy"],"prompt":"pr"}]\nHope this helps!';
  const result = parseSuggestedActions(input);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "x");
  assert.deepEqual(result[0]!.skills, ["launch-strategy"]);
});

// ---------------------------------------------------------------------------
// resolveIcon
// ---------------------------------------------------------------------------

void test("resolveIcon: returns an icon for each valid category", () => {
  const categories = ["conversion", "distribution", "growth", "messaging", "research", "seo"];
  for (const cat of categories) {
    const icon = resolveIcon(cat);
    assert.ok(typeof icon === "function" || typeof icon === "object", `Expected icon for ${cat}`);
  }
});

void test("resolveIcon: returns fallback for unknown category", () => {
  const icon = resolveIcon("unknown-category");
  assert.ok(icon, "Should return a fallback icon");
});

// ---------------------------------------------------------------------------
// toActionCard
// ---------------------------------------------------------------------------

void test("toActionCard: hydrates icon from category", () => {
  const data = {
    id: "test-card",
    title: "Test",
    promise: "Test promise",
    description: "Test description",
    category: "distribution" as const,
    skills: ["launch-strategy"],
    prompt: "Test prompt",
  };
  const card = toActionCard(data);
  assert.equal(card.id, "test-card");
  assert.equal(card.title, "Test");
  assert.ok(card.icon, "Should have an icon");
  assert.equal(card.category, "distribution");
  assert.deepEqual(card.skills, ["launch-strategy"]);
});

void test("toActionCard: preserves all original fields", () => {
  const data = {
    id: "preserve-test",
    title: "Preserve",
    promise: "Promise text",
    description: "Description text",
    category: "research" as const,
    skills: ["seo-audit", "page-cro"],
    prompt: "Prompt text here",
  };
  const card = toActionCard(data);
  assert.equal(card.promise, data.promise);
  assert.equal(card.description, data.description);
  assert.equal(card.prompt, data.prompt);
  assert.deepEqual(card.skills, ["seo-audit", "page-cro"]);
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

void test("SUGGESTED_ACTIONS_FILENAME is SUGGESTED_ACTIONS.json", () => {
  assert.equal(SUGGESTED_ACTIONS_FILENAME, "SUGGESTED_ACTIONS.json");
});

void test("SUGGESTED_ACTIONS_PROMPT references workspace files", () => {
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("PRODUCT.md"));
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("MARKET.md"));
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("GROWTH.md"));
});

void test("parseSuggestedActions: validates suggested action with skills field", () => {
  const input = JSON.stringify([
    {
      id: "seo-task",
      title: "Run SEO audit",
      promise: "Audit your site",
      description: "Full SEO audit.",
      category: "seo",
      skills: ["seo-audit"],
      prompt: "Read PRODUCT.md and audit.",
    },
  ]);
  const result = parseSuggestedActions(input);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0]!.skills, ["seo-audit"]);
});

void test("parseSuggestedActions: accepts conversion and growth categories", () => {
  const input = JSON.stringify([
    { id: "cro-task", title: "CRO audit", promise: "p", description: "d", category: "conversion", skills: ["page-cro"], prompt: "pr" },
    { id: "growth-task", title: "Referral program", promise: "p", description: "d", category: "growth", skills: [], prompt: "pr" },
  ]);
  const result = parseSuggestedActions(input);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.category, "conversion");
  assert.equal(result[1]!.category, "growth");
});

void test("SUGGESTED_ACTIONS_PROMPT lists fixed card titles", () => {
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("Find launch communities"));
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("Draft Product Hunt launch"));
});
