import { describe, expect, it } from "vitest";
import {
  buildInitialRoadmapPrompt,
  buildOnboardingFollowUpPrompt,
  isTransientProviderFailureMessage,
  normalizeRunError,
  parseOnboardingAssistantOutput,
  type OnboardingPayload,
} from "./shared";

describe("onboarding chat protocol helpers", () => {
  const onboardingPayload: OnboardingPayload = {
    projectSummary: "AI co-founder for indie SaaS teams",
    buildMode: "new",
    githubRepoUrl: "",
    sevenDayGoal: "",
    appName: "OpenGoat",
    mvpFeature: "Daily autonomous roadmap updates",
  };

  it("includes roadmap-save protocol in the initial roadmap prompt", () => {
    const prompt = buildInitialRoadmapPrompt(onboardingPayload);
    expect(prompt).toContain("Conversation protocol:");
    expect(prompt).toContain("update organization/ROADMAP.md before replying");
  });

  it("includes roadmap-save protocol in follow-up prompts", () => {
    const prompt = buildOnboardingFollowUpPrompt(
      "Everything is approved. Let's start.",
    );
    expect(prompt).toContain("Everything is approved. Let's start.");
    expect(prompt).toContain("Approval is handled by the UI.");
  });

  it("keeps assistant output unchanged", () => {
    const result = parseOnboardingAssistantOutput(
      "All set. I've updated the roadmap.",
    );
    expect(result.cleanedContent).toBe("All set. I've updated the roadmap.");
  });

  it("detects OpenClaw transient provider failures", () => {
    expect(
      isTransientProviderFailureMessage("Unhandled stop reason: error"),
    ).toBe(true);
    expect(isTransientProviderFailureMessage("LLM request timed out.")).toBe(
      true,
    );
    expect(
      isTransientProviderFailureMessage(
        "The AI service is temporarily overloaded. Please try again in a moment.",
      ),
    ).toBe(true);
    expect(
      isTransientProviderFailureMessage("Roadmap draft ready for review."),
    ).toBe(false);
  });

  it("normalizes transient provider failures into actionable onboarding errors", () => {
    expect(normalizeRunError("Unhandled stop reason: error")).toBe(
      "Goat hit a temporary AI provider issue in OpenClaw. Please retry.",
    );
  });
});
