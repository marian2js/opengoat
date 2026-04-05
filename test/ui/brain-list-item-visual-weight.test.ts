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

describe("Brain list item visual weight — bold lead text badges", () => {
  const proseClasses = getSectionCardProseClasses();

  // AC1: Bold lead text in bullet items renders with a subtle background chip
  it("applies background to first strong element in list items", () => {
    expect(proseClasses).toMatch(
      /\[&_li>strong:first-child\]:bg-muted/,
    );
  });

  it("applies rounded corners to first strong element in list items", () => {
    expect(proseClasses).toMatch(
      /\[&_li>strong:first-child\]:rounded/,
    );
  });

  it("applies horizontal padding to first strong element in list items", () => {
    expect(proseClasses).toMatch(
      /\[&_li>strong:first-child\]:px-1/,
    );
  });

  it("applies vertical padding to first strong element in list items", () => {
    expect(proseClasses).toMatch(
      /\[&_li>strong:first-child\]:py-0/,
    );
  });

  // AC2: Only the first strong per li is styled (the selector itself enforces this)
  it("targets only first-child strong, not all strong elements", () => {
    expect(proseClasses).toContain("li>strong:first-child");
    // Should NOT have a generic strong badge (that would hit all bold text)
    expect(proseClasses).not.toMatch(
      /\[&_strong\]:bg-muted/,
    );
  });

  // AC3: Works in dark and light mode — muted is theme-aware
  it("uses theme-aware muted color for the badge background", () => {
    expect(proseClasses).toMatch(
      /\[&_li>strong:first-child\]:bg-muted/,
    );
  });

  // AC4: Styling is subtle — uses opacity modifier on bg
  it("uses an opacity modifier for subtle background", () => {
    expect(proseClasses).toMatch(
      /\[&_li>strong:first-child\]:bg-muted\/\d/,
    );
  });

  // AC5: No changes outside Brain — we only modify SECTION_CARD_PROSE_CLASSES
  it("the badge styling lives within SECTION_CARD_PROSE_CLASSES", () => {
    expect(proseClasses).toContain("[&_li>strong:first-child]");
  });
});
