import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/brain/components/BrainWorkspace.tsx"),
  "utf-8",
);

// Extract SECTION_CARD_PROSE_CLASSES value from the source
function getSectionCardProseClasses(): string {
  const start = src.indexOf("SECTION_CARD_PROSE_CLASSES");
  if (start === -1) return "";
  const eqSign = src.indexOf("=", start);
  const lineEnd = src.indexOf(";", eqSign);
  return src.slice(eqSign, lineEnd);
}

describe("Brain h3 sub-heading depth within section cards", () => {
  const proseClasses = getSectionCardProseClasses();

  // AC1: h3 sub-headings have visible top spacing and a subtle separator line
  it("applies a subtle top border to h3 elements", () => {
    expect(proseClasses).toMatch(/\[&_h3\]:border-t/);
  });

  it("uses a subtle border color with low opacity", () => {
    expect(proseClasses).toMatch(/\[&_h3\]:border-border\/\d/);
  });

  it("adds padding-top after the border for spacing", () => {
    expect(proseClasses).toMatch(/\[&_h3\]:pt-3/);
  });

  it("has sufficient top margin for visual grouping", () => {
    // mt-5 = 20px, provides clear separation from preceding content
    expect(proseClasses).toMatch(/\[&_h3\]:mt-5/);
  });

  // AC2: h3 text is clearly visually heavier than body text
  it("uses font-semibold or font-bold for visual weight", () => {
    expect(proseClasses).toMatch(/\[&_h3\]:font-(semibold|bold)/);
  });

  it("uses explicit foreground color for clarity", () => {
    expect(proseClasses).toMatch(/\[&_h3\]:text-foreground/);
  });

  // AC3: Sub-sections under each h3 form a visible group (bottom margin)
  it("has bottom margin to create space before sub-section content", () => {
    expect(proseClasses).toMatch(/\[&_h3\]:mb-2/);
  });

  // AC4: Works in both dark and light mode — prose-invert handles dark mode
  it("has dark mode prose-invert support", () => {
    expect(proseClasses).toContain("prose-invert");
  });

  // AC5: No changes to non-Brain pages — styling is within SECTION_CARD_PROSE_CLASSES
  it("h3 depth styling is scoped to SECTION_CARD_PROSE_CLASSES", () => {
    expect(proseClasses).toContain("[&_h3]:border-t");
  });
});
