import { create } from "zustand";
import type {
  WorkbenchGatewayMode,
  WorkbenchMessage,
  WorkbenchOnboarding,
  WorkbenchProject
} from "@shared/workbench";
import { WORKBENCH_GATEWAY_DEFAULT_TIMEOUT_MS } from "@shared/workbench";
import {
  createWorkbenchApiClient,
  type WorkbenchApiClient
} from "@renderer/lib/trpc";

export type OnboardingFlowState = "hidden" | "loading" | "editing" | "submitting";
export type ChatFlowState = "idle" | "sending";
export type OnboardingGuidedAuthState = "idle" | "running";

export interface OnboardingGatewayDraft {
  mode: WorkbenchGatewayMode;
  remoteUrl: string;
  remoteToken: string;
  timeoutMs: number;
}

interface WorkbenchUiState {
  homeDir: string;
  projects: WorkbenchProject[];
  onboarding: WorkbenchOnboarding | null;
  showOnboarding: boolean;
  onboardingState: OnboardingFlowState;
  onboardingGuidedAuthState: OnboardingGuidedAuthState;
  onboardingDraftProviderId: string;
  onboardingDraftEnv: Record<string, string>;
  onboardingDraftGateway: OnboardingGatewayDraft;
  onboardingNotice: string | null;
  chatState: ChatFlowState;
  activeProjectId: string | null;
  activeSessionId: string | null;
  activeMessages: WorkbenchMessage[];
  isBootstrapping: boolean;
  isBusy: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  addProjectFromDialog: () => Promise<void>;
  addProjectByPath: (rootPath: string) => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  createSession: (projectId: string, title?: string) => Promise<void>;
  renameSession: (projectId: string, sessionId: string, title: string) => Promise<void>;
  removeSession: (projectId: string, sessionId: string) => Promise<void>;
  selectSession: (projectId: string, sessionId: string) => Promise<void>;
  submitOnboarding: (
    providerId: string,
    env: Record<string, string>,
    gateway: OnboardingGatewayDraft
  ) => Promise<void>;
  runOnboardingGuidedAuth: (providerId: string) => Promise<void>;
  setOnboardingDraftProvider: (providerId: string) => void;
  setOnboardingDraftField: (key: string, value: string) => void;
  setOnboardingDraftGateway: (patch: Partial<OnboardingGatewayDraft>) => void;
  openOnboarding: () => Promise<void>;
  closeOnboarding: () => void;
  sendMessage: (
    message: string,
    options?: {
      rethrow?: boolean;
    }
  ) => Promise<WorkbenchMessage | null>;
  clearError: () => void;
}

