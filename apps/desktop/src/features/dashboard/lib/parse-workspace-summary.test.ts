import assert from "node:assert/strict";
import test from "node:test";
import {
  extractSection,
  extractBullets,
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

const SAMPLE_MARKET = `# MARKET

## ICP hypotheses
- Remote-first engineering teams of 10-50 at seed/Series A startups that outgrew Notion for sprint planning.
- Secondary: product managers at mid-market SaaS companies needing async standup visibility.

## Personas
- VP Engineering at a Series A startup managing 3 squads across timezones.
- Product manager juggling roadmap alignment across engineering, design, and GTM.

## Main customer pains
- Scattered async communication across Slack, Notion, and Linear causes dropped context.
- Standup meetings waste 30+ min/day for distributed teams with no persistent record.
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

void test("parseWorkspaceSummary extracts all data points including icp and opportunities", () => {
  const result = parseWorkspaceSummary(SAMPLE_PRODUCT, SAMPLE_MARKET, SAMPLE_GROWTH);

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

  assert.ok(result.icp, "icp should be extracted from MARKET.md");
  assert.ok(
    result.icp.includes("engineering teams") || result.icp.includes("Remote-first"),
    "icp should describe ideal customer",
  );

  assert.ok(result.opportunities.length >= 2, "opportunities should have at least 2 bullets");
  assert.ok(result.opportunities.length <= 3, "opportunities should have at most 3 bullets");
});

void test("parseWorkspaceSummary returns nulls for missing files", () => {
  const result = parseWorkspaceSummary(null, null, null);
  assert.equal(result.productSummary, null);
  assert.equal(result.targetAudience, null);
  assert.equal(result.valueProposition, null);
  assert.equal(result.mainRisk, null);
  assert.equal(result.topOpportunity, null);
  assert.equal(result.icp, null);
  assert.deepEqual(result.opportunities, []);
});

void test("parseWorkspaceSummary handles partial data (only product)", () => {
  const result = parseWorkspaceSummary(SAMPLE_PRODUCT, null, null);
  assert.ok(result.productSummary);
  assert.ok(result.targetAudience);
  assert.ok(result.valueProposition);
  assert.equal(result.mainRisk, null);
  assert.equal(result.topOpportunity, null);
  // ICP falls back to PRODUCT.md targetAudience when no MARKET.md
  assert.ok(result.icp, "icp should fall back to product target users");
  assert.deepEqual(result.opportunities, []);
});

void test("parseWorkspaceSummary handles partial data (only growth)", () => {
  const result = parseWorkspaceSummary(null, null, SAMPLE_GROWTH);
  assert.equal(result.productSummary, null);
  assert.equal(result.targetAudience, null);
  assert.equal(result.valueProposition, null);
  assert.ok(result.mainRisk);
  assert.ok(result.topOpportunity);
  assert.equal(result.icp, null);
  assert.ok(result.opportunities.length > 0, "opportunities from GROWTH.md");
});

// ---------------------------------------------------------------------------
// Edge cases: alternative heading names
// ---------------------------------------------------------------------------

void test("parseWorkspaceSummary matches 'Product summary' as fallback for 'Company summary'", () => {
  const md = `# PRODUCT\n\n## Product summary\n- A scheduling tool for teams\n`;
  const result = parseWorkspaceSummary(md, null, null);
  assert.ok(result.productSummary, "should match 'Product summary' fallback heading");
  assert.ok(result.productSummary.includes("scheduling"));
});

void test("parseWorkspaceSummary matches 'Target audience' as fallback for 'Target users'", () => {
  const md = `# PRODUCT\n\n## Target audience\n- Sales teams and recruiters\n`;
  const result = parseWorkspaceSummary(md, null, null);
  assert.ok(result.targetAudience, "should match 'Target audience' fallback heading");
  assert.ok(result.targetAudience.includes("Sales"));
});

void test("parseWorkspaceSummary matches 'Value proposition' as fallback for 'Positioning signals'", () => {
  const md = `# PRODUCT\n\n## Value proposition\n- Fast, simple, async-first\n`;
  const result = parseWorkspaceSummary(md, null, null);
  assert.ok(result.valueProposition, "should match 'Value proposition' fallback heading");
});

void test("parseWorkspaceSummary matches 'Risks' as fallback for 'Risks and constraints'", () => {
  const md = `# GROWTH\n\n## Risks\n- High competition from incumbents\n`;
  const result = parseWorkspaceSummary(null, null, md);
  assert.ok(result.mainRisk, "should match 'Risks' fallback heading");
});

void test("parseWorkspaceSummary matches 'Growth opportunities' as fallback for opportunity", () => {
  const md = `# GROWTH\n\n## Growth opportunities\n- Viral loop potential\n`;
  const result = parseWorkspaceSummary(null, null, md);
  assert.ok(result.topOpportunity, "should match 'Growth opportunities' fallback heading");
});

// ---------------------------------------------------------------------------
// Edge cases: CRLF line endings
// ---------------------------------------------------------------------------

void test("extractSection handles CRLF line endings", () => {
  const md = "## Company summary\r\n- Acme does things\r\n- More info\r\n\r\n## Target users\r\n- Founders\r\n";
  const result = extractSection(md, "Company summary");
  assert.ok(result, "should extract content with CRLF endings");
  assert.ok(result.includes("Acme does things"));
});

