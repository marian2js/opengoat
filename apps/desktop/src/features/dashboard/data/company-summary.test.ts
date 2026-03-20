import assert from "node:assert/strict";
import test from "node:test";
import {
  parseWorkspaceSummary,
  extractSection,
  type CompanySummaryData,
} from "../lib/parse-workspace-summary";

// ---------------------------------------------------------------------------
// Integration-level tests: verifying the full extraction pipeline against
// realistic bootstrap-generated markdown content.
// ---------------------------------------------------------------------------

const REALISTIC_PRODUCT = `# PRODUCT

## Company summary
- Calendly is a scheduling automation platform that eliminates back-and-forth emails for booking meetings
- It solves the problem of manual meeting coordination across time zones and availability
- One-sentence summary: Calendly lets anyone schedule meetings by sharing a link to their available times

## Product offerings
- Free plan (1 event type, basic integrations)
- Standard plan ($10/seat/month)
- Teams plan ($16/seat/month)
- Enterprise plan (custom pricing)

## Target users (initial hypothesis)
- Sales teams needing to book demos and discovery calls
- Recruiters scheduling candidate interviews
- Customer success teams booking check-ins
- Freelancers and consultants managing client bookings
- Company size: SMB to enterprise, strongest signal in mid-market

## Core use cases
- Booking external meetings (sales demos, customer calls)
- Internal meeting coordination
- Round-robin team scheduling
- Routing and qualification flows

## Key features
- Shareable booking links
- Calendar integrations (Google, Outlook, iCloud)
- Team scheduling (round-robin, collective)
- Routing forms
- Automated reminders and follow-ups
- CRM integrations (Salesforce, HubSpot)
- Payment collection (Stripe, PayPal)

## Pricing and packaging
- Freemium model with clear upsell path
- Per-seat pricing for paid tiers
- Enterprise tier with custom pricing, SSO, advanced admin

## Proof points
- "Used by 100,000+ companies"
- Logos: Dropbox, Twilio, Lyft, eBay
- G2 leader badge

## Positioning signals
- "Easy ahead" tagline
- "Scheduling automation platform for teams"
- Main value props: eliminate back-and-forth, save time, professional scheduling experience
- Category terms: scheduling software, meeting scheduler, appointment scheduling

## Open questions
- Unclear how much enterprise revenue vs SMB
- Limited visibility into API/developer ecosystem depth
`;

const REALISTIC_GROWTH = `# GROWTH

## Strategic summary
- Focus on product-led growth through viral sharing loop (every meeting invite exposes new users to Calendly)
- Short thesis: double down on the viral loop + content marketing for SEO dominance in scheduling category

## Positioning recommendation
- Lean into "scheduling automation" rather than just "scheduling"
- Emphasize team workflows and enterprise readiness as differentiation

## Messaging pillars
- Save time, eliminate friction
- Professional scheduling experience
- Team-ready from day one
- Enterprise-grade security and compliance

## Channel priorities
- SEO (strongest channel — scheduling category has high search volume)
- Product-led viral growth (core growth engine)
- Partnerships/integrations marketplace
- LinkedIn thought leadership
- Content marketing (blog, guides)

## Content pillars
- Scheduling best practices and productivity
- Sales enablement and meeting optimization
- Remote work and async coordination

## Distribution strategy
- Blog posts targeting scheduling-related long-tail keywords
- Integration partner co-marketing
- Customer case studies

## 30-day plan
- Audit top 20 landing pages for conversion rate
- Launch 5 comparison pages (vs Doodle, vs Acuity, etc.)
- Ship 3 customer stories
- Test LinkedIn ad campaign targeting sales leaders

## Experiment ideas
- Test short-form video demos on LinkedIn showing booking flow
- A/B test homepage hero between "Easy ahead" and "Stop the back-and-forth"
- Launch on Product Hunt with team scheduling angle

## Measurement
- Weekly active schedulers
- Viral coefficient (new signups per existing user)
- Conversion rate free → paid

## Risks and constraints
- High competition from incumbents (Microsoft Bookings, Google Calendar appointment slots)
- Perception as a "simple tool" may limit enterprise adoption
- Viral loop depends on external meeting volume which varies by role

## Open questions
- Is the freemium ceiling limiting revenue per user?
`;

void test("realistic bootstrap output: all 5 summary points extracted", () => {
  const result = parseWorkspaceSummary(REALISTIC_PRODUCT, null, REALISTIC_GROWTH);

  assert.ok(result.productSummary, "productSummary should be present");
  assert.ok(
    result.productSummary.includes("scheduling") || result.productSummary.includes("Calendly"),
    "productSummary should mention the product or domain",
  );

  assert.ok(result.targetAudience, "targetAudience should be present");
  assert.ok(
    result.targetAudience.includes("Sales") || result.targetAudience.includes("sales"),
    "targetAudience should mention a user segment",
  );

  assert.ok(result.valueProposition, "valueProposition should be present");

  assert.ok(result.mainRisk, "mainRisk should be present");
  assert.ok(
    result.mainRisk.includes("competition") || result.mainRisk.includes("incumbents") || result.mainRisk.includes("High"),
    "mainRisk should describe a real risk",
  );

  assert.ok(result.topOpportunity, "topOpportunity should be present");
});

void test("summary data points are concise (under 300 chars each)", () => {
  const result = parseWorkspaceSummary(REALISTIC_PRODUCT, null, REALISTIC_GROWTH);

  for (const [key, value] of Object.entries(result)) {
    if (value !== null) {
      assert.ok(
        value.length <= 300,
        `${key} is ${value.length} chars, should be ≤300 for compact display`,
      );
    }
  }
});

void test("extractSection handles real PRODUCT.md Company summary heading", () => {
  const section = extractSection(REALISTIC_PRODUCT, "Company summary");
  assert.ok(section);
  assert.ok(section.includes("Calendly"));
});

void test("extractSection handles real PRODUCT.md Target users heading with parenthetical", () => {
  const section = extractSection(REALISTIC_PRODUCT, "Target users");
  assert.ok(section);
  assert.ok(section.includes("Sales teams"));
});

void test("extractSection handles real GROWTH.md Risks and constraints heading", () => {
  const section = extractSection(REALISTIC_GROWTH, "Risks and constraints");
  assert.ok(section);
  assert.ok(section.includes("competition") || section.includes("incumbents"));
});

void test("extractSection handles real GROWTH.md Experiment ideas heading", () => {
  const section = extractSection(REALISTIC_GROWTH, "Experiment ideas");
  assert.ok(section);
  assert.ok(section.includes("LinkedIn") || section.includes("video") || section.includes("Product Hunt"));
});

void test("CompanySummaryData type shape has exactly 5 fields", () => {
  const empty: CompanySummaryData = {
    productSummary: null,
    targetAudience: null,
    valueProposition: null,
    mainRisk: null,
    topOpportunity: null,
  };
  assert.equal(Object.keys(empty).length, 5);
});
