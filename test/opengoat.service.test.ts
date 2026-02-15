import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BaseProvider,
  OpenGoatService,
  ProviderRegistry,
  type ProviderCreateAgentOptions,
  type ProviderDeleteAgentOptions,
  type ProviderExecutionResult,
  type ProviderInvokeOptions,
} from "../packages/core/src/index.js";
import type {
  CommandRunRequest,
  CommandRunResult,
  CommandRunnerPort,
} from "../packages/core/src/core/ports/command-runner.port.js";
import { NodeFileSystem } from "../packages/core/src/platform/node/node-file-system.js";
import { NodePathPort } from "../packages/core/src/platform/node/node-path.port.js";
import {
  TestPathsProvider,
  createTempDir,
  removeTempDir,
} from "./helpers/temp-opengoat.js";

const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("OpenGoatService", () => {
  it("exposes home path and bootstraps ceo as default agent", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const service = createService(root).service;
    expect(service.getHomeDir()).toBe(root);

    const result = await service.initialize();
    expect(result.defaultAgent).toBe("ceo");

    const config = JSON.parse(
      await readFile(path.join(root, "config.json"), "utf-8"),
    ) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("ceo");
  });

  it("creates and lists agents through the facade", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service } = createService(root);
    await service.initialize();

    const created = await service.createAgent("Research Analyst", {
      type: "individual",
      reportsTo: "ceo",
      skills: ["research"],
      role: "Developer",
    });

    expect(created.agent.id).toBe("research-analyst");
    expect(created.agent.role).toBe("Developer");
    expect(created.runtimeSync?.runtimeId).toBe("openclaw");
    expect(created.runtimeSync?.code).toBe(0);

    const createdConfig = JSON.parse(
      await readFile(
        path.join(root, "agents", "research-analyst", "config.json"),
        "utf-8",
      ),
    ) as { runtime?: { skills?: { assigned?: string[] } } };
    expect(createdConfig.runtime?.skills?.assigned).toEqual(["research"]);
    await expect(
      access(
        path.join(
          root,
          "workspaces",
          "research-analyst",
          "skills",
          "og-board-individual",
          "SKILL.md",
        ),
        constants.F_OK,
      ),
    ).resolves.toBeUndefined();

    const agents = await service.listAgents();
    expect(agents.map((agent) => agent.id)).toEqual([
      "ceo",
      "research-analyst",
    ]);
    expect(agents.find((agent) => agent.id === "ceo")?.role).toBe("CEO");
    expect(agents.find((agent) => agent.id === "research-analyst")?.role).toBe(
      "Developer",
    );
  });

  it("removes OpenClaw USER.md after agent runtime setup", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const provider = new FakeOpenClawProvider();
    provider.seedUserMarkdownOnCreate = true;
    const { service } = createService(root, provider);
    await service.initialize();

    await service.createAgent("Designer");

    await expect(
      access(
        path.join(root, "workspaces", "designer", "USER.md"),
        constants.F_OK,
      ),
    ).rejects.toBeTruthy();
  });

  it("leaves ROLE.md role empty when agent role is not provided", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service } = createService(root);
    await service.initialize();
    await service.createAgent("Engineer", {
      type: "individual",
      reportsTo: "ceo",
    });

    const roleMarkdown = await readFile(
      path.join(root, "workspaces", "engineer", "ROLE.md"),
      "utf-8",
    );
    expect(roleMarkdown).toContain("- Role: ");
    expect(roleMarkdown).not.toContain("- Role: Individual Contributor");
  });

  it("lists direct and recursive reportees", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service } = createService(root);
    await service.initialize();
    await service.createAgent("CTO", { type: "manager", reportsTo: "ceo" });
    await service.createAgent("QA", { type: "individual", reportsTo: "ceo" });
    await service.createAgent("Engineer", {
      type: "individual",
      reportsTo: "cto",
    });
    await service.createAgent("Intern", {
      type: "individual",
      reportsTo: "engineer",
    });

    const direct = await service.listDirectReportees("ceo");
    expect(direct).toEqual(["cto", "qa"]);

    const all = await service.listAllReportees("ceo");
    expect(all).toEqual(["cto", "engineer", "intern", "qa"]);

    await expect(service.listDirectReportees("missing")).rejects.toThrow(
      'Agent "missing" does not exist.',
    );
    await expect(service.listAllReportees("missing")).rejects.toThrow(
      'Agent "missing" does not exist.',
    );
  });

  it("returns agent info with direct reportees and totals", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service } = createService(root);
    await service.initialize();
    await service.createAgent("CTO", {
      type: "manager",
      reportsTo: "ceo",
      role: "Chief Technology Officer",
    });
    await service.createAgent("QA", {
      type: "individual",
      reportsTo: "ceo",
      role: "QA Engineer",
    });
    await service.createAgent("Engineer", {
      type: "individual",
      reportsTo: "cto",
      role: "Software Engineer",
    });

    const info = await service.getAgentInfo("ceo");
    expect(info.id).toBe("ceo");
    expect(info.name).toBe("CEO");
    expect(info.role).toBe("CEO");
    expect(info.totalReportees).toBe(3);
    expect(info.directReportees).toEqual([
      {
        id: "cto",
        name: "CTO",
        role: "Chief Technology Officer",
        totalReportees: 1,
      },
      {
        id: "qa",
        name: "QA",
        role: "QA Engineer",
        totalReportees: 0,
      },
    ]);
  });

  it("allows managers to assign tasks to indirect reportees", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service } = createService(root);
    await service.initialize();
    await service.createAgent("CTO", { type: "manager", reportsTo: "ceo" });
    await service.createAgent("Engineer", {
      type: "individual",
      reportsTo: "cto",
    });

    const task = await service.createTask("ceo", {
      title: "Ship core endpoint",
      description: "Implement and test endpoint",
      assignedTo: "engineer",
    });
    expect(task.assignedTo).toBe("engineer");
  });

  it("repairs stale OpenClaw ceo workspace mapping during initialize", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const commandRunner = new FakeCommandRunner(async (request) => {
      if (
        request.args[0] === "skills" &&
        request.args[1] === "list" &&
        request.args.includes("--json")
      ) {
        return {
          code: 0,
          stdout: JSON.stringify({
            workspaceDir: path.join(root, "openclaw-workspace"),
            managedSkillsDir: path.join(root, "openclaw-managed-skills"),
            skills: [],
          }),
          stderr: "",
        };
      }
      if (
        request.args[0] === "agents" &&
        request.args[1] === "list" &&
        request.args.includes("--json")
      ) {
        return {
          code: 0,
          stdout: JSON.stringify([
            {
              id: "ceo",
              workspace: path.join(root, "stale", "workspaces", "ceo"),
              agentDir: path.join(root, "stale", "agents", "ceo"),
            },
          ]),
          stderr: "",
        };
      }
      return {
        code: 0,
        stdout: "",
        stderr: "",
      };
    });

    const { service, provider } = createService(
      root,
      new FakeOpenClawProvider(),
      commandRunner,
    );
    await service.setOpenClawGatewayConfig({ mode: "local" });
    await service.initialize();

    expect(
      provider.deletedAgents.some((entry) => entry.agentId === "ceo"),
    ).toBe(true);
    expect(
      provider.createdAgents.filter((entry) => entry.agentId === "ceo").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("uses command overrides from execution env for OpenClaw passthrough", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const commandRunner = new FakeCommandRunner(async () => {
      return {
        code: 0,
        stdout: "2026.2.9\n",
        stderr: "",
      };
    });
    const { service } = createService(
      root,
      new FakeOpenClawProvider(),
      commandRunner,
    );

    const customCommand = "/tmp/custom-openclaw";
    await service.runOpenClaw(["--version"], {
      env: {
        OPENCLAW_CMD: customCommand,
        PATH: "",
      },
    });

    expect(commandRunner.requests).toHaveLength(1);
    expect(commandRunner.requests[0]?.command).toBe(customCommand);
    const commandPathEntries =
      commandRunner.requests[0]?.env?.PATH?.split(path.delimiter) ?? [];
    expect(commandPathEntries).toContain(
      path.join(homedir(), ".npm-global", "bin"),
    );
  });

  it("syncs OpenClaw role skills for the created agent and its manager", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service } = createService(root);
    await service.initialize();
    await service.createAgent("CTO", { type: "manager", reportsTo: "ceo" });

    const staleManagerSkillDir = path.join(
      root,
      "workspaces",
      "cto",
      "skills",
      "og-board-individual",
    );
    await new NodeFileSystem().ensureDir(staleManagerSkillDir);
    await writeFile(
      path.join(staleManagerSkillDir, "SKILL.md"),
      "# stale manager skill\n",
      "utf-8",
    );

    await service.createAgent("Engineer", {
      type: "individual",
      reportsTo: "cto",
    });

    await expect(
      access(
        path.join(
          root,
          "workspaces",
          "engineer",
          "skills",
          "og-board-individual",
          "SKILL.md",
        ),
        constants.F_OK,
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(
        path.join(
          root,
          "workspaces",
          "cto",
          "skills",
          "og-board-manager",
          "SKILL.md",
        ),
        constants.F_OK,
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(staleManagerSkillDir, constants.F_OK),
    ).rejects.toBeTruthy();
  });

  it("removes role skills from OpenClaw managed skills directory", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const managedSkillsDir = path.join(root, "openclaw-managed-skills");
    const staleBoardManagerSkillDir = path.join(managedSkillsDir, "og-board-manager");
    const staleBoardIndividualSkillDir = path.join(
      managedSkillsDir,
      "og-board-individual",
    );
    const staleManagedSkillDir = path.join(managedSkillsDir, "manager");
    await new NodeFileSystem().ensureDir(staleBoardManagerSkillDir);
    await new NodeFileSystem().ensureDir(staleBoardIndividualSkillDir);
    await new NodeFileSystem().ensureDir(staleManagedSkillDir);
    await writeFile(
      path.join(staleBoardManagerSkillDir, "SKILL.md"),
      "# stale manager board skill\n",
      "utf-8",
    );
    await writeFile(
      path.join(staleBoardIndividualSkillDir, "SKILL.md"),
      "# stale individual board skill\n",
      "utf-8",
    );
    await writeFile(
      path.join(staleManagedSkillDir, "SKILL.md"),
      "# stale managed skill\n",
      "utf-8",
    );

    const commandRunner = new FakeCommandRunner(async (request) => {
      if (
        request.args[0] === "skills" &&
        request.args[1] === "list" &&
        request.args.includes("--json")
      ) {
        return {
          code: 0,
          stdout: JSON.stringify({
            workspaceDir: path.join(root, "openclaw-workspace"),
            managedSkillsDir,
            skills: [],
          }),
          stderr: "",
        };
      }
      if (
        request.args[0] === "agents" &&
        request.args[1] === "list" &&
        request.args.includes("--json")
      ) {
        return {
          code: 0,
          stdout: JSON.stringify([]),
          stderr: "",
        };
      }
      return {
        code: 0,
        stdout: "",
        stderr: "",
      };
    });

    const { service } = createService(
      root,
      new FakeOpenClawProvider(),
      commandRunner,
    );
    await service.initialize();
    await service.createAgent("CTO", { type: "manager", reportsTo: "ceo" });

    await expect(
      access(
        path.join(managedSkillsDir, "og-board-manager"),
        constants.F_OK,
      ),
    ).rejects.toBeTruthy();
    await expect(
      access(
        path.join(managedSkillsDir, "og-board-individual"),
        constants.F_OK,
      ),
    ).rejects.toBeTruthy();
    await expect(
      access(staleManagedSkillDir, constants.F_OK),
    ).rejects.toBeTruthy();
    expect(
      commandRunner.requests.some(
        (request) =>
          request.args[0] === "skills" &&
          request.args[1] === "list" &&
          request.args.includes("--json"),
      ),
    ).toBe(true);
  });

  it("creates agents via gateway fallbacks when openclaw binary is unavailable", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const commandRunner = createRuntimeDefaultsCommandRunner(
      root,
      async (request) => {
        if (
          request.args[0] === "skills" &&
          request.args[1] === "list" &&
          request.args.includes("--json")
        ) {
          const error = new Error("spawn openclaw ENOENT");
          (error as Error & { code?: string }).code = "ENOENT";
          throw error;
        }
        if (
          request.args[0] === "agents" &&
          request.args[1] === "list" &&
          request.args.includes("--json")
        ) {
          const error = new Error("spawn openclaw ENOENT");
          (error as Error & { code?: string }).code = "ENOENT";
          throw error;
        }
        if (
          request.args[0] === "config" &&
          request.args[1] === "get" &&
          request.args[2] === "agents.list"
        ) {
          const error = new Error("spawn openclaw ENOENT");
          (error as Error & { code?: string }).code = "ENOENT";
          throw error;
        }
        return undefined;
      },
    );

    const { service } = createService(
      root,
      new FakeOpenClawProvider(),
      commandRunner,
    );
    const providerService = (
      service as unknown as {
        providerService: {
          getOpenClawSkillsStatusViaGateway: (
            ...args: unknown[]
          ) => Promise<unknown>;
          listOpenClawAgentsViaGateway: (
            ...args: unknown[]
          ) => Promise<unknown>;
          syncOpenClawAgentExecutionPoliciesViaGateway: (
            ...args: unknown[]
          ) => Promise<string[]>;
        };
      }
    ).providerService;

    const skillsFallbackSpy = vi
      .spyOn(providerService, "getOpenClawSkillsStatusViaGateway")
      .mockResolvedValue({
        workspaceDir: path.join(root, "openclaw-workspace"),
        managedSkillsDir: path.join(root, "openclaw-managed-skills"),
        skills: [],
      });
    const agentsFallbackSpy = vi
      .spyOn(providerService, "listOpenClawAgentsViaGateway")
      .mockResolvedValue([
        {
          id: "ceo",
          workspace: path.join(root, "workspaces", "ceo"),
          agentDir: path.join(root, "agents", "ceo"),
        },
      ]);
    const policiesFallbackSpy = vi
      .spyOn(providerService, "syncOpenClawAgentExecutionPoliciesViaGateway")
      .mockResolvedValue([]);

    await service.initialize();
    const created = await service.createAgent("Marcos", {
      type: "individual",
      reportsTo: "ceo",
    });

    expect(created.agent.id).toBe("marcos");
    expect(skillsFallbackSpy).toHaveBeenCalled();
    expect(agentsFallbackSpy).toHaveBeenCalled();
    expect(policiesFallbackSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining(["marcos"]),
      expect.anything(),
    );
  });

  it("repairs stale OpenClaw ceo workspace mapping to OPENGOAT_HOME", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const commandRunner = new FakeCommandRunner(async (request) => {
      if (
        request.args[0] === "skills" &&
        request.args[1] === "list" &&
        request.args.includes("--json")
      ) {
        return {
          code: 0,
          stdout: JSON.stringify({
            workspaceDir: path.join(root, "openclaw-workspace"),
            managedSkillsDir: path.join(root, "openclaw-managed-skills"),
            skills: [],
          }),
          stderr: "",
        };
      }
      if (
        request.args[0] === "agents" &&
        request.args[1] === "list" &&
        request.args.includes("--json")
      ) {
        return {
          code: 0,
          stdout: JSON.stringify([
            {
              id: "ceo",
              workspace: path.join(root, "stale", "workspaces", "ceo"),
              agentDir: path.join(root, "stale", "agents", "ceo"),
            },
          ]),
          stderr: "",
        };
      }
      return {
        code: 0,
        stdout: "",
        stderr: "",
      };
    });

    const { service, provider } = createService(
      root,
      new FakeOpenClawProvider(),
      commandRunner,
    );
    await service.initialize();

    const result = await service.syncRuntimeDefaults();
    expect(result.ceoSynced).toBe(true);
    expect(
      provider.deletedAgents.some((entry) => entry.agentId === "ceo"),
    ).toBe(true);
    expect(
      provider.createdAgents.filter((entry) => entry.agentId === "ceo")
        .length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("still syncs OpenClaw when the local agent already exists", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service, provider } = createService(root);
    await service.initialize();

    await service.createAgent("Research Analyst");
    const second = await service.createAgent("Research Analyst");

    expect(second.alreadyExisted).toBe(true);
    expect(second.runtimeSync?.runtimeId).toBe("openclaw");
    expect(
      provider.createdAgents.filter(
        (entry) => entry.agentId === "research-analyst",
      ),
    ).toHaveLength(2);
  });

  it("does not delete local files when sync fails for an already existing agent", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service, provider } = createService(root);
    await service.initialize();
    await service.createAgent("Research Analyst");
    provider.failCreate = true;

    await expect(service.createAgent("Research Analyst")).rejects.toThrow(
      "OpenClaw agent creation failed",
    );

    const agents = await service.listAgents();
    expect(agents.map((agent) => agent.id)).toEqual([
      "ceo",
      "research-analyst",
    ]);
  });

  it("treats OpenClaw already-exists response as successful sync", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service, provider } = createService(root);
    await service.initialize();
    await service.createAgent("Research Analyst");
    provider.createAlreadyExists = true;

    const repeated = await service.createAgent("Research Analyst");
    expect(repeated.alreadyExisted).toBe(true);
    expect(repeated.runtimeSync?.runtimeId).toBe("openclaw");
  });

  it("does not treat non-duplicate 'exists' errors as successful sync", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service, provider } = createService(root);
    await service.initialize();
    provider.failCreate = true;
    provider.createFailureStderr = "profile does not exist";

    await expect(service.createAgent("Research Analyst")).rejects.toThrow(
      "OpenClaw agent creation failed",
    );
  });

  it("rolls back local files when OpenClaw create fails", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const fakeProvider = new FakeOpenClawProvider();
    fakeProvider.failCreate = true;
    const { service } = createService(root, fakeProvider);
    await service.initialize();

    await expect(service.createAgent("Broken Agent")).rejects.toThrow(
      "OpenClaw agent creation failed",
    );

    const agents = await service.listAgents();
    expect(agents.map((agent) => agent.id)).toEqual(["ceo"]);
  });

  it("deletes local and OpenClaw runtime agents", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service, provider } = createService(root);
    await service.initialize();
    await service.createAgent("Research Analyst");

    const deleted = await service.deleteAgent("research-analyst");

    expect(deleted.existed).toBe(true);
    expect(deleted.runtimeSync?.runtimeId).toBe("openclaw");
    expect(provider.deletedAgents.map((entry) => entry.agentId)).toContain(
      "research-analyst",
    );
  });

  it("supports force delete when OpenClaw delete fails", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const fakeProvider = new FakeOpenClawProvider();
    fakeProvider.failDelete = true;
    const { service } = createService(root, fakeProvider);
    await service.initialize();
    await service.createAgent("Research Analyst");

    await expect(service.deleteAgent("research-analyst")).rejects.toThrow(
      "OpenClaw agent deletion failed",
    );

    const forced = await service.deleteAgent("research-analyst", {
      force: true,
    });
    expect(forced.existed).toBe(true);
  });

  it("syncs runtime defaults with ceo", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service, provider } = createService(root);
    await service.initialize();

    const result = await service.syncRuntimeDefaults();

    expect(result.ceoSynced).toBe(true);
    expect(
      provider.createdAgents.some((entry) => entry.agentId === "ceo"),
    ).toBe(true);
    expect(provider.deletedAgents).toHaveLength(0);
  });

  it("parses OpenClaw skills list JSON even when config warnings are prefixed", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const pluginSourceDir = path.join(root, "plugin-src");
    await mkdir(pluginSourceDir, { recursive: true });
    await writeFile(
      path.join(pluginSourceDir, "openclaw.plugin.json"),
      "{}\n",
      "utf-8",
    );

    const originalPluginPath = process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
    process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH = pluginSourceDir;

    const commandRunner = createRuntimeDefaultsCommandRunner(
      root,
      async (request) => {
        if (
          request.args[0] === "skills" &&
          request.args[1] === "list" &&
          request.args.includes("--json")
        ) {
          return {
            code: 0,
            stdout: `Config warnings:\\n- duplicate plugin id detected\\n${JSON.stringify(
              {
                workspaceDir: path.join(root, "openclaw-workspace"),
                managedSkillsDir: path.join(root, "openclaw-managed-skills"),
                skills: [],
              },
            )}`,
            stderr: "",
          };
        }
        return undefined;
      },
    );

    try {
      const { service } = createService(
        root,
        new FakeOpenClawProvider(),
        commandRunner,
      );
      const result = await service.syncRuntimeDefaults();
      expect(
        result.warnings.some((warning) =>
          warning.includes("skills list returned non-JSON output"),
        ),
      ).toBe(false);
    } finally {
      if (originalPluginPath === undefined) {
        delete process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
      } else {
        process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH = originalPluginPath;
      }
    }
  });

  it("does not recreate OpenClaw agent when ceo is already registered with matching paths", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const provider = new FakeOpenClawProvider();
    const commandRunner = createRuntimeDefaultsCommandRunner(root);
    const { service } = createService(root, provider, commandRunner);
    await service.initialize();

    provider.createdAgents.length = 0;

    const result = await service.syncRuntimeDefaults();

    expect(result.ceoSynced).toBe(true);
    expect(
      provider.createdAgents.some((entry) => entry.agentId === "ceo"),
    ).toBe(false);
  });

  it("enforces OpenClaw agent policy: sandbox off and tools allow all", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const commandRunner = new FakeCommandRunner(async (request) => {
      if (
        request.args[0] === "skills" &&
        request.args[1] === "list" &&
        request.args.includes("--json")
      ) {
        return {
          code: 0,
          stdout: JSON.stringify({
            workspaceDir: path.join(root, "openclaw-workspace"),
            managedSkillsDir: path.join(root, "openclaw-managed-skills"),
            skills: [],
          }),
          stderr: "",
        };
      }
      if (
        request.args[0] === "agents" &&
        request.args[1] === "list" &&
        request.args.includes("--json")
      ) {
        return {
          code: 0,
          stdout: JSON.stringify([
            {
              id: "ceo",
              workspace: path.join(root, "workspaces", "ceo"),
              agentDir: path.join(root, "agents", "ceo"),
            },
          ]),
          stderr: "",
        };
      }
      if (
        request.args[0] === "config" &&
        request.args[1] === "get" &&
        request.args[2] === "agents.list"
      ) {
        return {
          code: 0,
          stdout: JSON.stringify([
            {
              id: "ceo",
              workspace: path.join(root, "workspaces", "ceo"),
              agentDir: path.join(root, "agents", "ceo"),
            },
          ]),
          stderr: "",
        };
      }
      if (
        request.args[0] === "config" &&
        request.args[1] === "set"
      ) {
        return {
          code: 0,
          stdout: "",
          stderr: "",
        };
      }
      return {
        code: 0,
        stdout: "",
        stderr: "",
      };
    });

    const { service } = createService(
      root,
      new FakeOpenClawProvider(),
      commandRunner,
    );
    await service.initialize();

    expect(
      commandRunner.requests.some(
        (request) =>
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "agents.list[0].sandbox.mode" &&
          request.args[3] === "off",
      ),
    ).toBe(true);
    expect(
      commandRunner.requests.some(
        (request) =>
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "agents.list[0].tools.allow" &&
          request.args[3] === "[\"*\"]",
      ),
    ).toBe(true);
  });

  it("configures OpenClaw plugin source path and enables the OpenGoat plugin", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const pluginSourceDir = path.join(root, "plugin-src");
    await mkdir(pluginSourceDir, { recursive: true });
    await writeFile(
      path.join(pluginSourceDir, "openclaw.plugin.json"),
      "{}\n",
      "utf-8",
    );

    const originalPluginPath = process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
    process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH = pluginSourceDir;

    const commandRunner = new FakeCommandRunner(async (request) => {
      if (
        request.args[0] === "skills" &&
        request.args[1] === "list" &&
        request.args.includes("--json")
      ) {
        return {
          code: 0,
          stdout: JSON.stringify({
            workspaceDir: path.join(root, "openclaw-workspace"),
            managedSkillsDir: path.join(root, "openclaw-managed-skills"),
            skills: [],
          }),
          stderr: "",
        };
      }
      if (
        request.args[0] === "agents" &&
        request.args[1] === "list" &&
        request.args.includes("--json")
      ) {
        return {
          code: 0,
          stdout: JSON.stringify([
            {
              id: "ceo",
              workspace: path.join(root, "workspaces", "ceo"),
              agentDir: path.join(root, "agents", "ceo"),
            },
          ]),
          stderr: "",
        };
      }
      if (
        request.args[0] === "config" &&
        request.args[1] === "get" &&
        request.args[2] === "agents.list"
      ) {
        return {
          code: 0,
          stdout: JSON.stringify([
            {
              id: "ceo",
              workspace: path.join(root, "workspaces", "ceo"),
              agentDir: path.join(root, "agents", "ceo"),
            },
          ]),
          stderr: "",
        };
      }
      if (
        request.args[0] === "config" &&
        request.args[1] === "get" &&
        request.args[2] === "plugins.load.paths"
      ) {
        return {
          code: 1,
          stdout: "",
          stderr: "Config path not found: plugins.load.paths",
        };
      }
      if (
        request.args[0] === "config" &&
        request.args[1] === "set"
      ) {
        return {
          code: 0,
          stdout: "",
          stderr: "",
        };
      }

      return {
        code: 0,
        stdout: "",
        stderr: "",
      };
    });

    try {
      const { service } = createService(
        root,
        new FakeOpenClawProvider(),
        commandRunner,
      );
      await service.initialize();
    } finally {
      if (originalPluginPath === undefined) {
        delete process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
      } else {
        process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH = originalPluginPath;
      }
    }

    expect(
      commandRunner.requests.some(
        (request) =>
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.load.paths" &&
          request.args[3] === JSON.stringify([pluginSourceDir]),
      ),
    ).toBe(true);
    expect(
      commandRunner.requests.some(
        (request) =>
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.entries.openclaw-plugin.enabled" &&
          request.args[3] === "true",
      ),
    ).toBe(true);
  });

  it("skips plugin config writes when plugin source path cannot be resolved", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const originalPluginPath = process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
    const originalCwd = process.cwd();
    const originalArgvEntry = process.argv[1];
    const commandRunner = createRuntimeDefaultsCommandRunner(root);

    try {
      delete process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
      process.chdir(root);
      process.argv[1] = path.join(root, "bin", "opengoat.js");

      const { service } = createService(
        root,
        new FakeOpenClawProvider(),
        commandRunner,
      );
      const result = await service.syncRuntimeDefaults();

      expect(
        result.warnings.some((warning) =>
          warning.includes("OpenClaw OpenGoat plugin source path was not found"),
        ),
      ).toBe(true);
    } finally {
      process.chdir(originalCwd);
      process.argv[1] = originalArgvEntry;
      if (originalPluginPath === undefined) {
        delete process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
      } else {
        process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH = originalPluginPath;
      }
    }

    expect(
      commandRunner.requests.some(
        (request) =>
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.load.paths",
      ),
    ).toBe(false);
    expect(
      commandRunner.requests.some(
        (request) =>
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.entries.openclaw-plugin.enabled",
      ),
    ).toBe(false);
  });

  it("does not rewrite plugin load paths when the source path is already configured", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const pluginSourceDir = path.join(root, "plugin-src");
    await mkdir(pluginSourceDir, { recursive: true });
    await writeFile(
      path.join(pluginSourceDir, "openclaw.plugin.json"),
      "{}\n",
      "utf-8",
    );

    const originalPluginPath = process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
    process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH = pluginSourceDir;

    const commandRunner = createRuntimeDefaultsCommandRunner(
      root,
      async (request) => {
        if (
          request.args[0] === "config" &&
          request.args[1] === "get" &&
          request.args[2] === "plugins.load.paths"
        ) {
          return {
            code: 0,
            stdout: JSON.stringify([pluginSourceDir, "/tmp/existing"]),
            stderr: "",
          };
        }
        return undefined;
      },
    );

    try {
      const { service } = createService(
        root,
        new FakeOpenClawProvider(),
        commandRunner,
      );
      await service.syncRuntimeDefaults();
    } finally {
      if (originalPluginPath === undefined) {
        delete process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
      } else {
        process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH = originalPluginPath;
      }
    }

    expect(
      commandRunner.requests.some(
        (request) =>
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.load.paths",
      ),
    ).toBe(false);
    expect(
      commandRunner.requests.some(
        (request) =>
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.entries.openclaw-plugin.enabled" &&
          request.args[3] === "true",
      ),
    ).toBe(true);
  });

  it("deduplicates and prepends plugin load paths before saving OpenClaw config", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const pluginSourceDir = path.join(root, "plugin-src");
    await mkdir(pluginSourceDir, { recursive: true });
    await writeFile(
      path.join(pluginSourceDir, "openclaw.plugin.json"),
      "{}\n",
      "utf-8",
    );

    const originalPluginPath = process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
    process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH = pluginSourceDir;

    const commandRunner = createRuntimeDefaultsCommandRunner(
      root,
      async (request) => {
        if (
          request.args[0] === "config" &&
          request.args[1] === "get" &&
          request.args[2] === "plugins.load.paths"
        ) {
          return {
            code: 0,
            stdout: JSON.stringify([
              "/tmp/existing-a",
              "/tmp/existing-a",
              "/tmp/existing-b",
            ]),
            stderr: "",
          };
        }
        return undefined;
      },
    );

    try {
      const { service } = createService(
        root,
        new FakeOpenClawProvider(),
        commandRunner,
      );
      await service.syncRuntimeDefaults();
    } finally {
      if (originalPluginPath === undefined) {
        delete process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
      } else {
        process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH = originalPluginPath;
      }
    }

    expect(
      commandRunner.requests.some(
        (request) =>
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.load.paths" &&
          request.args[3] ===
            JSON.stringify([
              pluginSourceDir,
              "/tmp/existing-a",
              "/tmp/existing-b",
            ]),
      ),
    ).toBe(true);
  });

  it("removes duplicate OpenGoat plugin source paths with the same plugin id", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const pluginSourceDir = path.join(root, "plugin-src");
    const duplicatePluginDir = path.join(root, "duplicate-plugin-src");
    const unrelatedPluginDir = path.join(root, "unrelated-plugin-src");
    await mkdir(pluginSourceDir, { recursive: true });
    await mkdir(duplicatePluginDir, { recursive: true });
    await mkdir(unrelatedPluginDir, { recursive: true });
    await writeFile(
      path.join(pluginSourceDir, "openclaw.plugin.json"),
      JSON.stringify({ id: "openclaw-plugin" }, null, 2) + "\n",
      "utf-8",
    );
    await writeFile(
      path.join(duplicatePluginDir, "openclaw.plugin.json"),
      JSON.stringify({ id: "openclaw-plugin" }, null, 2) + "\n",
      "utf-8",
    );
    await writeFile(
      path.join(unrelatedPluginDir, "openclaw.plugin.json"),
      JSON.stringify({ id: "unrelated-plugin" }, null, 2) + "\n",
      "utf-8",
    );

    const originalPluginPath = process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
    process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH = pluginSourceDir;

    const commandRunner = createRuntimeDefaultsCommandRunner(
      root,
      async (request) => {
        if (
          request.args[0] === "config" &&
          request.args[1] === "get" &&
          request.args[2] === "plugins.load.paths"
        ) {
          return {
            code: 0,
            stdout: JSON.stringify([duplicatePluginDir, unrelatedPluginDir]),
            stderr: "",
          };
        }
        return undefined;
      },
    );

    try {
      const { service } = createService(
        root,
        new FakeOpenClawProvider(),
        commandRunner,
      );
      await service.syncRuntimeDefaults();
    } finally {
      if (originalPluginPath === undefined) {
        delete process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
      } else {
        process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH = originalPluginPath;
      }
    }

    expect(
      commandRunner.requests.some(
        (request) =>
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.load.paths" &&
          request.args[3] ===
            JSON.stringify([pluginSourceDir, unrelatedPluginDir]),
      ),
    ).toBe(true);
  });

  it("falls back to root plugin id when openclaw-plugin id is not found", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const pluginSourceDir = path.join(root, "plugin-src");
    await mkdir(pluginSourceDir, { recursive: true });
    await writeFile(
      path.join(pluginSourceDir, "openclaw.plugin.json"),
      "{}\n",
      "utf-8",
    );

    const originalPluginPath = process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
    process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH = pluginSourceDir;

    const commandRunner = createRuntimeDefaultsCommandRunner(
      root,
      async (request) => {
        if (
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.entries.openclaw-plugin.enabled"
        ) {
          return {
            code: 1,
            stdout: "",
            stderr: "plugin not found: openclaw-plugin",
          };
        }
        if (
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.entries.opengoat-plugin.enabled"
        ) {
          return {
            code: 0,
            stdout: "",
            stderr: "",
          };
        }
        return undefined;
      },
    );

    let result:
      | Awaited<ReturnType<OpenGoatService["syncRuntimeDefaults"]>>
      | undefined;
    try {
      const { service } = createService(
        root,
        new FakeOpenClawProvider(),
        commandRunner,
      );
      result = await service.syncRuntimeDefaults();
    } finally {
      if (originalPluginPath === undefined) {
        delete process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
      } else {
        process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH = originalPluginPath;
      }
    }

    expect(
      commandRunner.requests.some(
        (request) =>
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.entries.openclaw-plugin.enabled" &&
          request.args[3] === "true",
      ),
    ).toBe(true);
    expect(
      commandRunner.requests.some(
        (request) =>
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.entries.opengoat-plugin.enabled" &&
          request.args[3] === "true",
      ),
    ).toBe(true);
    expect(
      result?.warnings.some((warning) => warning.includes("plugin enable failed")),
    ).toBe(false);
  });

  it("adds a warning when OpenClaw plugin enable fails", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const pluginSourceDir = path.join(root, "plugin-src");
    await mkdir(pluginSourceDir, { recursive: true });
    await writeFile(
      path.join(pluginSourceDir, "openclaw.plugin.json"),
      "{}\n",
      "utf-8",
    );

    const originalPluginPath = process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
    process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH = pluginSourceDir;

    const commandRunner = createRuntimeDefaultsCommandRunner(
      root,
      async (request) => {
        if (
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.entries.openclaw-plugin.enabled"
        ) {
          return {
            code: 1,
            stdout: "",
            stderr: "plugin not found: openclaw-plugin",
          };
        }
        if (
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.entries.opengoat-plugin.enabled"
        ) {
          return {
            code: 1,
            stdout: "",
            stderr: "plugin not found: opengoat-plugin",
          };
        }
        if (
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.entries.openclaw-plugin-pack.enabled"
        ) {
          return {
            code: 1,
            stdout: "",
            stderr: "plugin not found: openclaw-plugin-pack",
          };
        }
        if (
          request.args[0] === "config" &&
          request.args[1] === "set" &&
          request.args[2] === "plugins.entries.workspace.enabled"
        ) {
          return {
            code: 1,
            stdout: "",
            stderr: "plugin not found: workspace",
          };
        }
        return undefined;
      },
    );

    let result:
      | Awaited<ReturnType<OpenGoatService["syncRuntimeDefaults"]>>
      | undefined;
    try {
      const { service } = createService(
        root,
        new FakeOpenClawProvider(),
        commandRunner,
      );
      result = await service.syncRuntimeDefaults();
    } finally {
      if (originalPluginPath === undefined) {
        delete process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH;
      } else {
        process.env.OPENGOAT_OPENCLAW_PLUGIN_PATH = originalPluginPath;
      }
    }

    expect(
      result?.warnings.some((warning) =>
        warning.includes(
          "OpenClaw plugin enable failed: no matching plugin id was found (openclaw-plugin, opengoat-plugin, openclaw-plugin-pack, workspace).",
        ),
      ),
    ).toBe(true);
  });

  it("does not rewrite ceo bootstrap files during runtime sync", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service } = createService(root);
    await service.initialize();

    const ceoWorkspace = path.join(root, "workspaces", "ceo");
    const bootstrapPath = path.join(ceoWorkspace, "BOOTSTRAP.md");
    const agentsPath = path.join(ceoWorkspace, "AGENTS.md");
    const rolePath = path.join(ceoWorkspace, "ROLE.md");
    const soulPath = path.join(ceoWorkspace, "SOUL.md");
    await writeFile(bootstrapPath, "# legacy bootstrap\n", "utf-8");
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
      ["# SOUL.md - Legacy CEO", "", "Legacy body"].join("\n"),
      "utf-8",
    );

    const result = await service.syncRuntimeDefaults();

    expect(result.ceoSynced).toBe(true);
    await expect(access(bootstrapPath, constants.F_OK)).resolves.toBeUndefined();

    const agentsMarkdown = await readFile(agentsPath, "utf-8");
    const soulMarkdown = await readFile(soulPath, "utf-8");
    const bootstrapMarkdown = await readFile(bootstrapPath, "utf-8");
    const boardManagerSkillMarkdown = await readFile(
      path.join(ceoWorkspace, "skills", "og-board-manager", "SKILL.md"),
      "utf-8",
    );
    expect(agentsMarkdown).toContain("foo");
    expect(agentsMarkdown).toContain("## First Run");
    expect(agentsMarkdown).toContain("bar");
    expect(agentsMarkdown).toContain("legacy session instructions");
    expect(agentsMarkdown).toContain("## Another section");
    expect(agentsMarkdown).toContain("baz");
    expect(soulMarkdown).toBe(
      ["# SOUL.md - Legacy CEO", "", "Legacy body"].join("\n"),
    );
    expect(bootstrapMarkdown.trimEnd()).toBe("# legacy bootstrap");
    expect(boardManagerSkillMarkdown).toContain("name: og-board-manager");
    await expect(
      access(
        path.join(ceoWorkspace, "skills", "manager", "SKILL.md"),
        constants.F_OK,
      ),
    ).rejects.toBeTruthy();
  });

  it("updates who an agent reports to", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service } = createService(root);
    await service.initialize();
    await service.createAgent("CTO", { type: "manager", reportsTo: "ceo" });
    await service.createAgent("Engineer");

    const updated = await service.setAgentManager("engineer", "cto");
    expect(updated.previousReportsTo).toBe("ceo");
    expect(updated.reportsTo).toBe("cto");
  });

  it("enforces assignment restrictions through the service facade", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service } = createService(root);
    await service.initialize();
    await service.createAgent("CTO", {
      type: "manager",
      reportsTo: "ceo",
    });
    await service.createAgent("Engineer", {
      type: "individual",
      reportsTo: "cto",
    });
    await service.createAgent("QA", {
      type: "individual",
      reportsTo: "ceo",
    });

    await expect(
      service.createTask("cto", {
        title: "Cross-team assignment",
        description: "Should fail",
        assignedTo: "qa",
      }),
    ).rejects.toThrow(
      "Agents can only assign tasks to themselves or their reportees (direct or indirect).",
    );
  });

  it("returns the latest agent AI action timestamp", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service } = createService(root);
    await service.initialize();
    await service.runAgent("ceo", { message: "hello" });

    const result = await service.getAgentLastAction("ceo");
    expect(result).not.toBeNull();
    expect(result?.agentId).toBe("ceo");
    expect(typeof result?.timestamp).toBe("number");
  });

  it("hard-resets OpenGoat home and OpenClaw state associated with OpenGoat", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const managedSkillsDir = path.join(root, "openclaw-managed-skills");

    const commandRunner = new FakeCommandRunner(async (request) => {
      if (
        request.args[0] === "skills" &&
        request.args[1] === "list" &&
        request.args.includes("--json")
      ) {
        return {
          code: 0,
          stdout: JSON.stringify({
            workspaceDir: path.join(root, "openclaw-workspace"),
            managedSkillsDir,
            skills: [],
          }),
          stderr: "",
        };
      }
      if (
        request.args[0] === "agents" &&
        request.args[1] === "list" &&
        request.args.includes("--json")
      ) {
        return {
          code: 0,
          stdout: JSON.stringify([
            {
              id: "ceo",
              workspace: path.join(root, "workspaces", "ceo"),
              agentDir: path.join(root, "agents", "ceo"),
            },
            {
              id: "orphan",
              workspace: path.join(root, "workspaces", "orphan"),
              agentDir: path.join(root, "agents", "orphan"),
            },
            {
              id: "outsider",
              workspace: path.join("/tmp", "other", "workspace"),
              agentDir: path.join("/tmp", "other", "agent"),
            },
          ]),
          stderr: "",
        };
      }
      return {
        code: 0,
        stdout: "",
        stderr: "",
      };
    });

    const { service, provider } = createService(
      root,
      new FakeOpenClawProvider(),
      commandRunner,
    );
    await service.initialize();
    await service.createAgent("CTO", { type: "manager", reportsTo: "ceo" });
    await new NodeFileSystem().ensureDir(path.join(managedSkillsDir, "og-board-manager"));
    await new NodeFileSystem().ensureDir(path.join(managedSkillsDir, "manager"));
    await writeFile(
      path.join(managedSkillsDir, "og-board-manager", "SKILL.md"),
      "# stale og-board-manager\n",
      "utf-8",
    );
    await writeFile(
      path.join(managedSkillsDir, "manager", "SKILL.md"),
      "# stale manager\n",
      "utf-8",
    );

    const result = await service.hardReset();

    expect(result.homeDir).toBe(root);
    expect(result.homeRemoved).toBe(true);
    expect(result.failedOpenClawAgents).toHaveLength(0);
    expect(result.deletedOpenClawAgents).toEqual(["ceo", "cto", "orphan"]);
    expect(result.removedOpenClawManagedSkillDirs).toEqual([
      path.join(managedSkillsDir, "og-board-manager"),
      path.join(managedSkillsDir, "manager"),
    ]);
    expect(
      provider.deletedAgents.map((entry) => entry.agentId).sort(),
    ).toEqual(["ceo", "cto", "orphan"]);
    await expect(access(root, constants.F_OK)).rejects.toBeTruthy();
  });

  it("hard-reset deletes workspace-derived agents when OpenClaw discovery fails", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const commandRunner = new FakeCommandRunner(async (request) => {
      if (request.args[0] === "agents" && request.args[1] === "list") {
        return {
          code: 1,
          stdout: "",
          stderr: "unsupported flag: --json",
        };
      }
      if (request.args[0] === "skills" && request.args[1] === "list") {
        return {
          code: 0,
          stdout: JSON.stringify({
            workspaceDir: path.join(root, "openclaw-workspace"),
            managedSkillsDir: path.join(root, "openclaw-managed-skills"),
            skills: [],
          }),
          stderr: "",
        };
      }
      return {
        code: 0,
        stdout: "",
        stderr: "",
      };
    });

    const { service, provider } = createService(
      root,
      new FakeOpenClawProvider(),
      commandRunner,
    );
    await service.initialize();
    await new NodeFileSystem().ensureDir(path.join(root, "workspaces", "cto"));

    const result = await service.hardReset();

    expect(result.homeRemoved).toBe(true);
    expect(result.failedOpenClawAgents).toHaveLength(0);
    expect(result.warnings.some((warning) => warning.includes("OpenClaw agent discovery failed"))).toBe(true);
    expect(
      provider.deletedAgents.some((entry) => entry.agentId === "cto"),
    ).toBe(true);
  });

  it("prepares a new session for a specific project path without invoking runtime", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service, provider } = createService(root);
    await service.initialize();

    const projectPath = path.join(root, "desktop-project");
    const fileSystem = new NodeFileSystem();
    await fileSystem.ensureDir(projectPath);

    const prepared = await service.prepareSession("ceo", {
      sessionRef: "project:desktop-project",
      projectPath: projectPath,
      forceNew: true,
    });

    expect(prepared.agentId).toBe("ceo");
    expect(prepared.sessionKey).toBe("project:desktop-project");
    expect(prepared.projectPath).toBe(projectPath);
    expect(prepared.isNewSession).toBe(true);
    expect(provider.invocations).toHaveLength(0);

    const sessions = await service.listSessions("ceo");
    expect(
      sessions.some(
        (session) => session.sessionKey === "project:desktop-project",
      ),
    ).toBe(true);
  });

  it("runs task cron cycle and routes todo/blocked/inactive notifications", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service, provider } = createService(root);
    await service.initialize();
    const projectPath = path.join(root, "packages", "ui");
    await new NodeFileSystem().ensureDir(projectPath);
    await service.prepareSession("ceo", {
      sessionRef: "project:ui",
      projectPath,
      forceNew: true,
    });
    await service.createAgent("Engineer", {
      type: "individual",
      reportsTo: "ceo",
    });

    const todoTask = await service.createTask("ceo", {
      title: "Implement endpoint",
      description: "Build endpoint and tests",
      assignedTo: "engineer",
      status: "todo",
    });
    const blockedTask = await service.createTask("ceo", {
      title: "Prepare release",
      description: "Finalize release notes",
      project: "/workspace/release",
      assignedTo: "engineer",
      status: "blocked",
    });
    await service.addTaskBlocker(
      "engineer",
      blockedTask.taskId,
      "Waiting for production credentials",
    );

    const cycle = await service.runTaskCronCycle({ inactiveMinutes: 30 });

    expect(cycle.todoTasks).toBe(1);
    expect(cycle.blockedTasks).toBe(1);
    expect(cycle.inactiveAgents).toBe(1);
    expect(cycle.failed).toBe(0);
    expect(cycle.dispatches.length).toBe(3);

    const todoInvocation = provider.invocations.find(
      (entry) => entry.agent === "engineer",
    );
    expect(todoInvocation?.message).toContain(`Task ID: ${todoTask.taskId}`);
    expect(todoInvocation?.message).toContain("Project: ~");
    expect(todoInvocation?.message).toContain("Status: todo");

    const blockedInvocation = provider.invocations.find(
      (entry) =>
        entry.agent === "ceo" &&
        entry.message.includes(`Task #${blockedTask.taskId}`),
    );
    expect(blockedInvocation?.message).toContain(
      'assigned to your reportee "@engineer" is blocked because of',
    );
    expect(blockedInvocation?.message).toContain("Project: /workspace/release");
    expect(blockedInvocation?.message).toContain(
      "Waiting for production credentials",
    );

    const inactivityInvocation = provider.invocations.find(
      (entry) =>
        entry.agent === "ceo" &&
        entry.message.includes('Your reportee "@engineer"'),
    );
    expect(inactivityInvocation?.message).toContain(
      "no activity in the last 30 minutes",
    );
    expect(inactivityInvocation?.message).toContain(
      "Engineer has 0 direct and 0 indirect reportees.",
    );
    expect(inactivityInvocation?.cwd).toBe(projectPath);

    const engineerSessions = await service.listSessions("engineer");
    expect(
      engineerSessions.some((entry) =>
        entry.sessionKey.includes(`agent_engineer_task_${todoTask.taskId}`),
      ),
    ).toBe(false);

    const ceoSessions = await service.listSessions("ceo");
    expect(
      ceoSessions.some((entry) =>
        entry.sessionKey.includes(`agent_ceo_task_${blockedTask.taskId}`),
      ),
    ).toBe(false);
    expect(
      ceoSessions.some((entry) =>
        entry.sessionKey.includes("agent_ceo_inactive_engineer"),
      ),
    ).toBe(false);
  });

  it("notifies assignees when pending tasks exceed the inactivity threshold", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const provider = new FakeOpenClawProvider();
    let nowMs = Date.parse("2026-02-06T00:00:00.000Z");
    const { service } = createService(root, provider, undefined, {
      nowIso: () => new Date(nowMs).toISOString(),
    });
    await service.initialize();
    await service.createAgent("Engineer", {
      type: "individual",
      reportsTo: "ceo",
    });

    const task = await service.createTask("ceo", {
      title: "Finish integration",
      description: "Complete the pending integration work",
      assignedTo: "engineer",
      status: "doing",
    });
    await service.updateTaskStatus(
      "engineer",
      task.taskId,
      "pending",
      "Waiting for integration window",
    );

    nowMs += 31 * 60_000;
    const cycle = await service.runTaskCronCycle({
      inactiveMinutes: 30,
      notifyInactiveAgents: false,
    });

    expect(cycle.todoTasks).toBe(0);
    expect(cycle.blockedTasks).toBe(0);
    expect(cycle.inactiveAgents).toBe(0);
    expect(cycle.dispatches).toHaveLength(1);
    expect(cycle.dispatches[0]).toMatchObject({
      kind: "pending",
      targetAgentId: "engineer",
      taskId: task.taskId,
      ok: true,
    });
    expect(
      provider.invocations.some(
        (entry) =>
          entry.agent === "engineer" &&
          entry.message.includes(
            `Task #${task.taskId} is still in PENDING after 30 minutes.`,
          ) &&
          entry.message.includes(
            "Please continue working on it or update the task status if needed.",
          ),
      ),
    ).toBe(true);
  });

  it("does not notify assignees for pending tasks below the inactivity threshold", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const provider = new FakeOpenClawProvider();
    let nowMs = Date.parse("2026-02-06T00:00:00.000Z");
    const { service } = createService(root, provider, undefined, {
      nowIso: () => new Date(nowMs).toISOString(),
    });
    await service.initialize();
    await service.createAgent("Engineer", {
      type: "individual",
      reportsTo: "ceo",
    });

    const task = await service.createTask("ceo", {
      title: "Prepare QA handoff",
      description: "Collect all QA handoff artifacts",
      assignedTo: "engineer",
      status: "doing",
    });
    await service.updateTaskStatus(
      "engineer",
      task.taskId,
      "pending",
      "Awaiting QA slot",
    );

    nowMs += 29 * 60_000;
    const cycle = await service.runTaskCronCycle({
      inactiveMinutes: 30,
      notifyInactiveAgents: false,
    });

    expect(cycle.dispatches).toHaveLength(0);
    expect(
      provider.invocations.some(
        (entry) =>
          entry.agent === "engineer" &&
          entry.message.includes(`Task #${task.taskId} is still in PENDING`),
      ),
    ).toBe(false);
  });

  it("supports notifying only ceo for inactive direct reports", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service, provider } = createService(root);
    await service.initialize();
    await service.createAgent("CTO", {
      type: "manager",
      reportsTo: "ceo",
    });
    await service.createAgent("Engineer", {
      type: "individual",
      reportsTo: "cto",
    });

    const cycle = await service.runTaskCronCycle({
      inactiveMinutes: 30,
      notificationTarget: "ceo-only",
    });

    expect(cycle.inactiveAgents).toBe(1);
    expect(cycle.dispatches).toHaveLength(1);
    expect(cycle.dispatches[0]?.targetAgentId).toBe("ceo");
    expect(cycle.dispatches[0]?.subjectAgentId).toBe("cto");

    expect(
      provider.invocations.some(
        (entry) =>
          entry.agent === "ceo" &&
          entry.message.includes('Your reportee "@cto"') &&
          entry.message.includes("CTO has 1 direct and 0 indirect reportees."),
      ),
    ).toBe(true);
    expect(
      provider.invocations.some((entry) =>
        entry.message.includes('Your reportee "@engineer"'),
      ),
    ).toBe(false);
  });

  it("runs todo and blocked checks even when inactivity notifications are disabled", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service, provider } = createService(root);
    await service.initialize();
    await service.createAgent("Engineer", {
      type: "individual",
      reportsTo: "ceo",
    });

    const todoTask = await service.createTask("ceo", {
      title: "Review API",
      description: "Review API task status",
      assignedTo: "engineer",
      status: "todo",
    });
    const blockedTask = await service.createTask("ceo", {
      title: "Release prep",
      description: "Prepare release checklist",
      assignedTo: "engineer",
      status: "blocked",
    });
    await service.addTaskBlocker(
      "engineer",
      blockedTask.taskId,
      "Waiting for approvals",
    );

    const cycle = await service.runTaskCronCycle({
      inactiveMinutes: 30,
      notifyInactiveAgents: false,
    });

    expect(cycle.todoTasks).toBe(1);
    expect(cycle.blockedTasks).toBe(1);
    expect(cycle.inactiveAgents).toBe(0);
    expect(cycle.dispatches).toHaveLength(2);
    expect(cycle.dispatches.every((entry) => entry.kind !== "inactive")).toBe(
      true,
    );
    expect(
      provider.invocations.some((entry) => entry.agent === "engineer"),
    ).toBe(true);
    expect(
      provider.invocations.some(
        (entry) =>
          entry.agent === "ceo" &&
          entry.message.includes(`Task #${blockedTask.taskId}`),
      ),
    ).toBe(true);
    expect(
      provider.invocations.some((entry) =>
        entry.message.includes('Your reportee "@engineer"'),
      ),
    ).toBe(false);
    expect(
      provider.invocations.some((entry) =>
        entry.message.includes(`Task ID: ${todoTask.taskId}`),
      ),
    ).toBe(true);
  });

  it("limits task automation dispatch concurrency using maxParallelFlows", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const provider = new FakeOpenClawProvider();
    const { service } = createService(root, provider);
    await service.initialize();
    await service.createAgent("Engineer One", {
      type: "individual",
      reportsTo: "ceo",
    });
    await service.createAgent("Engineer Two", {
      type: "individual",
      reportsTo: "ceo",
    });
    await service.createAgent("Engineer Three", {
      type: "individual",
      reportsTo: "ceo",
    });
    await service.createAgent("Engineer Four", {
      type: "individual",
      reportsTo: "ceo",
    });

    for (const assignee of [
      "engineer-one",
      "engineer-two",
      "engineer-three",
      "engineer-four",
    ]) {
      await service.createTask("ceo", {
        title: `Deliver for ${assignee}`,
        description: "Complete the assigned task",
        assignedTo: assignee,
        status: "todo",
      });
    }

    let concurrentInvocations = 0;
    let peakConcurrentInvocations = 0;
    vi.spyOn(provider, "invoke").mockImplementation(async () => {
      concurrentInvocations += 1;
      peakConcurrentInvocations = Math.max(
        peakConcurrentInvocations,
        concurrentInvocations,
      );
      await delayMs(20);
      concurrentInvocations -= 1;
      return {
        code: 0,
        stdout: "ok\n",
        stderr: "",
      };
    });

    const cycle = await service.runTaskCronCycle({
      notifyInactiveAgents: false,
      maxParallelFlows: 2,
    });

    expect(cycle.todoTasks).toBe(4);
    expect(cycle.dispatches).toHaveLength(4);
    expect(peakConcurrentInvocations).toBe(2);
  });
});

