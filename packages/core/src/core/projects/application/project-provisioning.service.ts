import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import type { ProviderExecutionResult } from "../../providers/index.js";
import { ProviderService } from "../../providers/index.js";
import { SessionService } from "../../sessions/index.js";
import { SkillService } from "../../skills/index.js";
import { type ProjectCreationResult, type ProjectDescriptor } from "../domain/project.js";
import { ProjectService } from "./project.service.js";
import {
  listProjectCmoBootstrapPrompts,
  type ProjectCmoBootstrapPrompt,
} from "./project-cmo-bootstrap.js";

const OPENCLAW_PROVIDER_ID = "openclaw";
const DEFAULT_PROJECT_CMO_SKILL_ID = "agent-browser";
const DEFAULT_PROJECT_CMO_SKILL_SOURCE_URL =
  "https://github.com/vercel-labs/agent-browser";

interface ProjectProvisioningServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  projectService: ProjectService;
  providerService: ProviderService;
  skillService: SkillService;
  sessionService: SessionService;
  containsAlreadyExistsMessage: (stdout: string, stderr: string) => boolean;
  toErrorMessage: (error: unknown) => string;
  ensureAgentLocation: (
    paths: OpenGoatPaths,
    agent: {
      agentId: string;
      displayName: string;
      workspaceDir: string;
      internalConfigDir: string;
    },
  ) => Promise<void>;
  syncExecutionPolicies: (
    paths: OpenGoatPaths,
    agentIds: string[],
  ) => Promise<string[]>;
}

