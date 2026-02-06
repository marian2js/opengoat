import { describe, expect, it } from "vitest";
import { RoutingService } from "../../src/core/orchestration/index.js";
import type { AgentManifest } from "../../src/core/agents/index.js";

describe("RoutingService", () => {
  it("routes orchestrator traffic to best matching specialized agent", () => {
    const service = new RoutingService();
    const manifests = createManifests();

    const decision = service.decide({
      entryAgentId: "orchestrator",
      message: "Please research API docs and summarize findings.",
      manifests
    });

    expect(decision.targetAgentId).toBe("researcher");
    expect(decision.rewrittenMessage).toContain("Delegation target: Research Agent");
    expect(decision.candidates.length).toBeGreaterThan(0);
  });

  it("keeps direct invocation when entry agent is not orchestrator", () => {
    const service = new RoutingService();
    const manifests = createManifests();

    const decision = service.decide({
      entryAgentId: "writer",
      message: "Draft a release note.",
      manifests
    });

    expect(decision.targetAgentId).toBe("writer");
    expect(decision.reason).toContain("Direct invocation");
  });
});

function createManifests(): AgentManifest[] {
  return [
    {
      agentId: "orchestrator",
      filePath: "/tmp/orchestrator/AGENTS.md",
      workspaceDir: "/tmp/orchestrator",
      source: "frontmatter",
      body: "# Orchestrator",
      metadata: {
        id: "orchestrator",
        name: "Orchestrator",
        description: "Routes tasks to specialists",
        provider: "openai",
        tags: ["orchestration", "routing"],
        delegation: { canReceive: true, canDelegate: true },
        priority: 100
      }
    },
    {
      agentId: "researcher",
      filePath: "/tmp/researcher/AGENTS.md",
      workspaceDir: "/tmp/researcher",
      source: "frontmatter",
      body: "Research deeply and include citations.",
      metadata: {
        id: "researcher",
        name: "Research Agent",
        description: "Researches documentation and technical topics",
        provider: "openai",
        tags: ["research", "docs"],
        delegation: { canReceive: true, canDelegate: false },
        priority: 70
      }
    },
    {
      agentId: "writer",
      filePath: "/tmp/writer/AGENTS.md",
      workspaceDir: "/tmp/writer",
      source: "frontmatter",
      body: "Writes polished content.",
      metadata: {
        id: "writer",
        name: "Writer Agent",
        description: "Creates polished written content",
        provider: "openai",
        tags: ["writing", "content"],
        delegation: { canReceive: true, canDelegate: false },
        priority: 60
      }
    }
  ];
}
