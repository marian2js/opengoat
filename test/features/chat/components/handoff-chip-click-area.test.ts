import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceSrc = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../../apps/desktop/src/features/chat/components/ChatWorkspace.tsx",
  ),
  "utf-8",
);

const handoffChipSrc = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../../apps/desktop/src/features/chat/components/HandoffChip.tsx",
  ),
  "utf-8",
);

describe("handoff chip click area overlap fix", () => {
  describe("messages scroll area has sufficient bottom padding", () => {
    it("messages area uses pb-36 for bottom padding to clear the input bar", () => {
      // The messages scroll area must have generous bottom padding so that
      // handoff chips at the bottom of the last message sit well above the
      // input bar when scrolled to the bottom.
      expect(workspaceSrc).toContain("pb-36");
    });

    it("messages area does not use py-6 which provides insufficient bottom padding", () => {
      // The old py-6 (24px) was not enough — chips were covered by the input bar.
      // The scroll area should use separate pt-6 and pb-36 instead.
      const scrollAreaMatch = workspaceSrc.match(
        /className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto[^"]*"/,
      );
      expect(scrollAreaMatch).not.toBeNull();
      const className = scrollAreaMatch![0];
      // Should NOT have py-6 (which sets both top and bottom to 24px)
      expect(className).not.toContain("py-6");
      // Should have separate top and bottom padding
      expect(className).toContain("pt-6");
      expect(className).toContain("pb-36");
    });
  });

  describe("handoff chips wrapper has elevated z-index", () => {
    it("ChatHandoffChipsWrapper container has relative z-10", () => {
      // The handoff chips wrapper must have a higher z-index than the input
      // bar so that even if there is slight visual overlap, the chips are
      // clickable above the input bar.
      expect(workspaceSrc).toMatch(/relative z-10 space-y-0/);
    });
  });

  describe("handoff chip button is interactive", () => {
    it("HandoffChip renders a button element with onClick handler", () => {
      expect(handoffChipSrc).toContain("<button");
      expect(handoffChipSrc).toContain("onClick={handleClick}");
    });

    it("HandoffChip button has pointer-friendly styling", () => {
      // The button must be a full-width clickable area
      expect(handoffChipSrc).toMatch(/className="[^"]*w-full[^"]*"/);
    });
  });

  describe("scroll area still supports auto-scrolling", () => {
    it("messages area has overflow-y-auto for scrolling", () => {
      expect(workspaceSrc).toContain("overflow-y-auto");
    });

    it("auto-scroll calls scrollTo on the list ref", () => {
      expect(workspaceSrc).toContain("list.scrollTo(");
      expect(workspaceSrc).toContain("top: list.scrollHeight");
    });
  });
});
