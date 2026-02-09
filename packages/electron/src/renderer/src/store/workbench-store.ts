import { create } from "zustand";
import type {
  WorkbenchAgent,
  WorkbenchAgentCreationResult,
  WorkbenchAgentDeletionResult,
  WorkbenchAgentProvider,
  WorkbenchGatewayMode,
  WorkbenchMessage,
  WorkbenchOnboarding,
  WorkbenchProject,
  WorkbenchRunStatusEvent,
  WorkbenchSession
} from "@shared/workbench";
import {
  WORKBENCH_CHAT_ERROR_PROVIDER_ID,
  WORKBENCH_GATEWAY_DEFAULT_TIMEOUT_MS
} from "@shared/workbench";
import {
  createWorkbenchApiClient,
  type WorkbenchApiClient
} from "@renderer/lib/trpc";

export type OnboardingFlowState = "hidden" | "loading" | "editing" | "submitting";
export type ChatFlowState = "idle" | "sending";
export type OnboardingGuidedAuthState = "idle" | "running";
export type GatewayFlowState = "idle" | "saving";
export type AgentsFlowState = "idle" | "loading" | "saving";

export interface OnboardingGatewayDraft {
  mode: WorkbenchGatewayMode;
  remoteUrl: string;
  remoteToken: string;
  timeoutMs: number;
}

interface WorkbenchUiState {
  homeDir: string;
  ipcContractVersion: number | null;
  projects: WorkbenchProject[];
  onboarding: WorkbenchOnboarding | null;
  showOnboarding: boolean;
  onboardingState: OnboardingFlowState;
  onboardingGuidedAuthState: OnboardingGuidedAuthState;
  onboardingDraftProviderId: string;
  onboardingDraftEnv: Record<string, string>;
  onboardingDraftGateway: OnboardingGatewayDraft;
  gatewayState: GatewayFlowState;
  onboardingNotice: string | null;
  chatState: ChatFlowState;
  agents: WorkbenchAgent[];
  agentProviders: WorkbenchAgentProvider[];
  agentsState: AgentsFlowState;
  agentsNotice: string | null;
  activeProjectId: string | null;
  activeSessionId: string | null;
  activeMessages: WorkbenchMessage[];
  runStatusProjectId: string | null;
  runStatusSessionId: string | null;
  runStatusEvents: WorkbenchRunStatusEvent[];
  isBootstrapping: boolean;
  isBusy: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  addProjectFromDialog: () => Promise<void>;
  addProjectByPath: (rootPath: string) => Promise<void>;
  renameProject: (projectId: string, name: string) => Promise<void>;
  removeProject: (projectId: string) => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  createSession: (projectId: string, title?: string) => Promise<void>;
  renameSession: (projectId: string, sessionId: string, title: string) => Promise<void>;
  removeSession: (projectId: string, sessionId: string) => Promise<void>;
  selectSession: (projectId: string, sessionId: string) => Promise<void>;
  loadAgents: () => Promise<void>;
  saveAgentProviderConfig: (input: { providerId: string; env: Record<string, string> }) => Promise<void>;
  createAgent: (input: {
    name: string;
    providerId?: string;
    createExternalAgent?: boolean;
    env?: Record<string, string>;
  }) => Promise<void>;
  deleteAgent: (input: {
    agentId: string;
    providerId?: string;
    deleteExternalAgent?: boolean;
  }) => Promise<void>;
  clearAgentsNotice: () => void;
  submitOnboarding: (
    providerId: string,
    env: Record<string, string>
  ) => Promise<void>;
  saveOnboardingGateway: (gateway: OnboardingGatewayDraft) => Promise<void>;
  runOnboardingGuidedAuth: (providerId: string) => Promise<void>;
  setOnboardingDraftProvider: (providerId: string) => void;
  setOnboardingDraftField: (key: string, value: string) => void;
  setOnboardingDraftGateway: (patch: Partial<OnboardingGatewayDraft>) => void;
  openOnboarding: () => Promise<void>;
  closeOnboarding: () => Promise<void>;
  sendMessage: (
    message: string,
    options?: {
      rethrow?: boolean;
    }
  ) => Promise<WorkbenchMessage | null>;
  appendRunStatusEvent: (event: WorkbenchRunStatusEvent) => void;
  clearError: () => void;
}

