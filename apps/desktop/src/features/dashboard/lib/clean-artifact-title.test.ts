import assert from "node:assert/strict";
import test from "node:test";
import { cleanArtifactTitle, isConversationalTitle } from "./clean-artifact-title.js";

// ---------------------------------------------------------------------------
// isConversationalTitle — detects AI conversational preamble
// ---------------------------------------------------------------------------

void test("isConversationalTitle: detects 'I still' prefix", () => {
  assert.ok(isConversationalTitle("I still don't have the actual positioning thread"));
});

void test("isConversationalTitle: detects 'I checked' prefix", () => {
  assert.ok(isConversationalTitle("I checked your saved memory and there's no recorded marke..."));
});

void test("isConversationalTitle: detects 'I ' prefix", () => {
  assert.ok(isConversationalTitle("I found three main issues with your copy"));
});

void test("isConversationalTitle: detects 'Let me' prefix", () => {
  assert.ok(isConversationalTitle("Let me analyze your positioning strategy"));
});

void test("isConversationalTitle: detects 'Here ' prefix", () => {
  assert.ok(isConversationalTitle("Here are the top five recommendations"));
});

void test("isConversationalTitle: detects 'Sure' prefix", () => {
  assert.ok(isConversationalTitle("Sure, I can help with that"));
});

void test("isConversationalTitle: detects 'Got it' prefix", () => {
  assert.ok(isConversationalTitle("Got it, let me work on this"));
});

void test("isConversationalTitle: detects 'OK ' prefix", () => {
  assert.ok(isConversationalTitle("OK so here's what I found"));
});

void test("isConversationalTitle: detects 'Hmm' prefix", () => {
  assert.ok(isConversationalTitle("Hmm, this is tricky"));
});

void test("isConversationalTitle: accepts good title 'Tagline Variants'", () => {
  assert.ok(!isConversationalTitle("Tagline Variants"));
});

void test("isConversationalTitle: accepts good title 'Five highest-impact quick fixes'", () => {
  assert.ok(!isConversationalTitle("Five highest-impact quick fixes"));
});

void test("isConversationalTitle: accepts 'Marketing Priorities Overview'", () => {
  assert.ok(!isConversationalTitle("Marketing Priorities Overview"));
});

void test("isConversationalTitle: is case-insensitive", () => {
  assert.ok(isConversationalTitle("i still need more info"));
});

// ---------------------------------------------------------------------------
// cleanArtifactTitle — returns clean display titles
// ---------------------------------------------------------------------------

void test("cleanArtifactTitle: preserves good titles", () => {
  assert.equal(
    cleanArtifactTitle({ title: "Tagline Variants", type: "copy_draft" }),
    "Tagline Variants",
  );
});

void test("cleanArtifactTitle: preserves good titles with markdown stripped", () => {
  assert.equal(
    cleanArtifactTitle({ title: "## Tagline Variants", type: "copy_draft" }),
    "Tagline Variants",
  );
});

void test("cleanArtifactTitle: extracts heading from content for conversational titles", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "I still don't have the actual positioning thread",
      type: "page_outline",
      content: "# Positioning Page Outline\n\nHere is the outline...",
    }),
    "Positioning Page Outline",
  );
});

void test("cleanArtifactTitle: extracts h2 heading from content", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "I checked your saved memory and there's no recorded",
      type: "strategy_note",
      content: "Some preamble text\n\n## Marketing Priorities Overview\n\nDetails...",
    }),
    "Marketing Priorities Overview",
  );
});

void test("cleanArtifactTitle: falls back to type label when no heading in content", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "I still don't have the actual positioning thread",
      type: "page_outline",
      content: "No headings here, just plain text about positioning.",
    }),
    "Page Outline",
  );
});

void test("cleanArtifactTitle: falls back to type label when no content", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "I checked your saved memory and there's no recorded",
      type: "research_brief",
    }),
    "Research Brief",
  );
});

void test("cleanArtifactTitle: falls back to type label for unknown type", () => {
  const result = cleanArtifactTitle({
    title: "Let me think about this",
    type: "some_unknown_type" as never,
  });
  // Should fall back to the default "Artifact" label
  assert.equal(result, "Artifact");
});

void test("cleanArtifactTitle: strips markdown from content heading", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "Here is what I found",
      type: "checklist",
      content: "# **Bold Heading**\n\nContent...",
    }),
    "Bold Heading",
  );
});

// ---------------------------------------------------------------------------
// Smart quote (Unicode U+2019) support
// ---------------------------------------------------------------------------

void test("isConversationalTitle: detects smart-quote I\u2019m prefix", () => {
  assert.ok(isConversationalTitle("I\u2019m pulling the site copy"));
});

