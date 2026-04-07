import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSuggestedActions,
  resolveIcon,
  toActionCard,
  SUGGESTED_ACTIONS_PROMPT,
  SUGGESTED_ACTIONS_FILENAME,
  CATEGORY_TO_SPECIALIST,
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
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("Launch on Product Hunt"));
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("Find SEO quick wins"));
});

// ---------------------------------------------------------------------------
// Skill catalog in prompt
// ---------------------------------------------------------------------------

void test("SUGGESTED_ACTIONS_PROMPT includes skill catalog with representative skill IDs", () => {
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("page-cro"), "Should include CRO skills");
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("referral-program"), "Should include growth skills");
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("paid-ads"), "Should include paid skills");
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("churn-prevention"), "Should include retention skills");
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("seo-audit"), "Should include SEO skills");
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("cold-email"), "Should include email skills");
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("pricing-strategy"), "Should include strategy skills");
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("revops"), "Should include sales skills");
});

void test("SUGGESTED_ACTIONS_PROMPT lists all 6 categories", () => {
  const categories = ["conversion", "distribution", "growth", "messaging", "research", "seo"];
  for (const cat of categories) {
    assert.ok(SUGGESTED_ACTIONS_PROMPT.includes(`"${cat}"`), `Should include category "${cat}"`);
  }
});

void test("SUGGESTED_ACTIONS_PROMPT includes skills field in JSON schema", () => {
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes('"skills"'), "Should include skills field in schema");
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("skill-id-1"), "Should show skills array example");
});

// ---------------------------------------------------------------------------
// Backward compatibility — actions without skills field
// ---------------------------------------------------------------------------

void test("parseSuggestedActions: accepts action WITHOUT skills field (backward compat)", () => {
  const input = JSON.stringify([
    {
      id: "legacy-action",
      title: "Legacy action",
      promise: "p",
      description: "d",
      category: "seo",
      prompt: "Do something",
    },
  ]);
  const result = parseSuggestedActions(input);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "legacy-action");
});

void test("toActionCard: defaults skills to empty array when input lacks skills", () => {
  const data = {
    id: "no-skills-card",
    title: "No Skills",
    promise: "p",
    description: "d",
    category: "seo" as const,
    prompt: "Test prompt",
  } as unknown as import("./suggested-actions").SuggestedActionData;
  const card = toActionCard(data);
  assert.deepEqual(card.skills, []);
});

void test("toActionCard: preserves skills when present", () => {
  const data = {
    id: "with-skills",
    title: "With Skills",
    promise: "p",
    description: "d",
    category: "growth" as const,
    skills: ["referral-program", "lead-magnets"],
    prompt: "Test prompt",
  };
  const card = toActionCard(data);
  assert.deepEqual(card.skills, ["referral-program", "lead-magnets"]);
});

// ---------------------------------------------------------------------------
// Category-to-specialist mapping & time estimate
// ---------------------------------------------------------------------------

void test("toActionCard: adds specialistId from category mapping", () => {
  const mappings: Array<{ category: import("./actions").ActionCategory; expectedSpecialistId: string }> = [
    { category: "conversion", expectedSpecialistId: "website-conversion" },
    { category: "distribution", expectedSpecialistId: "distribution" },
    { category: "seo", expectedSpecialistId: "seo-aeo" },
    { category: "messaging", expectedSpecialistId: "positioning" },
    { category: "research", expectedSpecialistId: "market-intel" },
    { category: "growth", expectedSpecialistId: "content" },
  ];
  for (const { category, expectedSpecialistId } of mappings) {
    const data = {
      id: `test-${category}`,
      title: "Test",
      promise: "p",
      description: "d",
      category,
      skills: [],
      prompt: "pr",
    };
    const card = toActionCard(data);
    assert.equal(card.specialistId, expectedSpecialistId, `Category "${category}" should map to specialist "${expectedSpecialistId}"`);
  }
});

void test("toActionCard: adds default timeToFirstOutput", () => {
  const data = {
    id: "time-test",
    title: "Test",
    promise: "p",
    description: "d",
    category: "seo" as const,
    skills: [],
    prompt: "pr",
  };
  const card = toActionCard(data);
  assert.ok(card.timeToFirstOutput, "Should have a timeToFirstOutput value");
  assert.equal(card.timeToFirstOutput, "30\u201390s");
});

void test("CATEGORY_TO_SPECIALIST: exports mapping for all 6 categories", () => {
  const categories = ["conversion", "distribution", "growth", "messaging", "research", "seo"];
  for (const cat of categories) {
    assert.ok(CATEGORY_TO_SPECIALIST[cat as import("./actions").ActionCategory], `Should have mapping for ${cat}`);
  }
});

