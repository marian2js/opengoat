import { describe, expect, it } from "vitest";
import { OrchestrationPlannerService, type AgentManifest } from "../../src/index.js";

describe("OrchestrationPlannerService", () => {
  it("builds planner prompt with agent metadata", () => {
    const service = new OrchestrationPlannerService();
    const prompt = service.buildPlannerPrompt({
      userMessage: "Ship feature X",
      step: 1,
      maxSteps: 10,
      sharedNotes: "none",
      recentEvents: [],
      agents: createManifests()
    });

    expect(prompt).toContain("Allowed agents:");
    expect(prompt).toContain("developer");
    expect(prompt).toContain("qa-agent");
  });

  it("parses fenced JSON decisions and sanitizes defaults", () => {
    const service = new OrchestrationPlannerService();
    const decision = service.parseDecision(
      "```json\n{\"rationale\":\"delegate\",\"action\":{\"type\":\"delegate_to_agent\",\"targetAgentId\":\"Developer\",\"message\":\"Do it\"}}\n```",
      "fallback"
    );

    expect(decision.action.type).toBe("delegate_to_agent");
    if (decision.action.type !== "delegate_to_agent") {
      throw new Error("Expected delegate action");
    }

    expect(decision.action.targetAgentId).toBe("developer");
    expect(decision.action.mode).toBe("hybrid");
    expect(decision.action.sessionPolicy).toBe("auto");
  });

  it("falls back to respond_user when output is not valid JSON", () => {
    const service = new OrchestrationPlannerService();
    const decision = service.parseDecision("not-json", "fallback");

    expect(decision.action.type).toBe("respond_user");
    if (decision.action.type !== "respond_user") {
      throw new Error("Expected respond_user action");
    }

    expect(decision.action.message).toContain("fallback");
  });

  it("parses install_skill and normalizes optional fields", () => {
    const service = new OrchestrationPlannerService();
    const decision = service.parseDecision(
      JSON.stringify({
        rationale: "Install a missing skill before delegation.",
        action: {
          type: "install_skill",
          targetAgentId: "Developer",
          skillName: "Code Review",
          sourcePath: "~/skills/code-review"
        }
      }),
      "fallback"
    );

    expect(decision.action.type).toBe("install_skill");
    if (decision.action.type !== "install_skill") {
      throw new Error("Expected install_skill action");
    }

    expect(decision.action.targetAgentId).toBe("developer");
    expect(decision.action.skillName).toBe("Code Review");
    expect(decision.action.mode).toBe("artifacts");
  });

  it("normalizes delegate task keys and session policy", () => {
    const service = new OrchestrationPlannerService();
    const decision = service.parseDecision(
      JSON.stringify({
        rationale: "Route follow-up to existing thread.",
        action: {
          type: "delegate_to_agent",
          targetAgentId: "Developer",
          message: "Apply QA feedback",
          taskKey: "Task QA Feedback #12",
          sessionPolicy: "reuse"
        }
      }),
      "fallback"
    );

    expect(decision.action.type).toBe("delegate_to_agent");
    if (decision.action.type !== "delegate_to_agent") {
      throw new Error("Expected delegate_to_agent action");
    }

    expect(decision.action.taskKey).toBe("task-qa-feedback-12");
    expect(decision.action.sessionPolicy).toBe("reuse");
  });
});

function createManifests(): AgentManifest[] {
  return [
    {
      agentId: "orchestrator",
      filePath: "/tmp/orchestrator/AGENTS.md",
      workspaceDir: "/tmp/orchestrator",
      metadata: {
        id: "orchestrator",
        name: "Orchestrator",
        description: "Routes work",
        provider: "openai",
        tags: ["orchestration"],
        delegation: { canReceive: true, canDelegate: true },
        priority: 100
      },
      body: "",
      source: "frontmatter"
    },
    {
      agentId: "developer",
      filePath: "/tmp/developer/AGENTS.md",
      workspaceDir: "/tmp/developer",
      metadata: {
        id: "developer",
        name: "Developer",
        description: "Implements tasks",
        provider: "cursor",
        tags: ["implementation"],
        delegation: { canReceive: true, canDelegate: false },
        priority: 80
      },
      body: "",
      source: "frontmatter"
    },
    {
      agentId: "qa-agent",
      filePath: "/tmp/qa/AGENTS.md",
      workspaceDir: "/tmp/qa",
      metadata: {
        id: "qa-agent",
        name: "QA",
        description: "Verifies output",
        provider: "openai",
        tags: ["qa"],
        delegation: { canReceive: true, canDelegate: false },
        priority: 80
      },
      body: "",
      source: "frontmatter"
    }
  ];
}
