import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentManifest, AgentManifestService } from "../../agents/index.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { ProviderExecutionResult, ProviderService, ProviderInvokeOptions } from "../../providers/index.js";
import type { SessionService } from "../../sessions/index.js";
import type { SkillService } from "../../skills/index.js";
import { NodeFileSystem } from "../../../platform/node/node-file-system.js";
import { NodePathPort } from "../../../platform/node/node-path.port.js";
import { OrchestrationService } from "./orchestration.service.js";

describe("OrchestrationService integration flow", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("runs planner -> delegation -> finish and writes trace ledger", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-orch-flow-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);
    const providerService = createProviderService({
      plannerExecutions: [
        okExecution(
          JSON.stringify({
            rationale: "Delegate implementation to writer.",
            action: {
              type: "delegate_to_agent",
              mode: "direct",
              reason: "writer agent owns markdown docs",
              targetAgentId: "writer",
              message: "Create ABOUT.md for this project.",
              expectedOutput: "A complete ABOUT.md file.",
              taskKey: "task-about",
              sessionPolicy: "new"
            }
          })
        ),
        okExecution(
          JSON.stringify({
            rationale: "Delegation completed successfully.",
            action: {
              type: "finish",
              mode: "direct",
              reason: "done",
              message: "Created ABOUT.md with project context."
            }
          })
        )
      ],
      delegatedExecution: {
        code: 0,
        stdout: "Done. ABOUT.md is created.",
        stderr: "",
        providerSessionId: "delegate-session-1"
      }
    });
    const service = new OrchestrationService({
      providerService: providerService as unknown as ProviderService,
      skillService: createSkillServiceStub() as unknown as SkillService,
      agentManifestService: createManifestServiceStub([
        createManifest("orchestrator", {
          canReceive: true,
          canDelegate: true,
          provider: "openai"
        }),
        createManifest("writer", {
          canReceive: true,
          canDelegate: false,
          provider: "codex"
        })
      ]) as unknown as AgentManifestService,
      sessionService: createSessionServiceStub() as unknown as SessionService,
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => "2026-02-07T17:00:00.000Z"
    });

    const result = await service.runAgent(paths, "orchestrator", {
      message: "Please create ABOUT.md",
      cwd: tempDir
    });

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("Created ABOUT.md with project context.");
    expect(result.orchestration?.mode).toBe("ai-loop");
    expect(result.orchestration?.steps).toHaveLength(2);
    expect(result.orchestration?.steps[0]?.agentCall?.targetAgentId).toBe("writer");
    expect(result.orchestration?.taskThreads?.[0]?.taskKey).toBe("task-about");
    expect(providerService.invokeAgent).toHaveBeenCalledTimes(3);

    const traceRaw = await readFile(result.tracePath, "utf-8");
    const trace = JSON.parse(traceRaw) as {
      orchestration?: {
        finalMessage: string;
        steps: Array<{ plannerDecision: { action: { type: string } } }>;
      };
    };
    expect(trace.orchestration?.finalMessage).toBe("Created ABOUT.md with project context.");
    expect(trace.orchestration?.steps[0]?.plannerDecision.action.type).toBe("delegate_to_agent");
  });

  it("returns an actionable response when planner provider invocation fails", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-orch-provider-fail-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);
    const providerService = createProviderService({
      plannerExecutions: [
        {
          code: 1,
          stdout: "",
          stderr: "401 unauthorized - missing OPENAI_API_KEY"
        }
      ],
      delegatedExecution: {
        code: 0,
        stdout: "unused",
        stderr: ""
      }
    });
    const service = new OrchestrationService({
      providerService: providerService as unknown as ProviderService,
      skillService: createSkillServiceStub() as unknown as SkillService,
      agentManifestService: createManifestServiceStub([
        createManifest("orchestrator", {
          canReceive: true,
          canDelegate: true,
          provider: "openai"
        }),
        createManifest("writer", {
          canReceive: true,
          canDelegate: false,
          provider: "codex"
        })
      ]) as unknown as AgentManifestService,
      sessionService: createSessionServiceStub() as unknown as SessionService,
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => "2026-02-07T17:05:00.000Z"
    });

    const result = await service.runAgent(paths, "orchestrator", {
      message: "Please create ABOUT.md",
      cwd: tempDir
    });

    expect(result.code).toBe(1);
    expect(result.stdout).toContain("Open provider setup in the desktop app");
    expect(result.stdout).toContain("OPENAI_API_KEY");
    expect(result.orchestration?.steps).toHaveLength(1);
    expect(result.orchestration?.steps[0]?.plannerDecision.action.type).toBe("respond_user");
    expect(result.orchestration?.steps[0]?.plannerDecision.action.reason).toBe("planner_provider_failure");
    expect(result.orchestration?.finalMessage).not.toContain("planner output parsing issues");
    expect(providerService.invokeAgent).toHaveBeenCalledTimes(1);
  });

  it("does not delegate to non-discoverable agents even if planner targets them", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-orch-hidden-agent-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);
    const providerService = createProviderService({
      plannerExecutions: [
        okExecution(
          JSON.stringify({
            rationale: "Try delegating to hidden agent.",
            action: {
              type: "delegate_to_agent",
              mode: "direct",
              targetAgentId: "writer",
              message: "Draft docs"
            }
          })
        ),
        okExecution(
          JSON.stringify({
            rationale: "Fallback after invalid target.",
            action: {
              type: "finish",
              mode: "direct",
              message: "Finished without delegation."
            }
          })
        )
      ],
      delegatedExecution: {
        code: 0,
        stdout: "unexpected",
        stderr: ""
      }
    });
    const service = new OrchestrationService({
      providerService: providerService as unknown as ProviderService,
      skillService: createSkillServiceStub() as unknown as SkillService,
      agentManifestService: createManifestServiceStub([
        createManifest("orchestrator", {
          canReceive: true,
          canDelegate: true,
          provider: "openai"
        }),
        createManifest("writer", {
          canReceive: true,
          canDelegate: false,
          provider: "codex",
          discoverable: false
        })
      ]) as unknown as AgentManifestService,
      sessionService: createSessionServiceStub() as unknown as SessionService,
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => "2026-02-07T17:10:00.000Z"
    });

    const result = await service.runAgent(paths, "orchestrator", {
      message: "Please draft docs",
      cwd: tempDir
    });

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("Finished without delegation.");
    expect(result.orchestration?.steps[0]?.agentCall).toBeUndefined();
    expect(result.orchestration?.steps[0]?.note).toContain("non-discoverable");
    expect(providerService.invokeAgent).toHaveBeenCalledTimes(2);
  });

  it("allows direct invocation of non-discoverable agents", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-direct-hidden-agent-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);
    const providerService = createProviderService({
      plannerExecutions: [okExecution("unused")],
      delegatedExecution: {
        code: 0,
        stdout: "Writer handled request.",
        stderr: ""
      }
    });
    const service = new OrchestrationService({
      providerService: providerService as unknown as ProviderService,
      skillService: createSkillServiceStub() as unknown as SkillService,
      agentManifestService: createManifestServiceStub([
        createManifest("orchestrator", {
          canReceive: true,
          canDelegate: true,
          provider: "openai"
        }),
        createManifest("writer", {
          canReceive: true,
          canDelegate: false,
          provider: "codex",
          discoverable: false
        })
      ]) as unknown as AgentManifestService,
      sessionService: createSessionServiceStub() as unknown as SessionService,
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => "2026-02-07T17:15:00.000Z"
    });

    const result = await service.runAgent(paths, "writer", {
      message: "Draft docs",
      cwd: tempDir
    });

    expect(result.entryAgentId).toBe("writer");
    expect(result.stdout.trim()).toBe("Writer handled request.");
    expect(result.routing.targetAgentId).toBe("writer");
    expect(providerService.invokeAgent).toHaveBeenCalledTimes(1);
  });
});