void test("parseWorkspaceSummary handles CRLF line endings end-to-end", () => {
  const product = "# PRODUCT\r\n\r\n## Company summary\r\n- Acme Corp\r\n\r\n## Target users\r\n- Founders\r\n\r\n## Positioning signals\r\n- Fast and simple\r\n";
  const growth = "# GROWTH\r\n\r\n## Risks and constraints\r\n- Competition\r\n\r\n## Experiment ideas\r\n- Test on Reddit\r\n";
  const result = parseWorkspaceSummary(product, null, growth);
  assert.ok(result.productSummary, "productSummary with CRLF");
  assert.ok(result.targetAudience, "targetAudience with CRLF");
  assert.ok(result.valueProposition, "valueProposition with CRLF");
  assert.ok(result.mainRisk, "mainRisk with CRLF");
  assert.ok(result.topOpportunity, "topOpportunity with CRLF");
});

// ---------------------------------------------------------------------------
// Edge cases: BOM prefix
// ---------------------------------------------------------------------------

void test("extractSection handles BOM prefix at file start", () => {
  const md = "\uFEFF# PRODUCT\n\n## Company summary\n- Acme does things\n";
  const result = extractSection(md, "Company summary");
  assert.ok(result, "should extract content even with BOM prefix");
  assert.ok(result.includes("Acme does things"));
});

// ---------------------------------------------------------------------------
// Edge cases: resilience
// ---------------------------------------------------------------------------

void test("parseWorkspaceSummary never throws on malformed input", () => {
  // Completely empty strings
  const r1 = parseWorkspaceSummary("", null, "");
  assert.equal(r1.productSummary, null);

  // Random non-markdown content
  const r2 = parseWorkspaceSummary("just some random text", null, "no headings here");
  assert.equal(r2.productSummary, null);
  assert.equal(r2.mainRisk, null);

  // Extremely nested markdown
  const r3 = parseWorkspaceSummary("### Sub\n#### Deep\n##### Deeper", null, null);
  assert.equal(r3.productSummary, null);
});

// ---------------------------------------------------------------------------
// extractBullets
// ---------------------------------------------------------------------------

void test("extractBullets extracts up to max bullets from section text", () => {
  const section = "- First bullet here.\n- Second bullet here.\n- Third bullet here.\n- Fourth bullet here.";
  const result = extractBullets(section, 3);
  assert.equal(result.length, 3);
  assert.ok(result[0].startsWith("First"));
  assert.ok(result[2].startsWith("Third"));
});

void test("extractBullets returns empty array for empty input", () => {
  assert.deepEqual(extractBullets("", 3), []);
  assert.deepEqual(extractBullets("  ", 3), []);
});

void test("extractBullets stops at sub-headings", () => {
  const section = "- First bullet.\n### Sub heading\n- Second bullet.";
  const result = extractBullets(section, 3);
  assert.equal(result.length, 1);
});

void test("extractBullets skips label-like lines", () => {
  const section = "Key opportunity\n- Actual bullet with real content here.\n- Another real bullet with details.";
  const result = extractBullets(section, 3);
  assert.ok(result.length >= 1);
  assert.ok(result[0].includes("Actual bullet"));
});

// ---------------------------------------------------------------------------
// ICP extraction
// ---------------------------------------------------------------------------

void test("parseWorkspaceSummary extracts ICP from MARKET.md 'ICP hypotheses'", () => {
  const result = parseWorkspaceSummary(null, SAMPLE_MARKET, null);
  assert.ok(result.icp, "icp should be extracted from MARKET.md");
  assert.ok(
    result.icp.includes("engineering teams") || result.icp.includes("Remote-first"),
    "icp should describe the ideal customer",
  );
});

void test("parseWorkspaceSummary ICP falls back to MARKET.md 'Personas' heading", () => {
  const marketMd = `# MARKET\n\n## Personas\n- DevOps leads at mid-size SaaS companies managing CI/CD pipelines.\n`;
  const result = parseWorkspaceSummary(null, marketMd, null);
  assert.ok(result.icp, "icp should fall back to Personas heading");
  assert.ok(result.icp.includes("DevOps"));
});

void test("parseWorkspaceSummary ICP falls back to PRODUCT.md when MARKET.md is null", () => {
  const result = parseWorkspaceSummary(SAMPLE_PRODUCT, null, null);
  assert.ok(result.icp, "icp should fall back to product target users");
  assert.ok(result.icp.includes("Remote-first") || result.icp.includes("startup"));
});

// ---------------------------------------------------------------------------
// Opportunities extraction
// ---------------------------------------------------------------------------

void test("parseWorkspaceSummary extracts opportunities from GROWTH.md", () => {
  const result = parseWorkspaceSummary(null, null, SAMPLE_GROWTH);
  assert.ok(result.opportunities.length >= 2, "should extract at least 2 opportunity bullets");
  assert.ok(result.opportunities.length <= 3, "should extract at most 3 opportunity bullets");
});

void test("parseWorkspaceSummary returns empty opportunities when GROWTH.md is null", () => {
  const result = parseWorkspaceSummary(SAMPLE_PRODUCT, null, null);
  assert.deepEqual(result.opportunities, []);
});
