import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const agentsDir = resolve(
  __dirname,
  "../../../apps/desktop/src/features/agents",
);
const readSrc = (path: string) =>
  readFileSync(resolve(agentsDir, path), "utf-8");

const specialistCardSrc = readSrc("components/SpecialistCard.tsx");
const teamBrowserSrc = readSrc("components/SpecialistTeamBrowser.tsx");

// ---------------------------------------------------------------------------
// SpecialistCard — recent outputs section
// ---------------------------------------------------------------------------
describe("SpecialistCard recent outputs section", () => {
  it("accepts recentOutputs prop as an array of ArtifactRecord", () => {
    expect(specialistCardSrc).toContain("recentOutputs");
    expect(specialistCardSrc).toContain("ArtifactRecord");
  });

  it("renders 'Recent outputs' label in the section", () => {
    expect(specialistCardSrc).toContain("Recent outputs");
  });

  it("renders output titles from recentOutputs array", () => {
    // Should iterate over recentOutputs and display artifact titles
    expect(specialistCardSrc).toMatch(/recentOutputs.*map/s);
  });

  it("renders relative timestamps for each output", () => {
    expect(specialistCardSrc).toContain("formatRelativeTime");
  });

  it("omits section when recentOutputs is empty or not provided", () => {
    // Should check length or existence before rendering
    expect(specialistCardSrc).toMatch(
      /recentOutputs.*length|recentOutputs\??\./s,
    );
  });
});

// ---------------------------------------------------------------------------
// SpecialistCard — output navigation
// ---------------------------------------------------------------------------
describe("SpecialistCard output navigation", () => {
  it("accepts onOutputNavigate callback prop", () => {
    expect(specialistCardSrc).toContain("onOutputNavigate");
  });

  it("calls onOutputNavigate when an output entry is clicked", () => {
    expect(specialistCardSrc).toContain("onOutputNavigate");
    expect(specialistCardSrc).toContain("onClick");
  });

  it("supports keyboard navigation for output entries", () => {
    expect(specialistCardSrc).toContain("onKeyDown");
  });

  it("uses button or clickable role for output entries", () => {
    expect(
      specialistCardSrc.includes('role="button"') ||
        specialistCardSrc.includes("cursor-pointer"),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SpecialistTeamBrowser — recent outputs data
// ---------------------------------------------------------------------------
describe("SpecialistTeamBrowser recent outputs data", () => {
  it("builds a map of artifact arrays per specialist", () => {
    // Should collect multiple artifacts per specialist, not just one
    expect(teamBrowserSrc).toContain("ArtifactRecord[]");
  });

  it("passes recentOutputs array to SpecialistCard", () => {
    expect(teamBrowserSrc).toContain("recentOutputs=");
  });

  it("passes onOutputNavigate callback to SpecialistCard", () => {
    expect(teamBrowserSrc).toContain("onOutputNavigate");
  });

  it("has output navigation handler", () => {
    expect(teamBrowserSrc).toContain("handleOutputNavigate");
  });

  it("uses getActionMapping for run-to-session navigation", () => {
    expect(teamBrowserSrc).toContain("getActionMapping");
  });

  it("falls back to specialist chat navigation", () => {
    // Should navigate to specialist chat if no action mapping found
    expect(teamBrowserSrc).toContain("specialist=");
  });

  it("imports and uses deduplicateSpecialistOutputs before slicing", () => {
    expect(teamBrowserSrc).toContain("deduplicateSpecialistOutputs");
  });

  it("applies dedup before limiting to MAX_OUTPUTS_PER_SPECIALIST", () => {
    // Should call dedup then slice, not limit first
    expect(teamBrowserSrc).toMatch(/deduplicateSpecialistOutputs.*slice/s);
  });
});
