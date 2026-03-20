import assert from "node:assert/strict";
import test from "node:test";
import {
  extractOpportunities,
  opportunityCategoryConfig,
  type OpportunityCategory,
  type WorkspaceFiles,
} from "./opportunities";

// ---------------------------------------------------------------------------
// Realistic markdown content matching bootstrap-generated structure
// ---------------------------------------------------------------------------

const REALISTIC_PRODUCT = `# PRODUCT

## Company summary
- Calendly is a scheduling automation platform

## Target users (initial hypothesis)
- Sales teams needing to book demos and discovery calls
- Freelancers and consultants managing client bookings

## Positioning signals
- "Easy ahead" tagline
- "Scheduling automation platform for teams"

## Weaknesses in current messaging
- Hero headline is generic and doesn't communicate the core differentiator
- No clear ICP targeting — tries to speak to everyone
- Pricing page lacks comparison with alternatives

## Open questions
- Unclear how much enterprise revenue vs SMB
`;

const REALISTIC_MARKET = `# MARKET

## Market category
- Scheduling software / meeting automation

## Competitor hypotheses
- Doodle: simpler, poll-based scheduling — weaker on automation
- Acuity Scheduling: strong with solopreneurs, weaker for teams
- Microsoft Bookings: bundled with M365, low standalone awareness

## Differentiation hypotheses
- Strongest brand recognition in the category
- Best team scheduling features (round-robin, collective)
- Viral growth loop via meeting invites is unique

## Likely communities and channels
- r/SaaS and r/startups on Reddit
- Hacker News — scheduling productivity angle
- Product Hunt — strong fit for feature launches
- Sales-focused Slack communities (RevGenius, Sales Hacker)
`;

const REALISTIC_GROWTH = `# GROWTH

## Strategic summary
- Focus on product-led growth through viral sharing loop

## Website conversion issues
- Homepage hero is too generic, doesn't speak to a specific segment
- No social proof above the fold
- CTA text "Get started" is weak — doesn't promise a specific outcome

## Content opportunities
- Scheduling best practices blog series could capture long-tail SEO traffic
- Comparison pages (vs Doodle, vs Acuity) are missing entirely
- "How to schedule meetings effectively" keyword cluster is uncontested

## Channel priorities
- SEO (strongest channel — scheduling category has high search volume)
- Product-led viral growth (core growth engine)
- Partnerships/integrations marketplace

## Experiment ideas
- Test short-form video demos on LinkedIn showing booking flow
- A/B test homepage hero between "Easy ahead" and "Stop the back-and-forth"
- Launch on Product Hunt with team scheduling angle

## Risks and constraints
- High competition from incumbents (Microsoft Bookings, Google Calendar)
`;

const fullFiles: WorkspaceFiles = {
  productMd: REALISTIC_PRODUCT,
  marketMd: REALISTIC_MARKET,
  growthMd: REALISTIC_GROWTH,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void test("extractOpportunities returns 3-7 opportunities from realistic content", () => {
  const opportunities = extractOpportunities(fullFiles);
  assert.ok(
    opportunities.length >= 3 && opportunities.length <= 7,
    `Expected 3-7 opportunities, got ${opportunities.length}`,
  );
});

void test("every opportunity has required fields", () => {
  const opportunities = extractOpportunities(fullFiles);
  for (const opp of opportunities) {
    assert.ok(opp.id, `Opportunity missing id`);
    assert.ok(opp.title, `Opportunity ${opp.id} missing title`);
    assert.ok(opp.explanation, `Opportunity ${opp.id} missing explanation`);
    assert.ok(opp.category, `Opportunity ${opp.id} missing category`);
  }
});

void test("all opportunity ids are unique", () => {
  const opportunities = extractOpportunities(fullFiles);
  const ids = opportunities.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length, "Duplicate opportunity ids found");
});

void test("all opportunity categories are valid", () => {
  const validCategories: OpportunityCategory[] = [
    "messaging",
    "positioning",
    "distribution",
    "seo",
  ];
  const opportunities = extractOpportunities(fullFiles);
  for (const opp of opportunities) {
    assert.ok(
      validCategories.includes(opp.category),
      `Opportunity ${opp.id} has invalid category: ${opp.category}`,
    );
  }
});

