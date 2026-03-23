import {
  agentCatalogSchema,
  agentSchema,
  agentSessionListSchema,
  agentSessionSchema,
  artifactListPageSchema,
  artifactRecordSchema,
  artifactVersionSchema,
  authSessionSchema,
  authOverviewSchema,
  bootstrapPromptListSchema,
  bundleRecordSchema,
  chatBootstrapSchema,
  connectProviderSecretRequestSchema,
  createAgentRequestSchema,
  createAgentSessionRequestSchema,
  createArtifactRequestSchema,
  createBundleRequestSchema,
  createMemoryRequestSchema,
  createSignalRequestSchema,
  deleteAgentResponseSchema,
  createObjectiveRequestSchema,
  deleteTasksRequestSchema,
  deleteTasksResponseSchema,
  dismissSignalRequestSchema,
  installSkillRequestSchema,
  installSkillResultSchema,
  listPlaybooksResponseSchema,
  memoryListSchema,
  memoryRecordSchema,
  objectiveListSchema,
  objectiveSchema,
  playbookManifestSchema,
  promoteSignalRequestSchema,
  removeSkillResultSchema,
  resolveConflictRequestSchema,
  signalListPageSchema,
  signalSchema,
  skillListSchema,
  taskListPageSchema,
  taskRecordSchema,
  updateAgentRequestSchema,
  updateAgentSessionRequestSchema,
  updateArtifactRequestSchema,
  updateArtifactStatusRequestSchema,
  updateMemoryRequestSchema,
  updateObjectiveRequestSchema,
  updateSignalStatusRequestSchema,
  updateTaskStatusRequestSchema,
  advanceRunPhaseRequestSchema,
  createRunRequestSchema,
  runListPageSchema,
  runRecordSchema,
  updateRunStatusRequestSchema,
  addTaskBlockerRequestSchema,
  addTaskArtifactRequestSchema,
  addTaskWorklogRequestSchema,
  providerModelCatalogSchema,
  createBasicAuthHeader,
  respondAuthSessionRequestSchema,
  savedConnectionSchema,
  setProviderModelRequestSchema,
  selectConnectionRequestSchema,
  sidecarBootstrapSchema,
  sidecarConnectionSchema,
  sidecarHealthSchema,
  startAuthSessionRequestSchema,
  workspaceFileCheckSchema,
  workspaceFileContentSchema,
  type AgentSession,
  type AgentSessionList,
  type ArtifactListPage,
  type ArtifactRecord,
  type ArtifactVersion,
  type AuthOverview,
  type Agent,
  type AgentCatalog,
  type AuthSession,
  type BootstrapPromptList,
  type BundleRecord,
  type ChatBootstrap,
  type DeleteTasksResponse,
  type InstallSkillResultContract,
  type CreateMemoryRequest,
  type ListPlaybooksResponse,
  type MemoryRecord,
  type Objective,
  type PlaybookManifest,
  type ProviderModelCatalog,
  type RunListPage,
  type RunRecord,
  type RemoveSkillResultContract,
  type SavedConnection,
  type Signal,
  type SignalListPage,
  type SidecarBootstrap,
  type SidecarConnection,
  type SidecarHealth,
  type SkillList,
  type TaskListPage,
  type TaskRecord,
  type WorkspaceFileCheck,
  type WorkspaceFileContent,
} from "@opengoat/contracts";
import { z } from "zod";

export class SidecarClient {
  constructor(private readonly connection: SidecarConnection) {}

  static fromConnection(candidate: unknown): SidecarClient {
    return new SidecarClient(sidecarConnectionSchema.parse(candidate));
  }

