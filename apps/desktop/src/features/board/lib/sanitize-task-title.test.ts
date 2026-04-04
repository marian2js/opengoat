import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeTaskTitle } from "./sanitize-task-title.js";

// ---------------------------------------------------------------------------
// Conversational prefix stripping
// ---------------------------------------------------------------------------

test("strips 'I'm' prefix and gerund process-description fully", () => {
  assert.equal(
    sanitizeTaskTitle("I'm pulling the site copy/source so the recommendations are grounded"),
    "Site copy/source",
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

test("strips 'Got it' prefix and nested gerund", () => {
  assert.equal(
    sanitizeTaskTitle("Got it, reviewing the brand guidelines now"),
    "Brand guidelines now",
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

test("handles case-insensitive prefix matching and strips nested gerund", () => {
  assert.equal(
    sanitizeTaskTitle("i'm working on the SEO audit"),
    "SEO audit",
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

test("strips smart-quote I\u2019m prefix and gerund process-description fully", () => {
  assert.equal(
    sanitizeTaskTitle("I\u2019m pulling the site copy/source so the recommendations are grounded"),
    "Site copy/source",
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

// ---------------------------------------------------------------------------
// Gerund process-description stripping (task 0032)
// ---------------------------------------------------------------------------

test("strips 'Pulling' gerund prefix", () => {
  assert.equal(
    sanitizeTaskTitle("Pulling the latest analytics data for review"),
    "Latest analytics data for review",
  );
});

test("strips 'Checking' gerund prefix", () => {
  assert.equal(
    sanitizeTaskTitle("Checking the competitor sites for pricing info"),
    "Competitor sites for pricing info",
  );
});

test("strips 'Looking' gerund prefix", () => {
  assert.equal(
    sanitizeTaskTitle("Looking at the homepage for copy issues"),
    "Homepage for copy issues",
  );
});

test("strips 'Reviewing' gerund prefix", () => {
  assert.equal(
    sanitizeTaskTitle("Reviewing the brand guidelines now"),
    "Brand guidelines now",
  );
});

test("strips 'Analyzing' gerund prefix", () => {
  assert.equal(
    sanitizeTaskTitle("Analyzing competitor messaging across channels"),
    "Competitor messaging across channels",
  );
});

test("strips 'Working on' gerund prefix", () => {
  assert.equal(
    sanitizeTaskTitle("Working on the SEO recommendations"),
    "SEO recommendations",
  );
});

test("strips 'Going to' gerund prefix", () => {
  assert.equal(
    sanitizeTaskTitle("Going to draft the email sequence now"),
    "Draft the email sequence now",
  );
});

test("strips 'Trying to' gerund prefix", () => {
  assert.equal(
    sanitizeTaskTitle("Trying to find the best positioning angle"),
    "Find the best positioning angle",
  );
});

test("strips 'Getting' gerund prefix", () => {
  assert.equal(
    sanitizeTaskTitle("Getting the latest data from your analytics"),
    "Latest data from your analytics",
  );
});

test("strips 'Running' gerund prefix", () => {
  assert.equal(
    sanitizeTaskTitle("Running a quick audit of the landing page"),
    "Quick audit of the landing page",
  );
});

test("strips 'Building' gerund prefix", () => {
  assert.equal(
    sanitizeTaskTitle("Building the competitor comparison matrix"),
    "Competitor comparison matrix",
  );
});

test("strips 'Creating' gerund prefix", () => {
  assert.equal(
    sanitizeTaskTitle("Creating a draft of the launch announcement"),
    "Draft of the launch announcement",
  );
});

test("strips 'Drafting' gerund prefix", () => {
  assert.equal(
    sanitizeTaskTitle("Drafting the email copy for the campaign"),
    "Email copy",
  );
});

test("strips 'Starting with' gerund prefix", () => {
  assert.equal(
    sanitizeTaskTitle("Starting with a review of the current messaging"),
    "Review of the current messaging",
  );
});

// ---------------------------------------------------------------------------
// Purpose-clause truncation (task 0033)
// ---------------------------------------------------------------------------

test("truncates at 'so the' purpose clause", () => {
  assert.equal(
    sanitizeTaskTitle("Pulling the site copy/source so the recommendations are more specific"),
    "Site copy/source",
  );
});

test("truncates at 'so that' purpose clause", () => {
  assert.equal(
    sanitizeTaskTitle("Checking competitor pages so that we can compare positioning"),
    "Competitor pages",
  );
});

test("truncates at 'because' purpose clause", () => {
  assert.equal(
    sanitizeTaskTitle("Getting the pricing data because we need to benchmark"),
    "Pricing data",
  );
});

test("truncates at 'in order to' purpose clause", () => {
  assert.equal(
    sanitizeTaskTitle("Reviewing the SEO metrics in order to prioritize fixes"),
    "SEO metrics",
  );
});

test("truncates at 'for the' purpose clause", () => {
  assert.equal(
    sanitizeTaskTitle("Building the comparison matrix for the executive presentation"),
    "Comparison matrix",
  );
});

test("truncates at 'to make' purpose clause", () => {
  assert.equal(
    sanitizeTaskTitle("Analyzing the homepage copy to make it more compelling"),
    "Homepage copy",
  );
});

test("truncates at 'to ensure' purpose clause", () => {
  assert.equal(
    sanitizeTaskTitle("Checking the launch checklist to ensure nothing is missed"),
    "Launch checklist",
  );
});

test("does not truncate when purpose clause is too early (< 10 chars)", () => {
  assert.equal(
    sanitizeTaskTitle("Fix it so the tests pass"),
    "Fix it so the tests pass",
  );
});

test("does not truncate titles without purpose clauses", () => {
  assert.equal(
    sanitizeTaskTitle("Competitive messaging analysis across channels"),
    "Competitive messaging analysis across channels",
  );
});

test("truncates at 'so we' purpose clause", () => {
  assert.equal(
    sanitizeTaskTitle("Pulling the analytics data so we can see the trends"),
    "Analytics data",
  );
});