function createRuntimeDefaultsCommandRunner(
  root: string,
  override?: (
    request: CommandRunRequest,
  ) => Promise<CommandRunResult | undefined>,
): FakeCommandRunner {
  return new FakeCommandRunner(async (request) => {
    const overridden = await override?.(request);
    if (overridden) {
      return overridden;
    }

    if (
      request.args[0] === "skills" &&
      request.args[1] === "list" &&
      request.args.includes("--json")
    ) {
      return {
        code: 0,
        stdout: JSON.stringify({
          workspaceDir: path.join(root, "openclaw-workspace"),
          managedSkillsDir: path.join(root, "openclaw-managed-skills"),
          skills: [],
        }),
        stderr: "",
      };
    }

    if (
      request.args[0] === "agents" &&
      request.args[1] === "list" &&
      request.args.includes("--json")
    ) {
      return {
        code: 0,
        stdout: JSON.stringify([
          {
            id: "ceo",
            workspace: path.join(root, "workspaces", "ceo"),
            agentDir: path.join(root, "agents", "ceo"),
          },
        ]),
        stderr: "",
      };
    }

    if (
      request.args[0] === "config" &&
      request.args[1] === "get" &&
      request.args[2] === "agents.list"
    ) {
      return {
        code: 0,
        stdout: JSON.stringify([
          {
            id: "ceo",
            workspace: path.join(root, "workspaces", "ceo"),
            agentDir: path.join(root, "agents", "ceo"),
          },
        ]),
        stderr: "",
      };
    }

    if (
      request.args[0] === "config" &&
      request.args[1] === "get" &&
      request.args[2] === "plugins.load.paths"
    ) {
      return {
        code: 1,
        stdout: "",
        stderr: "Config path not found: plugins.load.paths",
      };
    }

    if (
      request.args[0] === "config" &&
      request.args[1] === "set"
    ) {
      return {
        code: 0,
        stdout: "",
        stderr: "",
      };
    }

    return {
      code: 0,
      stdout: "",
      stderr: "",
    };
  });
}