  async waitUntilHealthy(timeoutMs = 20_000): Promise<SidecarHealth> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      try {
        return await this.health();
      } catch {
        await new Promise((resolve) => window.setTimeout(resolve, 150));
      }
    }

    throw new Error("Timed out waiting for the sidecar to become healthy.");
  }

  async health(): Promise<SidecarHealth> {
    return sidecarHealthSchema.parse(await this.request("/global/health"));
  }

  async bootstrap(): Promise<SidecarBootstrap> {
    return sidecarBootstrapSchema.parse(
      await this.request("/global/bootstrap"),
    );
  }

  async agentCatalog(): Promise<AgentCatalog> {
    return agentCatalogSchema.parse(await this.request("/agents"));
  }

  async createProjectAgent(projectUrl: string): Promise<Agent> {
    return agentSchema.parse(
      await this.request("/agents/project", {
        body: JSON.stringify({ projectUrl }),
        method: "POST",
      }),
    );
  }

  async getBootstrapPrompts(agentId: string, projectUrl: string): Promise<BootstrapPromptList> {
    const params = new URLSearchParams({ projectUrl });
    return bootstrapPromptListSchema.parse(
      await this.request(
        `/agents/${encodeURIComponent(agentId)}/bootstrap-prompts?${params.toString()}`,
      ),
    );
  }

  async checkWorkspaceFile(agentId: string, filename: string): Promise<WorkspaceFileCheck> {
    return workspaceFileCheckSchema.parse(
      await this.request(
        `/agents/${encodeURIComponent(agentId)}/workspace/files/${encodeURIComponent(filename)}`,
      ),
    );
  }

  async readWorkspaceFile(agentId: string, filename: string): Promise<WorkspaceFileContent> {
    return workspaceFileContentSchema.parse(
      await this.request(
        `/agents/${encodeURIComponent(agentId)}/workspace/files/${encodeURIComponent(filename)}/content`,
      ),
    );
  }

  async writeWorkspaceFile(agentId: string, filename: string, content: string): Promise<WorkspaceFileContent> {
    return workspaceFileContentSchema.parse(
      await this.request(
        `/agents/${encodeURIComponent(agentId)}/workspace/files/${encodeURIComponent(filename)}/content`,
        {
          body: JSON.stringify({ content }),
          method: "PUT",
        },
      ),
    );
  }

  /**
   * Sends a chat message and returns the raw streaming Response.
   * Use this for bootstrap prompts where you need to read the stream directly.
   */
  async sendChatMessage(
    payload: { agentId: string; message: string; sessionId: string },
    signal?: AbortSignal,
  ): Promise<Response> {
    const headers = this.createAuthHeaders();
    headers.set("Content-Type", "application/json");

    const response = await fetch(new URL("/chat", this.connection.url), {
      body: JSON.stringify(payload),
      headers,
      method: "POST",
      ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
      throw new Error(`Chat request failed with status ${String(response.status)}.`);
    }

    return response;
  }

  async listSkills(agentId: string): Promise<SkillList> {
    return skillListSchema.parse(
      await this.request(`/agents/${encodeURIComponent(agentId)}/skills`),
    );
  }

  async installSkill(
    agentId: string,
    payload: { skillName: string; sourceUrl?: string },
  ): Promise<InstallSkillResultContract> {
    return installSkillResultSchema.parse(
      await this.request(`/agents/${encodeURIComponent(agentId)}/skills`, {
        body: JSON.stringify(installSkillRequestSchema.parse(payload)),
        method: "POST",
      }),
    );
  }

  async removeSkill(agentId: string, skillId: string): Promise<RemoveSkillResultContract> {
    return removeSkillResultSchema.parse(
      await this.request(
        `/agents/${encodeURIComponent(agentId)}/skills/${encodeURIComponent(skillId)}`,
        { method: "DELETE" },
      ),
    );
  }

  async authOverview(): Promise<AuthOverview> {
    return authOverviewSchema.parse(await this.request("/auth/overview"));
  }

  async chatBootstrap(agentId?: string, sessionId?: string): Promise<ChatBootstrap> {
    const params = new URLSearchParams();
    if (agentId) {
      params.set("agentId", agentId);
    }
    if (sessionId) {
      params.set("sessionId", sessionId);
    }
    const query = params.toString();
    return chatBootstrapSchema.parse(
      await this.request(`/chat/bootstrap${query ? `?${query}` : ""}`),
    );
  }

  async listSessions(agentId?: string): Promise<AgentSessionList> {
    const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
    return agentSessionListSchema.parse(await this.request(`/agents/sessions${query}`));
  }

  async createSession(payload: {
    agentId: string;
    internal?: boolean;
    label?: string;
  }): Promise<AgentSession> {
    return agentSessionSchema.parse(
      await this.request("/agents/sessions", {
        body: JSON.stringify(createAgentSessionRequestSchema.parse(payload)),
        method: "POST",
      }),
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.request(`/agents/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
  }

  async updateSessionLabel(sessionId: string, label: string): Promise<AgentSession> {
    return agentSessionSchema.parse(
      await this.request(`/agents/sessions/${encodeURIComponent(sessionId)}`, {
        body: JSON.stringify(updateAgentSessionRequestSchema.parse({ label })),
        method: "PATCH",
      }),
    );
  }

  async agents(): Promise<AgentCatalog> {
    return agentCatalogSchema.parse(await this.request("/agents"));
  }

  async createAgent(payload: {
    id?: string;
    name: string;
    description?: string;
    instructions?: string;
    providerId?: string;
    modelId?: string;
    workspaceDir?: string;
    setAsDefault?: boolean;
  }): Promise<Agent> {
    return agentSchema.parse(
      await this.request("/agents", {
        body: JSON.stringify(createAgentRequestSchema.parse(payload)),
        method: "POST",
      }),
    );
  }

  async updateAgent(
    agentId: string,
    payload: {
      name?: string;
      description?: string;
      instructions?: string;
      providerId?: string;
      modelId?: string;
      workspaceDir?: string;
      setAsDefault?: boolean;
    },
  ): Promise<Agent> {
    return agentSchema.parse(
      await this.request(`/agents/${encodeURIComponent(agentId)}`, {
        body: JSON.stringify(updateAgentRequestSchema.parse(payload)),
        method: "PATCH",
      }),
    );
  }

  async deleteAgent(
    agentId: string,
  ): Promise<{ agentId: string; deletedSessions: number; removedPaths: string[] }> {
    return deleteAgentResponseSchema.parse(
      await this.request(`/agents/${encodeURIComponent(agentId)}`, {
        method: "DELETE",
      }),
    );
  }

  async connectProviderSecret(payload: {
    authChoice: string;
    secret: string;
  }): Promise<SavedConnection> {
    return savedConnectionSchema.parse(
      await this.request("/auth/credentials", {
        body: JSON.stringify(connectProviderSecretRequestSchema.parse(payload)),
        method: "POST",
      }),
    );
  }

  async selectConnection(profileId: string): Promise<SavedConnection> {
    return savedConnectionSchema.parse(
      await this.request("/auth/select", {
        body: JSON.stringify(selectConnectionRequestSchema.parse({ profileId })),
        method: "POST",
      }),
    );
  }

  async providerModels(providerId: string): Promise<ProviderModelCatalog> {
    return providerModelCatalogSchema.parse(
      await this.request(`/auth/providers/${encodeURIComponent(providerId)}/models`),
    );
  }

  async setProviderModel(providerId: string, modelRef: string): Promise<AuthOverview> {
    return authOverviewSchema.parse(
      await this.request(`/auth/providers/${encodeURIComponent(providerId)}/model`, {
        body: JSON.stringify(setProviderModelRequestSchema.parse({ modelRef })),
        method: "POST",
      }),
    );
  }

  async deleteAuthProfile(profileId: string): Promise<void> {
    await this.request(`/auth/profiles/${encodeURIComponent(profileId)}`, {
      method: "DELETE",
    });
  }

  async startAuthSession(payload: {
    authChoice: string;
  }): Promise<AuthSession> {
    return authSessionSchema.parse(
      await this.request("/auth/sessions", {
        body: JSON.stringify(startAuthSessionRequestSchema.parse(payload)),
        method: "POST",
      }),
    );
  }

  async getAuthSession(sessionId: string): Promise<AuthSession> {
    return authSessionSchema.parse(
      await this.request(`/auth/sessions/${sessionId}`),
    );
  }

  async respondToAuthSession(
    sessionId: string,
    value: boolean | string | string[],
  ): Promise<AuthSession> {
    return authSessionSchema.parse(
      await this.request(`/auth/sessions/${sessionId}/respond`, {
        body: JSON.stringify(
          respondAuthSessionRequestSchema.parse({ value }),
        ),
        method: "POST",
      }),
    );
  }

  async listTasks(params?: {
    status?: string;
    assignee?: string;
    objectiveId?: string;
    runId?: string;
    sourceType?: string;
    limit?: number;
    offset?: number;
  }): Promise<TaskListPage> {
    const query = new URLSearchParams();
    if (params?.status) {
      query.set("status", params.status);
    }
    if (params?.assignee) {
      query.set("assignee", params.assignee);
    }
    if (params?.objectiveId) {
      query.set("objectiveId", params.objectiveId);
    }
    if (params?.runId) {
      query.set("runId", params.runId);
    }
    if (params?.sourceType) {
      query.set("sourceType", params.sourceType);
    }
    if (params?.limit !== undefined) {
      query.set("limit", String(params.limit));
    }
    if (params?.offset !== undefined) {
      query.set("offset", String(params.offset));
    }
    const qs = query.toString();
    return taskListPageSchema.parse(
      await this.request(`/tasks${qs ? `?${qs}` : ""}`),
    );
  }

  async getTask(taskId: string): Promise<TaskRecord> {
    return taskRecordSchema.parse(
      await this.request(`/tasks/${encodeURIComponent(taskId)}`),
    );
  }

  async updateTaskStatus(
    taskId: string,
    status: string,
    reason?: string,
    actorId?: string,
  ): Promise<TaskRecord> {
    return taskRecordSchema.parse(
      await this.request(`/tasks/${encodeURIComponent(taskId)}/status`, {
        body: JSON.stringify(updateTaskStatusRequestSchema.parse({ status, reason })),
        method: "PATCH",
        ...(actorId ? { headers: { "x-actor-id": actorId } } : {}),
      }),
    );
  }

  async addTaskBlocker(taskId: string, content: string, actorId?: string): Promise<TaskRecord> {
    return taskRecordSchema.parse(
      await this.request(`/tasks/${encodeURIComponent(taskId)}/blockers`, {
        body: JSON.stringify(addTaskBlockerRequestSchema.parse({ content })),
        method: "POST",
        ...(actorId ? { headers: { "x-actor-id": actorId } } : {}),
      }),
    );
  }

  async addTaskArtifact(taskId: string, content: string, actorId?: string): Promise<TaskRecord> {
    return taskRecordSchema.parse(
      await this.request(`/tasks/${encodeURIComponent(taskId)}/artifacts`, {
        body: JSON.stringify(addTaskArtifactRequestSchema.parse({ content })),
        method: "POST",
        ...(actorId ? { headers: { "x-actor-id": actorId } } : {}),
      }),
    );
  }

  async addTaskWorklog(taskId: string, content: string, actorId?: string): Promise<TaskRecord> {
    return taskRecordSchema.parse(
      await this.request(`/tasks/${encodeURIComponent(taskId)}/worklog`, {
        body: JSON.stringify(addTaskWorklogRequestSchema.parse({ content })),
        method: "POST",
        ...(actorId ? { headers: { "x-actor-id": actorId } } : {}),
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Objectives
  // ---------------------------------------------------------------------------

  async createObjective(payload: {
    projectId: string;
    title: string;
    goalType?: string;
    summary?: string;
    whyNow?: string;
    successDefinition?: string;
    timeframe?: string;
    alreadyTried?: string;
    avoid?: string;
    constraints?: string;
    preferredChannels?: string[];
  }): Promise<Objective> {
    return objectiveSchema.parse(
      await this.request("/objectives", {
        body: JSON.stringify({
          projectId: payload.projectId,
          ...createObjectiveRequestSchema.parse(payload),
        }),
        method: "POST",
      }),
    );
  }

  async listObjectives(projectId: string, status?: string): Promise<Objective[]> {
    const query = new URLSearchParams({ projectId });
    if (status) {
      query.set("status", status);
    }
    return objectiveListSchema.parse(
      await this.request(`/objectives?${query.toString()}`),
    );
  }

  async getObjective(objectiveId: string): Promise<Objective> {
    return objectiveSchema.parse(
      await this.request(`/objectives/${encodeURIComponent(objectiveId)}`),
    );
  }

  async updateObjective(
    objectiveId: string,
    changes: {
      title?: string;
      goalType?: string;
      status?: string;
      summary?: string;
      whyNow?: string;
      successDefinition?: string;
      timeframe?: string;
      alreadyTried?: string;
      avoid?: string;
      constraints?: string;
      preferredChannels?: string[];
      isPrimary?: boolean;
    },
  ): Promise<Objective> {
    return objectiveSchema.parse(
      await this.request(`/objectives/${encodeURIComponent(objectiveId)}`, {
        body: JSON.stringify(updateObjectiveRequestSchema.parse(changes)),
        method: "PATCH",
      }),
    );
  }

  async archiveObjective(objectiveId: string): Promise<Objective> {
    return objectiveSchema.parse(
      await this.request(
        `/objectives/${encodeURIComponent(objectiveId)}/archive`,
        { method: "POST" },
      ),
    );
  }

  async setPrimaryObjective(projectId: string, objectiveId: string): Promise<Objective> {
    return objectiveSchema.parse(
      await this.request(
        `/objectives/${encodeURIComponent(objectiveId)}/set-primary`,
        {
          body: JSON.stringify({ projectId }),
          method: "POST",
        },
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Playbooks
  // ---------------------------------------------------------------------------

  async listPlaybooks(): Promise<ListPlaybooksResponse> {
    return listPlaybooksResponseSchema.parse(
      await this.request("/playbooks"),
    );
  }

  async getPlaybook(playbookId: string): Promise<PlaybookManifest> {
    return playbookManifestSchema.parse(
      await this.request(`/playbooks/${encodeURIComponent(playbookId)}`),
    );
  }

  // ---------------------------------------------------------------------------
  // Runs
  // ---------------------------------------------------------------------------

  async createRun(payload: {
    projectId: string;
    objectiveId: string;
    playbookId?: string;
    title: string;
    startedFrom?: string;
    agentId?: string;
    phase?: string;
    phaseSummary?: string;
    sessionId?: string;
  }): Promise<RunRecord> {
    return runRecordSchema.parse(
      await this.request("/runs", {
        body: JSON.stringify(createRunRequestSchema.parse(payload)),
        method: "POST",
      }),
    );
  }

  async getRun(runId: string): Promise<RunRecord> {
    return runRecordSchema.parse(
      await this.request(`/runs/${encodeURIComponent(runId)}`),
    );
  }

  async listRuns(params?: {
    projectId?: string;
    objectiveId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<RunListPage> {
    const query = new URLSearchParams();
    if (params?.projectId) {
      query.set("projectId", params.projectId);
    }
    if (params?.objectiveId) {
      query.set("objectiveId", params.objectiveId);
    }
    if (params?.status) {
      query.set("status", params.status);
    }
    if (params?.limit !== undefined) {
      query.set("limit", String(params.limit));
    }
    if (params?.offset !== undefined) {
      query.set("offset", String(params.offset));
    }
    const qs = query.toString();
    return runListPageSchema.parse(
      await this.request(`/runs${qs ? `?${qs}` : ""}`),
    );
  }

  async updateRunStatus(runId: string, status: string): Promise<RunRecord> {
    return runRecordSchema.parse(
      await this.request(`/runs/${encodeURIComponent(runId)}/status`, {
        body: JSON.stringify(updateRunStatusRequestSchema.parse({ status })),
        method: "PATCH",
      }),
    );
  }

  async advanceRunPhase(
    runId: string,
    phase: string,
    phaseSummary?: string,
  ): Promise<RunRecord> {
    return runRecordSchema.parse(
      await this.request(`/runs/${encodeURIComponent(runId)}/advance-phase`, {
        body: JSON.stringify(
          advanceRunPhaseRequestSchema.parse({ phase, phaseSummary }),
        ),
        method: "POST",
      }),
    );
  }

  async createTaskFromRun(payload: {
    runId: string;
    objectiveId: string;
    title: string;
    description: string;
    assignedTo?: string;
    status?: string;
  }): Promise<TaskRecord> {
    return taskRecordSchema.parse(
      await this.request("/tasks/from-run", {
        body: JSON.stringify(payload),
        method: "POST",
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Artifacts
  // ---------------------------------------------------------------------------

  async listArtifacts(params?: {
    projectId?: string;
    objectiveId?: string;
    runId?: string;
    taskId?: string;
    bundleId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ArtifactListPage> {
    const query = new URLSearchParams();
    if (params?.projectId) {
      query.set("projectId", params.projectId);
    }
    if (params?.objectiveId) {
      query.set("objectiveId", params.objectiveId);
    }
    if (params?.runId) {
      query.set("runId", params.runId);
    }
    if (params?.taskId) {
      query.set("taskId", params.taskId);
    }
    if (params?.bundleId) {
      query.set("bundleId", params.bundleId);
    }
    if (params?.status) {
      query.set("status", params.status);
    }
    if (params?.limit !== undefined) {
      query.set("limit", String(params.limit));
    }
    if (params?.offset !== undefined) {
      query.set("offset", String(params.offset));
    }
    const qs = query.toString();
    return artifactListPageSchema.parse(
      await this.request(`/artifacts${qs ? `?${qs}` : ""}`),
    );
  }

  async getArtifact(artifactId: string): Promise<ArtifactRecord> {
    return artifactRecordSchema.parse(
      await this.request(`/artifacts/${encodeURIComponent(artifactId)}`),
    );
  }

  async createArtifact(data: {
    projectId: string;
    title: string;
    type: string;
    format: string;
    contentRef: string;
    createdBy: string;
    objectiveId?: string;
    runId?: string;
    taskId?: string;
    bundleId?: string;
    content?: string;
    summary?: string;
  }): Promise<ArtifactRecord> {
    return artifactRecordSchema.parse(
      await this.request("/artifacts", {
        body: JSON.stringify(createArtifactRequestSchema.parse(data)),
        method: "POST",
      }),
    );
  }

  async updateArtifact(
    artifactId: string,
    data: {
      title?: string;
      content?: string;
      contentRef?: string;
      summary?: string;
    },
  ): Promise<ArtifactRecord> {
    return artifactRecordSchema.parse(
      await this.request(`/artifacts/${encodeURIComponent(artifactId)}`, {
        body: JSON.stringify(updateArtifactRequestSchema.parse(data)),
        method: "PATCH",
      }),
    );
  }

  async updateArtifactStatus(
    artifactId: string,
    status: string,
    feedback?: string,
    actorId?: string,
  ): Promise<ArtifactRecord> {
    return artifactRecordSchema.parse(
      await this.request(`/artifacts/${encodeURIComponent(artifactId)}/status`, {
        body: JSON.stringify(updateArtifactStatusRequestSchema.parse({ status, actor: actorId })),
        method: "PATCH",
        ...(actorId ? { headers: { "x-actor-id": actorId } } : {}),
      }),
    );
  }

  async getArtifactVersions(artifactId: string): Promise<ArtifactVersion[]> {
    return z.array(artifactVersionSchema).parse(
      await this.request(`/artifacts/${encodeURIComponent(artifactId)}/versions`),
    );
  }

  async createBundle(data: {
    projectId: string;
    title: string;
    description?: string;
  }): Promise<BundleRecord> {
    return bundleRecordSchema.parse(
      await this.request("/bundles", {
        body: JSON.stringify(createBundleRequestSchema.parse(data)),
        method: "POST",
      }),
    );
  }

  async listBundleArtifacts(bundleId: string): Promise<ArtifactRecord[]> {
    return z.array(artifactRecordSchema).parse(
      await this.request(`/bundles/${encodeURIComponent(bundleId)}`),
    );
  }

  // ---------------------------------------------------------------------------
  // Memory
  // ---------------------------------------------------------------------------

  async listMemories(params: {
    projectId: string;
    objectiveId?: string;
    category?: string;
    scope?: string;
    activeOnly?: boolean;
  }): Promise<MemoryRecord[]> {
    const query = new URLSearchParams();
    query.set("projectId", params.projectId);
    if (params.objectiveId) {
      query.set("objectiveId", params.objectiveId);
    }
    if (params.category) {
      query.set("category", params.category);
    }
    if (params.scope) {
      query.set("scope", params.scope);
    }
    if (params.activeOnly !== undefined) {
      query.set("activeOnly", String(params.activeOnly));
    }
    const qs = query.toString();
    return memoryListSchema.parse(await this.request(`/memories?${qs}`));
  }

  async getMemory(memoryId: string): Promise<MemoryRecord> {
    return memoryRecordSchema.parse(
      await this.request(`/memories/${encodeURIComponent(memoryId)}`),
    );
  }

  async createMemory(payload: CreateMemoryRequest): Promise<MemoryRecord> {
    return memoryRecordSchema.parse(
      await this.request("/memories", {
        body: JSON.stringify(createMemoryRequestSchema.parse(payload)),
        method: "POST",
      }),
    );
  }

  async updateMemory(
    memoryId: string,
    payload: { content?: string; confidence?: number; userConfirmed?: boolean },
  ): Promise<MemoryRecord> {
    return memoryRecordSchema.parse(
      await this.request(`/memories/${encodeURIComponent(memoryId)}`, {
        body: JSON.stringify(updateMemoryRequestSchema.parse(payload)),
        method: "PATCH",
      }),
    );
  }

  async deleteMemory(memoryId: string): Promise<void> {
    await this.request(`/memories/${encodeURIComponent(memoryId)}`, {
      method: "DELETE",
    });
  }

  async resolveMemoryConflict(payload: {
    keepMemoryId: string;
    replaceMemoryId: string;
  }): Promise<void> {
    await this.request("/memories/conflicts/resolve", {
      body: JSON.stringify(resolveConflictRequestSchema.parse(payload)),
      method: "POST",
    });
  }

  // ---------------------------------------------------------------------------
  // Workspace Signals
  // ---------------------------------------------------------------------------

  async detectWorkspaceSignals(
    projectId: string,
  ): Promise<{ created: number; skipped: number }> {
    return z
      .object({ created: z.number(), skipped: z.number() })
      .parse(
        await this.request("/workspace-signals/detect", {
          body: JSON.stringify({ projectId }),
          method: "POST",
        }),
      );
  }

  // ---------------------------------------------------------------------------
  // Signals
  // ---------------------------------------------------------------------------

  async listSignals(params?: {
    projectId?: string;
    objectiveId?: string;
    status?: string;
    sourceType?: string;
    limit?: number;
    offset?: number;
  }): Promise<SignalListPage> {
    const query = new URLSearchParams();
    if (params?.projectId) {
      query.set("projectId", params.projectId);
    }
    if (params?.objectiveId) {
      query.set("objectiveId", params.objectiveId);
    }
    if (params?.status) {
      query.set("status", params.status);
    }
    if (params?.sourceType) {
      query.set("sourceType", params.sourceType);
    }
    if (params?.limit !== undefined) {
      query.set("limit", String(params.limit));
    }
    if (params?.offset !== undefined) {
      query.set("offset", String(params.offset));
    }
    const qs = query.toString();
    return signalListPageSchema.parse(
      await this.request(`/signals${qs ? `?${qs}` : ""}`),
    );
  }

  async createSignal(payload: {
    projectId: string;
    sourceType: string;
    signalType: string;
    title: string;
    summary: string;
    evidence?: string;
    importance: string;
    freshness: string;
    objectiveId?: string;
  }): Promise<Signal> {
    return signalSchema.parse(
      await this.request("/signals", {
        body: JSON.stringify(createSignalRequestSchema.parse(payload)),
        method: "POST",
      }),
    );
  }

  async getSignal(signalId: string): Promise<Signal> {
    return signalSchema.parse(
      await this.request(`/signals/${encodeURIComponent(signalId)}`),
    );
  }

  async updateSignalStatus(signalId: string, status: string): Promise<Signal> {
    return signalSchema.parse(
      await this.request(`/signals/${encodeURIComponent(signalId)}/status`, {
        body: JSON.stringify(updateSignalStatusRequestSchema.parse({ status })),
        method: "PATCH",
      }),
    );
  }

  async promoteSignal(signalId: string, targetObjectiveId?: string): Promise<Signal> {
    return signalSchema.parse(
      await this.request(`/signals/${encodeURIComponent(signalId)}/promote`, {
        body: JSON.stringify(promoteSignalRequestSchema.parse({ targetObjectiveId })),
        method: "POST",
      }),
    );
  }

  async dismissSignal(signalId: string): Promise<Signal> {
    return signalSchema.parse(
      await this.request(`/signals/${encodeURIComponent(signalId)}/dismiss`, {
        body: JSON.stringify(dismissSignalRequestSchema.parse({})),
        method: "POST",
      }),
    );
  }

  async deleteTasks(taskIds: string[]): Promise<DeleteTasksResponse> {
    return deleteTasksResponseSchema.parse(
      await this.request("/tasks", {
        body: JSON.stringify(deleteTasksRequestSchema.parse({ taskIds })),
        method: "DELETE",
      }),
    );
  }

  createApiUrl(path: string): string {
    return new URL(path, this.connection.url).toString();
  }

  createAuthHeaders(): Headers {
    const headers = new Headers();
    headers.set(
      "Authorization",
      createBasicAuthHeader(this.connection.username, this.connection.password),
    );
    return headers;
  }

  private async request(
    path: string,
    init?: RequestInit,
  ): Promise<unknown> {
    const headers = this.createAuthHeaders();
    const initHeaders = new Headers(init?.headers);
    for (const [key, value] of initHeaders.entries()) {
      headers.set(key, value);
    }

    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(new URL(path, this.connection.url), {
      ...init,
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Sidecar request failed with status ${String(response.status)}.`,
      );
    }

    if (response.status === 204) {
      return null;
    }

    return (await response.json()) as unknown;
  }
}