export function createWorkbenchStore(api: WorkbenchApiClient = createWorkbenchApiClient()) {
  return create<WorkbenchUiState>((set, get) => ({
    homeDir: "",
    projects: [],
    onboarding: null,
    showOnboarding: false,
    onboardingState: "hidden",
    onboardingGuidedAuthState: "idle",
    onboardingDraftProviderId: "",
    onboardingDraftEnv: {},
    onboardingDraftGateway: createDefaultGatewayDraft(),
    onboardingNotice: null,
    chatState: "idle",
    activeProjectId: null,
    activeSessionId: null,
    activeMessages: [],
    isBootstrapping: true,
    isBusy: false,
    error: null,

    bootstrap: async () => {
      set({ isBootstrapping: true, isBusy: true, error: null });
      try {
        await api.validateContract();
        const boot = await api.bootstrap();
        const projects = boot.projects;
        const firstProject = projects[0] ?? null;
        const firstSession = firstProject?.sessions[0] ?? null;
        const activeMessages =
          firstProject && firstSession
            ? await api.getSessionMessages({
                projectId: firstProject.id,
                sessionId: firstSession.id
              })
            : [];
        const onboardingDraft = resolveOnboardingDraftState(
          boot.onboarding,
          get().onboardingDraftProviderId,
          get().onboardingDraftEnv,
          get().onboardingDraftGateway
        );
        const showOnboarding = boot.onboarding.needsOnboarding;

        set({
          homeDir: boot.homeDir,
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

        const projects = await api.listProjects();
        set({
          projects,
          activeProjectId: project.id,
          activeSessionId: null,
          activeMessages: [],
          isBusy: false
        });
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
        const projects = await api.listProjects();
        set({
          projects,
          activeProjectId: project.id,
          activeSessionId: null,
          activeMessages: [],
          isBusy: false
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
      const activeMessages =
        firstSession === null
          ? []
          : await api.getSessionMessages({
              projectId,
              sessionId: firstSession.id
            });

      set({
        activeProjectId: projectId,
        activeSessionId: firstSession?.id ?? null,
        activeMessages
      });
    },

    createSession: async (projectId: string, title?: string) => {
      set({ isBusy: true, error: null });
      try {
        const session = await api.createSession({
          projectId,
          title
        });
        const projects = await api.listProjects();
        set({
          projects,
          activeProjectId: projectId,
          activeSessionId: session.id,
          activeMessages: [],
          isBusy: false
        });
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
        await api.renameSession({
          projectId,
          sessionId,
          title: normalizedTitle
        });
        const projects = await api.listProjects();
        set({
          projects,
          isBusy: false
        });
      } catch (error) {
        set({ isBusy: false, error: toErrorMessage(error) });
      }
    },

    removeSession: async (projectId: string, sessionId: string) => {
      const state = get();
      const wasActive = state.activeProjectId === projectId && state.activeSessionId === sessionId;

      set({ isBusy: true, error: null });
      try {
        await api.removeSession({ projectId, sessionId });
        const projects = await api.listProjects();

        if (!wasActive) {
          set({
            projects,
            isBusy: false
          });
          return;
        }

        const project = projects.find((candidate) => candidate.id === projectId) ?? null;
        const fallbackSession = project?.sessions[0] ?? null;
        const activeMessages = fallbackSession
          ? await api.getSessionMessages({
              projectId,
              sessionId: fallbackSession.id
            })
          : [];

        set({
          projects,
          activeProjectId: project?.id ?? null,
          activeSessionId: fallbackSession?.id ?? null,
          activeMessages,
          isBusy: false
        });
      } catch (error) {
        set({ isBusy: false, error: toErrorMessage(error) });
      }
    },

    selectSession: async (projectId: string, sessionId: string) => {
      set({ isBusy: true, error: null });
      try {
        const messages = await api.getSessionMessages({ projectId, sessionId });
        set({
          activeProjectId: projectId,
          activeSessionId: sessionId,
          activeMessages: messages,
          isBusy: false
        });
      } catch (error) {
        set({ isBusy: false, error: toErrorMessage(error) });
      }
    },

    submitOnboarding: async (
      providerId: string,
      env: Record<string, string>,
      gateway: OnboardingGatewayDraft
    ) => {
      set({
        isBusy: true,
        onboardingState: "submitting",
        error: null
      });
      try {
        const onboarding = await api.submitOnboarding({
          providerId,
          env,
          gateway: toGatewaySubmitInput(gateway)
        });
        const onboardingDraft = resolveOnboardingDraftState(
          onboarding,
          onboarding.activeProviderId,
          undefined,
          gateway
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

    closeOnboarding: () => {
      const state = get();
      if (state.onboarding?.needsOnboarding) {
        return;
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
        activeMessages: [...state.activeMessages, optimistic]
      });

      try {
        const result = await api.sendChatMessage({
          projectId,
          sessionId,
          message: trimmed
        });

        const [projects, messages] = await Promise.all([
          api.listProjects(),
          api.getSessionMessages({ projectId, sessionId })
        ]);

        set({
          projects,
          activeMessages: messages,
          chatState: "idle",
          isBusy: false
        });
        return result.reply;
      } catch (error) {
        const next: Partial<WorkbenchUiState> = {
          chatState: "idle",
          isBusy: false,
          error: toErrorMessage(error)
        };

        if (isProviderFailureError(error)) {
          try {
            const onboarding = await api.getOnboardingStatus();
            const onboardingDraft = resolveOnboardingDraftState(
              onboarding,
              get().onboardingDraftProviderId,
              get().onboardingDraftEnv
            );
            next.onboarding = onboarding;
            next.showOnboarding = true;
            next.onboardingState = "editing";
            next.onboardingDraftProviderId = onboardingDraft.providerId;
            next.onboardingDraftEnv = onboardingDraft.env;
          } catch {
            // keep original error
          }
        }

        set(next);
        if (options?.rethrow) {
          throw error;
        }
        return null;
      }
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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error.";
}

function isProviderFailureError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("orchestrator provider failed") ||
    message.includes("provider failed") ||
    message.includes("remote gateway")
  );
}

export function resolveOnboardingDraftProviderId(
  onboarding: WorkbenchOnboarding,
  preferredProviderId?: string
): string {
  const preferred = preferredProviderId?.trim();
  if (preferred && onboarding.providers.some((provider) => provider.id === preferred)) {
    return preferred;
  }
  return onboarding.activeProviderId || onboarding.providers[0]?.id || "";
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

function toGatewaySubmitInput(
  gateway: OnboardingGatewayDraft
):
  | {
      mode: WorkbenchGatewayMode;
      remoteUrl?: string;
      remoteToken?: string;
      timeoutMs: number;
    }
  | undefined {
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
