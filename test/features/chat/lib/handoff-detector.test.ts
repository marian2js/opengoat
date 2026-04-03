import { describe, expect, it } from "vitest";
import {
  detectHandoffSuggestions,
  type HandoffSuggestion,
} from "../../../../apps/desktop/src/features/chat/lib/handoff-detector";

describe("detectHandoffSuggestions", () => {
  describe("positive matches — specialist mention + handoff intent", () => {
    it("detects 'The Positioning Agent could help sharpen your messaging'", () => {
      const result = detectHandoffSuggestions(
        "Based on this analysis, the Positioning Agent could help sharpen your messaging for this audience.",
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].specialistId).toBe("positioning");
      expect(result[0].specialistName).toBe("Positioning");
      expect(result[0].reason).toBeTruthy();
    });

    it("detects 'I suggest talking to Market Intel for deeper research'", () => {
      const result = detectHandoffSuggestions(
        "I suggest talking to Market Intel for deeper competitor research on this topic.",
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].specialistId).toBe("market-intel");
      expect(result[0].specialistName).toBe("Market Intel");
    });

    it("detects 'The SEO/AEO Agent specializes in search visibility'", () => {
      const result = detectHandoffSuggestions(
        "For search optimization, the SEO/AEO Agent specializes in improving organic visibility.",
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].specialistId).toBe("seo-aeo");
    });

    it("detects 'Website Conversion could help with landing page improvements'", () => {
      const result = detectHandoffSuggestions(
        "Website Conversion could help with landing page improvements based on these findings.",
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].specialistId).toBe("website-conversion");
    });

    it("detects 'The Distribution Agent would be great for your launch plan'", () => {
      const result = detectHandoffSuggestions(
        "The Distribution Agent would be great for planning your Product Hunt launch.",
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].specialistId).toBe("distribution");
    });

    it("detects 'The Content Agent could help produce blog outlines'", () => {
      const result = detectHandoffSuggestions(
        "The Content Agent could help produce blog outlines from this research.",
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].specialistId).toBe("content");
    });

    it("detects 'The Outbound Agent could help craft outreach sequences'", () => {
      const result = detectHandoffSuggestions(
        "The Outbound Agent could help craft cold email sequences based on these angles.",
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].specialistId).toBe("outbound");
    });

    it("detects 'hand this off to' phrasing", () => {
      const result = detectHandoffSuggestions(
        "You might want to hand this off to the Content Agent for actual content production.",
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].specialistId).toBe("content");
    });
  });

  describe("self-reference filtering", () => {
    it("filters out the current specialist from suggestions", () => {
      const result = detectHandoffSuggestions(
        "The Positioning Agent could help sharpen your messaging.",
        "positioning",
      );
      expect(result.length).toBe(0);
    });

    it("keeps other specialists when current specialist is different", () => {
      const result = detectHandoffSuggestions(
        "The Positioning Agent could help sharpen your messaging.",
        "market-intel",
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].specialistId).toBe("positioning");
    });
  });

  describe("CMO filtering", () => {
    it("never suggests handoff to CMO", () => {
      const result = detectHandoffSuggestions(
        "The CMO could help coordinate this across specialists.",
      );
      const cmoSuggestions = result.filter((s) => s.specialistId === "cmo");
      expect(cmoSuggestions.length).toBe(0);
    });
  });

  describe("negative matches — no handoff intent", () => {
    it("does not detect bare specialist name mentions without intent", () => {
      const result = detectHandoffSuggestions(
        "The Positioning Agent already reviewed your messaging and it looks strong.",
      );
      expect(result.length).toBe(0);
    });

    it("does not detect generic text without specialist mentions", () => {
      const result = detectHandoffSuggestions(
        "Let me help you improve your homepage conversion rate with these suggestions.",
      );
      expect(result.length).toBe(0);
    });

    it("does not detect short or empty text", () => {
      expect(detectHandoffSuggestions("")).toHaveLength(0);
      expect(detectHandoffSuggestions("OK")).toHaveLength(0);
    });
  });

  describe("max suggestions limit", () => {
    it("returns at most 2 suggestions per message", () => {
      const result = detectHandoffSuggestions(
        "The Positioning Agent could help with messaging. " +
        "The Content Agent could help with blog posts. " +
        "The Outbound Agent could help with email sequences.",
      );
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe("reason extraction", () => {
    it("extracts the sentence containing the specialist mention as the reason", () => {
      const result = detectHandoffSuggestions(
        "Great analysis! The Positioning Agent could help sharpen your messaging further. Let me know if you want more details.",
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].reason).toContain("Positioning");
      expect(result[0].reason).toContain("sharpen");
    });
  });

  describe("multiple specialists in one message", () => {
    it("detects two different specialist handoffs", () => {
      const result = detectHandoffSuggestions(
        "The Positioning Agent could help refine your messaging. " +
        "The SEO/AEO Agent could help improve your search visibility.",
      );
      expect(result.length).toBe(2);
      const ids = result.map((s) => s.specialistId);
      expect(ids).toContain("positioning");
      expect(ids).toContain("seo-aeo");
    });
  });

  describe("case insensitivity", () => {
    it("handles varied capitalization of specialist names", () => {
      const result = detectHandoffSuggestions(
        "The POSITIONING agent could help with your framing.",
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].specialistId).toBe("positioning");
    });
  });
});