function createService(
  root: string,
  provider: FakeOpenClawProvider = new FakeOpenClawProvider(),
  commandRunner?: CommandRunnerPort,
  options: {
    nowIso?: () => string;
  } = {},
): { service: OpenGoatService; provider: FakeOpenClawProvider } {
  const registry = new ProviderRegistry();
  registry.register("openclaw", () => provider);

  const service = new OpenGoatService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort(),
    pathsProvider: new TestPathsProvider(root),
    providerRegistry: registry,
    nowIso: options.nowIso ?? (() => "2026-02-06T00:00:00.000Z"),
    commandRunner,
  });
  return {
    service,
    provider,
  };
}

class FakeOpenClawProvider extends BaseProvider {
  public readonly createdAgents: ProviderCreateAgentOptions[] = [];
  public readonly deletedAgents: ProviderDeleteAgentOptions[] = [];
  public readonly invocations: ProviderInvokeOptions[] = [];
  public failCreate = false;
  public createFailureStderr = "create failed";
  public createAlreadyExists = false;
  public failDelete = false;
  public seedUserMarkdownOnCreate = false;

  public constructor() {
    super({
      id: "openclaw",
      displayName: "OpenClaw",
      kind: "cli",
      capabilities: {
        agent: true,
        model: true,
        auth: true,
        passthrough: true,
        agentCreate: true,
        agentDelete: true,
      },
    });
  }

