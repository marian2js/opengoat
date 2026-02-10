import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenGoatPaths } from "../../packages/core/src/core/domain/opengoat-paths.js";
import { AgentService } from "../../packages/core/src/core/agents/index.js";
import { NodeFileSystem } from "../../packages/core/src/platform/node/node-file-system.js";
import { NodePathPort } from "../../packages/core/src/platform/node/node-path.port.js";
import { createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("AgentService", () => {
  it("normalizes valid names and rejects invalid names", async () => {
    const service = createAgentService();

    expect(service.normalizeAgentName("  Research Analyst  ")).toEqual({
      id: "research-analyst",
      displayName: "Research Analyst"
    });

    expect(() => service.normalizeAgentName("   ")).toThrowError("Agent name cannot be empty.");
    expect(() => service.normalizeAgentName("***")).toThrowError(
      "Agent name must contain at least one alphanumeric character."
    );
  });

  it("creates workspace and internal files for an agent", async () => {
    const { service, paths } = await createAgentServiceWithPaths();

    const result = await service.ensureAgent(paths, {
      id: "goat",
      displayName: "Goat"
    });

    expect(result.agent.workspaceDir).toBe(path.join(paths.workspacesDir, "goat"));
    expect(result.createdPaths.length).toBeGreaterThan(0);

    const agentsMd = await readFile(path.join(result.agent.workspaceDir, "AGENTS.md"), "utf-8");
    expect(agentsMd).toContain("# Goat (OpenGoat Agent)");
    expect(await readFile(path.join(result.agent.workspaceDir, "SOUL.md"), "utf-8")).toContain("# Soul");
    expect(await readFile(path.join(result.agent.workspaceDir, "IDENTITY.md"), "utf-8")).toContain(
      "- id: goat"
    );
    expect(await readFile(path.join(result.agent.workspaceDir, "BOOTSTRAP.md"), "utf-8")).toContain(
      "First-run checklist"
    );
    const internalState = JSON.parse(
      await readFile(path.join(result.agent.internalConfigDir, "state.json"), "utf-8")
    ) as { status: string };
    expect(internalState.status).toBe("idle");

    const index = JSON.parse(await readFile(paths.agentsIndexJsonPath, "utf-8")) as {
      agents: string[];
    };
    expect(index.agents).toEqual(["goat"]);
  });

  it("defaults non-goat reportsTo to goat when omitted", async () => {
    const { service, paths } = await createAgentServiceWithPaths();

    const result = await service.ensureAgent(paths, {
      id: "developer",
      displayName: "Developer"
    });

    const agentsMd = await readFile(path.join(result.agent.workspaceDir, "AGENTS.md"), "utf-8");
    expect(agentsMd).toContain("reportsTo: goat");

    const config = JSON.parse(await readFile(path.join(result.agent.internalConfigDir, "config.json"), "utf-8")) as {
      organization?: { reportsTo?: string | null };
    };
    expect(config.organization?.reportsTo).toBe("goat");
  });

  it("supports explicit reportsTo manager when creating an agent", async () => {
    const { service, paths } = await createAgentServiceWithPaths();

    const result = await service.ensureAgent(
      paths,
      {
        id: "engineer",
        displayName: "Engineer"
      },
      {
        reportsTo: "CTO"
      }
    );

    const agentsMd = await readFile(path.join(result.agent.workspaceDir, "AGENTS.md"), "utf-8");
    expect(agentsMd).toContain("reportsTo: cto");

    const config = JSON.parse(await readFile(path.join(result.agent.internalConfigDir, "config.json"), "utf-8")) as {
      organization?: { reportsTo?: string | null };
    };
    expect(config.organization?.reportsTo).toBe("cto");
  });

  it("does not seed orchestrator default skill for non-default agents", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();

    const result = await service.ensureAgent(paths, {
      id: "developer",
      displayName: "Developer"
    });

    const defaultSkillPath = path.join(result.agent.workspaceDir, "skills", "opengoat-skill", "SKILL.md");
    expect(await fileSystem.exists(defaultSkillPath)).toBe(false);
  });

  it("never changes global default agent during agent creation", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();

    await fileSystem.writeFile(
      paths.globalConfigJsonPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          defaultAgent: "goat",
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z"
        },
        null,
        2
      ) + "\n"
    );

    await service.ensureAgent(paths, {
      id: "research-analyst",
      displayName: "Research Analyst"
    });

    const config = JSON.parse(await readFile(paths.globalConfigJsonPath, "utf-8")) as {
      defaultAgent: string;
      createdAt: string;
      updatedAt: string;
    };

    expect(config.defaultAgent).toBe("goat");
    expect(config.createdAt).toBe("2026-02-01T00:00:00.000Z");
    expect(config.updatedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("deduplicates and sorts agents index", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();

    await fileSystem.writeFile(
      paths.agentsIndexJsonPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          agents: ["zeta", "alpha", "alpha"],
          updatedAt: "2026-02-01T00:00:00.000Z"
        },
        null,
        2
      ) + "\n"
    );

    await service.ensureAgent(paths, {
      id: "beta",
      displayName: "Beta"
    });

    const index = JSON.parse(await readFile(paths.agentsIndexJsonPath, "utf-8")) as {
      agents: string[];
    };
    expect(index.agents).toEqual(["alpha", "beta", "zeta"]);
  });

  it("lists agents sorted and falls back to id when metadata is unreadable", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();

    await fileSystem.ensureDir(path.join(paths.workspacesDir, "z-agent"));
    await fileSystem.writeFile(
      path.join(paths.workspacesDir, "z-agent", "workspace.json"),
      JSON.stringify({ displayName: "Zed" }, null, 2) + "\n"
    );
    await fileSystem.ensureDir(path.join(paths.workspacesDir, "a-agent"));
    await fileSystem.writeFile(path.join(paths.workspacesDir, "a-agent", "workspace.json"), "{bad json");

    const agents = await service.listAgents(paths);

    expect(agents.map((agent) => agent.id)).toEqual(["a-agent", "z-agent"]);
    expect(agents[0]?.displayName).toBe("a-agent");
    expect(agents[1]?.displayName).toBe("Zed");
  });

  it("is idempotent and does not overwrite existing AGENTS.md", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();

    await service.ensureAgent(paths, { id: "goat", displayName: "Goat" });

    const agentsMdPath = path.join(paths.workspacesDir, "goat", "AGENTS.md");
    await fileSystem.writeFile(agentsMdPath, "# Custom\n");

    const second = await service.ensureAgent(paths, { id: "goat", displayName: "Goat" });

    expect(second.createdPaths).toEqual([]);
    expect(second.skippedPaths.length).toBeGreaterThan(0);
    expect(await readFile(agentsMdPath, "utf-8")).toBe("# Custom\n");
  });

  it("does not recreate BOOTSTRAP.md when workspace is already established", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();

    const workspaceDir = path.join(paths.workspacesDir, "goat");
    await fileSystem.ensureDir(workspaceDir);
    await fileSystem.writeFile(path.join(workspaceDir, "AGENTS.md"), "# Existing\n");
    await fileSystem.writeFile(path.join(workspaceDir, "CONTEXT.md"), "# Existing context\n");

    await service.ensureAgent(paths, { id: "goat", displayName: "Goat" });

    const bootstrapPath = path.join(workspaceDir, "BOOTSTRAP.md");
    expect(await fileSystem.exists(bootstrapPath)).toBe(false);
  });

  it("updates manager relationship in AGENTS.md and config.json", async () => {
    const { service, paths } = await createAgentServiceWithPaths();
    await service.ensureAgent(paths, { id: "goat", displayName: "Goat" });
    await service.ensureAgent(paths, { id: "cto", displayName: "CTO" }, { type: "manager", reportsTo: "goat" });
    await service.ensureAgent(paths, { id: "engineer", displayName: "Engineer" });

    const result = await service.setAgentManager(paths, "engineer", "cto");

    expect(result.agentId).toBe("engineer");
    expect(result.previousReportsTo).toBe("goat");
    expect(result.reportsTo).toBe("cto");

    const agentsMd = await readFile(path.join(paths.workspacesDir, "engineer", "AGENTS.md"), "utf-8");
    expect(agentsMd).toContain("reportsTo: cto");
    const config = JSON.parse(await readFile(path.join(paths.agentsDir, "engineer", "config.json"), "utf-8")) as {
      organization?: { reportsTo?: string | null };
    };
    expect(config.organization?.reportsTo).toBe("cto");
  });

  it("rejects manager reassignment that would create a cycle", async () => {
    const { service, paths } = await createAgentServiceWithPaths();
    await service.ensureAgent(paths, { id: "goat", displayName: "Goat" });
    await service.ensureAgent(paths, { id: "cto", displayName: "CTO" }, { type: "manager", reportsTo: "goat" });
    await service.ensureAgent(paths, { id: "engineer", displayName: "Engineer" }, { reportsTo: "cto" });

    await expect(service.setAgentManager(paths, "cto", "engineer")).rejects.toThrow("create a cycle");
  });

  it("removes a non-default agent workspace and internal config", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();
    await service.ensureAgent(paths, { id: "developer", displayName: "Developer" });

    const deletion = await service.removeAgent(paths, "developer");

    expect(deletion.agentId).toBe("developer");
    expect(deletion.existed).toBe(true);
    expect(deletion.removedPaths).toEqual([
      path.join(paths.workspacesDir, "developer"),
      path.join(paths.agentsDir, "developer")
    ]);
    expect(await fileSystem.exists(path.join(paths.workspacesDir, "developer"))).toBe(false);
    expect(await fileSystem.exists(path.join(paths.agentsDir, "developer"))).toBe(false);
  });

  it("prevents deleting goat", async () => {
    const { service, paths } = await createAgentServiceWithPaths();
    await service.ensureAgent(paths, { id: "goat", displayName: "Goat" });

    await expect(service.removeAgent(paths, "goat")).rejects.toThrow(
      "Cannot delete goat"
    );
  });
});

