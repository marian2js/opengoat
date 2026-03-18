import {
  agentCatalogSchema,
  agentSchema,
  agentSessionListSchema,
  agentSessionSchema,
  authSessionSchema,
  authOverviewSchema,
  bootstrapPromptListSchema,
  chatBootstrapSchema,
  connectProviderSecretRequestSchema,
  createAgentRequestSchema,
  createAgentSessionRequestSchema,
  updateAgentRequestSchema,
  updateAgentSessionRequestSchema,
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
  type AgentSession,
  type AgentSessionList,
  type AuthOverview,
  type Agent,
  type AgentCatalog,
  type AuthSession,
  type BootstrapPromptList,
  type ChatBootstrap,
  type ProviderModelCatalog,
  type SavedConnection,
  type SidecarBootstrap,
  type SidecarConnection,
  type SidecarHealth,
  type WorkspaceFileCheck,
} from "@opengoat/contracts";

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
      signal,
    });

    if (!response.ok) {
      throw new Error(`Chat request failed with status ${String(response.status)}.`);
    }

    return response;
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
