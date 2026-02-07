import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenGoatPaths } from "../../src/core/domain/opengoat-paths.js";
import { AgentService } from "../../src/core/agents/index.js";
import { NodeFileSystem } from "../../src/platform/node/node-file-system.js";
import { NodePathPort } from "../../src/platform/node/node-path.port.js";
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
      id: "orchestrator",
      displayName: "Orchestrator"
    });

    expect(result.agent.workspaceDir).toBe(path.join(paths.workspacesDir, "orchestrator"));
    expect(result.createdPaths.length).toBeGreaterThan(0);

    const agentsMd = await readFile(path.join(result.agent.workspaceDir, "AGENTS.md"), "utf-8");
    expect(agentsMd).toContain("# Orchestrator (OpenGoat Agent)");
    expect(await readFile(path.join(result.agent.workspaceDir, "SOUL.md"), "utf-8")).toContain("# Soul");
    expect(await readFile(path.join(result.agent.workspaceDir, "IDENTITY.md"), "utf-8")).toContain(
      "- id: orchestrator"
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
    expect(index.agents).toEqual(["orchestrator"]);
  });

  it("never changes global default agent during agent creation", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();

    await fileSystem.writeFile(
      paths.globalConfigJsonPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          defaultAgent: "orchestrator",
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

    expect(config.defaultAgent).toBe("orchestrator");
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

    await service.ensureAgent(paths, { id: "orchestrator", displayName: "Orchestrator" });

    const agentsMdPath = path.join(paths.workspacesDir, "orchestrator", "AGENTS.md");
    await fileSystem.writeFile(agentsMdPath, "# Custom\n");

    const second = await service.ensureAgent(paths, { id: "orchestrator", displayName: "Orchestrator" });

    expect(second.createdPaths).toEqual([]);
    expect(second.skippedPaths.length).toBeGreaterThan(0);
    expect(await readFile(agentsMdPath, "utf-8")).toBe("# Custom\n");
  });

  it("does not recreate BOOTSTRAP.md when workspace is already established", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();

    const workspaceDir = path.join(paths.workspacesDir, "orchestrator");
    await fileSystem.ensureDir(workspaceDir);
    await fileSystem.writeFile(path.join(workspaceDir, "AGENTS.md"), "# Existing\n");
    await fileSystem.writeFile(path.join(workspaceDir, "CONTEXT.md"), "# Existing context\n");

    await service.ensureAgent(paths, { id: "orchestrator", displayName: "Orchestrator" });

    const bootstrapPath = path.join(workspaceDir, "BOOTSTRAP.md");
    expect(await fileSystem.exists(bootstrapPath)).toBe(false);
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
  await fileSystem.ensureDir(paths.runsDir);

  return {
    service: createAgentService(),
    paths,
    fileSystem
  };
}
