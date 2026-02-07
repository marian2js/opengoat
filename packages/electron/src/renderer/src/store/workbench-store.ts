import { create } from "zustand";
import type {
  WorkbenchBootstrap,
  WorkbenchMessage,
  WorkbenchOnboarding,
  WorkbenchProject
} from "@shared/workbench";
import { trpc } from "@renderer/lib/trpc";

interface WorkbenchUiState {
  homeDir: string;
  projects: WorkbenchProject[];
  onboarding: WorkbenchOnboarding | null;
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
  sendMessage: (message: string) => Promise<void>;
  clearError: () => void;
}

export const useWorkbenchStore = create<WorkbenchUiState>((set, get) => ({
  homeDir: "",
  projects: [],
  onboarding: null,
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

      set({
        homeDir: boot.homeDir,
        projects,
        onboarding: boot.onboarding,
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
      const onboarding = await trpc.onboarding.submit.mutate({
        providerId,
        env
      });
      set({
        onboarding,
        isBusy: false
      });
    } catch (error) {
      set({ isBusy: false, error: toErrorMessage(error) });
    }
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
      set({ isBusy: false, error: toErrorMessage(error) });
    }
  },

  clearError: () => {
    set({ error: null });
  }
}));

async function requestBootstrap(): Promise<WorkbenchBootstrap> {
  try {
    return await trpc.bootstrap.query();
  } catch (error) {
    if (isMissingQueryProcedureError(error)) {
      return trpc.bootstrapMutate.mutate();
    }
    throw error;
  }
}

async function requestProjectsList(): Promise<WorkbenchProject[]> {
  try {
    return await trpc.projects.list.query();
  } catch (error) {
    if (isMissingQueryProcedureError(error)) {
      return trpc.projects.listMutate.mutate();
    }
    throw error;
  }
}

async function requestSessionMessages(input: {
  projectId: string;
  sessionId: string;
}): Promise<WorkbenchMessage[]> {
  try {
    return await trpc.sessions.messages.query(input);
  } catch (error) {
    if (isMissingQueryProcedureError(error)) {
      return trpc.sessions.messagesMutate.mutate(input);
    }
    throw error;
  }
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

function isMissingQueryProcedureError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.includes('No "query"-procedure on path');
}