  public async invoke(
    options: ProviderInvokeOptions,
  ): Promise<ProviderExecutionResult> {
    this.invocations.push(options);
    return {
      code: 0,
      stdout: "ok\n",
      stderr: "",
    };
  }

  public override async createAgent(
    options: ProviderCreateAgentOptions,
  ): Promise<ProviderExecutionResult> {
    this.createdAgents.push(options);
    if (this.failCreate) {
      return {
        code: 1,
        stdout: "",
        stderr: this.createFailureStderr,
      };
    }
    if (this.createAlreadyExists) {
      return {
        code: 1,
        stdout: "",
        stderr: "agent already exists",
      };
    }
    if (this.seedUserMarkdownOnCreate) {
      await writeFile(
        path.join(options.workspaceDir, "USER.md"),
        "# USER.md\n",
        "utf-8",
      );
    }
    return {
      code: 0,
      stdout: "created\n",
      stderr: "",
    };
  }

  public override async deleteAgent(
    options: ProviderDeleteAgentOptions,
  ): Promise<ProviderExecutionResult> {
    this.deletedAgents.push(options);
    if (this.failDelete) {
      return {
        code: 1,
        stdout: "",
        stderr: "delete failed",
      };
    }
    return {
      code: 0,
      stdout: "deleted\n",
      stderr: "",
    };
  }
}

class FakeCommandRunner implements CommandRunnerPort {
  public readonly requests: CommandRunRequest[] = [];
  private readonly handler: (
    request: CommandRunRequest,
  ) => Promise<CommandRunResult>;

  public constructor(
    handler: (request: CommandRunRequest) => Promise<CommandRunResult>,
  ) {
    this.handler = handler;
  }

  public async run(request: CommandRunRequest): Promise<CommandRunResult> {
    this.requests.push(request);
    return this.handler(request);
  }
}

function delayMs(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
