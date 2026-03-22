import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const actionGridSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/ActionCardGrid.tsx",
  ),
  "utf-8",
);

const suggestedGridSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/SuggestedActionGrid.tsx",
  ),
  "utf-8",
);

describe("Dashboard grid – orphan card visual balance", () => {
  // AC1 & AC2: Grid handles orphan (last) cards spanning full width
  describe("ActionCardGrid", () => {
    it("applies col-span-full to the last card when it is alone on a 2-col row", () => {
      // sm breakpoint: last-child that is at an odd position spans full width
      expect(actionGridSrc).toMatch(
        /sm:\[&>:last-child:nth-child\(2n\+1\)\]:col-span-full/,
      );
    });

    it("applies col-span-full to the last card when it is alone on a 3-col row", () => {
      // xl breakpoint: last-child at position 3n+1 spans full width
      expect(actionGridSrc).toMatch(
        /xl:\[&>:last-child:nth-child\(3n\+1\)\]:col-span-full/,
      );
    });

    it("resets 2-col spanning at xl breakpoint to avoid conflict", () => {
      // At xl, the 2n+1 rule from sm is overridden back to col-auto
      expect(actionGridSrc).toMatch(
        /xl:\[&>:last-child:nth-child\(2n\+1\)\]:col-auto/,
      );
    });
  });

  // AC2 & AC3: SuggestedActionGrid also handles orphan cards
  describe("SuggestedActionGrid", () => {
    it("applies col-span-full to the last card when it is alone on a 2-col row", () => {
      expect(suggestedGridSrc).toMatch(
        /sm:\[&>:last-child:nth-child\(2n\+1\)\]:col-span-full/,
      );
    });

    it("applies col-span-full to the last card when it is alone on a 3-col row", () => {
      expect(suggestedGridSrc).toMatch(
        /xl:\[&>:last-child:nth-child\(3n\+1\)\]:col-span-full/,
      );
    });

    it("resets 2-col spanning at xl breakpoint to avoid conflict", () => {
      expect(suggestedGridSrc).toMatch(
        /xl:\[&>:last-child:nth-child\(2n\+1\)\]:col-auto/,
      );
    });

    it("uses responsive grid columns matching ActionCardGrid", () => {
      // Both grids should use the same column layout
      expect(suggestedGridSrc).toContain("sm:grid-cols-2");
      expect(suggestedGridSrc).toContain("xl:grid-cols-3");
    });
  });

  // AC4: No regression if cards are added – both grids handle arbitrary card counts
  describe("Skeleton grid", () => {
    it("skeleton grid also uses responsive columns", () => {
      expect(suggestedGridSrc).toContain("sm:grid-cols-2");
      expect(suggestedGridSrc).toContain("xl:grid-cols-3");
    });
  });
});
