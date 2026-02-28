import { describe, expect, it } from "vitest";
import {
  ONBOARDING_START_MARKER,
  buildInitialRoadmapPrompt,
  buildOnboardingFollowUpPrompt,
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

  it("includes start marker protocol in the initial roadmap prompt", () => {
    const prompt = buildInitialRoadmapPrompt(onboardingPayload);
    expect(prompt).toContain("Conversation protocol:");
    expect(prompt).toContain(ONBOARDING_START_MARKER);
  });

  it("includes start marker protocol in follow-up prompts", () => {
    const prompt = buildOnboardingFollowUpPrompt(
      "Everything is approved. Let's start.",
    );
    expect(prompt).toContain("Everything is approved. Let's start.");
    expect(prompt).toContain(ONBOARDING_START_MARKER);
  });

  it("returns redirect=true and strips marker when marker is the final line", () => {
    const result = parseOnboardingAssistantOutput(
      `All set. I've updated the roadmap.\n\n${ONBOARDING_START_MARKER}`,
    );
    expect(result.shouldRedirectToDashboard).toBe(true);
    expect(result.cleanedContent).toBe("All set. I've updated the roadmap.");
  });

  it("does not trigger redirect when marker is not the final line", () => {
    const result = parseOnboardingAssistantOutput(
      `${ONBOARDING_START_MARKER}\nAll set. I've updated the roadmap.`,
    );
    expect(result.shouldRedirectToDashboard).toBe(false);
    expect(result.cleanedContent).toBe(
      `${ONBOARDING_START_MARKER}\nAll set. I've updated the roadmap.`,
    );
  });
});
