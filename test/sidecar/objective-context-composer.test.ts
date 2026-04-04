import { describe, expect, it } from "vitest";
import {
  composeObjectiveContext,
  estimateTokens,
  type ObjectiveContextInput,
} from "../../packages/sidecar/src/context-composer/objective-context-composer.ts";

const baseObjective = {
  objectiveId: "obj-1",
  projectId: "proj-1",
  title: "Launch on Product Hunt",
  goalType: "launch",
  status: "active" as const,
  summary: "Prepare and execute a Product Hunt launch",
  whyNow: "We just shipped v2",
  successDefinition: "Top 5 product of the day",
  timeframe: "2 weeks",
  alreadyTried: "Soft launch on Twitter",
  avoid: "Spamming communities",
  constraints: "No paid ads budget",
  preferredChannels: ["twitter", "reddit"],
  createdFrom: "dashboard" as const,
  isPrimary: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const baseMemory = {
  memoryId: "mem-1",
  projectId: "proj-1",
  objectiveId: null as string | null,
  category: "brand_voice" as const,
  scope: "project" as const,
  content: "Friendly and approachable tone",
  source: "user",
  confidence: 0.9,
  createdBy: "user",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  userConfirmed: true,
  supersedes: null,
  replacedBy: null,
};

const baseRun = {
  runId: "run-1",
  projectId: "proj-1",
  objectiveId: "obj-1",
  playbookId: "pb-launch",
  title: "Launch prep sprint",
  status: "running" as const,
  phase: "research",
  phaseSummary: "Analyzing competitors and crafting positioning",
  startedFrom: "dashboard" as const,
  agentId: "goat",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const baseArtifact = {
  artifactId: "art-1",
  projectId: "proj-1",
  objectiveId: "obj-1",
  type: "copy_draft" as const,
  title: "PH Launch Copy",
  status: "draft" as const,
  format: "markdown" as const,
  contentRef: "artifacts/art-1.md",
  version: 1,
  createdBy: "goat",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeInput(overrides: Partial<ObjectiveContextInput> = {}): ObjectiveContextInput {
  return {
    objective: baseObjective,
    objectiveMemories: [
      { ...baseMemory, memoryId: "mem-obj-1", objectiveId: "obj-1", scope: "objective", category: "current_goal", content: "Ship PH launch by end of month" },
    ],
    projectMemories: [baseMemory],
    run: null,
    artifacts: [],
    playbook: null,
    ...overrides,
  };
}

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates tokens as chars / 4 rounded up", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("a")).toBe(1);
  });

  it("handles very long strings", () => {
    const long = "x".repeat(8000);
    expect(estimateTokens(long)).toBe(2000);
  });
});