function createPaths(homeDir: string): OpenGoatPaths {
  return {
    homeDir,
    workspacesDir: path.join(homeDir, "workspaces"),
    agentsDir: path.join(homeDir, "agents"),
    skillsDir: path.join(homeDir, "skills"),
    providersDir: path.join(homeDir, "providers"),
    sessionsDir: path.join(homeDir, "sessions"),
    runsDir: path.join(homeDir, "runs"),
    globalConfigJsonPath: path.join(homeDir, "config.json"),
    globalConfigMarkdownPath: path.join(homeDir, "CONFIG.md"),
    agentsIndexJsonPath: path.join(homeDir, "agents.json")
  };
}

function createProviderService(params: {
  plannerExecutions: ProviderExecutionResult[];
  delegatedExecution: ProviderExecutionResult;
}): {
  invokeAgent: ReturnType<typeof vi.fn>;
  getAgentProvider: ReturnType<typeof vi.fn>;
  getAgentRuntimeProfile: ReturnType<typeof vi.fn>;
} {
  let plannerCallIndex = 0;

  const invokeAgent = vi.fn(async (_paths: OpenGoatPaths, agentId: string, _options: ProviderInvokeOptions) => {
    if (agentId === "orchestrator") {
      const next = params.plannerExecutions[plannerCallIndex] ?? params.plannerExecutions.at(-1);
      plannerCallIndex += 1;
      return {
        agentId,
        providerId: "openai",
        ...(next ?? { code: 1, stdout: "", stderr: "missing planner output" })
      };
    }

    return {
      agentId,
      providerId: "codex",
      ...params.delegatedExecution
    };
  });

  const getAgentProvider = vi.fn(async (_paths: OpenGoatPaths, agentId: string) => ({
    agentId,
    providerId: agentId === "orchestrator" ? "openai" : "codex"
  }));

  const getAgentRuntimeProfile = vi.fn(async (_paths: OpenGoatPaths, agentId: string) => ({
    agentId,
    providerId: agentId === "orchestrator" ? "openai" : "codex",
    providerKind: agentId === "orchestrator" ? "http" : "cli",
    workspaceAccess: agentId === "orchestrator" ? "internal" : "external"
  }));

  return {
    invokeAgent,
    getAgentProvider,
    getAgentRuntimeProfile
  };
}

