import assert from "node:assert/strict";
import test from "node:test";
import {
  extractSection,
  firstParagraphOrBullet,
  parseWorkspaceSummary,
} from "./parse-workspace-summary";

// ---------------------------------------------------------------------------
// extractSection
// ---------------------------------------------------------------------------

void test("extractSection returns content under a matching heading", () => {
  const md = `# PRODUCT

## Company summary
- Acme is a project management tool
- It helps teams ship faster

## Target users
- Startup founders
`;
  const result = extractSection(md, "Company summary");
  assert.ok(result);
  assert.ok(result.includes("Acme is a project management tool"));
});

void test("extractSection returns null for missing heading", () => {
  const md = `# PRODUCT\n\n## Company summary\nSome content\n`;
  const result = extractSection(md, "Nonexistent heading");
  assert.equal(result, null);
});

void test("extractSection is case-insensitive", () => {
  const md = `## company summary\nContent here\n`;
  const result = extractSection(md, "Company summary");
  assert.ok(result);
  assert.ok(result.includes("Content here"));
});

void test("extractSection stops at the next ## heading", () => {
  const md = `## Company summary
First section content

## Target users
Second section content
`;
  const result = extractSection(md, "Company summary");
  assert.ok(result);
  assert.ok(result.includes("First section content"));
  assert.ok(!result.includes("Second section content"));
});

void test("extractSection handles heading with extra text (e.g. parenthetical)", () => {
  const md = `## Target users (initial hypothesis)
- Startup founders
- Small teams
`;
  const result = extractSection(md, "Target users");
  assert.ok(result);
  assert.ok(result.includes("Startup founders"));
});

void test("extractSection returns null for empty section", () => {
  const md = `## Company summary

## Target users
Content here
`;
  const result = extractSection(md, "Company summary");
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// firstParagraphOrBullet
// ---------------------------------------------------------------------------

void test("firstParagraphOrBullet strips bullet prefix", () => {
  const result = firstParagraphOrBullet("- Acme is a tool\n- It does things");
  assert.ok(result);
  assert.ok(result.startsWith("Acme is a tool"));
});

void test("firstParagraphOrBullet returns plain text as-is", () => {
  const result = firstParagraphOrBullet("A plain paragraph of text.");
  assert.equal(result, "A plain paragraph of text.");
});

void test("firstParagraphOrBullet returns null for empty input", () => {
  assert.equal(firstParagraphOrBullet(""), null);
  assert.equal(firstParagraphOrBullet("   "), null);
});

void test("firstParagraphOrBullet stops at sub-headings", () => {
  const result = firstParagraphOrBullet(
    "First line\n### Sub heading\nSub content",
  );
  assert.ok(result);
  assert.equal(result, "First line");
  assert.ok(!result.includes("Sub content"));
});

void test("firstParagraphOrBullet caps at 3 lines", () => {
  const result = firstParagraphOrBullet(
    "- Line 1\n- Line 2\n- Line 3\n- Line 4\n- Line 5",
  );
  assert.ok(result);
  assert.ok(!result.includes("Line 4"));
});

// ---------------------------------------------------------------------------
// parseWorkspaceSummary
// ---------------------------------------------------------------------------

const SAMPLE_PRODUCT = `# PRODUCT

## Company summary
- Acme Corp builds a project management tool for remote teams
- It solves the problem of scattered communication

## Product offerings
- Free tier and Pro plan

## Target users (initial hypothesis)
- Remote-first startup teams of 5-50 people
- Engineering and product managers

## Core use cases
- Sprint planning
- Async standups

## Key features
- Real-time collaboration
- AI task suggestions

## Positioning signals
- "The simplest way to ship as a remote team"
- Main value props: simplicity, speed, async-first
`;

const SAMPLE_GROWTH = `# GROWTH

## Strategic summary
- Focus on community-led growth through developer communities
- Short thesis: content + community before paid

## Positioning recommendation
- Lean into async-first narrative

## Messaging pillars
- Async-first
- Developer-friendly
- Ship faster

## Risks and constraints
- Small team limits content velocity
- High competition in project management space

## Experiment ideas
- Test developer community posts on Reddit and HN
- Run a Product Hunt launch within 30 days
`;

void test("parseWorkspaceSummary extracts all 5 data points", () => {
  const result = parseWorkspaceSummary(SAMPLE_PRODUCT, null, SAMPLE_GROWTH);

  assert.ok(result.productSummary, "productSummary should be extracted");
  assert.ok(
    result.productSummary.includes("Acme Corp"),
    "productSummary should mention company name",
  );

  assert.ok(result.targetAudience, "targetAudience should be extracted");
  assert.ok(
    result.targetAudience.includes("Remote-first"),
    "targetAudience should describe user",
  );

  assert.ok(result.valueProposition, "valueProposition should be extracted");
  assert.ok(
    result.valueProposition.includes("simplest way"),
    "valueProposition should capture positioning",
  );

  assert.ok(result.mainRisk, "mainRisk should be extracted");
  assert.ok(
    result.mainRisk.includes("content velocity") || result.mainRisk.includes("Small team"),
    "mainRisk should capture a risk",
  );

  assert.ok(result.topOpportunity, "topOpportunity should be extracted");
  assert.ok(
    result.topOpportunity.includes("community") || result.topOpportunity.includes("Reddit"),
    "topOpportunity should capture an experiment or strategy",
  );
});

void test("parseWorkspaceSummary returns nulls for missing files", () => {
  const result = parseWorkspaceSummary(null, null, null);
  assert.equal(result.productSummary, null);
  assert.equal(result.targetAudience, null);
  assert.equal(result.valueProposition, null);
  assert.equal(result.mainRisk, null);
  assert.equal(result.topOpportunity, null);
});

void test("parseWorkspaceSummary handles partial data (only product)", () => {
  const result = parseWorkspaceSummary(SAMPLE_PRODUCT, null, null);
  assert.ok(result.productSummary);
  assert.ok(result.targetAudience);
  assert.ok(result.valueProposition);
  assert.equal(result.mainRisk, null);
  assert.equal(result.topOpportunity, null);
});

void test("parseWorkspaceSummary handles partial data (only growth)", () => {
  const result = parseWorkspaceSummary(null, null, SAMPLE_GROWTH);
  assert.equal(result.productSummary, null);
  assert.equal(result.targetAudience, null);
  assert.equal(result.valueProposition, null);
  assert.ok(result.mainRisk);
  assert.ok(result.topOpportunity);
});
