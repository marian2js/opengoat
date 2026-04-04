import { describe, expect, it } from "vitest";
import { detectHandoffSuggestions } from "../../../../apps/desktop/src/features/chat/lib/handoff-detector";

/**
 * Tests for the handoff chip rendering pipeline.
 *
 * The detection logic (detectHandoffSuggestions) works correctly in isolation,
 * but HandoffChip components never appear in the DOM. This test suite verifies
 * the guard conditions and rendering logic that controls when chips display.
 */

// ── Simulated guard logic (mirrors ChatMessage's shouldDetect) ──

function shouldDetect(params: {
  role: string;
  isLastAssistant: boolean;
  isStreaming: boolean;
  fullTextLength: number;
}): boolean {
  return (
    params.role === "assistant" &&
    Boolean(params.isLastAssistant) &&
    !params.isStreaming &&
    params.fullTextLength > 0
  );
}

describe("handoff chip rendering pipeline", () => {
  const MARKET_INTEL_RESPONSE = `## Competitive Landscape

Here's what I found about competitors in the SaaS intelligence space.

### My take: the single biggest opening
The strongest wedge is probably a deeper intelligence layer.

### Actionable next step
The Positioning Agent could help sharpen messaging based on these gaps.

If you want, I can do the next layer and turn this into one of these:
- a Bullseye positioning statement + homepage angle
- a clarified focused only on messaging gaps and wedge claims`;

  describe("shouldDetect guard conditions", () => {
    it("returns true for last assistant message after streaming completes", () => {
      expect(
        shouldDetect({
          role: "assistant",
          isLastAssistant: true,
          isStreaming: false,
          fullTextLength: MARKET_INTEL_RESPONSE.length,
        }),
      ).toBe(true);
    });

    it("returns false during streaming", () => {
      expect(
        shouldDetect({
          role: "assistant",
          isLastAssistant: true,
          isStreaming: true,
          fullTextLength: MARKET_INTEL_RESPONSE.length,
        }),
      ).toBe(false);
    });

    it("returns false for non-last assistant message", () => {
      expect(
        shouldDetect({
          role: "assistant",
          isLastAssistant: false,
          isStreaming: false,
          fullTextLength: MARKET_INTEL_RESPONSE.length,
        }),
      ).toBe(false);
    });

    it("returns false for user messages", () => {
      expect(
        shouldDetect({
          role: "user",
          isLastAssistant: true,
          isStreaming: false,
          fullTextLength: 100,
        }),
      ).toBe(false);
    });

    it("returns false for empty text", () => {
      expect(
        shouldDetect({
          role: "assistant",
          isLastAssistant: true,
          isStreaming: false,
          fullTextLength: 0,
        }),
      ).toBe(false);
    });
  });

  describe("detection on realistic Market Intel response", () => {
    it("detects Positioning handoff from Market Intel response", () => {
      const suggestions = detectHandoffSuggestions(
        MARKET_INTEL_RESPONSE,
        "market-intel",
      );
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].specialistId).toBe("positioning");
      expect(suggestions[0].specialistName).toBe("Positioning");
      expect(suggestions[0].reason).toContain("sharpen");
    });

    it("filters out self-references in Market Intel response", () => {
      const textWithSelf =
        "The Market Intel Agent could help with research. The Positioning Agent could help sharpen messaging.";
      const suggestions = detectHandoffSuggestions(textWithSelf, "market-intel");
      expect(suggestions.every((s) => s.specialistId !== "market-intel")).toBe(
        true,
      );
      expect(suggestions.some((s) => s.specialistId === "positioning")).toBe(
        true,
      );
    });
  });

  describe("full rendering pipeline simulation", () => {
    it("produces renderable handoff chips when all conditions are met", () => {
      // Simulate the complete rendering pipeline:
      // 1. Guard check (shouldDetect)
      const detect = shouldDetect({
        role: "assistant",
        isLastAssistant: true,
        isStreaming: false,
        fullTextLength: MARKET_INTEL_RESPONSE.length,
      });
      expect(detect).toBe(true);

      // 2. Detection
      const suggestions = detectHandoffSuggestions(
        MARKET_INTEL_RESPONSE,
        "market-intel",
      );
      expect(suggestions.length).toBeGreaterThanOrEqual(1);

      // 3. Rendering guard
      const sessionId = "test-session-123";
      const shouldRender = suggestions.length > 0 && Boolean(sessionId);
      expect(shouldRender).toBe(true);

      // 4. Dismissed filtering (fresh session = empty dismissed set)
      const dismissedIds = new Set<string>();
      const visible = suggestions.filter((s) => !dismissedIds.has(s.id));
      expect(visible.length).toBeGreaterThanOrEqual(1);

      // 5. Verify chip data
      expect(visible[0].specialistId).toBe("positioning");
      expect(visible[0].specialistName).toBe("Positioning");
      expect(visible[0].reason.length).toBeGreaterThan(0);
    });

    it("generates stable deterministic IDs for the same input", () => {
      const suggestions1 = detectHandoffSuggestions(
        MARKET_INTEL_RESPONSE,
        "market-intel",
      );
      const suggestions2 = detectHandoffSuggestions(
        MARKET_INTEL_RESPONSE,
        "market-intel",
      );

      // IDs should be deterministic (based on content hash) so that
      // dismissal state persists across re-renders
      expect(suggestions1[0].id).toBe(suggestions2[0].id);
      expect(suggestions1[0].specialistId).toBe(suggestions2[0].specialistId);
      expect(suggestions1[0].specialistName).toBe(
        suggestions2[0].specialistName,
      );
    });

    it("generates different IDs for different specialists", () => {
      const text1 =
        "The Positioning Agent could help sharpen messaging.";
      const text2 =
        "The Content Agent could help produce blog outlines.";
      const suggestions1 = detectHandoffSuggestions(text1);
      const suggestions2 = detectHandoffSuggestions(text2);

      expect(suggestions1[0].id).not.toBe(suggestions2[0].id);
    });
  });

  describe("streaming → ready transition", () => {
    it("transitions shouldDetect from false to true when streaming ends", () => {
      // During streaming
      const duringStreaming = shouldDetect({
        role: "assistant",
        isLastAssistant: true,
        isStreaming: true,
        fullTextLength: MARKET_INTEL_RESPONSE.length,
      });
      expect(duringStreaming).toBe(false);

      // After streaming completes (status: "ready")
      const afterStreaming = shouldDetect({
        role: "assistant",
        isLastAssistant: true,
        isStreaming: false,
        fullTextLength: MARKET_INTEL_RESPONSE.length,
      });
      expect(afterStreaming).toBe(true);

      // The useMemo deps [shouldDetect, fullText, specialistId] should
      // detect this change and recompute
      expect(duringStreaming).not.toBe(afterStreaming);
    });
  });
});