describe("composeObjectiveContext", () => {
  describe("context assembly", () => {
    it("assembles full context with all sections", () => {
      const input = makeInput({
        run: baseRun,
        artifacts: [baseArtifact],
      });
      const result = composeObjectiveContext(input);

      expect(result).toContain("## Active Objective");
      expect(result).toContain("Launch on Product Hunt");
      expect(result).toContain("Top 5 product of the day");
      expect(result).toContain("Spamming communities");

      expect(result).toContain("## Objective Memory");
      expect(result).toContain("Ship PH launch by end of month");

      expect(result).toContain("## Current Run");
      expect(result).toContain("Launch prep sprint");
      expect(result).toContain("research");

      expect(result).toContain("## Linked Artifacts");
      expect(result).toContain("PH Launch Copy");

      expect(result).toContain("## Project Memory");
      expect(result).toContain("Friendly and approachable tone");
    });

    it("wraps context in objective-context tags", () => {
      const result = composeObjectiveContext(makeInput());
      expect(result).toMatch(/^<objective-context>/);
      expect(result).toMatch(/<\/objective-context>$/);
    });

    it("includes partial context when some data is missing", () => {
      const input = makeInput({
        objectiveMemories: [],
        run: null,
        artifacts: [],
        projectMemories: [],
      });
      const result = composeObjectiveContext(input);

      expect(result).toContain("## Active Objective");
      expect(result).not.toContain("## Objective Memory");
      expect(result).not.toContain("## Current Run");
      expect(result).not.toContain("## Linked Artifacts");
      expect(result).not.toContain("## Project Memory");
    });

    it("returns empty string when objective is null", () => {
      const input = makeInput({ objective: null });
      const result = composeObjectiveContext(input);
      expect(result).toBe("");
    });

    it("returns empty string when all inputs are empty/null", () => {
      const input: ObjectiveContextInput = {
        objective: null,
        objectiveMemories: [],
        projectMemories: [],
        run: null,
        artifacts: [],
      };
      const result = composeObjectiveContext(input);
      expect(result).toBe("");
    });
  });

  describe("token budget", () => {
    it("includes all sections when under budget", () => {
      const input = makeInput({
        run: baseRun,
        artifacts: [baseArtifact],
      });
      const result = composeObjectiveContext(input, { tokenBudget: 5000 });

      expect(result).toContain("## Active Objective");
      expect(result).toContain("## Objective Memory");
      expect(result).toContain("## Current Run");
      expect(result).toContain("## Linked Artifacts");
      expect(result).toContain("## Project Memory");
    });

    it("drops low-priority sections when over budget", () => {
      const input = makeInput({
        run: baseRun,
        artifacts: [baseArtifact],
        projectMemories: [
          baseMemory,
          { ...baseMemory, memoryId: "mem-2", content: "We sell to developers" },
        ],
      });
      // Very tight budget - should keep objective summary but drop lower priority
      const result = composeObjectiveContext(input, { tokenBudget: 200 });

      expect(result).toContain("## Active Objective");
      // At minimum, objective summary should be present
    });

    it("only includes objective summary with very small budget", () => {
      const input = makeInput({
        run: baseRun,
        artifacts: [baseArtifact],
      });
      const result = composeObjectiveContext(input, { tokenBudget: 100 });

      expect(result).toContain("## Active Objective");
      // Lower-priority sections should be dropped
      expect(result).not.toContain("## Project Memory");
    });

    it("uses default budget of 2000 tokens", () => {
      const input = makeInput();
      const result = composeObjectiveContext(input);
      // Should produce output within 2000 token budget
      expect(estimateTokens(result)).toBeLessThanOrEqual(2000);
    });
  });

  describe("priority ordering", () => {
    it("renders sections in priority order", () => {
      const input = makeInput({
        run: baseRun,
        artifacts: [baseArtifact],
      });
      const result = composeObjectiveContext(input, { tokenBudget: 5000 });

      const objectiveIdx = result.indexOf("## Active Objective");
      const memoryIdx = result.indexOf("## Objective Memory");
      const runIdx = result.indexOf("## Current Run");
      const artifactIdx = result.indexOf("## Linked Artifacts");
      const projectMemIdx = result.indexOf("## Project Memory");

      expect(objectiveIdx).toBeLessThan(memoryIdx);
      expect(memoryIdx).toBeLessThan(runIdx);
      expect(runIdx).toBeLessThan(artifactIdx);
      expect(artifactIdx).toBeLessThan(projectMemIdx);
    });

    it("high-priority sections survive truncation", () => {
      const input = makeInput({
        run: baseRun,
        artifacts: Array.from({ length: 20 }, (_, i) => ({
          ...baseArtifact,
          artifactId: `art-${i}`,
          title: `Artifact ${i} with a long title for padding`,
        })),
        projectMemories: Array.from({ length: 20 }, (_, i) => ({
          ...baseMemory,
          memoryId: `mem-${i}`,
          content: `Memory fact ${i} with some padding text for token estimation`,
        })),
      });
      // Budget enough for objective + memories but not everything
      const result = composeObjectiveContext(input, { tokenBudget: 400 });

      expect(result).toContain("## Active Objective");
    });
  });

  describe("artifact truncation", () => {
    it("limits artifacts to first 10 when many exist", () => {
      const artifacts = Array.from({ length: 25 }, (_, i) => ({
        ...baseArtifact,
        artifactId: `art-${i}`,
        title: `Artifact ${i}`,
      }));
      const input = makeInput({ artifacts });
      const result = composeObjectiveContext(input, { tokenBudget: 5000 });

      // Should contain at most 10 artifact lines
      const artifactMatches = result.match(/- \*\*Artifact \d+\*\*/g);
      expect(artifactMatches).toBeTruthy();
      expect(artifactMatches!.length).toBeLessThanOrEqual(10);
    });
  });

  describe("objective summary content", () => {
    it("includes all objective fields when present", () => {
      const result = composeObjectiveContext(makeInput());

      expect(result).toContain("**Title:** Launch on Product Hunt");
      expect(result).toContain("**Status:** active");
      expect(result).toContain("**Goal:** Prepare and execute a Product Hunt launch");
      expect(result).toContain("**Success:** Top 5 product of the day");
      expect(result).toContain("**Avoid:** Spamming communities");
      expect(result).toContain("**Constraints:** No paid ads budget");
    });

    it("omits optional fields when not present", () => {
      const input = makeInput({
        objective: {
          ...baseObjective,
          whyNow: undefined,
          alreadyTried: undefined,
          avoid: undefined,
          constraints: undefined,
        },
      });
      const result = composeObjectiveContext(input);

      expect(result).toContain("**Title:**");
      expect(result).not.toContain("**Why Now:**");
      expect(result).not.toContain("**Already Tried:**");
      expect(result).not.toContain("**Avoid:**");
      expect(result).not.toContain("**Constraints:**");
    });
  });
});
