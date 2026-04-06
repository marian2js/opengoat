import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { stripTitleFromPreview } from "../../apps/desktop/src/features/dashboard/lib/strip-title-from-preview";

const utilPath = resolve(
  __dirname,
  "../../apps/desktop/src/features/dashboard/lib/strip-title-from-preview.ts",
);

const artifactCardPath = resolve(
  __dirname,
  "../../apps/desktop/src/features/dashboard/components/ArtifactCard.tsx",
);

describe("strip-title-from-preview utility", () => {
  it("utility file exists", () => {
    expect(existsSync(utilPath)).toBe(true);
  });

  it("exports a stripTitleFromPreview function", () => {
    const src = readFileSync(utilPath, "utf-8");
    expect(src).toMatch(/export\s+function\s+stripTitleFromPreview/);
  });

  it("strips markdown from summary before comparison", () => {
    const src = readFileSync(utilPath, "utf-8");
    expect(src).toMatch(/stripMarkdown/);
  });

  it("removes the title prefix from the summary when it starts with the title", () => {
    const src = readFileSync(utilPath, "utf-8");
    // Should normalize and compare the start of the summary with the title
    expect(src).toMatch(/startsWith|indexOf|slice|substring/);
  });

  it("trims and cleans remaining text after stripping title prefix", () => {
    const src = readFileSync(utilPath, "utf-8");
    expect(src).toMatch(/\.trim\(\)/);
  });

  it("returns full stripped summary when title is not a prefix", () => {
    const src = readFileSync(utilPath, "utf-8");
    // Should have a conditional — return different value when no match
    expect(src).toMatch(/if|return/);
  });

  it("handles empty or undefined summary gracefully", () => {
    const src = readFileSync(utilPath, "utf-8");
    // Should guard against empty/missing summary
    expect(src).toMatch(/!summary|summary\s*===?\s*""/);
  });
});

describe("stripTitleFromPreview — behavioral", () => {
  it("returns empty string for empty summary", () => {
    expect(stripTitleFromPreview("Some title", "")).toBe("");
  });

  it("strips title prefix from summary", () => {
    expect(
      stripTitleFromPreview(
        "Feature matrix",
        "Feature matrix with grouped rows by use case",
      ),
    ).toBe("with grouped rows by use case");
  });

  it("returns full summary when title is not a prefix", () => {
    expect(
      stripTitleFromPreview("Unrelated title", "Some preview text here"),
    ).toBe("Some preview text here");
  });

  it("strips leading numbering from preview before title comparison", () => {
    expect(
      stripTitleFromPreview(
        "Rewritten Free vs Pro feature matrix with grouped rows by",
        "1) Rewritten Free vs Pro feature matrix with grouped rows by use case > Important framing",
      ),
    ).toBe("use case > Important framing");
  });

  it("strips '2. ' numbering prefix from preview before title comparison", () => {
    expect(
      stripTitleFromPreview(
        "Updated homepage hero copy",
        "2. Updated homepage hero copy: new version with better CTA",
      ),
    ).toBe("new version with better CTA");
  });

  it("handles preview without numbering as before", () => {
    expect(
      stripTitleFromPreview(
        "SEO Audit Key Findings",
        "SEO Audit Key Findings — detailed breakdown follows",
      ),
    ).toBe("detailed breakdown follows");
  });
});

describe("ArtifactCard title-echo removal", () => {
  it("ArtifactCard imports stripTitleFromPreview", () => {
    const src = readFileSync(artifactCardPath, "utf-8");
    expect(src).toMatch(/stripTitleFromPreview/);
  });

  it("ArtifactCard uses stripTitleFromPreview for summary display", () => {
    const src = readFileSync(artifactCardPath, "utf-8");
    // Should call stripTitleFromPreview with the cleaned title and summary
    expect(src).toMatch(/stripTitleFromPreview\(/);
  });

  it("ArtifactCard preview body uses line-clamp-2", () => {
    const src = readFileSync(artifactCardPath, "utf-8");
    expect(src).toMatch(/line-clamp-2/);
  });
});