function createSkillServiceStub(): Pick<SkillService, "buildSkillsPrompt" | "installSkill"> {
  return {
    buildSkillsPrompt: vi.fn(async () => ({
      prompt: "",
      skills: []
    })),
    installSkill: vi.fn(async () => ({
      scope: "agent",
      agentId: "orchestrator",
      skillId: "skill",
      skillName: "skill",
      source: "generated",
      installedPath: "/tmp/skill/SKILL.md",
      replaced: false
    }))
  };
}

function createManifestServiceStub(manifests: AgentManifest[]): Pick<AgentManifestService, "listManifests"> {
  return {
    listManifests: vi.fn(async () => manifests)
  };
}

function createSessionServiceStub(): Pick<SessionService, "prepareRunSession" | "recordAssistantReply"> {
  return {
    prepareRunSession: vi.fn(async () => ({ enabled: false })),
    recordAssistantReply: vi.fn(async () => ({
      sessionKey: "unused",
      sessionId: "unused",
      transcriptPath: "/tmp/unused.jsonl",
      applied: false,
      compactedMessages: 0
    }))
  };
}

function createManifest(
  agentId: string,
  options: {
    canReceive: boolean;
    canDelegate: boolean;
    provider: string;
    discoverable?: boolean;
  }
): AgentManifest {
  return {
    agentId,
    filePath: `/tmp/${agentId}/AGENTS.md`,
    workspaceDir: `/tmp/${agentId}`,
    body: "",
    source: "derived",
    metadata: {
      id: agentId,
      name: agentId,
      description: `${agentId} agent`,
      provider: options.provider,
      discoverable: options.discoverable ?? true,
      tags: [],
      delegation: {
        canReceive: options.canReceive,
        canDelegate: options.canDelegate
      },
      priority: 50
    }
  };
}

function okExecution(stdout: string): ProviderExecutionResult {
  return {
    code: 0,
    stdout,
    stderr: ""
  };
}
