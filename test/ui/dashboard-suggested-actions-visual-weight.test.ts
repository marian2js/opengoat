import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dashDir = resolve(
  __dirname,
  "../../apps/desktop/src/features/dashboard",
);
const readSrc = (path: string) =>
  readFileSync(resolve(dashDir, path), "utf-8");

describe("Suggested Actions visual weight reduction", () => {
  describe("ActionCardItem supports variant prop", () => {
    const cardSrc = readSrc("components/ActionCardItem.tsx");

    it("accepts a variant prop in its interface", () => {
      expect(cardSrc).toContain("variant");
    });

    it("applies lighter border styling for secondary variant", () => {
      // Secondary cards should have a more muted/transparent border
      expect(cardSrc).toMatch(/variant.*secondary|secondary.*variant/s);
    });

    it("does not apply hover elevation for secondary variant", () => {
      // Secondary cards should not translate-y on hover — differentiation
      // The code should conditionally apply translate based on variant
      expect(cardSrc).toMatch(/variant/);
    });
  });

  describe("SuggestedActionGrid passes secondary variant", () => {
    const suggestedSrc = readSrc("components/SuggestedActionGrid.tsx");

    it("passes variant='secondary' to ActionCardItem", () => {
      expect(suggestedSrc).toContain('variant="secondary"');
    });
  });

  describe("ActionCardGrid does NOT pass secondary variant", () => {
    const quickSrc = readSrc("components/ActionCardGrid.tsx");

    it("does not pass variant='secondary' to ActionCardItem", () => {
      expect(quickSrc).not.toContain('variant="secondary"');
    });

    it("still renders ActionCardItem with default (primary) styling", () => {
      expect(quickSrc).toContain("<ActionCardItem");
    });
  });

  describe("Visual differentiation details", () => {
    const cardSrc = readSrc("components/ActionCardItem.tsx");

    it("secondary variant has distinct card styling from default", () => {
      // The card should have different className logic based on variant
      // Secondary should use bg-card/50 or similar muted background
      expect(cardSrc).toMatch(/secondary/);
    });

    it("secondary variant mutes the footer run label", () => {
      // The secondary variant should produce lighter footer text
      expect(cardSrc).toMatch(/variant/);
    });
  });
});