function createAgentService(): AgentService {
  return new AgentService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort(),
    nowIso: () => "2026-02-06T00:00:00.000Z"
  });
}

async function createAgentServiceWithPaths(): Promise<{
  service: AgentService;
  paths: OpenGoatPaths;
  fileSystem: NodeFileSystem;
}> {
  const root = await createTempDir("opengoat-agent-service-");
  roots.push(root);

  const fileSystem = new NodeFileSystem();
  const paths: OpenGoatPaths = {
    homeDir: root,
    workspacesDir: path.join(root, "workspaces"),
    agentsDir: path.join(root, "agents"),
    skillsDir: path.join(root, "skills"),
    providersDir: path.join(root, "providers"),
    sessionsDir: path.join(root, "sessions"),
    runsDir: path.join(root, "runs"),
    globalConfigJsonPath: path.join(root, "config.json"),
    globalConfigMarkdownPath: path.join(root, "CONFIG.md"),
    agentsIndexJsonPath: path.join(root, "agents.json")
  };

  await fileSystem.ensureDir(paths.homeDir);
  await fileSystem.ensureDir(paths.workspacesDir);
  await fileSystem.ensureDir(paths.agentsDir);
  await fileSystem.ensureDir(paths.skillsDir);
  await fileSystem.ensureDir(paths.providersDir);
  await fileSystem.ensureDir(paths.sessionsDir);
  await fileSystem.ensureDir(paths.runsDir);

  return {
    service: createAgentService(),
    paths,
    fileSystem
  };
}
