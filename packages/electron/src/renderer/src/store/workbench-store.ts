import { create } from "zustand";
import type {
  WorkbenchBootstrap,
  WorkbenchMessage,
  WorkbenchOnboarding,
  WorkbenchProject
} from "@shared/workbench";
import { getTrpcClient, getTrpcUntypedClient } from "@renderer/lib/trpc";

interface WorkbenchUiState {
  homeDir: string;
  projects: WorkbenchProject[];
  onboarding: WorkbenchOnboarding | null;
  showOnboarding: boolean;
  onboardingDraftProviderId: string;
  onboardingDraftEnv: Record<string, string>;
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
  sendMessage: (message: string) => Promise<void>;
  clearError: () => void;
}

export const useWorkbenchStore = create<WorkbenchUiState>((set, get) => ({
  homeDir: "",
  projects: [],
  onboarding: null,
  showOnboarding: false,
  onboardingDraftProviderId: "",
  onboardingDraftEnv: {},
  activeProjectId: null,
  activeSessionId: null,
  activeMessages: [],
  isBootstrapping: true,
  isBusy: false,
  error: null,

  bootstrap: async () => {
    set({ isBootstrapping: true, error: null });
    try {
      const boot = await requestBootstrap();
      const projects = boot.projects;
      const firstProject = projects[0] ?? null;
      const firstSession = firstProject?.sessions[0] ?? null;
      const activeMessages =
        firstProject && firstSession
          ? await requestSessionMessages({
              projectId: firstProject.id,
              sessionId: firstSession.id
            })
          : [];
      const current = get();
      const onboardingDraft = resolveOnboardingDraftState(
        boot.onboarding,
        current.onboardingDraftProviderId,
        current.onboardingDraftEnv
      );

      set({
        homeDir: boot.homeDir,
        projects,
        onboarding: boot.onboarding,
        showOnboarding: boot.onboarding.needsOnboarding,
        onboardingDraftProviderId: onboardingDraft.providerId,
        onboardingDraftEnv: onboardingDraft.env,
        activeProjectId: firstProject?.id ?? null,
        activeSessionId: firstSession?.id ?? null,
        activeMessages,
        isBootstrapping: false
      });
    } catch (error) {
      set({
        isBootstrapping: false,
        error: toErrorMessage(error)
      });
    }
  },

  addProjectFromDialog: async () => {
    set({ isBusy: true, error: null });
    try {
      const trpc = getTrpcClient();
      const project = await trpc.projects.pick.mutate();
      if (!project) {
        set({ isBusy: false });
        return;
      }

      const projects = await requestProjectsList();
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
      const trpc = getTrpcClient();
      const project = await trpc.projects.add.mutate({ rootPath: normalized });
      const projects = await requestProjectsList();
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
        : await requestSessionMessages({
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
      const trpc = getTrpcClient();
      const session = await trpc.sessions.create.mutate({
        projectId,
        title
      });
      const projects = await requestProjectsList();
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
      const messages = await requestSessionMessages({ projectId, sessionId });
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
    set({ isBusy: true, error: null });
    try {
      const trpc = getTrpcClient();
      const onboarding = await trpc.onboarding.submit.mutate({
        providerId,
        env
      });
      const onboardingDraft = resolveOnboardingDraftState(
        onboarding,
        onboarding.activeProviderId
      );
      set({
        onboarding,
        showOnboarding: true,
        onboardingDraftProviderId: onboardingDraft.providerId,
        onboardingDraftEnv: onboardingDraft.env,
        isBusy: false
      });
    } catch (error) {
      set({ isBusy: false, error: toErrorMessage(error) });
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
    set({ isBusy: true, error: null });
    try {
      const onboarding = await requestOnboardingStatus();
      const current = get();
      const onboardingDraft = resolveOnboardingDraftState(
        onboarding,
        current.onboardingDraftProviderId,
        current.onboardingDraftEnv
      );
      set({
        onboarding,
        showOnboarding: true,
        onboardingDraftProviderId: onboardingDraft.providerId,
        onboardingDraftEnv: onboardingDraft.env,
        isBusy: false
      });
    } catch (error) {
      set({ isBusy: false, error: toErrorMessage(error) });
    }
  },

  closeOnboarding: () => {
    const state = get();
    if (state.onboarding?.needsOnboarding) {
      return;
    }
    set({ showOnboarding: false });
  },

  sendMessage: async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    const state = get();
    const projectId = state.activeProjectId;
    const sessionId = state.activeSessionId;
    if (!projectId || !sessionId) {
      set({ error: "Create a session before sending messages." });
      return;
    }

    const optimistic: WorkbenchMessage = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString()
    };

    set({
      isBusy: true,
      error: null,
      activeMessages: [...state.activeMessages, optimistic]
    });

    try {
      const trpc = getTrpcClient();
      await trpc.chat.send.mutate({
        projectId,
        sessionId,
        message: trimmed
      });

      const projects = await requestProjectsList();
      const messages = await requestSessionMessages({ projectId, sessionId });
      set({
        projects,
        activeMessages: messages,
        isBusy: false
      });
    } catch (error) {
      const next: Partial<WorkbenchUiState> = {
        isBusy: false,
        error: toErrorMessage(error)
      };

      if (isProviderFailureError(error)) {
        try {
          const onboarding = await requestOnboardingStatus();
          const current = get();
          const onboardingDraft = resolveOnboardingDraftState(
            onboarding,
            current.onboardingDraftProviderId,
            current.onboardingDraftEnv
          );
          next.onboarding = onboarding;
          next.showOnboarding = true;
          next.onboardingDraftProviderId = onboardingDraft.providerId;
          next.onboardingDraftEnv = onboardingDraft.env;
        } catch {
          // keep original error
        }
      }

      set(next);
    }
  },

  clearError: () => {
    set({ error: null });
  }
}));

async function requestBootstrap(): Promise<WorkbenchBootstrap> {
  const trpc = getTrpcClient();
  const trpcUntyped = getTrpcUntypedClient();

  return callWithProcedureFallback<WorkbenchBootstrap>([
    () => trpc.bootstrap.query(),
    () => trpcUntyped.query("bootstrap") as Promise<WorkbenchBootstrap>,
    () => trpcUntyped.mutation("bootstrap") as Promise<WorkbenchBootstrap>,
    () => trpcUntyped.mutation("bootstrapMutate") as Promise<WorkbenchBootstrap>,
    () => trpcUntyped.query("bootstrapMutate") as Promise<WorkbenchBootstrap>
  ]);
}

async function requestProjectsList(): Promise<WorkbenchProject[]> {
  const trpc = getTrpcClient();
  const trpcUntyped = getTrpcUntypedClient();

  return callWithProcedureFallback<WorkbenchProject[]>([
    () => trpc.projects.list.query(),
    () => trpcUntyped.query("projects.list") as Promise<WorkbenchProject[]>,
    () => trpcUntyped.mutation("projects.list") as Promise<WorkbenchProject[]>,
    () => trpcUntyped.mutation("projects.listMutate") as Promise<WorkbenchProject[]>,
    () => trpcUntyped.query("projects.listMutate") as Promise<WorkbenchProject[]>
  ]);
}

async function requestSessionMessages(input: {
  projectId: string;
  sessionId: string;
}): Promise<WorkbenchMessage[]> {
  const trpc = getTrpcClient();
  const trpcUntyped = getTrpcUntypedClient();

  return callWithProcedureFallback<WorkbenchMessage[]>([
    () => trpc.sessions.messages.query(input),
    () => trpcUntyped.query("sessions.messages", input) as Promise<WorkbenchMessage[]>,
    () => trpcUntyped.mutation("sessions.messages", input) as Promise<WorkbenchMessage[]>,
    () => trpcUntyped.mutation("sessions.messagesMutate", input) as Promise<WorkbenchMessage[]>,
    () => trpcUntyped.query("sessions.messagesMutate", input) as Promise<WorkbenchMessage[]>
  ]);
}

async function requestOnboardingStatus(): Promise<WorkbenchOnboarding> {
  const trpc = getTrpcClient();
  const trpcUntyped = getTrpcUntypedClient();

  return callWithProcedureFallback<WorkbenchOnboarding>([
    () => trpc.onboarding.status.query(),
    () => trpcUntyped.query("onboarding.status") as Promise<WorkbenchOnboarding>,
    () => trpcUntyped.mutation("onboarding.status") as Promise<WorkbenchOnboarding>,
    () => trpcUntyped.mutation("onboarding.statusMutate") as Promise<WorkbenchOnboarding>,
    () => trpcUntyped.query("onboarding.statusMutate") as Promise<WorkbenchOnboarding>
  ]);
}

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

export function isMissingProcedureError(error: unknown): boolean {
  const message = extractErrorMessage(error);
  return message.includes("-procedure on path");
}

function isProviderFailureError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("orchestrator provider failed") || message.includes("provider failed");
}

export async function callWithProcedureFallback<T>(attempts: Array<() => Promise<T>>): Promise<T> {
  let lastProcedureError: unknown;

  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      if (!isMissingProcedureError(error)) {
        throw error;
      }
      lastProcedureError = error;
    }
  }

  if (lastProcedureError instanceof Error) {
    throw lastProcedureError;
  }

  throw new Error("Procedure call failed.");
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === "string") {
      return candidate;
    }
  }
  return "";
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
