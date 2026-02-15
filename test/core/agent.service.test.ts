import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentService } from "../../packages/core/src/core/agents/index.js";
import type { OpenGoatPaths } from "../../packages/core/src/core/domain/opengoat-paths.js";
import { renderCeoBootstrapMarkdown } from "../../packages/core/src/core/templates/default-templates.js";
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
      displayName: "Research Analyst",
    });
    expect(service.normalizeAgentName("John Doe")).toEqual({
      id: "john-doe",
      displayName: "John Doe",
    });
    expect(service.normalizeAgentName("Developer")).toEqual({
      id: "developer",
      displayName: "Developer",
    });

    expect(() => service.normalizeAgentName("   ")).toThrowError(
      "Agent name cannot be empty.",
    );
    expect(() => service.normalizeAgentName("***")).toThrowError(
      "Agent name must contain at least one alphanumeric character.",
    );
  });

  it("creates internal agent config for an agent", async () => {
    const { service, paths } = await createAgentServiceWithPaths();

    const result = await service.ensureAgent(paths, {
      id: "ceo",
      displayName: "CEO",
    });

    expect(result.agent.workspaceDir).toBe(
      path.join(paths.workspacesDir, "ceo"),
    );
    expect(result.createdPaths.length).toBeGreaterThan(0);

    const config = JSON.parse(
      await readFile(
        path.join(result.agent.internalConfigDir, "config.json"),
        "utf-8",
      ),
    ) as {
      role?: string;
      runtime?: { provider?: { id?: string } };
      organization?: { type?: string; reportsTo?: string | null };
    };
    expect(config.role).toBe("CEO");
    expect(config.runtime?.provider?.id).toBe("openclaw");
    expect(config.organization?.type).toBe("manager");
    expect(config.organization?.reportsTo).toBeNull();
    expect(result.agent.role).toBe("CEO");

    const index = JSON.parse(
      await readFile(paths.agentsIndexJsonPath, "utf-8"),
    ) as {
      agents: string[];
    };
    expect(index.agents).toEqual(["ceo"]);
    expect(result.createdPaths).not.toContain(
      path.join(result.agent.workspaceDir, "AGENTS.md"),
    );
  });

  it("defaults non-ceo reportsTo to ceo when omitted", async () => {
    const { service, paths } = await createAgentServiceWithPaths();

    const result = await service.ensureAgent(paths, {
      id: "developer",
      displayName: "Developer",
    });

    const config = JSON.parse(
      await readFile(
        path.join(result.agent.internalConfigDir, "config.json"),
        "utf-8",
      ),
    ) as {
      organization?: { reportsTo?: string | null };
    };
    expect(config.organization?.reportsTo).toBe("ceo");
  });

  it("supports explicit reportsTo manager when creating an agent", async () => {
    const { service, paths } = await createAgentServiceWithPaths();

    const result = await service.ensureAgent(
      paths,
      {
        id: "engineer",
        displayName: "Engineer",
      },
      {
        reportsTo: "CTO",
      },
    );

    const config = JSON.parse(
      await readFile(
        path.join(result.agent.internalConfigDir, "config.json"),
        "utf-8",
      ),
    ) as {
      organization?: { reportsTo?: string | null };
    };
    expect(config.organization?.reportsTo).toBe("cto");
  });

  it("stores explicit role when provided during creation", async () => {
    const { service, paths } = await createAgentServiceWithPaths();

    const result = await service.ensureAgent(
      paths,
      {
        id: "neo",
        displayName: "Neo",
      },
      {
        role: "Developer",
      },
    );

    const config = JSON.parse(
      await readFile(
        path.join(result.agent.internalConfigDir, "config.json"),
        "utf-8",
      ),
    ) as {
      role?: string;
    };
    expect(config.role).toBe("Developer");
    expect(result.agent.role).toBe("Developer");
  });

  it("does not create workspace bootstrap markdown for non-default agents", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();

    const result = await service.ensureAgent(paths, {
      id: "developer",
      displayName: "Developer",
    });

    expect(
      await fileSystem.exists(
        path.join(result.agent.workspaceDir, "AGENTS.md"),
      ),
    ).toBe(false);
    expect(
      await fileSystem.exists(path.join(result.agent.workspaceDir, "ROLE.md")),
    ).toBe(false);
  });

  it("keeps CEO First Run, replaces Every Session, preserves SOUL.md, and writes ROLE/BOOTSTRAP", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();
    await service.ensureAgent(paths, { id: "ceo", displayName: "CEO" });

    const ceoWorkspace = path.join(paths.workspacesDir, "ceo");
    const agentsPath = path.join(ceoWorkspace, "AGENTS.md");
    const rolePath = path.join(ceoWorkspace, "ROLE.md");
    const soulPath = path.join(ceoWorkspace, "SOUL.md");
    const bootstrapPath = path.join(ceoWorkspace, "BOOTSTRAP.md");
    const userPath = path.join(ceoWorkspace, "USER.md");
    await fileSystem.ensureDir(ceoWorkspace);
    await writeFile(
      agentsPath,
      [
        "foo",
        "",
        "## First Run",
        "bar",
        "",
        "## Every Session",
        "legacy session instructions",
        "",
        "## Another section",
        "baz",
        "",
      ].join("\n"),
      "utf-8",
    );
    await writeFile(
      soulPath,
      ["# SOUL.md - Custom", "", "Legacy body"].join("\n"),
      "utf-8",
    );
    await writeFile(bootstrapPath, "# bootstrap\n", "utf-8");
    await writeFile(userPath, "# user\n", "utf-8");

    await service.ensureCeoWorkspaceBootstrap(paths);

    const agentsMarkdown = await readFile(agentsPath, "utf-8");
    const roleMarkdown = await readFile(rolePath, "utf-8");
    const soulMarkdown = await readFile(soulPath, "utf-8");
    const bootstrapMarkdown = await readFile(bootstrapPath, "utf-8");
    expect(agentsMarkdown).toContain("foo");
    expect(agentsMarkdown).toContain("## First Run");
    expect(agentsMarkdown).toContain("bar");
    expect(agentsMarkdown).not.toContain("legacy session instructions");
    expect(agentsMarkdown).toContain("## Another section");
    expect(agentsMarkdown).toContain("baz");
    expect(agentsMarkdown).not.toContain("## Your Role");
    expect(agentsMarkdown).toContain("## Every Session");
    expect(agentsMarkdown).toContain("Read `SOUL.md` — this is who you are");
    expect(agentsMarkdown).toContain(
      "4. **If in MAIN SESSION**: Also read `MEMORY.md`",
    );
    expect(agentsMarkdown).toContain(
      "Use OpenGoat tools directly (`opengoat_*`). Do not rely on shell CLI commands.",
    );
    expect(agentsMarkdown).toContain("## The Organization");
    expect(agentsMarkdown).toContain(
      "You have access to the organization's context and wiki on `../../organization`",
    );
    expect(roleMarkdown).toContain(
      "# ROLE.md - Your position in the organization",
    );
    expect(roleMarkdown).toContain(
      "You are the CEO of an organization fully run by AI agents.",
    );
    expect(roleMarkdown).toContain("- Your id: ceo (agent id)");
    expect(roleMarkdown).toContain("- Your name: CEO");
    expect(roleMarkdown).toContain("- Role: CEO");
    expect(roleMarkdown).toContain(
      '- For info about your reportees, call tool `opengoat_agent_info` with `{"agentId":"ceo"}`.',
    );
    expect(roleMarkdown).toContain(
      "- Use OpenGoat tools directly (`opengoat_*`), not shell CLI commands.",
    );
    expect(roleMarkdown).toContain(
      "- To delegate and coordinate work, use `og-*` skills.",
    );
    expect(soulMarkdown).toBe(["# SOUL.md - Custom", "", "Legacy body"].join("\n"));
    expect(bootstrapMarkdown.trimEnd()).toBe(renderCeoBootstrapMarkdown());
    expect(bootstrapMarkdown).not.toContain("# bootstrap");
    expect(await fileSystem.exists(userPath)).toBe(false);
  });

  it("removes First Run and replaces Every Session for non-ceo AGENTS.md", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();
    await service.ensureAgent(paths, { id: "engineer", displayName: "Avery" });

    const workspace = path.join(paths.workspacesDir, "engineer");
    const agentsPath = path.join(workspace, "AGENTS.md");
    await fileSystem.ensureDir(workspace);
    await writeFile(
      agentsPath,
      [
        "foo",
        "",
        "## First Run",
        "first-run-content",
        "",
        "## Every Session",
        "legacy session content",
        "",
        "## Another section",
        "baz",
        "",
      ].join("\n"),
      "utf-8",
    );

    await service.ensureAgentWorkspaceBootstrap(paths, {
      agentId: "engineer",
      displayName: "Avery",
      role: "Backend Engineer",
    });

    const agentsMarkdown = await readFile(agentsPath, "utf-8");
    expect(agentsMarkdown).toContain("foo");
    expect(agentsMarkdown).toContain("## Another section");
    expect(agentsMarkdown).toContain("baz");
    expect(agentsMarkdown).not.toContain("## First Run");
    expect(agentsMarkdown).not.toContain("first-run-content");
    expect(agentsMarkdown).not.toContain("legacy session content");
    expect(agentsMarkdown).toContain("## Every Session");
    expect(agentsMarkdown).toContain("Read `SOUL.md` — this is who you are");
    expect(agentsMarkdown).toContain(
      "Use OpenGoat tools directly (`opengoat_*`). Do not rely on shell CLI commands.",
    );
    expect(agentsMarkdown).toContain("## The Organization");
  });

  it("writes ROLE.md for non-ceo agents with id/name/role details", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();

    await service.ensureAgent(paths, { id: "engineer", displayName: "Avery" });

    const workspace = path.join(paths.workspacesDir, "engineer");
    const rolePath = path.join(workspace, "ROLE.md");
    const bootstrapPath = path.join(workspace, "BOOTSTRAP.md");
    const userPath = path.join(workspace, "USER.md");
    await fileSystem.ensureDir(workspace);
    await writeFile(bootstrapPath, "# bootstrap\n", "utf-8");
    await writeFile(userPath, "# user\n", "utf-8");

    await service.ensureAgentWorkspaceBootstrap(paths, {
      agentId: "engineer",
      displayName: "Avery",
      role: "Backend Engineer",
    });

    const roleMarkdown = await readFile(rolePath, "utf-8");
    expect(roleMarkdown).toContain(
      "# ROLE.md - Your position in the organization",
    );
    expect(roleMarkdown).toContain(
      "You are part of an organization fully run by AI agents.",
    );
    expect(roleMarkdown).toContain("- Your id: engineer (agent id)");
    expect(roleMarkdown).toContain("- Your name: Avery");
    expect(roleMarkdown).toContain("- Role: Backend Engineer");
    expect(roleMarkdown).toContain(
      '- For info about your level on the organization, call tool `opengoat_agent_info` with `{"agentId":"engineer"}`.',
    );
    expect(roleMarkdown).toContain(
      "- Use OpenGoat tools directly (`opengoat_*`), not shell CLI commands.",
    );
    expect(roleMarkdown).toContain(
      "- To delegate and coordinate work, use `og-*` skills.",
    );
    expect(await fileSystem.exists(bootstrapPath)).toBe(false);
    expect(await fileSystem.exists(userPath)).toBe(false);
    expect(await fileSystem.exists(path.join(workspace, "opengoat"))).toBe(
      true,
    );
  });

  it("never changes global default agent during agent creation", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();

    await fileSystem.writeFile(
      paths.globalConfigJsonPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          defaultAgent: "ceo",
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z",
        },
        null,
        2,
      ) + "\n",
    );

    await service.ensureAgent(paths, {
      id: "research-analyst",
      displayName: "Research Analyst",
    });

    const config = JSON.parse(
      await readFile(paths.globalConfigJsonPath, "utf-8"),
    ) as {
      defaultAgent: string;
      createdAt: string;
      updatedAt: string;
    };

    expect(config.defaultAgent).toBe("ceo");
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
          updatedAt: "2026-02-01T00:00:00.000Z",
        },
        null,
        2,
      ) + "\n",
    );

    await service.ensureAgent(paths, {
      id: "beta",
      displayName: "Beta",
    });

    const index = JSON.parse(
      await readFile(paths.agentsIndexJsonPath, "utf-8"),
    ) as {
      agents: string[];
    };
    expect(index.agents).toEqual(["alpha", "beta", "zeta"]);
  });

  it("lists agents sorted and falls back to id when config is unreadable", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();

    await fileSystem.ensureDir(path.join(paths.agentsDir, "z-agent"));
    await fileSystem.writeFile(
      path.join(paths.agentsDir, "z-agent", "config.json"),
      JSON.stringify({ displayName: "Zed" }, null, 2) + "\n",
    );
    await fileSystem.ensureDir(path.join(paths.agentsDir, "a-agent"));
    await fileSystem.writeFile(
      path.join(paths.agentsDir, "a-agent", "config.json"),
      "{bad json",
    );

    const agents = await service.listAgents(paths);

    expect(agents.map((agent) => agent.id)).toEqual(["a-agent", "z-agent"]);
    expect(agents[0]?.displayName).toBe("a-agent");
    expect(agents[0]?.role).toBe("Team Member");
    expect(agents[1]?.displayName).toBe("Zed");
    expect(agents[1]?.role).toBe("Team Member");
  });

  it("is idempotent and does not overwrite existing config.json", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();

    await service.ensureAgent(paths, { id: "ceo", displayName: "CEO" });

    const configPath = path.join(paths.agentsDir, "ceo", "config.json");
    await fileSystem.writeFile(
      configPath,
      JSON.stringify({ displayName: "Custom CEO" }, null, 2) + "\n",
    );

    const second = await service.ensureAgent(paths, {
      id: "ceo",
      displayName: "CEO",
    });

    expect(second.createdPaths).toEqual([]);
    expect(second.skippedPaths.length).toBeGreaterThan(0);
    expect(await readFile(configPath, "utf-8")).toContain("Custom CEO");
  });

  it("updates manager relationship in config.json", async () => {
    const { service, paths } = await createAgentServiceWithPaths();
    await service.ensureAgent(paths, { id: "ceo", displayName: "CEO" });
    await service.ensureAgent(
      paths,
      { id: "cto", displayName: "CTO" },
      { type: "manager", reportsTo: "ceo" },
    );
    await service.ensureAgent(paths, {
      id: "engineer",
      displayName: "Engineer",
    });

    const result = await service.setAgentManager(paths, "engineer", "cto");

    expect(result.agentId).toBe("engineer");
    expect(result.previousReportsTo).toBe("ceo");
    expect(result.reportsTo).toBe("cto");

    const config = JSON.parse(
      await readFile(
        path.join(paths.agentsDir, "engineer", "config.json"),
        "utf-8",
      ),
    ) as {
      organization?: { reportsTo?: string | null };
    };
    expect(config.organization?.reportsTo).toBe("cto");
    expect(result.updatedPaths).toEqual([
      path.join(paths.agentsDir, "engineer", "config.json"),
    ]);
  });

  it("rejects manager reassignment that would create a cycle", async () => {
    const { service, paths } = await createAgentServiceWithPaths();
    await service.ensureAgent(paths, { id: "ceo", displayName: "CEO" });
    await service.ensureAgent(
      paths,
      { id: "cto", displayName: "CTO" },
      { type: "manager", reportsTo: "ceo" },
    );
    await service.ensureAgent(
      paths,
      { id: "engineer", displayName: "Engineer" },
      { reportsTo: "cto" },
    );

    await expect(
      service.setAgentManager(paths, "cto", "engineer"),
    ).rejects.toThrow("create a cycle");
  });

  it("removes a non-default agent internal config and prunes optional workspace dir", async () => {
    const { service, paths, fileSystem } = await createAgentServiceWithPaths();
    await service.ensureAgent(paths, {
      id: "developer",
      displayName: "Developer",
    });

    const deletion = await service.removeAgent(paths, "developer");

    expect(deletion.agentId).toBe("developer");
    expect(deletion.existed).toBe(true);
    expect(deletion.removedPaths).toEqual([
      path.join(paths.agentsDir, "developer"),
    ]);
    expect(
      await fileSystem.exists(path.join(paths.workspacesDir, "developer")),
    ).toBe(false);
    expect(
      await fileSystem.exists(path.join(paths.agentsDir, "developer")),
    ).toBe(false);
  });

  it("prevents deleting ceo", async () => {
    const { service, paths } = await createAgentServiceWithPaths();
    await service.ensureAgent(paths, { id: "ceo", displayName: "CEO" });

    await expect(service.removeAgent(paths, "ceo")).rejects.toThrow(
      "Cannot delete ceo",
    );
  });
});

function createAgentService(): AgentService {
  return new AgentService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort(),
    nowIso: () => "2026-02-06T00:00:00.000Z",
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
    organizationDir: path.join(root, "organization"),
    agentsDir: path.join(root, "agents"),
    skillsDir: path.join(root, "skills"),
    providersDir: path.join(root, "providers"),
    sessionsDir: path.join(root, "sessions"),
    runsDir: path.join(root, "runs"),
    globalConfigJsonPath: path.join(root, "config.json"),
    globalConfigMarkdownPath: path.join(root, "CONFIG.md"),
    agentsIndexJsonPath: path.join(root, "agents.json"),
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
    fileSystem,
  };
}