export class ProjectProvisioningService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly projectService: ProjectService;
  private readonly providerService: ProviderService;
  private readonly skillService: SkillService;
  private readonly sessionService: SessionService;
  private readonly containsAlreadyExistsMessage: (
    stdout: string,
    stderr: string,
  ) => boolean;
  private readonly toErrorMessage: (error: unknown) => string;
  private readonly ensureAgentLocation: ProjectProvisioningServiceDeps["ensureAgentLocation"];
  private readonly syncExecutionPolicies: ProjectProvisioningServiceDeps["syncExecutionPolicies"];

  public constructor(deps: ProjectProvisioningServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.projectService = deps.projectService;
    this.providerService = deps.providerService;
    this.skillService = deps.skillService;
    this.sessionService = deps.sessionService;
    this.containsAlreadyExistsMessage = deps.containsAlreadyExistsMessage;
    this.toErrorMessage = deps.toErrorMessage;
    this.ensureAgentLocation = deps.ensureAgentLocation;
    this.syncExecutionPolicies = deps.syncExecutionPolicies;
  }

  public async createProject(
    paths: OpenGoatPaths,
    rawUrl: string,
  ): Promise<ProjectCreationResult> {
    const created = await this.projectService.ensureProject(paths, rawUrl);

    const runtimeSync = await this.providerService.createProviderAgent(
      paths,
      created.project.cmoAgent.id,
      {
        providerId: OPENCLAW_PROVIDER_ID,
        displayName: created.project.cmoAgent.displayName,
        workspaceDir: created.project.cmoAgent.workspaceDir,
        internalConfigDir: created.project.cmoAgent.internalConfigDir,
      },
    );

    if (
      runtimeSync.code !== 0 &&
      !this.containsAlreadyExistsMessage(runtimeSync.stdout, runtimeSync.stderr)
    ) {
      await this.rollbackCreatedProject(paths, created);
      throw new Error(
        `OpenClaw project agent creation failed for "${
          created.project.cmoAgent.id
        }" (exit ${runtimeSync.code}). ${
          runtimeSync.stderr.trim() || runtimeSync.stdout.trim() || ""
        }`.trim(),
      );
    }

    try {
      await this.ensureAgentLocation(paths, {
        agentId: created.project.cmoAgent.id,
        displayName: created.project.cmoAgent.displayName,
        workspaceDir: created.project.cmoAgent.workspaceDir,
        internalConfigDir: created.project.cmoAgent.internalConfigDir,
      });
    } catch (error) {
      await this.rollbackCreatedProject(paths, created);
      throw new Error(
        `OpenClaw project agent location sync failed for "${
          created.project.cmoAgent.id
        }". ${this.toErrorMessage(error)}`,
      );
    }

    await this.syncExecutionPolicies(paths, [created.project.cmoAgent.id]);

    try {
      await this.installDefaultProjectCmoSkills(paths, created.project.cmoAgent);
    } catch (error) {
      await this.rollbackCreatedProject(paths, created, { deleteProviderAgent: true });
      throw new Error(
        `Failed to install default skills for "${
          created.project.cmoAgent.id
        }". ${this.toErrorMessage(error)}`,
      );
    }

    try {
      await this.bootstrapProjectCmo(paths, created.project);
    } catch (error) {
      await this.rollbackCreatedProject(paths, created, { deleteProviderAgent: true });
      throw new Error(
        `Failed to bootstrap project CMO for "${
          created.project.cmoAgent.id
        }". ${this.toErrorMessage(error)}`,
      );
    }

    return {
      ...created,
      runtimeSync: {
        runtimeId: runtimeSync.providerId,
        code: runtimeSync.code,
        stdout: runtimeSync.stdout,
        stderr: runtimeSync.stderr,
      },
    };
  }

  private async installDefaultProjectCmoSkills(
    paths: OpenGoatPaths,
    agent: ProjectCreationResult["project"]["cmoAgent"],
  ): Promise<void> {
    await this.skillService.installSkill(
      paths,
      {
        agentId: agent.id,
        scope: "agent",
        skillName: DEFAULT_PROJECT_CMO_SKILL_ID,
        sourceUrl: DEFAULT_PROJECT_CMO_SKILL_SOURCE_URL,
        sourceSkillName: DEFAULT_PROJECT_CMO_SKILL_ID,
      },
      {
        workspaceDir: agent.workspaceDir,
        workspaceSkillDirectories: ["skills"],
      },
    );
  }

  private async bootstrapProjectCmo(
    paths: OpenGoatPaths,
    project: ProjectDescriptor,
  ): Promise<void> {
    const projectSessionPaths: OpenGoatPaths = {
      ...paths,
      agentsDir: this.pathPort.join(project.rootDir, "agents"),
      workspacesDir: project.rootDir,
    };
    const sessionAgentId = project.cmoAgent.roleId;
    const prompts = listProjectCmoBootstrapPrompts(project.sourceUrl);

    for (const prompt of prompts) {
      if (
        await this.hasCompletedBootstrapPrompt(
          projectSessionPaths,
          sessionAgentId,
          prompt,
        )
      ) {
        continue;
      }
      await this.runBootstrapPrompt(
        paths,
        projectSessionPaths,
        sessionAgentId,
        project,
        prompt,
      );
    }
  }

  private async rollbackCreatedProject(
    paths: OpenGoatPaths,
    created: ProjectCreationResult,
    options: { deleteProviderAgent?: boolean } = {},
  ): Promise<void> {
    if (options.deleteProviderAgent && !created.alreadyExisted) {
      await this.providerService.deleteProviderAgent(
        paths,
        created.project.cmoAgent.id,
        { providerId: OPENCLAW_PROVIDER_ID },
      );
    }
    if (!created.alreadyExisted) {
      await this.fileSystem.removeDir(created.project.rootDir);
    }
  }

  private async hasCompletedBootstrapPrompt(
    projectSessionPaths: OpenGoatPaths,
    sessionAgentId: string,
    prompt: ProjectCmoBootstrapPrompt,
  ): Promise<boolean> {
    const history = await this.sessionService.getSessionHistory(
      projectSessionPaths,
      sessionAgentId,
      {
        sessionRef: prompt.sessionRef,
      },
    );
    const lastAssistantMessage = findLastAssistantMessage(history.messages);
    if (!lastAssistantMessage) {
      return false;
    }
    return !isBootstrapRuntimeErrorMessage(lastAssistantMessage.content);
  }

  private async runBootstrapPrompt(
    paths: OpenGoatPaths,
    projectSessionPaths: OpenGoatPaths,
    sessionAgentId: string,
    project: ProjectDescriptor,
    prompt: ProjectCmoBootstrapPrompt,
  ): Promise<void> {
    const prepared = await this.sessionService.prepareRunSession(
      projectSessionPaths,
      sessionAgentId,
      {
        sessionRef: prompt.sessionRef,
        userMessage: prompt.message,
      },
    );
    if (!prepared.enabled) {
      throw new Error(
        `Project CMO bootstrap session was unexpectedly disabled for "${prompt.name}".`,
      );
    }

    let execution: ProviderExecutionResult;
    try {
      execution = await this.providerService.invokeProviderAgent(
        paths,
        project.cmoAgent.id,
        OPENCLAW_PROVIDER_ID,
        {
          message: prompt.message,
          providerSessionId: prepared.info.sessionId,
        },
      );
    } catch (error) {
      await this.sessionService.recordAssistantReply(
        projectSessionPaths,
        prepared.info,
        `[Runtime error] ${this.toErrorMessage(error)}`,
      );
      throw error;
    }

    const assistantContent =
      execution.stdout.trim() ||
      (execution.stderr.trim()
        ? `[Runtime error code ${execution.code}] ${execution.stderr.trim()}`
        : `[Runtime exited with code ${execution.code}]`);
    await this.sessionService.recordAssistantReply(
      projectSessionPaths,
      prepared.info,
      assistantContent,
    );

    if (execution.code !== 0) {
      throw new Error(
        `Bootstrap prompt "${prompt.name}" failed (exit ${execution.code}). ${
          execution.stderr.trim() || execution.stdout.trim() || ""
        }`.trim(),
      );
    }
  }
}

function findLastAssistantMessage(
  messages: Array<{ type: string; role?: string; content?: string }>,
): { content: string } | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index];
    if (
      entry?.type === "message" &&
      entry.role === "assistant" &&
      typeof entry.content === "string"
    ) {
      return { content: entry.content };
    }
  }
  return null;
}

function isBootstrapRuntimeErrorMessage(content: string): boolean {
  return /^\[(?:Runtime error|Runtime error code \d+|Runtime exited with code )/.test(
    content,
  );
}