void test("isConversationalTitle: detects smart-quote I\u2019ll prefix", () => {
  assert.ok(isConversationalTitle("I\u2019ll start by reviewing the homepage"));
});

void test("isConversationalTitle: detects smart-quote I\u2019ve prefix", () => {
  assert.ok(isConversationalTitle("I\u2019ve finished the audit"));
});

void test("isConversationalTitle: detects smart-quote don\u2019t prefix", () => {
  assert.ok(isConversationalTitle("I don\u2019t see any issues"));
});

void test("isConversationalTitle: detects smart-quote can\u2019t prefix", () => {
  assert.ok(isConversationalTitle("I can\u2019t find the source"));
});

void test("cleanArtifactTitle: falls back to type label for smart-quote conversational title", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "I\u2019m still only seeing the handoff sentence, not the actua...",
      type: "strategy_note",
    }),
    "Strategy Note",
  );
});

void test("cleanArtifactTitle: extracts heading from content for smart-quote title", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "I\u2019m still only seeing the handoff sentence",
      type: "strategy_note",
      content: "# Positioning Strategy\n\nDetails...",
    }),
    "Positioning Strategy",
  );
});

// ---------------------------------------------------------------------------
// isConversationalTitle — summary-specific conversational detection
// ---------------------------------------------------------------------------

void test("isConversationalTitle: detects conversational summary 'I still can't see...'", () => {
  assert.ok(
    isConversationalTitle(
      "I still can't see the earlier positioning itself — only the handoff line. So rather than block you again, here's the use...",
    ),
  );
});

void test("isConversationalTitle: detects conversational summary 'I still don't have...'", () => {
  assert.ok(
    isConversationalTitle(
      "I still don't have the actual positioning thread — only the quoted carry-over line...",
    ),
  );
});

void test("isConversationalTitle: detects conversational summary 'I'm still only seeing...'", () => {
  assert.ok(
    isConversationalTitle(
      "I'm still only seeing the handoff sentence, not the actual positioning...",
    ),
  );
});

void test("isConversationalTitle: accepts descriptive summary 'Comprehensive analysis of...'", () => {
  assert.ok(!isConversationalTitle("Comprehensive analysis of market positioning"));
});

void test("isConversationalTitle: accepts descriptive summary 'Top 5 recommendations...'", () => {
  assert.ok(!isConversationalTitle("Top 5 recommendations for improving brand awareness"));
});

// ---------------------------------------------------------------------------
// Impersonal AI preamble detection (task 0032)
// ---------------------------------------------------------------------------

void test("isConversationalTitle: detects 'Based on' preamble", () => {
  assert.ok(isConversationalTitle("Based on the market notes in this workspace, your top com..."));
});

void test("isConversationalTitle: detects 'According to' preamble", () => {
  assert.ok(isConversationalTitle("According to the latest data, your positioning is strong"));
});

void test("isConversationalTitle: detects 'After reviewing' preamble", () => {
  assert.ok(isConversationalTitle("After reviewing your homepage copy, here are the issues"));
});

void test("isConversationalTitle: detects 'After analyzing' preamble", () => {
  assert.ok(isConversationalTitle("After analyzing the competitor landscape, three gaps emerge"));
});

void test("isConversationalTitle: detects 'Looking at' preamble", () => {
  assert.ok(isConversationalTitle("Looking at the brand guidelines, I see several issues"));
});

void test("isConversationalTitle: detects 'From the' preamble", () => {
  assert.ok(isConversationalTitle("From the data provided, engagement metrics are declining"));
});

void test("isConversationalTitle: detects 'From my' preamble", () => {
  assert.ok(isConversationalTitle("From my analysis, the strongest positioning angle is"));
});

void test("isConversationalTitle: detects 'Given' preamble", () => {
  assert.ok(isConversationalTitle("Given your current market position, I recommend"));
});

void test("isConversationalTitle: detects 'Pulling' preamble", () => {
  assert.ok(isConversationalTitle("Pulling the site copy to ground recommendations"));
});

void test("isConversationalTitle: detects 'Checking' preamble", () => {
  assert.ok(isConversationalTitle("Checking the latest analytics data now"));
});

void test("isConversationalTitle: detects 'Reviewing' preamble", () => {
  assert.ok(isConversationalTitle("Reviewing your brand guidelines for consistency"));
});

void test("isConversationalTitle: detects 'Analyzing' preamble", () => {
  assert.ok(isConversationalTitle("Analyzing competitor messaging across channels"));
});

void test("isConversationalTitle: detects 'To help' preamble", () => {
  assert.ok(isConversationalTitle("To help with your launch, here's a timeline"));
});

void test("isConversationalTitle: detects 'In order to' preamble", () => {
  assert.ok(isConversationalTitle("In order to improve SEO, you should focus on"));
});

