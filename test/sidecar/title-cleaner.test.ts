import { describe, expect, it } from "vitest";
import {
  isConversationalTitle,
  cleanSectionTitle,
} from "../../packages/sidecar/src/artifact-extractor/title-cleaner.ts";

// ---------------------------------------------------------------------------
// isConversationalTitle
// ---------------------------------------------------------------------------
describe("isConversationalTitle", () => {
  it("detects first-person openers", () => {
    expect(isConversationalTitle("I can sharpen it, but I need the raw material first.")).toBe(true);
    expect(isConversationalTitle("I'll create a comprehensive analysis for you")).toBe(true);
    expect(isConversationalTitle("I'm going to break this down")).toBe(true);
    expect(isConversationalTitle("I've put together the following")).toBe(true);
    expect(isConversationalTitle("I don't think that's the right angle")).toBe(true);
  });

  it("detects affirmative openers", () => {
    expect(isConversationalTitle("Absolutely — here's the continuation as a clean handoff.")).toBe(true);
    expect(isConversationalTitle("Sure, here's what I found")).toBe(true);
    expect(isConversationalTitle("OK so let me break this down")).toBe(true);
    expect(isConversationalTitle("Got it, let me work on that")).toBe(true);
  });

  it("detects 'Here's' openers", () => {
    expect(isConversationalTitle("Here's a structured readout of the main messaging gaps")).toBe(true);
    expect(isConversationalTitle("Here are the key competitors")).toBe(true);
  });

  it("detects 'Assuming' and analytical openers", () => {
    expect(isConversationalTitle("Assuming you mean Bullaware as a B2B SaaS intelligence")).toBe(true);
    expect(isConversationalTitle("Based on your product and ICP")).toBe(true);
    expect(isConversationalTitle("Looking at the broader market")).toBe(true);
    expect(isConversationalTitle("After reviewing the data")).toBe(true);
  });

  it("detects filler/transition openers", () => {
    expect(isConversationalTitle("Well here's what I think")).toBe(true);
    expect(isConversationalTitle("So the key takeaway is")).toBe(true);
    expect(isConversationalTitle("Let me walk through this")).toBe(true);
  });

  it("does NOT flag descriptive artifact titles", () => {
    expect(isConversationalTitle("Competitor Messaging Matrix")).toBe(false);
    expect(isConversationalTitle("Hero Rewrite Options")).toBe(false);
    expect(isConversationalTitle("Cold Email Sequence")).toBe(false);
    expect(isConversationalTitle("Launch Checklist")).toBe(false);
    expect(isConversationalTitle("Market Intel: Messaging Gap Analysis")).toBe(false);
    expect(isConversationalTitle("Community Shortlist")).toBe(false);
    expect(isConversationalTitle("CTA Options")).toBe(false);
  });

  it("handles smart quotes (Unicode curly apostrophes)", () => {
    expect(isConversationalTitle("Here\u2019s a quick summary")).toBe(true);
    expect(isConversationalTitle("I\u2019ll put together the analysis")).toBe(true);
    expect(isConversationalTitle("I\u2019ve compiled the data")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cleanSectionTitle
// ---------------------------------------------------------------------------
describe("cleanSectionTitle", () => {
  it("returns the heading as-is when it is not conversational", () => {
    expect(cleanSectionTitle("Competitor Messaging Matrix", "some content", "matrix")).toBe(
      "Competitor Messaging Matrix",
    );
  });

  it("strips markdown bold from non-conversational headings", () => {
    expect(cleanSectionTitle("**Hero Rewrite Options**", "some content", "copy_draft")).toBe(
      "Hero Rewrite Options",
    );
  });

  it("falls back to first content heading when section heading is conversational", () => {
    const content = `This is some intro text.

### Messaging Gap Analysis

Here's the detailed breakdown of gaps in competitor messaging...
More content about the analysis with details and findings.`;

    expect(
      cleanSectionTitle(
        "Here's a structured readout of the main messaging gaps",
        content,
        "matrix",
      ),
    ).toBe("Messaging Gap Analysis");
  });

  it("falls back to humanized artifact type when no content heading exists", () => {
    const content =
      "A detailed list of competitors with positioning, claims, and weaknesses compared to your product.";

    expect(
      cleanSectionTitle(
        "Absolutely — here's the continuation as a clean handoff.",
        content,
        "matrix",
      ),
    ).toBe("Matrix");
  });

  it("handles artifact types with underscores (e.g. copy_draft → Copy Draft)", () => {
    const content = "Some plain content without any headings at all, just text.";

    expect(
      cleanSectionTitle("I can sharpen it, but I need the raw material first.", content, "copy_draft"),
    ).toBe("Copy Draft");
  });

  it("skips conversational content headings and falls back to type", () => {
    const content = `### I'll start with the overview

Here's what I found when analyzing the competitive landscape...
The data shows some interesting patterns across all segments.`;

    expect(
      cleanSectionTitle(
        "Sure, let me walk you through this",
        content,
        "research_brief",
      ),
    ).toBe("Research Brief");
  });

  it("strips markdown from extracted content heading", () => {
    const content = `### **Launch Audience Breakdown**

1. Developer communities — Reddit, HN, Dev.to
2. SaaS founders — IndieHackers, Twitter
3. Product managers — ProductHunt, specialized Slack groups`;

    expect(
      cleanSectionTitle("Here are my recommendations for your launch", content, "dataset_list"),
    ).toBe("Launch Audience Breakdown");
  });

  it("prefers first non-conversational heading from content", () => {
    const content = `Some intro text here.

### Competitor Positioning Matrix

| Competitor | Position | Claim |
|---|---|---|
| Acme | All-in-one | Speed |

### Additional Insights

More analysis below...`;

    expect(
      cleanSectionTitle(
        "Assuming you mean Bullaware as a B2B SaaS intelligence",
        content,
        "matrix",
      ),
    ).toBe("Competitor Positioning Matrix");
  });
});
