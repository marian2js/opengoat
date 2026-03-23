import { describe, expect, it } from "vitest";
import {
  buildRunPrompt,
  type RunPromptParams,
} from "../../apps/desktop/src/features/dashboard/lib/run-prompt-composer";

function makeParams(overrides?: Partial<RunPromptParams>): RunPromptParams {
  return {
    playbook: {
      playbookId: "launch-pack",
      title: "Launch Pack",
      description: "Full launch preparation kit",
      idealFor: "Pre-launch startups",
      goalTypes: ["launch"],
      requiredInputs: ["product-url"],
      optionalInputs: [],
      skillRefs: ["ph-launch-copy", "launch-checklist"],
      defaultPhases: [
        { name: "Research", description: "Audit current assets" },
        { name: "Draft", description: "Write launch copy" },
        { name: "Review", description: "Self-critique and polish" },
      ],
      artifactTypes: ["launch-copy", "checklist", "faq"],
      taskPolicy: "Create tasks for each deliverable",
      approvalPolicy: "User reviews before finalizing",
      evaluationRubric: "Specificity and evidence-based",
      version: "1.0.0",
      source: "builtin" as const,
    },
    objective: {
      objectiveId: "obj-1",
      projectId: "proj-1",
      title: "Launch on Product Hunt",
      status: "active",
      summary: "Prepare and execute PH launch",
      successDefinition: "Top 5 of the day",
      constraints: "Budget under $500",
      avoid: "Spammy tactics",
      createdFrom: "dashboard",
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
    },
    phaseName: "Research",
    ...overrides,
  };
}

describe("buildRunPrompt", () => {
  it("includes playbook title and current phase name", () => {
    const prompt = buildRunPrompt(makeParams());
    expect(prompt).toContain("Launch Pack");
    expect(prompt).toContain("Research");
  });

  it("includes objective summary and constraints", () => {
    const prompt = buildRunPrompt(makeParams());
    expect(prompt).toContain("Prepare and execute PH launch");
    expect(prompt).toContain("Budget under $500");
  });

  it("includes skill references for each skill in playbook", () => {
    const prompt = buildRunPrompt(makeParams());
    expect(prompt).toContain("ph-launch-copy");
    expect(prompt).toContain("launch-checklist");
    expect(prompt).toContain("./skills/marketing/");
  });

  it("includes avoid list from objective", () => {
    const prompt = buildRunPrompt(makeParams());
    expect(prompt).toContain("Spammy tactics");
  });

  it("includes context file instructions", () => {
    const prompt = buildRunPrompt(makeParams());
    expect(prompt).toContain("PRODUCT.md");
    expect(prompt).toContain("MARKET.md");
    expect(prompt).toContain("GROWTH.md");
  });

  it("includes quality gate template", () => {
    const prompt = buildRunPrompt(makeParams());
    expect(prompt).toContain("self-critique");
  });

  it("produces valid prompt with empty avoid and constraints", () => {
    const prompt = buildRunPrompt(
      makeParams({
        objective: {
          objectiveId: "obj-2",
          projectId: "proj-1",
          title: "Basic Objective",
          status: "active",
          summary: "A simple goal",
          createdFrom: "dashboard",
          createdAt: "2025-01-01",
          updatedAt: "2025-01-01",
        },
      }),
    );
    expect(prompt).toBeTruthy();
    expect(prompt).toContain("A simple goal");
    // Should not contain undefined or null
    expect(prompt).not.toContain("undefined");
    expect(prompt).not.toContain("null");
  });

  it("omits skill section when playbook has no skills", () => {
    const prompt = buildRunPrompt(
      makeParams({
        playbook: {
          ...makeParams().playbook,
          skillRefs: [],
        },
      }),
    );
    expect(prompt).not.toContain("./skills/marketing/");
  });

  it("includes success definition from objective", () => {
    const prompt = buildRunPrompt(makeParams());
    expect(prompt).toContain("Top 5 of the day");
  });

  it("includes playbook description", () => {
    const prompt = buildRunPrompt(makeParams());
    expect(prompt).toContain("Full launch preparation kit");
  });

  it("includes phase instructions from current phase", () => {
    const prompt = buildRunPrompt(makeParams());
    expect(prompt).toContain("Audit current assets");
  });

  it("includes task policy from playbook", () => {
    const prompt = buildRunPrompt(makeParams());
    expect(prompt).toContain("Create tasks for each deliverable");
  });

  it("includes artifact types from playbook", () => {
    const prompt = buildRunPrompt(makeParams());
    expect(prompt).toContain("launch-copy");
    expect(prompt).toContain("checklist");
    expect(prompt).toContain("faq");
  });
});