// ---------------------------------------------------------------------------
// Tier & outputPromise validation
// ---------------------------------------------------------------------------

void test("parseSuggestedActions: accepts actions with valid tier field", () => {
  for (const tier of ["hero", "primary", "secondary"]) {
    const input = JSON.stringify([
      { id: "tiered", title: "Tiered", promise: "p", description: "d", category: "seo", skills: [], prompt: "pr", tier },
    ]);
    const result = parseSuggestedActions(input);
    assert.equal(result.length, 1, `Should accept tier="${tier}"`);
    assert.equal((result[0] as Record<string, unknown>).tier, tier);
  }
});

void test("parseSuggestedActions: rejects actions with invalid tier value", () => {
  const input = JSON.stringify([
    { id: "bad-tier", title: "Bad", promise: "p", description: "d", category: "seo", skills: [], prompt: "pr", tier: "invalid" },
  ]);
  const result = parseSuggestedActions(input);
  assert.equal(result.length, 0);
});

void test("parseSuggestedActions: accepts actions without tier field (backward compat)", () => {
  const input = JSON.stringify([
    { id: "no-tier", title: "No Tier", promise: "p", description: "d", category: "seo", skills: [], prompt: "pr" },
  ]);
  const result = parseSuggestedActions(input);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "no-tier");
});

void test("parseSuggestedActions: accepts actions with valid outputPromise field", () => {
  const input = JSON.stringify([
    { id: "op", title: "Op", promise: "p", description: "d", category: "seo", skills: [], prompt: "pr", outputPromise: "5 search wedges + page angles" },
  ]);
  const result = parseSuggestedActions(input);
  assert.equal(result.length, 1);
  assert.equal((result[0] as Record<string, unknown>).outputPromise, "5 search wedges + page angles");
});

void test("parseSuggestedActions: rejects actions with empty outputPromise string", () => {
  const input = JSON.stringify([
    { id: "empty-op", title: "Empty", promise: "p", description: "d", category: "seo", skills: [], prompt: "pr", outputPromise: "" },
  ]);
  const result = parseSuggestedActions(input);
  assert.equal(result.length, 0);
});

void test("toActionCard: preserves tier and outputPromise when present", () => {
  const data = {
    id: "full-card",
    title: "Full",
    promise: "p",
    description: "d",
    category: "research" as const,
    skills: ["seo-audit"],
    prompt: "pr",
    tier: "hero" as const,
    outputPromise: "5 search wedges + page angles",
  };
  const card = toActionCard(data);
  assert.equal((card as Record<string, unknown>).tier, "hero");
  assert.equal((card as Record<string, unknown>).outputPromise, "5 search wedges + page angles");
});

// ---------------------------------------------------------------------------
// Updated prompt content assertions
// ---------------------------------------------------------------------------

void test("SUGGESTED_ACTIONS_PROMPT: requests 4-6 actions", () => {
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("4-6"), "Should request 4-6 actions");
  assert.ok(!SUGGESTED_ACTIONS_PROMPT.includes("suggest 2-3"), "Should no longer request 2-3 actions");
});

void test("SUGGESTED_ACTIONS_PROMPT: includes leverage criteria keywords", () => {
  const lower = SUGGESTED_ACTIONS_PROMPT.toLowerCase();
  assert.ok(lower.includes("outside-in"), "Should include outside-in");
  assert.ok(lower.includes("revenue-adjacent"), "Should include revenue-adjacent");
  assert.ok(lower.includes("unknown-before-use"), "Should include unknown-before-use");
  assert.ok(lower.includes("hard-to-do-manually"), "Should include hard-to-do-manually");
});

void test("SUGGESTED_ACTIONS_PROMPT: includes demotion rules", () => {
  assert.ok(SUGGESTED_ACTIONS_PROMPT.toLowerCase().includes("demote") || SUGGESTED_ACTIONS_PROMPT.toLowerCase().includes("avoid"), "Should include demotion guidance");
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes("internal cleanup") || SUGGESTED_ACTIONS_PROMPT.includes("good hygiene"), "Should mention weak job types to avoid");
});

void test("SUGGESTED_ACTIONS_PROMPT: includes tier and outputPromise in JSON schema", () => {
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes('"tier"'), "Should include tier field in schema");
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes('"outputPromise"'), "Should include outputPromise field in schema");
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes('"hero"'), "Should mention hero tier");
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes('"primary"'), "Should mention primary tier");
  assert.ok(SUGGESTED_ACTIONS_PROMPT.includes('"secondary"'), "Should mention secondary tier");
});

