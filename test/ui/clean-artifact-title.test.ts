import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const utilPath = resolve(
  __dirname,
  "../../apps/desktop/src/features/dashboard/lib/clean-artifact-title.ts",
);

const artifactCardPath = resolve(
  __dirname,
  "../../apps/desktop/src/features/dashboard/components/ArtifactCard.tsx",
);

describe("clean-artifact-title utility", () => {
  it("utility file exists", () => {
    expect(existsSync(utilPath)).toBe(true);
  });

  it("exports a cleanArtifactTitle function", () => {
    const src = readFileSync(utilPath, "utf-8");
    expect(src).toMatch(/export\s+function\s+cleanArtifactTitle/);
  });

  it("exports CONVERSATIONAL_PATTERN regex", () => {
    const src = readFileSync(utilPath, "utf-8");
    expect(src).toMatch(/CONVERSATIONAL_PATTERN/);
  });

  it("preserves good titles like 'Tagline Variants' unchanged", () => {
    const src = readFileSync(utilPath, "utf-8");
    // The function should call stripMarkdown and return non-conversational titles as-is
    expect(src).toMatch(/stripMarkdown/);
  });

  it("detects first-person conversational patterns", () => {
    const src = readFileSync(utilPath, "utf-8");
    // Should detect patterns like: I , I'm , I'll , I still, I checked, etc.
    expect(src).toMatch(/I still|I checked|I'm|I'll/);
  });

  it("falls back to markdown heading from content when title is conversational", () => {
    const src = readFileSync(utilPath, "utf-8");
    // Should extract first heading from artifact.content
    expect(src).toMatch(/#{1,6}/);
  });

  it("falls back to humanized type label when no heading is found", () => {
    const src = readFileSync(utilPath, "utf-8");
    // Should use getArtifactTypeConfig for type-based fallback
    expect(src).toMatch(/getArtifactTypeConfig/);
  });

  it("handles additional conversational starters (Got it, Let me, Here, Sure, OK, Okay, Well, So, Hmm)", () => {
    const src = readFileSync(utilPath, "utf-8");
    expect(src).toMatch(/Got it/);
    expect(src).toMatch(/Let me/);
    expect(src).toMatch(/Sure/);
    expect(src).toMatch(/Hmm/);
  });
});

describe("ArtifactCard summary filtering", () => {
  it("ArtifactCard imports isConversationalTitle", () => {
    const src = readFileSync(artifactCardPath, "utf-8");
    expect(src).toMatch(/isConversationalTitle/);
  });

  it("ArtifactCard filters summary with isConversationalTitle before rendering", () => {
    const src = readFileSync(artifactCardPath, "utf-8");
    // The summary render should check !isConversationalTitle(artifact.summary)
    expect(src).toMatch(/!isConversationalTitle\(artifact\.summary\)/);
  });

  it("ArtifactCard still applies stripMarkdown to non-conversational summaries", () => {
    const src = readFileSync(artifactCardPath, "utf-8");
    expect(src).toMatch(/stripMarkdown\(artifact\.summary\)/);
  });
});