export function createWorkbenchStore(api: WorkbenchApiClient = createWorkbenchApiClient()) {
  return create<WorkbenchUiState>((set, get) => ({
    homeDir: "",
    ipcContractVersion: null,
    projects: [],
    onboarding: null,
    showOnboarding: false,
    onboardingState: "hidden",
    onboardingGuidedAuthState: "idle",
    onboardingDraftProviderId: "",
    onboardingDraftEnv: {},
    onboardingDraftGateway: createDefaultGatewayDraft(),
    gatewayState: "idle",
    onboardingNotice: null,
    chatState: "idle",
    agents: [],
    agentProviders: [],
    agentsState: "idle",
    agentsNotice: null,
    activeProjectId: null,
    activeSessionId: null,
    activeMessages: [],
    runStatusProjectId: null,
    runStatusSessionId: null,
    runStatusEvents: [],
    isBootstrapping: true,
    isBusy: false,
    error: null,

    bootstrap: async () => {
      set({ isBootstrapping: true, isBusy: true, error: null });
      try {
        const contract = await api.validateContract();
        const boot = await api.bootstrap();
        const projects = boot.projects;
        const firstProject = projects[0] ?? null;
        const firstSession = firstProject?.sessions[0] ?? null;
        const activeMessages = firstSession?.messages ?? [];
        const onboardingDraft = resolveOnboardingDraftState(
          boot.onboarding,
          get().onboardingDraftProviderId,
          get().onboardingDraftEnv,
          get().onboardingDraftGateway
        );
        const showOnboarding = boot.onboarding.needsOnboarding || !boot.providerSetupCompleted;

        set({
          homeDir: boot.homeDir,
          ipcContractVersion: contract.version,
          projects,
          onboarding: boot.onboarding,
          showOnboarding,
          onboardingState: showOnboarding ? "editing" : "hidden",
          onboardingDraftProviderId: onboardingDraft.providerId,
          onboardingDraftEnv: onboardingDraft.env,
          onboardingDraftGateway: onboardingDraft.gateway,
          onboardingNotice: null,
          activeProjectId: firstProject?.id ?? null,
          activeSessionId: firstSession?.id ?? null,
          activeMessages,
          runStatusProjectId: null,
          runStatusSessionId: null,
          runStatusEvents: [],
          isBootstrapping: false,
          isBusy: false
        });
      } catch (error) {
        set({
          isBootstrapping: false,
          isBusy: false,
          error: toErrorMessage(error)
        });
      }
    },

    addProjectFromDialog: async () => {
      set({ isBusy: true, error: null });
      try {
        const project = await api.pickProject();
        if (!project) {
          set({ isBusy: false });
          return;
        }

        const firstSession = project.sessions[0] ?? null;
        set((state) => ({
          projects: upsertProject(state.projects, project),
          activeProjectId: project.id,
          activeSessionId: firstSession?.id ?? null,
          activeMessages: firstSession?.messages ?? [],
          runStatusProjectId: null,
          runStatusSessionId: null,
          runStatusEvents: [],
          isBusy: false
        }));
      } catch (error) {
        set({ isBusy: false, error: toErrorMessage(error) });
      }
    },

    addProjectByPath: async (rootPath: string) => {
      const normalized = rootPath.trim();
      if (!normalized) {
        return;
      }

      set({ isBusy: true, error: null });
      try {
        const project = await api.addProject({ rootPath: normalized });
        const firstSession = project.sessions[0] ?? null;
        set((state) => ({
          projects: upsertProject(state.projects, project),
          activeProjectId: project.id,
          activeSessionId: firstSession?.id ?? null,
          activeMessages: firstSession?.messages ?? [],
          runStatusProjectId: null,
          runStatusSessionId: null,
          runStatusEvents: [],
          isBusy: false
        }));
      } catch (error) {
        set({ isBusy: false, error: toErrorMessage(error) });
      }
    },

    renameProject: async (projectId: string, name: string) => {
      const normalizedName = name.trim();
      if (!normalizedName) {
        set({ error: "Project name cannot be empty." });
        return;
      }

      set({ isBusy: true, error: null });
      try {
        const project = await api.renameProject({
          projectId,
          name: normalizedName
        });
        set((state) => ({
          projects: upsertProject(state.projects, project),
          isBusy: false
        }));
      } catch (error) {
        set({ isBusy: false, error: toErrorMessage(error) });
      }
    },

    removeProject: async (projectId: string) => {
      set({ isBusy: true, error: null });
      try {
        await api.removeProject({ projectId });
        set((state) => {
          const projects = state.projects.filter((project) => project.id !== projectId);
          if (state.activeProjectId !== projectId) {
            return {
              projects,
              isBusy: false
            };
          }

          const fallbackProject = projects[0] ?? null;
          const fallbackSession = fallbackProject?.sessions[0] ?? null;
          return {
            projects,
            activeProjectId: fallbackProject?.id ?? null,
            activeSessionId: fallbackSession?.id ?? null,
            activeMessages: fallbackSession?.messages ?? [],
            runStatusProjectId: null,
            runStatusSessionId: null,
            runStatusEvents: [],
            isBusy: false
          };
        });
      } catch (error) {
        set({ isBusy: false, error: toErrorMessage(error) });
      }
    },

    selectProject: async (projectId: string) => {
      const state = get();
      const project = state.projects.find((candidate) => candidate.id === projectId);
      if (!project) {
        return;
      }

      const firstSession = project.sessions[0] ?? null;
      const activeMessages = firstSession?.messages ?? [];

      set({
        activeProjectId: projectId,
        activeSessionId: firstSession?.id ?? null,
        activeMessages,
        runStatusProjectId: null,
        runStatusSessionId: null,
        runStatusEvents: []
      });
    },

    createSession: async (projectId: string, title?: string) => {
      set({ isBusy: true, error: null });
      try {
        const session = await api.createSession({
          projectId,
          title
        });
        set((state) => ({
          projects: upsertProjectSession(state.projects, projectId, session, {
            prepend: true
          }),
          activeProjectId: projectId,
          activeSessionId: session.id,
          activeMessages: session.messages,
          runStatusProjectId: null,
          runStatusSessionId: null,
          runStatusEvents: [],
          isBusy: false
        }));
      } catch (error) {
        set({ isBusy: false, error: toErrorMessage(error) });
      }
    },

    renameSession: async (projectId: string, sessionId: string, title: string) => {
      const normalizedTitle = title.trim();
      if (!normalizedTitle) {
        set({ error: "Session title cannot be empty." });
        return;
      }

      set({ isBusy: true, error: null });
      try {
        const session = await api.renameSession({
          projectId,
          sessionId,
          title: normalizedTitle
        });
        set((state) => ({
          projects: upsertProjectSession(state.projects, projectId, session),
          isBusy: false
        }));
      } catch (error) {
        set({ isBusy: false, error: toErrorMessage(error) });
      }
    },

    removeSession: async (projectId: string, sessionId: string) => {
      set({ isBusy: true, error: null });
      try {
        await api.removeSession({ projectId, sessionId });
        set((state) => {
          const wasActive =
            state.activeProjectId === projectId && state.activeSessionId === sessionId;
          const projects = removeProjectSession(state.projects, projectId, sessionId);
          if (!wasActive) {
            return {
              projects,
              isBusy: false
            };
          }

          const project = projects.find((candidate) => candidate.id === projectId) ?? null;
          const fallbackSession = project?.sessions[0] ?? null;
          return {
            projects,
            activeProjectId: project?.id ?? null,
            activeSessionId: fallbackSession?.id ?? null,
            activeMessages: fallbackSession?.messages ?? [],
            runStatusProjectId: null,
            runStatusSessionId: null,
            runStatusEvents: [],
            isBusy: false
          };
        });
      } catch (error) {
        set({ isBusy: false, error: toErrorMessage(error) });
      }
    },

    selectSession: async (projectId: string, sessionId: string) => {
      const messages = getProjectSessionMessages(get().projects, projectId, sessionId);
      if (!messages) {
        set({
          error: `Session not found: ${sessionId}`
        });
        return;
      }

      set({
        error: null,
        activeProjectId: projectId,
        activeSessionId: sessionId,
        activeMessages: messages,
        runStatusProjectId: null,
        runStatusSessionId: null,
        runStatusEvents: []
      });
    },

    loadAgents: async () => {
      set({ agentsState: "loading", agentsNotice: null, error: null });
      try {
        const [agents, providers] = await Promise.all([
          api.listAgents(),
          api.listAgentProviders()
        ]);
        set({
          agents,
          agentProviders: providers,
          agentsState: "idle"
        });
      } catch (error) {
        set({
          agentsState: "idle",
          error: toErrorMessage(error)
        });
      }
    },

    saveAgentProviderConfig: async (input) => {
      const providerId = input.providerId.trim();
      if (!providerId) {
        set({ error: "Provider id cannot be empty." });
        return;
      }

      set({ agentsState: "saving", agentsNotice: null, error: null });
      try {
        const result = await api.saveAgentProviderConfig({
          providerId,
          env: input.env
        });
        set((state) => ({
          agentProviders: upsertAgentProvider(state.agentProviders, result),
          agentsState: "idle",
          agentsNotice: `Saved ${result.displayName} settings.`
        }));
      } catch (error) {
        set({ agentsState: "idle", error: toErrorMessage(error) });
      }
    },

    createAgent: async (input) => {
      const name = input.name.trim();
      if (!name) {
        set({ error: "Agent name cannot be empty." });
        return;
      }

      set({ agentsState: "saving", agentsNotice: null, error: null });
      try {
        const result = await api.createAgent({
          name,
          providerId: input.providerId?.trim() || undefined,
          createExternalAgent: input.createExternalAgent,
          env: input.env
        });
        set((state) => ({
          agents: upsertAgent(state.agents, result.agent),
          agentsState: "idle",
          agentsNotice: buildAgentNotice(result)
        }));
        const externalFailure = buildExternalAgentFailure(result);
        if (externalFailure) {
          set({ error: externalFailure });
        }
      } catch (error) {
        set({ agentsState: "idle", error: toErrorMessage(error) });
      }
    },

    deleteAgent: async (input) => {
      const agentId = input.agentId.trim();
      if (!agentId) {
        set({ error: "Agent id cannot be empty." });
        return;
      }

      set({ agentsState: "saving", agentsNotice: null, error: null });
      try {
        const result = await api.deleteAgent({
          agentId,
          providerId: input.providerId?.trim() || undefined,
          deleteExternalAgent: Boolean(input.deleteExternalAgent)
        });
        set((state) => ({
          agents: state.agents.filter((agent) => agent.id !== agentId),
          agentsState: "idle",
          agentsNotice: buildAgentNotice(result)
        }));
        const externalFailure = buildExternalAgentFailure(result);
        if (externalFailure) {
          set({ error: externalFailure });
        }
      } catch (error) {
        set({ agentsState: "idle", error: toErrorMessage(error) });
      }
    },

    clearAgentsNotice: () => {
      set({ agentsNotice: null });
    },

    submitOnboarding: async (providerId: string, env: Record<string, string>) => {
      const previousDraftEnv = {
        ...get().onboardingDraftEnv,
        ...env
      };
      set({
        isBusy: true,
        onboardingState: "submitting",
        error: null
      });
      try {
        const onboarding = await api.submitOnboarding({
          providerId,
          env
        });
        const onboardingDraft = resolveOnboardingDraftState(
          onboarding,
          onboarding.activeProviderId,
          onboarding.needsOnboarding ? previousDraftEnv : undefined,
          get().onboardingDraftGateway
        );
        const showOnboarding = onboarding.needsOnboarding;

        set({
          onboarding,
          showOnboarding,
          onboardingState: showOnboarding ? "editing" : "hidden",
          onboardingDraftProviderId: onboardingDraft.providerId,
          onboardingDraftEnv: onboardingDraft.env,
          onboardingDraftGateway: onboardingDraft.gateway,
          onboardingNotice: null,
          error: showOnboarding
            ? buildOnboardingIncompleteError(onboarding, onboardingDraft.providerId)
            : null,
          isBusy: false
        });
      } catch (error) {
        set({
          isBusy: false,
          onboardingState: "editing",
          error: toErrorMessage(error)
        });
      }
    },

    saveOnboardingGateway: async (gateway: OnboardingGatewayDraft) => {
      set({
        isBusy: true,
        gatewayState: "saving",
        error: null
      });
      try {
        const updated = await api.updateGatewaySettings(toGatewayUpdateInput(gateway));
        set((state) => ({
          isBusy: false,
          gatewayState: "idle",
          onboarding: state.onboarding
            ? {
                ...state.onboarding,
                gateway: updated
              }
            : state.onboarding,
          onboardingDraftGateway: {
            mode: updated.mode,
            remoteUrl: updated.remoteUrl ?? "",
            timeoutMs: updated.timeoutMs,
            remoteToken: state.onboardingDraftGateway.remoteToken
          },
          onboardingNotice: null,
          error: null
        }));
      } catch (error) {
        set({
          isBusy: false,
          gatewayState: "idle",
          error: toErrorMessage(error)
        });
      }
    },

    setOnboardingDraftProvider: (providerId: string) => {
      set((state) => ({
        onboardingDraftProviderId: providerId.trim(),
        onboardingDraftEnv: getConfiguredOnboardingEnv(state.onboarding, providerId),
        onboardingNotice: null,
        error: null
      }));
    },

    setOnboardingDraftField: (key: string, value: string) => {
      const normalizedKey = key.trim();
      if (!normalizedKey) {
        return;
      }
      set((state) => ({
        onboardingDraftEnv: {
          ...state.onboardingDraftEnv,
          [normalizedKey]: value
        },
        onboardingNotice: null,
        error: null
      }));
    },

    setOnboardingDraftGateway: (patch: Partial<OnboardingGatewayDraft>) => {
      set((state) => ({
        onboardingDraftGateway: {
          ...state.onboardingDraftGateway,
          ...patch
        },
        onboardingNotice: null,
        error: null
      }));
    },

    runOnboardingGuidedAuth: async (providerId: string) => {
      const normalizedProviderId = providerId.trim();
      if (!normalizedProviderId) {
        return;
      }

      set({
        isBusy: true,
        onboardingGuidedAuthState: "running",
        onboardingNotice: null,
        error: null
      });
      try {
        const result = await api.runOnboardingGuidedAuth({
          providerId: normalizedProviderId
        });
        const notes = [result.note, ...result.notes]
          .filter((value): value is string => Boolean(value?.trim()))
          .join("\n");
        set((state) => ({
          isBusy: false,
          onboardingGuidedAuthState: "idle",
          onboardingDraftEnv: {
            ...state.onboardingDraftEnv,
            ...result.env
          },
          onboardingNotice: notes || "Guided sign-in completed.",
          error: null
        }));
      } catch (error) {
        set({
          isBusy: false,
          onboardingGuidedAuthState: "idle",
          onboardingNotice: null,
          error: toErrorMessage(error)
        });
      }
    },

    openOnboarding: async () => {
      set({
        isBusy: true,
        onboardingState: "loading",
        error: null
      });
      try {
        const onboarding = await api.getOnboardingStatus();
        const onboardingDraft = resolveOnboardingDraftState(
          onboarding,
          get().onboardingDraftProviderId,
          get().onboardingDraftEnv,
          get().onboardingDraftGateway
        );
        set({
          onboarding,
          showOnboarding: true,
          onboardingState: "editing",
          onboardingDraftProviderId: onboardingDraft.providerId,
          onboardingDraftEnv: onboardingDraft.env,
          onboardingDraftGateway: onboardingDraft.gateway,
          onboardingNotice: null,
          isBusy: false
        });
      } catch (error) {
        set({
          isBusy: false,
          onboardingState: "editing",
          error: toErrorMessage(error)
        });
      }
    },

    closeOnboarding: async () => {
      const state = get();
      if (state.onboarding?.needsOnboarding) {
        return;
      }
      try {
        await api.completeOnboarding();
      } catch {
        // Keep local close UX resilient even if persistence fails.
      }
      set({
        showOnboarding: false,
        onboardingState: "hidden",
        onboardingGuidedAuthState: "idle",
        onboardingNotice: null,
        error: null
      });
    },

    sendMessage: async (
      message: string,
      options?: {
        rethrow?: boolean;
      }
    ) => {
      const trimmed = message.trim();
      if (!trimmed) {
        return null;
      }

      const state = get();
      const projectId = state.activeProjectId;
      const sessionId = state.activeSessionId;
      if (!projectId || !sessionId) {
        set({ error: "Create a session before sending messages." });
        return null;
      }

      const optimistic: WorkbenchMessage = {
        id: `optimistic-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString()
      };

      set({
        isBusy: true,
        chatState: "sending",
        error: null,
        activeMessages: [...state.activeMessages, optimistic],
        runStatusProjectId: projectId,
        runStatusSessionId: sessionId,
        runStatusEvents: []
      });

      try {
        const result = await api.sendChatMessage({
          projectId,
          sessionId,
          message: trimmed
        });

        set((current) => ({
          projects: upsertProjectSession(current.projects, projectId, result.session),
          activeMessages: result.session.messages,
          chatState: "idle",
          isBusy: false
        }));
        return result.reply;
      } catch (error) {
        const currentMessages = get().activeMessages;
        if (options?.rethrow) {
          set({
            chatState: "idle",
            isBusy: false,
            error: toErrorMessage(error),
            activeMessages: currentMessages.filter((entry) => entry.id !== optimistic.id)
          });
          throw error;
        }

        const errorMessage = buildChatErrorMessage(error);
        set({
          chatState: "idle",
          isBusy: false,
          error: null,
          activeMessages: [...currentMessages, errorMessage]
        });
        return errorMessage;
      }
    },

    appendRunStatusEvent: (event: WorkbenchRunStatusEvent) => {
      set((state) => {
        if (
          state.runStatusProjectId !== event.projectId ||
          state.runStatusSessionId !== event.sessionId
        ) {
          return state;
        }

        const nextEvents = [...state.runStatusEvents, event];
        if (nextEvents.length > 64) {
          nextEvents.splice(0, nextEvents.length - 64);
        }

        return {
          runStatusEvents: nextEvents
        };
      });
    },

    clearError: () => {
      set({ error: null });
    }
  }));
}

export const useWorkbenchStore = createWorkbenchStore();

export function getActiveProject(
  projects: WorkbenchProject[],
  activeProjectId: string | null
): WorkbenchProject | null {
  if (!activeProjectId) {
    return null;
  }
  return projects.find((project) => project.id === activeProjectId) ?? null;
}

function upsertProject(
  projects: WorkbenchProject[],
  project: WorkbenchProject
): WorkbenchProject[] {
  const index = projects.findIndex((candidate) => candidate.id === project.id);
  if (index === -1) {
    return [...projects, project];
  }

  const next = projects.slice();
  next[index] = project;
  return next;
}

function upsertProjectSession(
  projects: WorkbenchProject[],
  projectId: string,
  session: WorkbenchSession,
  options?: {
    prepend?: boolean;
  }
): WorkbenchProject[] {
  return projects.map((project) => {
    if (project.id !== projectId) {
      return project;
    }

    const existingIndex = project.sessions.findIndex((candidate) => candidate.id === session.id);
    if (existingIndex === -1) {
      return {
        ...project,
        sessions: options?.prepend ? [session, ...project.sessions] : [...project.sessions, session]
      };
    }

    const sessions = project.sessions.slice();
    sessions[existingIndex] = session;
    return {
      ...project,
      sessions
    };
  });
}

function removeProjectSession(
  projects: WorkbenchProject[],
  projectId: string,
  sessionId: string
): WorkbenchProject[] {
  return projects.map((project) => {
    if (project.id !== projectId) {
      return project;
    }
    return {
      ...project,
      sessions: project.sessions.filter((session) => session.id !== sessionId)
    };
  });
}

function getProjectSessionMessages(
  projects: WorkbenchProject[],
  projectId: string,
  sessionId: string
): WorkbenchMessage[] | null {
  const project = projects.find((candidate) => candidate.id === projectId);
  if (!project) {
    return null;
  }

  const session = project.sessions.find((candidate) => candidate.id === sessionId);
  return session?.messages ?? null;
}

function upsertAgent(agents: WorkbenchAgent[], agent: WorkbenchAgent): WorkbenchAgent[] {
  const existingIndex = agents.findIndex((entry) => entry.id === agent.id);
  if (existingIndex === -1) {
    return [...agents, agent].sort((left, right) => left.id.localeCompare(right.id));
  }

  return agents
    .map((entry) => (entry.id === agent.id ? agent : entry))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function upsertAgentProvider(
  providers: WorkbenchAgentProvider[],
  provider: WorkbenchAgentProvider
): WorkbenchAgentProvider[] {
  const existingIndex = providers.findIndex((entry) => entry.id === provider.id);
  if (existingIndex === -1) {
    return [...providers, provider].sort((left, right) => left.id.localeCompare(right.id));
  }

  return providers
    .map((entry) => (entry.id === provider.id ? provider : entry))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function buildAgentNotice(
  result: WorkbenchAgentCreationResult | WorkbenchAgentDeletionResult
): string | null {
  if ("agent" in result) {
    if (result.externalAgentCreation) {
      return `Agent created. External creation (${result.externalAgentCreation.providerId}) returned code ${result.externalAgentCreation.code}.`;
    }
    return `Agent created: ${result.agent.displayName}.`;
  }

  if (result.externalAgentDeletion) {
    return `Agent removed locally. External deletion (${result.externalAgentDeletion.providerId}) returned code ${result.externalAgentDeletion.code}.`;
  }
  return result.existed ? `Agent deleted locally: ${result.agentId}.` : `Agent not found locally: ${result.agentId}.`;
}

function buildExternalAgentFailure(
  result: WorkbenchAgentCreationResult | WorkbenchAgentDeletionResult
): string | null {
  if ("agent" in result) {
    const external = result.externalAgentCreation;
    if (external && external.code !== 0) {
      const details = external.stderr.trim() || external.stdout.trim();
      return `Local agent was created, but external provider agent creation failed (code ${external.code}). ${details || ""}`.trim();
    }
    return null;
  }

  const external = result.externalAgentDeletion;
  if (external && external.code !== 0) {
    const details = external.stderr.trim() || external.stdout.trim();
    return `Local agent was deleted, but external provider agent deletion failed (code ${external.code}). ${details || ""}`.trim();
  }
  return null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error.";
}

function buildChatErrorMessage(error: unknown): WorkbenchMessage {
  return {
    id: `error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: "assistant",
    providerId: WORKBENCH_CHAT_ERROR_PROVIDER_ID,
    content: summarizeChatError(error),
    createdAt: new Date().toISOString()
  };
}

function summarizeChatError(error: unknown): string {
  const raw = toErrorMessage(error).replace(/\s+/g, " ").trim();
  const lower = raw.toLowerCase();

  if (
    lower.includes("quota exceeded") ||
    lower.includes("resource_exhausted") ||
    lower.includes("rate limit")
  ) {
    return "The provider quota or rate limit was exceeded. Check your plan and limits, then try again.";
  }

  if (
    lower.includes("invalid_api_key") ||
    lower.includes("unauthorized") ||
    lower.includes("authentication") ||
    lower.includes("http 401")
  ) {
    return "The provider rejected your credentials. Update provider settings and try again.";
  }

  if (lower.includes("timed out")) {
    return "The provider request timed out. Please retry in a moment.";
  }

  const structuredDetail = extractStructuredErrorDetail(raw);
  if (structuredDetail) {
    return structuredDetail;
  }

  return clampText(raw, 240);
}

function extractStructuredErrorDetail(raw: string): string | null {
  const providerFailureMatch = raw.match(
    /orchestrator provider failed \(([^,]+), code (\d+)\)\.\s*(.*)$/i
  );
  if (!providerFailureMatch) {
    return null;
  }

  const providerId = providerFailureMatch[1]?.trim();
  const details = providerFailureMatch[3]?.trim();
  const parsed = parseJsonErrorMessage(details) ?? clampText(details, 180);
  if (!parsed) {
    return providerId
      ? `The ${providerId} provider request failed.`
      : "The provider request failed.";
  }

  return providerId
    ? `${capitalize(providerId)} provider error: ${parsed}`
    : `Provider error: ${parsed}`;
}

function parseJsonErrorMessage(value?: string): string | null {
  if (!value) {
    return null;
  }

  const jsonStart = value.indexOf("{");
  if (jsonStart === -1) {
    return clampText(value, 180);
  }

  const candidate = value.slice(jsonStart).trim();
  try {
    const parsed = JSON.parse(candidate) as
      | { error?: { message?: string }; message?: string }
      | undefined;
    const message = parsed?.error?.message?.trim() || parsed?.message?.trim();
    return message ? clampText(message, 180) : clampText(value.slice(0, jsonStart).trim(), 180);
  } catch {
    return clampText(value, 180);
  }
}

function clampText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function resolveOnboardingDraftProviderId(
  onboarding: WorkbenchOnboarding,
  preferredProviderId?: string
): string {
  const preferred = preferredProviderId?.trim();
  if (preferred && onboarding.providers.some((provider) => provider.id === preferred)) {
    return preferred;
  }

  const active = onboarding.activeProviderId?.trim();
  if (active && onboarding.providers.some((provider) => provider.id === active)) {
    return active;
  }

  return onboarding.providers[0]?.id || active || "";
}

function getConfiguredOnboardingEnv(
  onboarding: WorkbenchOnboarding | null,
  providerId: string
): Record<string, string> {
  if (!onboarding) {
    return {};
  }
  const provider = onboarding.providers.find((entry) => entry.id === providerId.trim());
  if (!provider) {
    return {};
  }
  return { ...provider.configuredEnvValues };
}

function resolveOnboardingDraftState(
  onboarding: WorkbenchOnboarding,
  preferredProviderId?: string,
  currentDraftEnv?: Record<string, string>,
  currentGatewayDraft?: OnboardingGatewayDraft
): {
  providerId: string;
  env: Record<string, string>;
  gateway: OnboardingGatewayDraft;
} {
  const providerId = resolveOnboardingDraftProviderId(onboarding, preferredProviderId);
  const preferred = preferredProviderId?.trim();
  const gateway = resolveGatewayDraftState(onboarding, currentGatewayDraft);
  if (preferred && preferred === providerId && currentDraftEnv && Object.keys(currentDraftEnv).length > 0) {
    return {
      providerId,
      env: { ...currentDraftEnv },
      gateway
    };
  }
  return {
    providerId,
    env: getConfiguredOnboardingEnv(onboarding, providerId),
    gateway
  };
}

function buildOnboardingIncompleteError(
  onboarding: WorkbenchOnboarding,
  providerId: string
): string {
  const provider = onboarding.providers.find((entry) => entry.id === providerId);
  if (!provider) {
    return "Provider setup is still incomplete.";
  }

  const missingCount = provider.missingRequiredEnv.length;
  if (missingCount === 0) {
    return "Provider setup is still incomplete.";
  }

  return missingCount === 1
    ? "Provider setup is still incomplete. 1 required field is missing."
    : `Provider setup is still incomplete. ${missingCount} required fields are missing.`;
}

function resolveGatewayDraftState(
  onboarding: WorkbenchOnboarding,
  currentDraft?: OnboardingGatewayDraft
): OnboardingGatewayDraft {
  const gateway = onboarding.gateway;
  return {
    mode: gateway.mode,
    remoteUrl: gateway.remoteUrl ?? "",
    timeoutMs: gateway.timeoutMs,
    remoteToken: currentDraft?.remoteToken ?? ""
  };
}

function createDefaultGatewayDraft(): OnboardingGatewayDraft {
  return {
    mode: "local",
    remoteUrl: "",
    remoteToken: "",
    timeoutMs: WORKBENCH_GATEWAY_DEFAULT_TIMEOUT_MS
  };
}

function toGatewayUpdateInput(
  gateway: OnboardingGatewayDraft
): {
  mode: WorkbenchGatewayMode;
  remoteUrl?: string;
  remoteToken?: string;
  timeoutMs: number;
} {
  const mode = gateway.mode === "remote" ? "remote" : "local";
  const timeoutMs = Number.isFinite(gateway.timeoutMs)
    ? Math.max(1000, Math.min(120_000, Math.floor(gateway.timeoutMs)))
    : WORKBENCH_GATEWAY_DEFAULT_TIMEOUT_MS;

  if (mode !== "remote") {
    return {
      mode: "local",
      timeoutMs
    };
  }

  const remoteUrl = gateway.remoteUrl.trim();
  const remoteToken = gateway.remoteToken.trim();
  return {
    mode: "remote",
    remoteUrl: remoteUrl || undefined,
    remoteToken: remoteToken || undefined,
    timeoutMs
  };
}
