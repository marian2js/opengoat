import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
          "board-individual",
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

  it("creates a default board when creating a manager agent", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service } = createService(root);
    await service.initialize();
    await service.createAgent("CTO", { type: "manager", reportsTo: "ceo" });

    const boards = await service.listBoards();
    const ctoBoards = boards.filter((board) => board.owner === "cto");
    expect(ctoBoards).toHaveLength(1);
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
      "board-individual",
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
          "board-individual",
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
          "board-manager",
          "SKILL.md",
        ),
        constants.F_OK,
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(staleManagerSkillDir, constants.F_OK),
    ).rejects.toBeTruthy();
  });

  it("installs role skills into OpenClaw managed skills directory", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const managedSkillsDir = path.join(root, "openclaw-managed-skills");
    const staleManagedSkillDir = path.join(managedSkillsDir, "manager");
    await new NodeFileSystem().ensureDir(staleManagedSkillDir);
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
        path.join(managedSkillsDir, "board-manager", "SKILL.md"),
        constants.F_OK,
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(
        path.join(managedSkillsDir, "board-individual", "SKILL.md"),
        constants.F_OK,
      ),
    ).resolves.toBeUndefined();
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

  it("pre-seeds ceo workspace and removes BOOTSTRAP before runtime sync", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service } = createService(root);
    await service.initialize();

    const ceoWorkspace = path.join(root, "workspaces", "ceo");
    const bootstrapPath = path.join(ceoWorkspace, "BOOTSTRAP.md");
    await writeFile(bootstrapPath, "# legacy bootstrap\n", "utf-8");

    const result = await service.syncRuntimeDefaults();

    expect(result.ceoSynced).toBe(true);
    await expect(access(bootstrapPath, constants.F_OK)).rejects.toBeTruthy();

    const agentsMarkdown = await readFile(
      path.join(ceoWorkspace, "AGENTS.md"),
      "utf-8",
    );
    const soulMarkdown = await readFile(
      path.join(ceoWorkspace, "SOUL.md"),
      "utf-8",
    );
    const boardManagerSkillMarkdown = await readFile(
      path.join(ceoWorkspace, "skills", "board-manager", "SKILL.md"),
      "utf-8",
    );
    expect(agentsMarkdown).toContain("OpenGoat CEO Workspace");
    expect(soulMarkdown).toContain("You are `ceo`, the OpenGoat head manager.");
    expect(boardManagerSkillMarkdown).toContain("name: board-manager");
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

  it("creates a default board when an agent becomes manager via skill install", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service } = createService(root);
    await service.initialize();
    await service.createAgent("Engineer", {
      type: "individual",
      reportsTo: "ceo",
    });

    await service.installSkill({
      agentId: "engineer",
      skillName: "board-manager",
      description: "Promote to manager",
    });

    const boards = await service.listBoards();
    const engineerBoards = boards.filter((board) => board.owner === "engineer");
    expect(engineerBoards).toHaveLength(1);

    const task = await service.createTask("engineer", undefined, {
      title: "Plan sprint",
      description: "Create sprint plan",
    });
    expect(task.boardId).toBe(engineerBoards[0]?.boardId);
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
    await service.createAgent("Engineer", {
      type: "individual",
      reportsTo: "ceo",
    });

    const board = await service.createBoard("ceo", { title: "Delivery" });
    const todoTask = await service.createTask("ceo", board.boardId, {
      title: "Implement endpoint",
      description: "Build endpoint and tests",
      assignedTo: "engineer",
      status: "todo",
    });
    const blockedTask = await service.createTask("ceo", board.boardId, {
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

    const engineerSessions = await service.listSessions("engineer");
    expect(
      engineerSessions.some((entry) =>
        entry.sessionKey.includes(`agent_engineer_task_${todoTask.taskId}`),
      ),
    ).toBe(true);

    const ceoSessions = await service.listSessions("ceo");
    expect(
      ceoSessions.some((entry) =>
        entry.sessionKey.includes(`agent_ceo_task_${blockedTask.taskId}`),
      ),
    ).toBe(true);
  });
});

function createService(
  root: string,
  provider: FakeOpenClawProvider = new FakeOpenClawProvider(),
  commandRunner?: CommandRunnerPort,
): { service: OpenGoatService; provider: FakeOpenClawProvider } {
  const registry = new ProviderRegistry();
  registry.register("openclaw", () => provider);

  const service = new OpenGoatService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort(),
    pathsProvider: new TestPathsProvider(root),
    providerRegistry: registry,
    nowIso: () => "2026-02-06T00:00:00.000Z",
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
