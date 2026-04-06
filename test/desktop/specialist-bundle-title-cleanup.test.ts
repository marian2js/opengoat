import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/agents/components/SpecialistCard.tsx"),
  "utf-8",
);

describe("SpecialistCard bundle title cleanup", () => {
  // Extract only the bundle rendering section (between bundles.map and outputs.map)
  const bundleStart = src.indexOf("bundles.map");
  const outputsStart = src.indexOf("outputs.map");
  const bundleSection = src.slice(bundleStart, outputsStart);

  it("bundle titles pass through cleanArtifactTitle", () => {
    expect(bundleSection).toContain("cleanArtifactTitle");
  });

  it("cleanArtifactTitle receives bundle.title for cleaning", () => {
    expect(bundleSection).toContain("bundle.title");
    expect(bundleSection).toContain("cleanArtifactTitle");
  });

  it("cleanArtifactTitle receives first artifact type for fallback", () => {
    expect(bundleSection).toContain("bundle.artifacts[0]?.type");
  });

  it("cleanArtifactTitle receives first artifact content for heading extraction", () => {
    expect(bundleSection).toContain("bundle.artifacts[0]?.content");
  });
});
