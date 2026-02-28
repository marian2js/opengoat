import { describe, expect, it } from "vitest";
import { RoutingService } from "../../packages/core/src/core/orchestration/index.js";
import type { AgentManifest } from "../../packages/core/src/core/agents/index.js";

describe("RoutingService", () => {
  it("routes goat manager traffic to best matching direct report", () => {
    const service = new RoutingService();
    const manifests = createManifests();

    const decision = service.decide({
      entryAgentId: "goat",
      message: "Please research API docs and summarize findings.",
      manifests
    });

    expect(decision.targetAgentId).toBe("researcher");
    expect(decision.rewrittenMessage).toContain("Delegation target: Research Agent");
    expect(decision.candidates.length).toBeGreaterThan(0);
  });

  it("keeps direct invocation when entry agent is not a manager", () => {
    const service = new RoutingService();
    const manifests = createManifests();

    const decision = service.decide({
      entryAgentId: "writer",
      message: "Draft a release note.",
      manifests
    });

    expect(decision.targetAgentId).toBe("writer");
    expect(decision.reason).toContain("not a manager");
  });

  it("does not route manager traffic to non-discoverable direct reports", () => {
    const service = new RoutingService();
    const manifests = createManifests().map((manifest) =>
      manifest.agentId === "researcher"
        ? {
            ...manifest,
            metadata: {
              ...manifest.metadata,
              discoverable: false
            }
          }
        : manifest
    );

    const decision = service.decide({
      entryAgentId: "goat",
      message: "Please research API docs and summarize findings.",
      manifests
    });

    expect(decision.targetAgentId).toBe("goat");
  });
});

function createManifests(): AgentManifest[] {
  return [
    {
      agentId: "goat",
      filePath: "/tmp/goat/AGENTS.md",
      workspaceDir: "/tmp/goat",
      source: "frontmatter",
      body: "# Goat",
      metadata: {
        id: "goat",
        name: "Goat",
        description: "Routes tasks to specialists",
        type: "manager",
        reportsTo: null,
        discoverable: true,
        tags: ["management", "routing"],
        skills: ["og-board-manager"],
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
        type: "individual",
        reportsTo: "goat",
        discoverable: true,
        tags: ["research", "docs"],
        skills: [],
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
        type: "individual",
        reportsTo: "goat",
        discoverable: true,
        tags: ["writing", "content"],
        skills: [],
        delegation: { canReceive: true, canDelegate: false },
        priority: 60
      }
    }
  ];
}
