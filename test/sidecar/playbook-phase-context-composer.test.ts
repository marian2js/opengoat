import { describe, expect, it } from "vitest";
import {
  composePlaybookPhaseContext,
  type PlaybookPhaseContextInput,
} from "../../packages/sidecar/src/context-composer/playbook-phase-context-composer.ts";

const baseRun = {
  runId: "run-1",
  projectId: "proj-1",
  objectiveId: "obj-1",
  playbookId: "launch-pack",
  title: "Launch Pack",
  status: "running" as const,
  phase: "Research",
  phaseSummary: "Identify best-fit launch surfaces, audience, and timing.",
  startedFrom: "action" as const,
  agentId: "goat",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const basePlaybook = {
  playbookId: "launch-pack",
  title: "Launch Pack",
  description: "End-to-end launch preparation.",
  idealFor: "Teams preparing to launch.",
  goalTypes: ["launch"],
  requiredInputs: ["product name"],
  optionalInputs: ["landing page URL"],
  skillRefs: ["launch-strategy"],
  defaultPhases: [
    {
      name: "Research",
      description: "Identify best-fit launch surfaces, audience, and timing.",
      expectedArtifacts: ["community shortlist", "launch timing plan"],
      specialistId: "distribution",
    },
    {
      name: "Draft",
      description: "Write Product Hunt copy, FAQ, and community post drafts.",
      expectedArtifacts: ["Product Hunt copy", "FAQ pack", "community post angles"],
      specialistId: "distribution",
    },
    {
      name: "Review",
      description: "Present launch assets for founder review.",
      expectedArtifacts: ["revised launch copy"],
      specialistId: "cmo",
    },
    {
      name: "Finalize",
      description: "Compile final launch checklist and asset inventory.",
      expectedArtifacts: ["launch checklist", "launch assets list"],
      specialistId: "distribution",
    },
  ],
  artifactTypes: ["Product Hunt copy", "launch checklist"],
  taskPolicy: "Create one task per launch surface.",
  approvalPolicy: "All launch copy must be approved.",
  evaluationRubric: "Score on: copy specificity.",
  version: "1.0.0",
  source: "builtin" as const,
};

const baseArtifact = {
  artifactId: "art-1",
  projectId: "proj-1",
  objectiveId: "obj-1",
  runId: "run-1",
  type: "copy_draft" as const,
  title: "Community Shortlist",
  status: "draft" as const,
  format: "markdown" as const,
  contentRef: "artifacts/art-1.md",
  version: 1,
  createdBy: "goat",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeInput(overrides: Partial<PlaybookPhaseContextInput> = {}): PlaybookPhaseContextInput {
  return {
    run: baseRun,
    playbook: basePlaybook,
    artifacts: [],
    ...overrides,
  };
}

describe("composePlaybookPhaseContext", () => {
  it("renders context for first phase with expected artifacts and upcoming phases", () => {
    const result = composePlaybookPhaseContext(makeInput());

    expect(result).toContain("<playbook-phase-context>");
    expect(result).toContain("</playbook-phase-context>");
    expect(result).toContain("Launch Pack");
    expect(result).toContain("Research");
    expect(result).toContain("community shortlist");
    expect(result).toContain("launch timing plan");
    // Should mention upcoming phases
    expect(result).toContain("Draft");
    expect(result).toContain("Review");
    expect(result).toContain("Finalize");
  });

  it("renders context for middle phase showing progress on matched artifacts", () => {
    const input = makeInput({
      run: { ...baseRun, phase: "Draft" },
      artifacts: [
        { ...baseArtifact, title: "Community Shortlist" },
        { ...baseArtifact, artifactId: "art-2", title: "Launch Timing Plan" },
      ],
    });

    const result = composePlaybookPhaseContext(input);

    expect(result).toContain("Draft");
    expect(result).toContain("Product Hunt copy");
    expect(result).toContain("FAQ pack");
    expect(result).toContain("community post angles");
    // Should mention upcoming phases
    expect(result).toContain("Review");
    expect(result).toContain("Finalize");
  });

  it("renders context for last phase with no upcoming phases", () => {
    const input = makeInput({
      run: { ...baseRun, phase: "Finalize" },
    });

    const result = composePlaybookPhaseContext(input);

    expect(result).toContain("Finalize");
    expect(result).toContain("launch checklist");
    expect(result).toContain("launch assets list");
    // Should NOT mention "Next" with phases after it
    expect(result).not.toMatch(/Next.*:.*\w+/);
  });

  it("returns empty string when playbook is null", () => {
    const input = makeInput({ playbook: null });
    expect(composePlaybookPhaseContext(input)).toBe("");
  });

  it("returns empty string when run is null", () => {
    const input = makeInput({ run: null });
    expect(composePlaybookPhaseContext(input)).toBe("");
  });

  it("handles phase with no expectedArtifacts gracefully", () => {
    const playbook = {
      ...basePlaybook,
      defaultPhases: [
        {
          name: "Research",
          description: "Do some research.",
          specialistId: "distribution",
        },
        {
          name: "Draft",
          description: "Write drafts.",
          expectedArtifacts: ["draft copy"],
          specialistId: "distribution",
        },
      ],
    };
    const input = makeInput({ playbook });

    const result = composePlaybookPhaseContext(input);
    expect(result).toContain("Research");
    // Should still produce valid context even without expected artifacts
    expect(result).toContain("<playbook-phase-context>");
  });

  it("handles run with phase not found in playbook", () => {
    const input = makeInput({
      run: { ...baseRun, phase: "NonExistentPhase" },
    });

    const result = composePlaybookPhaseContext(input);
    // Should return empty or gracefully handle
    expect(result).toBe("");
  });

  it("includes phase index information (e.g. Phase 1/4)", () => {
    const result = composePlaybookPhaseContext(makeInput());
    expect(result).toMatch(/Phase 1\/4/);
  });

  it("shows correct phase index for middle phase", () => {
    const input = makeInput({
      run: { ...baseRun, phase: "Draft" },
    });

    const result = composePlaybookPhaseContext(input);
    expect(result).toMatch(/Phase 2\/4/);
  });

  it("uses natural language guidance tone", () => {
    const result = composePlaybookPhaseContext(makeInput());
    // Should read as guidance, not as a rigid data dump
    expect(result).toMatch(/You're in the/i);
  });
});
