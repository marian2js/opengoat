import { describe, expect, it } from "vitest";
import {
  detectGoalIntent,
  type GoalDetectionResult,
} from "../../../../apps/desktop/src/features/chat/lib/goal-detection";

describe("detectGoalIntent", () => {
  function detected(result: GoalDetectionResult) {
    return result.detected;
  }

  describe("positive matches — intent + outcome phrase", () => {
    it("detects 'I want to launch our product on Product Hunt'", () => {
      const result = detectGoalIntent(
        ["I want to launch our product on Product Hunt"],
        "Great idea! Let me help you prepare a launch plan.",
      );
      expect(result.detected).toBe(true);
      expect(result.goalPhrase).toContain("launch");
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it("detects 'We need to improve our homepage conversion'", () => {
      const result = detectGoalIntent(
        ["We need to improve our homepage conversion"],
        "I can analyze your current homepage and suggest changes.",
      );
      expect(result.detected).toBe(true);
      expect(result.goalPhrase).toContain("improve");
    });

    it("detects 'Help me create a content calendar'", () => {
      const result = detectGoalIntent(
        ["Help me create a content calendar"],
        "Sure, let me draft a content calendar for you.",
      );
      expect(result.detected).toBe(true);
      expect(result.goalPhrase).toContain("create");
    });

    it("detects 'I'd like to grow our email list'", () => {
      const result = detectGoalIntent(
        ["I'd like to grow our email list"],
        "There are several strategies we can use.",
      );
      expect(result.detected).toBe(true);
      expect(result.goalPhrase).toContain("grow");
    });

    it("detects 'Our goal is to ship a new landing page'", () => {
      const result = detectGoalIntent(
        ["Our goal is to ship a new landing page"],
        "Let me help you plan the landing page.",
      );
      expect(result.detected).toBe(true);
      expect(result.goalPhrase).toContain("ship");
    });

    it("detects 'I'm trying to build an outbound sequence'", () => {
      const result = detectGoalIntent(
        ["I'm trying to build an outbound sequence"],
        "I can help with that.",
      );
      expect(result.detected).toBe(true);
      expect(result.goalPhrase).toContain("build");
    });
  });

  describe("negative matches — should not trigger", () => {
    it("does not detect casual conversation", () => {
      const result = detectGoalIntent(
        ["What do you think about our competitors?"],
        "Your competitors include Acme and Beta Corp.",
      );
      expect(result.detected).toBe(false);
    });

    it("does not detect clarification requests", () => {
      const result = detectGoalIntent(
        ["Can you explain what SEO means?"],
        "SEO stands for Search Engine Optimization.",
      );
      expect(result.detected).toBe(false);
    });

    it("does not detect short vague messages", () => {
      const result = detectGoalIntent(["Hi"], "Hello! How can I help you today?");
      expect(result.detected).toBe(false);
    });

    it("does not detect questions without clear goals", () => {
      const result = detectGoalIntent(
        ["What are the best marketing channels?"],
        "The best channels depend on your audience.",
      );
      expect(result.detected).toBe(false);
    });

    it("does not detect when only intent phrase exists (no outcome)", () => {
      const result = detectGoalIntent(
        ["I want to know more about pricing"],
        "Let me share some pricing info.",
      );
      expect(result.detected).toBe(false);
    });
  });

  describe("multi-message context", () => {
    it("detects goal across multiple user messages", () => {
      const result = detectGoalIntent(
        [
          "We've been struggling with our homepage.",
          "I need to improve our conversion rate.",
        ],
        "I can help analyze your homepage.",
      );
      expect(result.detected).toBe(true);
    });

    it("uses the most recent matching message for the goal phrase", () => {
      const result = detectGoalIntent(
        [
          "I want to launch something new.",
          "Actually, I need to improve our SEO first.",
        ],
        "Let's focus on SEO improvements.",
      );
      expect(result.detected).toBe(true);
      expect(result.goalPhrase).toContain("improve");
    });
  });

  describe("edge cases", () => {
    it("returns not detected for empty messages", () => {
      const result = detectGoalIntent([], "Hello!");
      expect(result.detected).toBe(false);
    });

    it("returns not detected for empty strings", () => {
      const result = detectGoalIntent([""], "");
      expect(result.detected).toBe(false);
    });

    it("is case insensitive", () => {
      const result = detectGoalIntent(
        ["I WANT TO LAUNCH OUR PRODUCT"],
        "Sure thing!",
      );
      expect(result.detected).toBe(true);
    });
  });
});
