import { describe, expect, it } from "vitest";
import {
  renderAgentsIndex,
  renderGlobalConfig,
  renderInternalAgentConfig,
} from "../../packages/core/src/core/templates/default-templates.js";

describe("default templates", () => {
  it("renders the global config payload", () => {
    const config = renderGlobalConfig("2026-02-06T00:00:00.000Z");

    expect(config).toEqual({
      schemaVersion: 1,
      defaultAgent: "ceo",
      createdAt: "2026-02-06T00:00:00.000Z",
      updatedAt: "2026-02-06T00:00:00.000Z",
    });
  });

  it("renders agents index payload", () => {
    const index = renderAgentsIndex("2026-02-06T00:00:00.000Z", [
      "ceo",
      "research",
    ]);

    expect(index.schemaVersion).toBe(1);
    expect(index.agents).toEqual(["ceo", "research"]);
    expect(index.updatedAt).toBe("2026-02-06T00:00:00.000Z");
  });

  it("renders internal agent config templates", () => {
    const identity = { id: "ceo", displayName: "CEO" };
    const internalConfig = renderInternalAgentConfig(identity) as {
      role: string;
      organization: { type: string; reportsTo: string | null };
      runtime: {
        adapter: string;
        sessions: { mainKey: string };
        skills: { assigned: string[] };
      };
    };
    expect(internalConfig.role).toBe("CEO");
    expect(internalConfig.organization.type).toBe("manager");
    expect(internalConfig.organization.reportsTo).toBeNull();
    expect(internalConfig.runtime.adapter).toBe("openclaw");
    expect(internalConfig.runtime.sessions.mainKey).toBe("main");
    expect(internalConfig.runtime.skills.assigned).toEqual([]);
  });
});
