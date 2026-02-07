import { create } from "zustand";
import type {
  WorkbenchMessage,
  WorkbenchOnboarding,
  WorkbenchProject
} from "@shared/workbench";
import {
  createWorkbenchApiClient,
  type WorkbenchApiClient
} from "@renderer/lib/trpc";

export type OnboardingFlowState = "hidden" | "loading" | "editing" | "submitting";
export type ChatFlowState = "idle" | "sending";

interface WorkbenchUiState {
  homeDir: string;
  projects: WorkbenchProject[];
  onboarding: WorkbenchOnboarding | null;
  showOnboarding: boolean;
  onboardingState: OnboardingFlowState;
  onboardingDraftProviderId: string;
  onboardingDraftEnv: Record<string, string>;
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
  selectSession: (projectId: string, sessionId: string) => Promise<void>;
  submitOnboarding: (providerId: string, env: Record<string, string>) => Promise<void>;
  setOnboardingDraftProvider: (providerId: string) => void;
  setOnboardingDraftField: (key: string, value: string) => void;
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
    onboardingDraftProviderId: "",
    onboardingDraftEnv: {},
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
          get().onboardingDraftEnv
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

    submitOnboarding: async (providerId: string, env: Record<string, string>) => {
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
          onboarding.activeProviderId
        );
        const showOnboarding = onboarding.needsOnboarding;

        set({
          onboarding,
          showOnboarding,
          onboardingState: showOnboarding ? "editing" : "hidden",
          onboardingDraftProviderId: onboardingDraft.providerId,
          onboardingDraftEnv: onboardingDraft.env,
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
        error: null
      }));
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
          get().onboardingDraftEnv
        );
        set({
          onboarding,
          showOnboarding: true,
          onboardingState: "editing",
          onboardingDraftProviderId: onboardingDraft.providerId,
          onboardingDraftEnv: onboardingDraft.env,
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
  return message.includes("orchestrator provider failed") || message.includes("provider failed");
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
  currentDraftEnv?: Record<string, string>
): {
  providerId: string;
  env: Record<string, string>;
} {
  const providerId = resolveOnboardingDraftProviderId(onboarding, preferredProviderId);
  const preferred = preferredProviderId?.trim();
  if (preferred && preferred === providerId && currentDraftEnv && Object.keys(currentDraftEnv).length > 0) {
    return {
      providerId,
      env: { ...currentDraftEnv }
    };
  }
  return {
    providerId,
    env: getConfiguredOnboardingEnv(onboarding, providerId)
  };
}
