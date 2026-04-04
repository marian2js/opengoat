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
