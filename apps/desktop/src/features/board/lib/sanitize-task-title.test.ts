import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeTaskTitle } from "./sanitize-task-title.js";

// ---------------------------------------------------------------------------
// Conversational prefix stripping
// ---------------------------------------------------------------------------

test("strips 'I'm' prefix and capitalizes", () => {
  assert.equal(
    sanitizeTaskTitle("I'm pulling the site copy/source so the recommendations are grounded"),
    "Pulling the site copy/source so the recommendations are grounded",
  );
});

test("strips 'Let me' prefix and capitalizes", () => {
  assert.equal(
    sanitizeTaskTitle("Let me look at what competitors are saying about positioning"),
    "Look at what competitors are saying about positioning",
  );
});

test("strips 'I'll' prefix and capitalizes", () => {
  assert.equal(
    sanitizeTaskTitle("I'll start by putting together a launch plan for Product Hunt"),
    "Start by putting together a launch plan for Product Hunt",
  );
});

test("strips 'I will' prefix and capitalizes", () => {
  assert.equal(
    sanitizeTaskTitle("I will analyze the current homepage messaging"),
    "Analyze the current homepage messaging",
  );
});

test("strips 'Sure,' prefix and capitalizes", () => {
  assert.equal(
    sanitizeTaskTitle("Sure, I can draft that email sequence"),
    "Draft that email sequence",
  );
});

test("strips 'OK,' prefix and capitalizes", () => {
  assert.equal(
    sanitizeTaskTitle("OK, here's the competitive analysis"),
    "Competitive analysis",
  );
});

test("strips 'Got it' prefix and capitalizes", () => {
  assert.equal(
    sanitizeTaskTitle("Got it, reviewing the brand guidelines now"),
    "Reviewing the brand guidelines now",
  );
});

test("strips 'Here is' prefix and capitalizes", () => {
  assert.equal(
    sanitizeTaskTitle("Here is a draft of the landing page copy"),
    "Draft of the landing page copy",
  );
});

test("strips 'Here's' prefix and capitalizes", () => {
  assert.equal(
    sanitizeTaskTitle("Here's the updated tagline options"),
    "Updated tagline options",
  );
});

// ---------------------------------------------------------------------------
// Case-insensitivity
// ---------------------------------------------------------------------------

test("handles case-insensitive prefix matching", () => {
  assert.equal(
    sanitizeTaskTitle("i'm working on the SEO audit"),
    "Working on the SEO audit",
  );
});

// ---------------------------------------------------------------------------
// Non-conversational titles pass through
// ---------------------------------------------------------------------------

test("preserves clean action-oriented titles", () => {
  assert.equal(
    sanitizeTaskTitle("Review and apply homepage copy recommendations"),
    "Review and apply homepage copy recommendations",
  );
});

test("preserves titles starting with a verb", () => {
  assert.equal(
    sanitizeTaskTitle("Analyze competitor messaging for positioning"),
    "Analyze competitor messaging for positioning",
  );
});

test("preserves titles starting with a noun", () => {
  assert.equal(
    sanitizeTaskTitle("Product Hunt launch sequence draft"),
    "Product Hunt launch sequence draft",
  );
});

// ---------------------------------------------------------------------------
// Markdown stripping
// ---------------------------------------------------------------------------

test("strips markdown bold from titles", () => {
  assert.equal(
    sanitizeTaskTitle("**Homepage Copy** recommendations"),
    "Homepage Copy recommendations",
  );
});

test("strips markdown heading syntax", () => {
  assert.equal(
    sanitizeTaskTitle("## SEO Audit Results"),
    "SEO Audit Results",
  );
});

// ---------------------------------------------------------------------------
// Truncation at sentence boundary
// ---------------------------------------------------------------------------

test("truncates at sentence boundary for long titles", () => {
  const long = "Review the homepage messaging for clarity and alignment with brand positioning. Then draft three alternative taglines for A/B testing.";
  const result = sanitizeTaskTitle(long);
  assert.equal(result, "Review the homepage messaging for clarity and alignment with brand positioning.");
});

test("hard truncates at 80 chars when no sentence boundary", () => {
  const long = "Analyze the competitive landscape including direct and indirect competitors across all market segments and geographies to identify positioning opportunities";
  const result = sanitizeTaskTitle(long);
  assert.ok(result.length <= 83); // 80 + "..."
  assert.ok(result.endsWith("..."));
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("handles empty string gracefully", () => {
  assert.equal(sanitizeTaskTitle(""), "");
});

test("handles whitespace-only string", () => {
  assert.equal(sanitizeTaskTitle("   "), "");
});

test("strips nested conversational prefix after 'Sure,'", () => {
  assert.equal(
    sanitizeTaskTitle("Sure, let me draft that email sequence"),
    "Draft that email sequence",
  );
});

test("strips nested conversational prefix after 'OK,'", () => {
  assert.equal(
    sanitizeTaskTitle("OK, I'll put together the launch plan"),
    "Put together the launch plan",
  );
});

// ---------------------------------------------------------------------------
// Smart quote (Unicode U+2019) support
// ---------------------------------------------------------------------------

test("strips smart-quote I\u2019m prefix and capitalizes", () => {
  assert.equal(
    sanitizeTaskTitle("I\u2019m pulling the site copy/source so the recommendations are grounded"),
    "Pulling the site copy/source so the recommendations are grounded",
  );
});

test("strips smart-quote I\u2019ll prefix and capitalizes", () => {
  assert.equal(
    sanitizeTaskTitle("I\u2019ll start by putting together a launch plan for Product Hunt"),
    "Start by putting together a launch plan for Product Hunt",
  );
});

test("strips smart-quote I\u2019ve prefix", () => {
  assert.equal(
    sanitizeTaskTitle("I\u2019ve finished the competitive analysis"),
    "Finished the competitive analysis",
  );
});

test("strips smart-quote don\u2019t prefix", () => {
  assert.equal(
    sanitizeTaskTitle("I don\u2019t see any major issues with the copy"),
    "See any major issues with the copy",
  );
});

test("strips nested smart-quote prefix after 'OK,'", () => {
  assert.equal(
    sanitizeTaskTitle("OK, I\u2019ll put together the launch plan"),
    "Put together the launch plan",
  );
});