void test("isConversationalTitle: detects 'For this' preamble", () => {
  assert.ok(isConversationalTitle("For this analysis, I focused on direct competitors"));
});

void test("isConversationalTitle: detects 'For your' preamble", () => {
  assert.ok(isConversationalTitle("For your review, the updated copy deck is attached"));
});

void test("isConversationalTitle: detects 'As requested' preamble", () => {
  assert.ok(isConversationalTitle("As requested, the competitive matrix is ready"));
});

void test("cleanArtifactTitle: falls back to type label for 'Based on' preamble", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "Based on the market notes in this workspace, your top com...",
      type: "competitor_matrix",
    }),
    "Competitor Matrix",
  );
});

void test("cleanArtifactTitle: extracts heading for 'Based on' title with content", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "Based on the market notes in this workspace",
      type: "research_brief",
      content: "# Top Competitors Analysis\n\nHere are the findings...",
    }),
    "Top Competitors Analysis",
  );
});

// ---------------------------------------------------------------------------
// "Saved " and "Short answer" preamble detection (task 0021)
// ---------------------------------------------------------------------------

void test("isConversationalTitle: detects 'Saved ' preamble", () => {
  assert.ok(isConversationalTitle("Saved the audit here:"));
});

void test("isConversationalTitle: detects 'Short answer' preamble", () => {
  assert.ok(isConversationalTitle("Short answer: the real competitive set"));
});

void test("cleanArtifactTitle: falls back to type label for 'Saved ' preamble", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "Saved the audit here:",
      type: "strategy_note",
    }),
    "Strategy Note",
  );
});

void test("cleanArtifactTitle: falls back to type label for 'Short answer' preamble", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "Short answer: the real competitive set",
      type: "matrix",
    }),
    "Matrix",
  );
});

// ---------------------------------------------------------------------------
// Content heading fallback skips conversational headings (task 0021)
// ---------------------------------------------------------------------------

void test("cleanArtifactTitle: skips conversational content heading and uses next non-conversational heading", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "I still don't have the actual positioning thread 130",
      type: "page_outline",
      content: "## I'll start with the overview\n\nSome text\n\n## Positioning Page Outline\n\nDetails...",
    }),
    "Positioning Page Outline",
  );
});

void test("cleanArtifactTitle: falls back to type label when all content headings are conversational", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "I still don't have the actual positioning thread",
      type: "strategy_note",
      content: "## I'll start with the overview\n\nSome text\n\n## Here is what I found\n\nMore text",
    }),
    "Strategy Note",
  );
});

// ---------------------------------------------------------------------------
// Leading list numbering stripping (task 0021)
// ---------------------------------------------------------------------------

void test("cleanArtifactTitle: strips leading '1) ' numbering from title", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "1) Rewritten Free vs Pro feature matrix",
      type: "matrix",
    }),
    "Rewritten Free vs Pro feature matrix",
  );
});

void test("cleanArtifactTitle: strips leading '2. ' numbering from title", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "2. Updated homepage hero copy",
      type: "copy_draft",
    }),
    "Updated homepage hero copy",
  );
});

void test("cleanArtifactTitle: strips leading '10) ' numbering from title", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "10) Competitive analysis summary",
      type: "research_brief",
    }),
    "Competitive analysis summary",
  );
});

void test("cleanArtifactTitle: does not strip numbering from mid-title", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "Top 5 recommendations for SEO",
      type: "strategy_note",
    }),
    "Top 5 recommendations for SEO",
  );
});

// ---------------------------------------------------------------------------
// Trailing colon stripping (task 0021)
// ---------------------------------------------------------------------------

void test("cleanArtifactTitle: strips trailing colon from title", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "Biggest SEO opportunities for BullAware are:",
      type: "strategy_note",
    }),
    "Biggest SEO opportunities for BullAware are",
  );
});

void test("cleanArtifactTitle: strips trailing colon with whitespace from title", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "Key findings from the audit:  ",
      type: "report",
    }),
    "Key findings from the audit",
  );
});

void test("cleanArtifactTitle: does not strip colon from mid-title", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "SEO Audit: Key Findings",
      type: "report",
    }),
    "SEO Audit: Key Findings",
  );
});

// ---------------------------------------------------------------------------
// Type-label echo detection (task 0021)
// ---------------------------------------------------------------------------

void test("cleanArtifactTitle: returns true for titleMatchesType when title equals type label", () => {
  // "Matrix" title with type "matrix" → label is "Matrix" → matches
  const title = cleanArtifactTitle({ title: "Matrix", type: "matrix" });
  assert.equal(title, "Matrix");
});

void test("cleanArtifactTitle: combined — strips numbering AND trailing colon", () => {
  assert.equal(
    cleanArtifactTitle({
      title: "3) Key takeaways:",
      type: "strategy_note",
    }),
    "Key takeaways",
  );
});
