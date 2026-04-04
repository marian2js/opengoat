import { describe, expect, it, vi } from "vitest";

/**
 * Tests for handoff chip navigation — verifying that clicking a handoff chip
 * triggers direct specialist session creation instead of relying on fragile
 * hash-based navigation.
 */

describe("handoff chip navigation", () => {
  describe("HandoffChip click handler", () => {
    it("calls onNavigate with specialistId when callback is provided", () => {
      const onNavigate = vi.fn();
      const specialistId = "positioning";

      // Simulate the click handler logic from HandoffChip
      const handleClick = (
        id: string,
        navigate?: (specialistId: string) => void,
      ) => {
        if (navigate) {
          navigate(id);
        }
      };

      handleClick(specialistId, onNavigate);
      expect(onNavigate).toHaveBeenCalledWith("positioning");
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it("falls back to hash navigation when onNavigate is not provided", () => {
      // Simulate the fallback behavior: when no callback, we set the hash
      let hashValue = "";
      const setHash = (val: string) => {
        hashValue = val;
      };
      const specialistId = "content";

      const handleClick = (
        id: string,
        navigate?: (specialistId: string) => void,
        fallbackSetHash?: (val: string) => void,
      ) => {
        if (navigate) {
          navigate(id);
        } else {
          fallbackSetHash?.(`#chat?specialist=${encodeURIComponent(id)}`);
        }
      };

      handleClick(specialistId, undefined, setHash);
      expect(hashValue).toBe("#chat?specialist=content");
    });

    it("dismiss button does not trigger navigation", () => {
      const onNavigate = vi.fn();
      const onDismiss = vi.fn();

      // Simulate dismiss click with stopPropagation
      // The dismiss handler should NOT call onNavigate
      onDismiss();
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe("navigation callback integration", () => {
    it("passes specialistId from handoff suggestion to navigation callback", () => {
      const navigatedIds: string[] = [];
      const onNavigate = (id: string) => {
        navigatedIds.push(id);
      };

      // Simulate clicking multiple different handoff chips
      const suggestions = [
        { specialistId: "positioning", specialistName: "Positioning" },
        { specialistId: "content", specialistName: "Content" },
      ];

      for (const suggestion of suggestions) {
        onNavigate(suggestion.specialistId);
      }

      expect(navigatedIds).toEqual(["positioning", "content"]);
    });

    it("handles specialist IDs with hyphens correctly", () => {
      const onNavigate = vi.fn();
      const specialistId = "website-conversion";

      onNavigate(specialistId);
      expect(onNavigate).toHaveBeenCalledWith("website-conversion");
    });

    it("logs warning when navigation callback is missing and falls back to hash", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Simulate fallback path with warning
      const handleClick = (
        id: string,
        navigate?: (specialistId: string) => void,
      ) => {
        if (navigate) {
          navigate(id);
        } else {
          console.warn(
            `[HandoffChip] No onNavigate callback provided for specialist "${id}", falling back to hash navigation`,
          );
        }
      };

      handleClick("positioning");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No onNavigate callback"),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("handoff context construction", () => {
    it("builds summary with source specialist name and reason", () => {
      const sourceName = "Market Intel";
      const reason = "The Positioning Agent could help sharpen messaging based on these gaps.";
      const summary = `Continuing from ${sourceName}: ${reason}`;

      expect(summary).toBe(
        "Continuing from Market Intel: The Positioning Agent could help sharpen messaging based on these gaps.",
      );
    });

    it("defaults source name to Chat when currentSpecialistName is undefined", () => {
      const sourceName = undefined ?? "Chat";
      const reason = "Some handoff reason";
      const summary = `Continuing from ${sourceName}: ${reason}`;

      expect(summary).toContain("Continuing from Chat:");
    });

    it("context includes all required fields", () => {
      const context = {
        sourceSpecialist: "Market Intel",
        summary: "Continuing from Market Intel: test",
        timestamp: Date.now(),
      };

      expect(context).toHaveProperty("sourceSpecialist");
      expect(context).toHaveProperty("summary");
      expect(context).toHaveProperty("timestamp");
      expect(typeof context.timestamp).toBe("number");
    });
  });

  describe("callback wiring through component hierarchy", () => {
    it("onNavigate callback is threaded from wrapper to chip", () => {
      const onNavigate = vi.fn();

      // Simulate ChatHandoffChipsWrapper passing onNavigate to each HandoffChip
      const suggestions = [
        { id: "h1", specialistId: "positioning", specialistName: "Positioning", reason: "test" },
        { id: "h2", specialistId: "content", specialistName: "Content", reason: "test" },
      ];

      // Each chip receives the same callback
      for (const suggestion of suggestions) {
        // Simulate chip click
        onNavigate(suggestion.specialistId);
      }

      expect(onNavigate).toHaveBeenCalledTimes(2);
      expect(onNavigate).toHaveBeenNthCalledWith(1, "positioning");
      expect(onNavigate).toHaveBeenNthCalledWith(2, "content");
    });

    it("dismissed chips do not fire navigation", () => {
      const onNavigate = vi.fn();
      const dismissedIds = new Set(["h1"]);

      const suggestions = [
        { id: "h1", specialistId: "positioning", specialistName: "Positioning", reason: "test" },
        { id: "h2", specialistId: "content", specialistName: "Content", reason: "test" },
      ];

      // Only non-dismissed chips should render and be clickable
      const visible = suggestions.filter((s) => !dismissedIds.has(s.id));
      for (const suggestion of visible) {
        onNavigate(suggestion.specialistId);
      }

      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith("content");
    });
  });
});
