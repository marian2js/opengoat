import { describe, expect, it } from "vitest";
import {
  listAgentWorkspaceTemplates,
  listOrganizationMarkdownTemplates,
  renderAgentsIndex,
  renderGlobalConfig,
  renderInternalAgentConfig,
} from "../../packages/core/src/core/templates/default-templates.js";

describe("default templates", () => {
  it("renders the global config payload", () => {
    const config = renderGlobalConfig("2026-02-06T00:00:00.000Z");

    expect(config).toEqual({
      schemaVersion: 1,
      defaultAgent: "goat",
      createdAt: "2026-02-06T00:00:00.000Z",
      updatedAt: "2026-02-06T00:00:00.000Z",
    });
  });

  it("renders agents index payload", () => {
    const index = renderAgentsIndex("2026-02-06T00:00:00.000Z", [
      "goat",
      "research",
    ]);

    expect(index.schemaVersion).toBe(1);
    expect(index.agents).toEqual(["goat", "research"]);
    expect(index.updatedAt).toBe("2026-02-06T00:00:00.000Z");
  });

  it("renders internal agent config templates", () => {
    const identity = { id: "goat", displayName: "Goat" };
    const internalConfig = renderInternalAgentConfig(identity) as {
      role: string;
      organization: { type: string; reportsTo: string | null };
      runtime: {
        provider: { id: string };
        sessions: { mainKey: string };
        skills: { assigned: string[] };
      };
    };
    expect(internalConfig.role).toBe("Co-Founder");
    expect(internalConfig.organization.type).toBe("manager");
    expect(internalConfig.organization.reportsTo).toBeNull();
    expect(internalConfig.runtime.provider.id).toBe("openclaw");
    expect(internalConfig.runtime.sessions.mainKey).toBe("main");
    expect(internalConfig.runtime.skills.assigned).toEqual([]);
  });

  it("discovers default organization markdown templates", () => {
    const templates = listOrganizationMarkdownTemplates();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.some((template) => template.fileName === "wiki/index.md")).toBe(
      true,
    );
    for (const template of templates) {
      expect(template.fileName.toLowerCase().endsWith(".md")).toBe(true);
      expect(template.content.length).toBeGreaterThan(0);
    }
  });

  it("discovers agent workspace templates from assets/agents/<agent-id>", () => {
    const goatTemplates = listAgentWorkspaceTemplates("goat");
    const sageTemplates = listAgentWorkspaceTemplates("sage");
    const missingTemplates = listAgentWorkspaceTemplates("unknown-agent");

    expect(goatTemplates.some((template) => template.fileName === "ROLE.md")).toBe(
      true,
    );
    expect(
      goatTemplates.some((template) => template.fileName === "BOOTSTRAP.md"),
    ).toBe(true);
    expect(sageTemplates.some((template) => template.fileName === "ROLE.md")).toBe(
      true,
    );
    expect(missingTemplates).toEqual([]);
  });
});
