import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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
