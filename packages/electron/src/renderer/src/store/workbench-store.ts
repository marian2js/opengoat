import { create } from "zustand";
import type { WorkbenchMessage, WorkbenchProject } from "@shared/workbench";
import { trpc } from "@renderer/lib/trpc";

interface WorkbenchUiState {
  homeDir: string;
  projects: WorkbenchProject[];
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
  sendMessage: (message: string) => Promise<void>;
  clearError: () => void;
}

export const useWorkbenchStore = create<WorkbenchUiState>((set, get) => ({
  homeDir: "",
  projects: [],
  activeProjectId: null,
  activeSessionId: null,
  activeMessages: [],
  isBootstrapping: true,
  isBusy: false,
  error: null,

  bootstrap: async () => {
    set({ isBootstrapping: true, error: null });
    try {
      const boot = await trpc.bootstrap.query();
      const projects = boot.projects;
      const firstProject = projects[0] ?? null;
      const firstSession = firstProject?.sessions[0] ?? null;
      const activeMessages =
        firstProject && firstSession
          ? await trpc.sessions.messages.query({
              projectId: firstProject.id,
              sessionId: firstSession.id
            })
          : [];

      set({
        homeDir: boot.homeDir,
        projects,
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

      const projects = await trpc.projects.list.query();
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
      const projects = await trpc.projects.list.query();
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
        : await trpc.sessions.messages.query({
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
      const projects = await trpc.projects.list.query();
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
      const messages = await trpc.sessions.messages.query({ projectId, sessionId });
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

      const projects = await trpc.projects.list.query();
      const messages = await trpc.sessions.messages.query({ projectId, sessionId });
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