void test("explanations are concise (under 300 chars)", () => {
  const opportunities = extractOpportunities(fullFiles);
  for (const opp of opportunities) {
    assert.ok(
      opp.explanation.length <= 300,
      `Opportunity ${opp.id} explanation is ${opp.explanation.length} chars, should be ≤300`,
    );
  }
});

void test("messaging-weakness opportunity is extracted from PRODUCT.md", () => {
  const opportunities = extractOpportunities(fullFiles);
  const messaging = opportunities.find((o) => o.id === "messaging-weakness");
  assert.ok(messaging, "Should find messaging-weakness opportunity");
  assert.equal(messaging.category, "messaging");
  assert.ok(
    messaging.explanation.toLowerCase().includes("hero") ||
      messaging.explanation.toLowerCase().includes("headline") ||
      messaging.explanation.toLowerCase().includes("generic"),
    "Should reference the messaging weakness",
  );
});

void test("differentiation-gap opportunity is extracted from MARKET.md", () => {
  const opportunities = extractOpportunities(fullFiles);
  const diff = opportunities.find((o) => o.id === "differentiation-gap");
  assert.ok(diff, "Should find differentiation-gap opportunity");
  assert.equal(diff.category, "positioning");
  assert.equal(diff.relatedActionId, "analyze-competitor-messaging");
});

void test("community-opportunity is extracted from MARKET.md", () => {
  const opportunities = extractOpportunities(fullFiles);
  const community = opportunities.find((o) => o.id === "community-opportunity");
  assert.ok(community, "Should find community-opportunity");
  assert.equal(community.category, "distribution");
  assert.equal(community.relatedActionId, "find-launch-communities");
});

void test("conversion-issues opportunity is extracted from GROWTH.md", () => {
  const opportunities = extractOpportunities(fullFiles);
  const conversion = opportunities.find((o) => o.id === "conversion-issues");
  assert.ok(conversion, "Should find conversion-issues opportunity");
  assert.equal(conversion.category, "seo");
  assert.equal(conversion.relatedActionId, "find-seo-quick-wins");
});

void test("returns empty array when all files are null", () => {
  const opportunities = extractOpportunities({
    productMd: null,
    marketMd: null,
    growthMd: null,
  });
  assert.equal(opportunities.length, 0);
});

void test("returns partial results when only some files exist", () => {
  const opportunities = extractOpportunities({
    productMd: REALISTIC_PRODUCT,
    marketMd: null,
    growthMd: null,
  });
  assert.ok(opportunities.length >= 1, "Should find at least 1 opportunity from PRODUCT.md");
  assert.ok(
    opportunities.every((o) => o.id === "messaging-weakness"),
    "Should only have product-sourced opportunities",
  );
});

void test("relatedActionId references valid starter action ids when present", () => {
  const validActionIds = [
    "find-launch-communities",
    "draft-product-hunt-launch",
    "find-subreddits",
    "rewrite-homepage-hero",
    "analyze-competitor-messaging",
    "find-seo-quick-wins",
  ];
  const opportunities = extractOpportunities(fullFiles);
  for (const opp of opportunities) {
    if (opp.relatedActionId) {
      assert.ok(
        validActionIds.includes(opp.relatedActionId),
        `Opportunity ${opp.id} references unknown action: ${opp.relatedActionId}`,
      );
    }
  }
});

void test("opportunityCategoryConfig has an entry for every OpportunityCategory", () => {
  const categories: OpportunityCategory[] = [
    "messaging",
    "positioning",
    "distribution",
    "seo",
  ];
  for (const cat of categories) {
    assert.ok(opportunityCategoryConfig[cat], `Missing config for category: ${cat}`);
    assert.ok(opportunityCategoryConfig[cat].label, `Missing label for: ${cat}`);
    assert.ok(opportunityCategoryConfig[cat].className, `Missing className for: ${cat}`);
  }
});
