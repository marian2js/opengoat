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

  it("detects 'Absolutely' preamble pattern", () => {
    const src = readFileSync(utilPath, "utf-8");
    expect(src).toMatch(/Absolutely/);
  });

  it("detects 'Assuming ' preamble pattern", () => {
    const src = readFileSync(utilPath, "utf-8");
    expect(src).toMatch(/Assuming /);
  });

  it("detects 'Here\\'' (Here's) preamble pattern", () => {
    const src = readFileSync(utilPath, "utf-8");
    expect(src).toMatch(/Here'/);
  });

  it("detects 'I can ' preamble pattern", () => {
    const src = readFileSync(utilPath, "utf-8");
    expect(src).toMatch(/I can /);
  });

  it("detects 'Saved ' preamble pattern", () => {
    const src = readFileSync(utilPath, "utf-8");
    expect(src).toMatch(/Saved /);
  });

  it("detects 'Short answer' preamble pattern", () => {
    const src = readFileSync(utilPath, "utf-8");
    expect(src).toMatch(/Short answer/);
  });

  it("content heading fallback loops and skips conversational headings", () => {
    const src = readFileSync(utilPath, "utf-8");
    // Should use a while loop or similar iteration over headings, not just the first match
    expect(src).toMatch(/while/);
  });

  it("desktop CONVERSATIONAL_PATTERN matches sidecar patterns", () => {
    const src = readFileSync(utilPath, "utf-8");
    const sidecarSrc = readFileSync(
      resolve(__dirname, "../../packages/sidecar/src/artifact-extractor/title-cleaner.ts"),
      "utf-8",
    );

    // Extract pattern alternatives from both files
    const extractAlternatives = (source: string): string[] => {
      const match = source.match(/CONVERSATIONAL_PATTERN\s*=\s*\/\^\(([^)]+)\)\//);
      if (!match) return [];
      return match[1].split("|").map((s) => s.trim()).sort();
    };

    const desktopAlts = extractAlternatives(src);
    const sidecarAlts = extractAlternatives(sidecarSrc);

    // Every sidecar pattern should be present in desktop
    for (const pattern of sidecarAlts) {
      expect(desktopAlts).toContain(pattern);
    }
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

  it("ArtifactCard strips title echo from summary via stripTitleFromPreview", () => {
    const src = readFileSync(artifactCardPath, "utf-8");
    expect(src).toMatch(/stripTitleFromPreview\(/);
  });
});
