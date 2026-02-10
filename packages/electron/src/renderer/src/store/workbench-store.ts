import { create } from "zustand";
import type {
  WorkbenchAgent,
  WorkbenchAgentCreationResult,
  WorkbenchAgentDeletionResult,
  WorkbenchAgentUpdateResult,
  WorkbenchAgentProvider,
  WorkbenchGatewayMode,
  WorkbenchImageInput,
  WorkbenchMessage,
  WorkbenchMessageImage,
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
const MAX_IMAGE_PREVIEW_URL_LENGTH = 1_000_000;

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
  runStatusBySessionKey: Record<string, WorkbenchRunStatusEvent[]>;
  runStatusEvents: WorkbenchRunStatusEvent[];
  runningSessionCounts: Record<string, number>;
  runningSessionKeys: string[];
  isBootstrapping: boolean;
  isBusy: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  addProjectFromDialog: () => Promise<void>;
  addProjectByPath: (rootPath: string) => Promise<void>;
  renameProject: (projectId: string, name: string) => Promise<void>;
  removeProject: (projectId: string) => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  createSession: (projectId: string, title?: string, agentId?: string) => Promise<void>;
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
  updateAgent: (input: {
    agentId: string;
    providerId: string;
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
      images?: WorkbenchImageInput[];
      rethrow?: boolean;
    }
  ) => Promise<WorkbenchMessage | null>;
  stopMessage: (target?: { projectId?: string | null; sessionId?: string | null }) => Promise<void>;
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
    runStatusBySessionKey: {},
    runStatusEvents: [],
    runningSessionCounts: {},
    runningSessionKeys: [],
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
          runStatusBySessionKey: {},
          runStatusEvents: [],
          runningSessionCounts: {},
          runningSessionKeys: [],
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
          runStatusEvents: resolveRunStatusEvents(
            state.runStatusBySessionKey,
            project.id,
            firstSession?.id ?? null
          ),
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
          runStatusEvents: resolveRunStatusEvents(
            state.runStatusBySessionKey,
            project.id,
            firstSession?.id ?? null
          ),
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
          const runStatusBySessionKey = removeProjectRunStatus(state.runStatusBySessionKey, projectId);
          const runningSessionCounts = removeProjectRunningSessions(
            state.runningSessionCounts,
            projectId
          );
          const runningSessionKeys = Object.keys(runningSessionCounts);
          if (state.activeProjectId !== projectId) {
            return {
              projects,
              runStatusBySessionKey,
              runningSessionCounts,
              runningSessionKeys,
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
            runStatusBySessionKey,
            runStatusEvents: resolveRunStatusEvents(
              runStatusBySessionKey,
              fallbackProject?.id ?? null,
              fallbackSession?.id ?? null
            ),
            runningSessionCounts,
            runningSessionKeys,
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
        runStatusEvents: resolveRunStatusEvents(
          state.runStatusBySessionKey,
          projectId,
          firstSession?.id ?? null
        ),
        chatState: isSessionRunning(
          state.runningSessionCounts,
          projectId,
          firstSession?.id ?? null
        )
          ? "sending"
          : "idle"
      });
    },

    createSession: async (projectId: string, title?: string, agentId?: string) => {
      set({ isBusy: true, error: null });
      try {
        const session = await api.createSession({
          projectId,
          title,
          agentId
        });
        set((state) => ({
          projects: upsertProjectSession(state.projects, projectId, session, {
            prepend: true
          }),
          activeProjectId: projectId,
          activeSessionId: session.id,
          activeMessages: session.messages,
          runStatusEvents: resolveRunStatusEvents(state.runStatusBySessionKey, projectId, session.id),
          chatState: isSessionRunning(state.runningSessionCounts, projectId, session.id)
            ? "sending"
            : "idle",
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
          const runStatusBySessionKey = removeSessionRunStatus(
            state.runStatusBySessionKey,
            projectId,
            sessionId
          );
          const runningSessionCounts = removeRunningSessionCounter(
            state.runningSessionCounts,
            projectId,
            sessionId
          );
          const runningSessionKeys = Object.keys(runningSessionCounts);
          if (!wasActive) {
            return {
              projects,
              runStatusBySessionKey,
              runningSessionCounts,
              runningSessionKeys,
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
            runStatusBySessionKey,
            runStatusEvents: resolveRunStatusEvents(
              runStatusBySessionKey,
              project?.id ?? null,
              fallbackSession?.id ?? null
            ),
            runningSessionCounts,
            runningSessionKeys,
            chatState: isSessionRunning(
              runningSessionCounts,
              project?.id ?? null,
              fallbackSession?.id ?? null
            )
              ? "sending"
              : "idle",
            isBusy: false
          };
        });
      } catch (error) {
        set({ isBusy: false, error: toErrorMessage(error) });
      }
    },

    selectSession: async (projectId: string, sessionId: string) => {
      const state = get();
      const messages = getProjectSessionMessages(state.projects, projectId, sessionId);
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
        runStatusEvents: resolveRunStatusEvents(state.runStatusBySessionKey, projectId, sessionId),
        chatState: isSessionRunning(state.runningSessionCounts, projectId, sessionId)
          ? "sending"
          : "idle"
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

    updateAgent: async (input) => {
      const agentId = input.agentId.trim();
      const providerId = input.providerId.trim();
      if (!agentId) {
        set({ error: "Agent id cannot be empty." });
        return;
      }
      if (!providerId) {
        set({ error: "Provider id cannot be empty." });
        return;
      }

      set({ agentsState: "saving", agentsNotice: null, error: null });
      try {
        const result = await api.updateAgent({
          agentId,
          providerId,
          createExternalAgent: input.createExternalAgent,
          env: input.env
        });
        set((state) => ({
          agents: upsertAgent(state.agents, result.agent),
          agentProviders: result.provider
            ? upsertAgentProvider(state.agentProviders, result.provider)
            : state.agentProviders,
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
        images?: WorkbenchImageInput[];
        rethrow?: boolean;
      }
    ) => {
      const trimmed = message.trim();
      if (!trimmed) {
        return null;
      }
      const normalizedImages = normalizeWorkbenchImages(options?.images);

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
        images: toWorkbenchMessageImages(normalizedImages),
        createdAt: new Date().toISOString()
      };
      const targetSessionKey = toSessionKey(projectId, sessionId);

      set((current) => {
        const runningSessionCounts = incrementRunningSessionCount(
          current.runningSessionCounts,
          projectId,
          sessionId
        );
        const runStatusBySessionKey = {
          ...current.runStatusBySessionKey,
          [targetSessionKey]: []
        };
        const projects = appendProjectSessionMessage(
          current.projects,
          projectId,
          sessionId,
          optimistic
        );
        return {
          chatState: "sending",
          error: null,
          projects,
          activeMessages:
            current.activeProjectId === projectId && current.activeSessionId === sessionId
              ? [...current.activeMessages, optimistic]
              : current.activeMessages,
          runStatusBySessionKey,
          runStatusEvents:
            current.activeProjectId === projectId && current.activeSessionId === sessionId
              ? []
              : current.runStatusEvents,
          runningSessionCounts,
          runningSessionKeys: Object.keys(runningSessionCounts)
        };
      });

      try {
        const result = await api.sendChatMessage({
          projectId,
          sessionId,
          message: trimmed,
          images: normalizedImages
        });
        const sessionWithImagePreviews = mergeOptimisticImagePreviews(result.session, optimistic);

        set((current) => ({
          projects: upsertProjectSession(current.projects, projectId, sessionWithImagePreviews),
          activeMessages:
            current.activeProjectId === projectId && current.activeSessionId === sessionId
              ? sessionWithImagePreviews.messages
              : current.activeMessages
        }));
        return result.reply;
      } catch (error) {
        const currentState = get();
        const currentMessages =
          currentState.activeProjectId === projectId && currentState.activeSessionId === sessionId
            ? currentState.activeMessages
            : getProjectSessionMessages(currentState.projects, projectId, sessionId) ?? [];
        if (isAbortErrorLike(error)) {
          if (options?.rethrow) {
            set((current) => ({
              error: null,
              projects: removeProjectSessionMessage(current.projects, projectId, sessionId, optimistic.id),
              activeMessages:
                current.activeProjectId === projectId && current.activeSessionId === sessionId
                  ? currentMessages.filter((entry) => entry.id !== optimistic.id)
                  : current.activeMessages
            }));
            throw error;
          }

          set({
            error: null
          });
          return null;
        }

        if (options?.rethrow) {
          set((current) => ({
            error: summarizeChatError(error),
            projects: removeProjectSessionMessage(current.projects, projectId, sessionId, optimistic.id),
            activeMessages:
              current.activeProjectId === projectId && current.activeSessionId === sessionId
                ? currentMessages.filter((entry) => entry.id !== optimistic.id)
                : current.activeMessages
          }));
          throw error;
        }

        const errorMessage = buildChatErrorMessage(error, {
          runStatusEvents: currentState.runStatusBySessionKey[targetSessionKey] ?? []
        });
        set((current) => ({
          error: null,
          activeMessages:
            current.activeProjectId === projectId && current.activeSessionId === sessionId
              ? [...currentMessages, errorMessage]
              : current.activeMessages
        }));
        return errorMessage;
      } finally {
        set((current) => {
          const runningSessionCounts = decrementRunningSessionCount(
            current.runningSessionCounts,
            projectId,
            sessionId
          );
          return {
            runningSessionCounts,
            runningSessionKeys: Object.keys(runningSessionCounts),
            chatState: isSessionRunning(
              runningSessionCounts,
              current.activeProjectId,
              current.activeSessionId
            )
              ? "sending"
              : "idle",
            isBusy: false
          };
        });
      }
    },

    stopMessage: async (target) => {
      const state = get();
      const projectId = target?.projectId ?? state.activeProjectId;
      const sessionId = target?.sessionId ?? state.activeSessionId;
      if (!projectId || !sessionId) {
        return;
      }

      set((current) => ({
        chatState: isSessionRunning(
          current.runningSessionCounts,
          current.activeProjectId,
          current.activeSessionId
        )
          ? "sending"
          : "idle",
        isBusy: false,
        error: null
      }));

      try {
        await api.stopChatMessage({
          projectId,
          sessionId
        });
        const messages = await api.getSessionMessages({
          projectId,
          sessionId
        });
        set((current) => {
          const projects = upsertProjectSessionMessages(
            current.projects,
            projectId,
            sessionId,
            messages
          );
          const isActiveTarget =
            current.activeProjectId === projectId && current.activeSessionId === sessionId;
          return {
            projects,
            activeMessages: isActiveTarget ? messages : current.activeMessages,
            chatState:
              isActiveTarget && isSessionRunning(current.runningSessionCounts, projectId, sessionId)
                ? "sending"
                : "idle"
          };
        });
      } catch (error) {
        set({
          error: toErrorMessage(error)
        });
      }
    },

    appendRunStatusEvent: (event: WorkbenchRunStatusEvent) => {
      set((state) => {
        const key = toSessionKey(event.projectId, event.sessionId);
        const sessionEvents = [...(state.runStatusBySessionKey[key] ?? []), event];
        if (sessionEvents.length > 64) {
          sessionEvents.splice(0, sessionEvents.length - 64);
        }
        const runStatusBySessionKey = {
          ...state.runStatusBySessionKey,
          [key]: sessionEvents
        };
        const isActiveTarget =
          state.activeProjectId === event.projectId && state.activeSessionId === event.sessionId;
        return {
          runStatusBySessionKey,
          runStatusEvents: isActiveTarget ? sessionEvents : state.runStatusEvents
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

function resolveRunStatusEvents(
  runStatusBySessionKey: Record<string, WorkbenchRunStatusEvent[]>,
  projectId: string | null,
  sessionId: string | null
): WorkbenchRunStatusEvent[] {
  if (!projectId || !sessionId) {
    return [];
  }
  return runStatusBySessionKey[toSessionKey(projectId, sessionId)] ?? [];
}

function toSessionKey(projectId: string, sessionId: string): string {
  return `${projectId}:${sessionId}`;
}

function isSessionRunning(
  runningSessionCounts: Record<string, number>,
  projectId: string | null,
  sessionId: string | null
): boolean {
  if (!projectId || !sessionId) {
    return false;
  }
  return (runningSessionCounts[toSessionKey(projectId, sessionId)] ?? 0) > 0;
}

function incrementRunningSessionCount(
  runningSessionCounts: Record<string, number>,
  projectId: string,
  sessionId: string
): Record<string, number> {
  const key = toSessionKey(projectId, sessionId);
  return {
    ...runningSessionCounts,
    [key]: (runningSessionCounts[key] ?? 0) + 1
  };
}

function decrementRunningSessionCount(
  runningSessionCounts: Record<string, number>,
  projectId: string,
  sessionId: string
): Record<string, number> {
  const key = toSessionKey(projectId, sessionId);
  const current = runningSessionCounts[key] ?? 0;
  if (current <= 1) {
    const next = { ...runningSessionCounts };
    delete next[key];
    return next;
  }
  return {
    ...runningSessionCounts,
    [key]: current - 1
  };
}

function removeRunningSessionCounter(
  runningSessionCounts: Record<string, number>,
  projectId: string,
  sessionId: string
): Record<string, number> {
  const key = toSessionKey(projectId, sessionId);
  if (!(key in runningSessionCounts)) {
    return runningSessionCounts;
  }
  const next = { ...runningSessionCounts };
  delete next[key];
  return next;
}

function removeProjectRunningSessions(
  runningSessionCounts: Record<string, number>,
  projectId: string
): Record<string, number> {
  const prefix = `${projectId}:`;
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(runningSessionCounts)) {
    if (!key.startsWith(prefix)) {
      next[key] = value;
    }
  }
  return next;
}

function removeSessionRunStatus(
  runStatusBySessionKey: Record<string, WorkbenchRunStatusEvent[]>,
  projectId: string,
  sessionId: string
): Record<string, WorkbenchRunStatusEvent[]> {
  const key = toSessionKey(projectId, sessionId);
  if (!(key in runStatusBySessionKey)) {
    return runStatusBySessionKey;
  }
  const next = { ...runStatusBySessionKey };
  delete next[key];
  return next;
}

function removeProjectRunStatus(
  runStatusBySessionKey: Record<string, WorkbenchRunStatusEvent[]>,
  projectId: string
): Record<string, WorkbenchRunStatusEvent[]> {
  const prefix = `${projectId}:`;
  const next: Record<string, WorkbenchRunStatusEvent[]> = {};
  for (const [key, events] of Object.entries(runStatusBySessionKey)) {
    if (!key.startsWith(prefix)) {
      next[key] = events;
    }
  }
  return next;
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

function upsertProjectSessionMessages(
  projects: WorkbenchProject[],
  projectId: string,
  sessionId: string,
  messages: WorkbenchMessage[]
): WorkbenchProject[] {
  return projects.map((project) => {
    if (project.id !== projectId) {
      return project;
    }

    return {
      ...project,
      sessions: project.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              messages
            }
          : session
      )
    };
  });
}

function appendProjectSessionMessage(
  projects: WorkbenchProject[],
  projectId: string,
  sessionId: string,
  message: WorkbenchMessage
): WorkbenchProject[] {
  return projects.map((project) => {
    if (project.id !== projectId) {
      return project;
    }
    return {
      ...project,
      sessions: project.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              messages: [...session.messages, message]
            }
          : session
      )
    };
  });
}

function removeProjectSessionMessage(
  projects: WorkbenchProject[],
  projectId: string,
  sessionId: string,
  messageId: string
): WorkbenchProject[] {
  return projects.map((project) => {
    if (project.id !== projectId) {
      return project;
    }
    return {
      ...project,
      sessions: project.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              messages: session.messages.filter((message) => message.id !== messageId)
            }
          : session
      )
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

function normalizeWorkbenchImages(images: WorkbenchImageInput[] | undefined): WorkbenchImageInput[] {
  if (!images || images.length === 0) {
    return [];
  }

  return images
    .map((image) => ({
      path: image.path?.trim() || undefined,
      dataUrl: image.dataUrl?.trim() || undefined,
      mediaType: image.mediaType?.trim() || undefined,
      name: image.name?.trim() || undefined
    }))
    .filter((image) => Boolean(image.path || image.dataUrl));
}

function toWorkbenchMessageImages(images: WorkbenchImageInput[]): WorkbenchMessageImage[] | undefined {
  if (images.length === 0) {
    return undefined;
  }

  return images.map((image, index) => ({
    name: image.name || image.path?.split(/[\\/]/g).at(-1) || `Image ${index + 1}`,
    mediaType: image.mediaType,
    previewUrl: toImagePreviewUrl(image)
  }));
}

function toImagePreviewUrl(image: WorkbenchImageInput): string | undefined {
  const dataUrl = image.dataUrl?.trim();
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    return undefined;
  }
  if (dataUrl.length > MAX_IMAGE_PREVIEW_URL_LENGTH) {
    return undefined;
  }
  return dataUrl;
}

function mergeOptimisticImagePreviews(
  session: WorkbenchSession,
  optimisticUserMessage: WorkbenchMessage
): WorkbenchSession {
  const optimisticImages = optimisticUserMessage.images;
  if (!optimisticImages || optimisticImages.length === 0) {
    return session;
  }
  if (!optimisticImages.some((image) => Boolean(image.previewUrl))) {
    return session;
  }

  const targetIndex = findMatchingUserMessageIndex(session.messages, optimisticUserMessage);
  if (targetIndex < 0) {
    return session;
  }

  const targetMessage = session.messages[targetIndex];
  if (!targetMessage?.images || targetMessage.images.length === 0) {
    return session;
  }

  const mergedImages = targetMessage.images.map((image, index) => {
    const namedPreview = optimisticImages.find(
      (candidate) =>
        normalizeImageName(candidate.name) !== null &&
        normalizeImageName(candidate.name) === normalizeImageName(image.name)
    )?.previewUrl;
    const previewUrl = namedPreview || optimisticImages[index]?.previewUrl;
    if (!previewUrl) {
      return image;
    }
    return {
      ...image,
      previewUrl
    };
  });

  const nextMessages = session.messages.slice();
  nextMessages[targetIndex] = {
    ...targetMessage,
    images: mergedImages
  };
  return {
    ...session,
    messages: nextMessages
  };
}

function findMatchingUserMessageIndex(
  messages: WorkbenchMessage[],
  optimisticUserMessage: WorkbenchMessage
): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (!candidate || candidate.role !== "user") {
      continue;
    }
    if (candidate.content !== optimisticUserMessage.content) {
      continue;
    }
    if ((candidate.images?.length ?? 0) !== (optimisticUserMessage.images?.length ?? 0)) {
      continue;
    }
    return index;
  }
  return -1;
}

function normalizeImageName(name: string | undefined): string | null {
  const normalized = name?.trim().toLowerCase();
  return normalized || null;
}

function buildAgentNotice(
  result: WorkbenchAgentCreationResult | WorkbenchAgentDeletionResult | WorkbenchAgentUpdateResult
): string | null {
  if ("createdPaths" in result) {
    if (result.externalAgentCreation) {
      return `Agent created. External creation (${result.externalAgentCreation.providerId}) returned code ${result.externalAgentCreation.code}.`;
    }
    return `Agent created: ${result.agent.displayName}.`;
  }

  if ("existed" in result) {
    if (result.externalAgentDeletion) {
      return `Agent removed locally. External deletion (${result.externalAgentDeletion.providerId}) returned code ${result.externalAgentDeletion.code}.`;
    }
    return result.existed ? `Agent deleted locally: ${result.agentId}.` : `Agent not found locally: ${result.agentId}.`;
  }

  if (result.externalAgentCreation) {
    return `Agent updated. External create-if-missing (${result.externalAgentCreation.providerId}) returned code ${result.externalAgentCreation.code}.`;
  }
  return `Agent updated: ${result.agent.displayName}.`;
}

function buildExternalAgentFailure(
  result: WorkbenchAgentCreationResult | WorkbenchAgentDeletionResult | WorkbenchAgentUpdateResult
): string | null {
  if ("createdPaths" in result || ("agent" in result && !("existed" in result))) {
    const external = result.externalAgentCreation;
    if (external && external.code !== 0) {
      const details = external.stderr.trim() || external.stdout.trim();
      const context = "createdPaths" in result ? "created" : "updated";
      return `Local agent was ${context}, but external provider agent creation failed (code ${external.code}). ${details || ""}`.trim();
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

function isAbortErrorLike(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === "AbortError";
}

function buildChatErrorMessage(
  error: unknown,
  context?: {
    runStatusEvents?: WorkbenchRunStatusEvent[];
  }
): WorkbenchMessage {
  return {
    id: `error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: "assistant",
    providerId: WORKBENCH_CHAT_ERROR_PROVIDER_ID,
    content: summarizeChatError(error, context),
    createdAt: new Date().toISOString()
  };
}

function summarizeChatError(
  error: unknown,
  context?: {
    runStatusEvents?: WorkbenchRunStatusEvent[];
  }
): string {
  const raw = toErrorMessage(error).trim();
  if (!raw) {
    return "The request failed. Please try again.";
  }

  const extracted = extractStructuredErrorDetail(raw, context?.runStatusEvents);
  const details = extracted.details ?? raw;
  const reason = summarizeErrorReason(details);
  const subject = extracted.agentLabel ? `${extracted.agentLabel} failed` : "The request failed";
  const providerContext = extracted.providerLabel ? ` via ${extracted.providerLabel}` : "";
  const modelLabel = extractModelLabel(details);
  const modelContext = modelLabel ? ` (${modelLabel})` : "";

  if (reason) {
    return `${subject}${providerContext}${modelContext}: ${reason}`;
  }

  const sanitized = sanitizeProviderErrorDetails(details);
  if (sanitized) {
    return `${subject}${providerContext}${modelContext}: ${clampText(sanitized, 220)}`;
  }
  if (providerContext || modelContext) {
    return `${subject}${providerContext}${modelContext}.`;
  }

  return clampText(raw.replace(/\s+/g, " ").trim(), 220);
}

function extractStructuredErrorDetail(
  raw: string,
  runStatusEvents?: WorkbenchRunStatusEvent[]
): {
  agentLabel: string | null;
  providerLabel: string | null;
  details: string | null;
} {
  const delegatedMatch = raw.match(
    /The delegated agent ["`]?([^"`\n]+)["`]? failed via provider ["`]?([^"`\n]+)["`]?(?: \(exit code (\d+)\))?\.\s*(?:Details:\s*)?([\s\S]*)$/i
  );
  if (delegatedMatch) {
    return {
      agentLabel: formatAgentLabel(delegatedMatch[1]),
      providerLabel: formatProviderLabel(delegatedMatch[2]),
      details: delegatedMatch[4]?.trim() || null
    };
  }

  const failedInvocation = findFailedProviderInvocation(runStatusEvents);
  if (failedInvocation) {
    return {
      agentLabel: formatAgentLabel(failedInvocation.agentId),
      providerLabel: formatProviderLabel(failedInvocation.providerId),
      details: raw
    };
  }

  const orchestratorFailureMatch = raw.match(
    /orchestrator provider failed \(([^,]+), code (\d+)\)\.\s*([\s\S]*)$/i
  );
  if (orchestratorFailureMatch) {
    return {
      agentLabel: "Orchestrator",
      providerLabel: formatProviderLabel(orchestratorFailureMatch[1]),
      details: orchestratorFailureMatch[3]?.trim() || null
    };
  }

  return {
    agentLabel: null,
    providerLabel: null,
    details: null
  };
}

function findFailedProviderInvocation(
  events?: WorkbenchRunStatusEvent[]
): WorkbenchRunStatusEvent | null {
  if (!events?.length) {
    return null;
  }

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event) {
      continue;
    }
    if (event.stage === "provider_invocation_completed" && typeof event.code === "number" && event.code !== 0) {
      return event;
    }
  }

  return null;
}

function summarizeErrorReason(details: string): string | null {
  const lower = details.toLowerCase();

  if (
    lower.includes("quota exceeded") ||
    lower.includes("resource_exhausted") ||
    lower.includes("rate limit") ||
    lower.includes("terminalquotaerror") ||
    lower.includes("exhausted your capacity")
  ) {
    const resetMatch = details.match(/reset after ([^.\n]+)/i);
    const retryMatch = details.match(/try again in ([^.\n]+)/i);
    const retryWindow = resetMatch?.[1]?.trim() || retryMatch?.[1]?.trim();
    if (retryWindow) {
      return `quota exceeded. Try again in ${retryWindow}.`;
    }
    return "quota or rate limit exceeded. Check your plan and limits, then try again.";
  }

  if (
    lower.includes("invalid_api_key") ||
    lower.includes("unauthorized") ||
    lower.includes("authentication") ||
    lower.includes("http 401") ||
    lower.includes("forbidden")
  ) {
    return "credentials were rejected. Update provider settings and try again.";
  }

  if (lower.includes("timed out")) {
    const timeoutMatch = details.match(/timed out after (\d+)ms/i);
    if (timeoutMatch) {
      const timeoutMs = Number(timeoutMatch[1]);
      if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
        const seconds = Math.max(1, Math.round(timeoutMs / 1000));
        return `request timed out after ${seconds}s. Please retry.`;
      }
    }
    return "request timed out. Please retry.";
  }

  if (
    lower.includes("connection refused") ||
    lower.includes("enotfound") ||
    lower.includes("econnreset") ||
    lower.includes("network error")
  ) {
    return "network connection failed while contacting the provider.";
  }

  return null;
}

function extractModelLabel(details: string): string | null {
  const patterns = [
    /"model"\s*:\s*"([^"]+)"/i,
    /\bmodel\s*[:=]\s*["']?([a-z0-9][a-z0-9._/-]{1,127})["']?/i,
    /\bfor model\s+["']?([a-z0-9][a-z0-9._/-]{1,127})["']?/i
  ];
  for (const pattern of patterns) {
    const match = details.match(pattern);
    const candidate = match?.[1]?.trim();
    if (!candidate) {
      continue;
    }
    const lower = candidate.toLowerCase();
    if (lower === "this" || lower === "unknown") {
      continue;
    }
    return candidate;
  }
  return null;
}

function sanitizeProviderErrorDetails(value?: string): string {
  if (!value) {
    return "";
  }

  const withoutAnsi = value.replace(
    // Strip ANSI escapes from provider stderr so message text is clean.
    /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
    ""
  );
  const lines = withoutAnsi
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isProviderNoiseLine(line))
    .filter((line) => !/^at\s+/i.test(line))
    .filter((line) => !/^file:\/\//i.test(line));
  if (!lines.length) {
    return "";
  }

  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] !== line) {
      deduped.push(line);
    }
  }
  return deduped.join(" ").replace(/\s+/g, " ").trim();
}

function isProviderNoiseLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (
    lower.includes("deprecationwarning") ||
    lower.includes("punycode") ||
    lower.startsWith("(use node --trace-deprecation") ||
    lower.includes("yolo mode is enabled") ||
    lower.includes("loaded cached credentials") ||
    lower.includes("hook registry initialized") ||
    lower.startsWith("full report available at:") ||
    lower.includes("an unexpected critical error occurred")
  ) {
    return true;
  }

  return /^\(node:\d+\)\s+\[dep\d+\]/i.test(line);
}

function formatAgentLabel(agentId?: string): string | null {
  if (!agentId) {
    return null;
  }
  return toTitleLabel(agentId);
}

function formatProviderLabel(providerId?: string): string | null {
  const normalized = providerId?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "openai") {
    return "OpenAI";
  }
  if (normalized === "openrouter") {
    return "OpenRouter";
  }
  if (normalized === "google") {
    return "Google";
  }
  if (normalized === "gemini") {
    return "Gemini";
  }
  return toTitleLabel(providerId ?? "");
}

function toTitleLabel(value: string): string {
  return value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
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
