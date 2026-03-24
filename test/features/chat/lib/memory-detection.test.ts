import { describe, expect, it } from "vitest";
import {
  detectMemoryCandidates,
  type MemoryCandidate,
} from "../../../../apps/desktop/src/features/chat/lib/memory-detection";

describe("detectMemoryCandidates", () => {
  describe("brand voice patterns", () => {
    it("detects 'your brand voice should be casual and friendly'", () => {
      const result = detectMemoryCandidates(
        "Your brand voice should be casual and friendly, not corporate.",
      );
      expect(result.length).toBe(1);
      expect(result[0].suggestedCategory).toBe("brand_voice");
      expect(result[0].content).toContain("brand voice");
    });

    it("detects 'the tone should be professional but approachable'", () => {
      const result = detectMemoryCandidates(
        "The tone should be professional but approachable in all communications.",
      );
      expect(result.length).toBe(1);
      expect(result[0].suggestedCategory).toBe("brand_voice");
    });
  });

  describe("product facts patterns", () => {
    it("detects 'your product is a developer tool for CI/CD'", () => {
      const result = detectMemoryCandidates(
        "Your product is a developer tool for CI/CD pipeline management.",
      );
      expect(result.length).toBe(1);
      expect(result[0].suggestedCategory).toBe("product_facts");
      expect(result[0].content).toContain("developer tool");
    });

    it("detects 'the app does automated testing'", () => {
      const result = detectMemoryCandidates(
        "The app does automated testing and deployment.",
      );
      expect(result.length).toBe(1);
      expect(result[0].suggestedCategory).toBe("product_facts");
    });
  });

  describe("ICP patterns", () => {
    it("detects 'your target audience is early-stage startups'", () => {
      const result = detectMemoryCandidates(
        "Your target audience is early-stage startups looking to scale.",
      );
      expect(result.length).toBe(1);
      expect(result[0].suggestedCategory).toBe("icp_facts");
      expect(result[0].content).toContain("target audience");
    });

    it("detects 'your ideal customer is a technical founder'", () => {
      const result = detectMemoryCandidates(
        "Your ideal customer is a technical founder building their first product.",
      );
      expect(result.length).toBe(1);
      expect(result[0].suggestedCategory).toBe("icp_facts");
    });
  });

  describe("competitor patterns", () => {
    it("detects 'your main competitor is Acme Corp'", () => {
      const result = detectMemoryCandidates(
        "Your main competitor is Acme Corp, which focuses on enterprise.",
      );
      expect(result.length).toBe(1);
      expect(result[0].suggestedCategory).toBe("competitors");
    });
  });

  describe("channels to avoid patterns", () => {
    it("detects 'you should avoid cold calling'", () => {
      const result = detectMemoryCandidates(
        "You should avoid cold calling as it damages your brand.",
      );
      expect(result.length).toBe(1);
      expect(result[0].suggestedCategory).toBe("channels_to_avoid");
    });

    it("detects 'stay away from paid ads for now'", () => {
      const result = detectMemoryCandidates(
        "Stay away from paid ads for now until you have product-market fit.",
      );
      expect(result.length).toBe(1);
      expect(result[0].suggestedCategory).toBe("channels_to_avoid");
    });
  });

  describe("founder preferences patterns", () => {
    it("detects 'you prefer organic growth strategies'", () => {
      const result = detectMemoryCandidates(
        "You prefer organic growth strategies over paid acquisition.",
      );
      expect(result.length).toBe(1);
      expect(result[0].suggestedCategory).toBe("founder_preferences");
    });
  });

  describe("multiple candidates", () => {
    it("extracts multiple distinct facts from one message", () => {
      const result = detectMemoryCandidates(
        "Your product is a CI/CD tool. Your target audience is DevOps engineers. Your main competitor is Jenkins.",
      );
      expect(result.length).toBe(3);
      const categories = result.map((c) => c.suggestedCategory);
      expect(categories).toContain("product_facts");
      expect(categories).toContain("icp_facts");
      expect(categories).toContain("competitors");
    });

    it("limits candidates to max 3 per message", () => {
      const result = detectMemoryCandidates(
        "Your product is a tool. Your target audience is devs. Your main competitor is X. Your brand voice is casual. You should avoid spam.",
      );
      expect(result.length).toBeLessThanOrEqual(3);
    });
  });

  describe("edge cases", () => {
    it("returns empty for empty text", () => {
      expect(detectMemoryCandidates("")).toHaveLength(0);
    });

    it("returns empty for generic text with no facts", () => {
      expect(
        detectMemoryCandidates("Let me think about that and get back to you."),
      ).toHaveLength(0);
    });

    it("generates unique ids for each candidate", () => {
      const result = detectMemoryCandidates(
        "Your product is great. Your target audience is wide.",
      );
      if (result.length >= 2) {
        expect(result[0].id).not.toBe(result[1].id);
      }
    });

    it("sets scope to project by default", () => {
      const result = detectMemoryCandidates("Your product is a SaaS platform.");
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].suggestedScope).toBe("project");
    });

    it("sets confidence between 0 and 1", () => {
      const result = detectMemoryCandidates("Your product is a SaaS platform.");
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].confidence).toBeGreaterThan(0);
      expect(result[0].confidence).toBeLessThanOrEqual(1);
    });
  });
});
