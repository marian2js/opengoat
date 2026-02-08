import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  WORKBENCH_GATEWAY_DEFAULT_TIMEOUT_MS,
  type WorkbenchGatewaySettings,
  type WorkbenchMessage,
  type WorkbenchProject,
  type WorkbenchSession,
  type WorkbenchState,
  workbenchStateSchema
} from "@shared/workbench";

interface WorkbenchStoreDeps {
  stateFilePath: string;
  nowIso?: () => string;
}

export class WorkbenchStore {
  private readonly stateFilePath: string;
  private readonly nowIso: () => string;
  private pending: Promise<unknown> = Promise.resolve();
  private stateCache: WorkbenchState | null = null;

  public constructor(deps: WorkbenchStoreDeps) {
    this.stateFilePath = deps.stateFilePath;
    this.nowIso = deps.nowIso ?? (() => new Date().toISOString());
  }

  public async listProjects(): Promise<WorkbenchProject[]> {
    const state = await this.readState();
    return this.cloneData(state.projects);
  }

  public async addProject(rootPath: string): Promise<WorkbenchProject> {
    return this.writeTransaction((state) => {
      const existing = state.projects.find((project) => project.rootPath === rootPath);
      if (existing) {
        return {
          next: state,
          result: existing
        };
      }

      const now = this.nowIso();
      const project: WorkbenchProject = {
        id: randomUUID(),
        name: path.basename(rootPath) || rootPath,
        rootPath,
        createdAt: now,
        updatedAt: now,
        sessions: []
      };

      return {
        next: {
          ...state,
          updatedAt: now,
          projects: [...state.projects, project]
        },
        result: project
      };
    });
  }

  public async createSession(projectId: string, title: string): Promise<WorkbenchSession> {
    return this.writeTransaction((state) => {
      const project = requireProject(state, projectId);
      const now = this.nowIso();
      const session: WorkbenchSession = {
        id: randomUUID(),
        title,
        agentId: "orchestrator",
        sessionKey: `desktop:${project.id}:${randomUUID()}`,
        createdAt: now,
        updatedAt: now,
        messages: []
      };

      const nextProjects = state.projects.map((candidate) =>
        candidate.id === project.id
          ? {
              ...candidate,
              updatedAt: now,
              sessions: [session, ...candidate.sessions]
            }
          : candidate
      );

      return {
        next: {
          ...state,
          updatedAt: now,
          projects: nextProjects
        },
        result: session
      };
    });
  }

  public async listSessions(projectId: string): Promise<WorkbenchSession[]> {
    const state = await this.readState();
    const project = requireProject(state, projectId);
    return this.cloneData(project.sessions);
  }

  public async renameSession(projectId: string, sessionId: string, title: string): Promise<WorkbenchSession> {
    return this.writeTransaction((state) => {
      const project = requireProject(state, projectId);
      const session = requireSession(project, sessionId);
      const now = this.nowIso();
      const normalizedTitle = normalizeSessionTitle(title);
      const nextSession: WorkbenchSession = {
        ...session,
        title: normalizedTitle,
        updatedAt: now
      };

      const nextProjects = state.projects.map((candidate) => {
        if (candidate.id !== project.id) {
          return candidate;
        }
        return {
          ...candidate,
          updatedAt: now,
          sessions: candidate.sessions.map((candidateSession) =>
            candidateSession.id === session.id ? nextSession : candidateSession
          )
        };
      });

      return {
        next: {
          ...state,
          updatedAt: now,
          projects: nextProjects
        },
        result: nextSession
      };
    });
  }

  public async removeSession(projectId: string, sessionId: string): Promise<void> {
    return this.writeTransaction((state) => {
      const project = requireProject(state, projectId);
      const _session = requireSession(project, sessionId);
      const now = this.nowIso();
      const nextProjects = state.projects.map((candidate) => {
        if (candidate.id !== project.id) {
          return candidate;
        }
        return {
          ...candidate,
          updatedAt: now,
          sessions: candidate.sessions.filter((candidateSession) => candidateSession.id !== sessionId)
        };
      });

      return {
        next: {
          ...state,
          updatedAt: now,
          projects: nextProjects
        },
        result: undefined
      };
    });
  }

  public async listMessages(projectId: string, sessionId: string): Promise<WorkbenchMessage[]> {
    const state = await this.readState();
    const session = requireSession(requireProject(state, projectId), sessionId);
    return this.cloneData(session.messages);
  }

  public async appendMessage(
    projectId: string,
    sessionId: string,
    message: Omit<WorkbenchMessage, "id" | "createdAt">
  ): Promise<WorkbenchSession> {
    return this.writeTransaction((state) => {
      const project = requireProject(state, projectId);
      const session = requireSession(project, sessionId);
      const now = this.nowIso();
      const nextMessage: WorkbenchMessage = {
        id: randomUUID(),
        createdAt: now,
        ...message
      };

      const nextSession: WorkbenchSession = {
        ...session,
        updatedAt: now,
        title: deriveSessionTitle(session.title, session.messages, nextMessage),
        messages: [...session.messages, nextMessage]
      };

      const nextProjects = state.projects.map((candidate) => {
        if (candidate.id !== project.id) {
          return candidate;
        }
        return {
          ...candidate,
          updatedAt: now,
          sessions: candidate.sessions.map((candidateSession) =>
            candidateSession.id === session.id ? nextSession : candidateSession
          )
        };
      });

      return {
        next: {
          ...state,
          updatedAt: now,
          projects: nextProjects
        },
        result: nextSession
      };
    });
  }

  public async getProject(projectId: string): Promise<WorkbenchProject> {
    const state = await this.readState();
    return this.cloneData(requireProject(state, projectId));
  }

  public async getSession(projectId: string, sessionId: string): Promise<WorkbenchSession> {
    const state = await this.readState();
    return this.cloneData(requireSession(requireProject(state, projectId), sessionId));
  }

  public async getGatewaySettings(): Promise<WorkbenchGatewaySettings> {
    const state = await this.readState();
    return this.cloneData(state.settings.gateway);
  }

  public async setGatewaySettings(gateway: WorkbenchGatewaySettings): Promise<WorkbenchGatewaySettings> {
    const normalized = normalizeGatewaySettings(gateway);
    return this.writeTransaction((state) => {
      const now = this.nowIso();
      return {
        next: {
          ...state,
          updatedAt: now,
          settings: {
            ...state.settings,
            gateway: normalized
          }
        },
        result: normalized
      };
    });
  }

  public async getProviderSetupCompleted(): Promise<boolean> {
    const state = await this.readState();
    return state.settings.onboarding.providerSetupCompleted === true;
  }

  public async setProviderSetupCompleted(value: boolean): Promise<boolean> {
    const normalized = value === true;
    return this.writeTransaction((state) => {
      const now = this.nowIso();
      return {
        next: {
          ...state,
          updatedAt: now,
          settings: {
            ...state.settings,
            onboarding: {
              ...state.settings.onboarding,
              providerSetupCompleted: normalized
            }
          }
        },
        result: normalized
      };
    });
  }

  private async readState(): Promise<WorkbenchState> {
    if (this.stateCache) {
      return this.stateCache;
    }

    const state = await this.loadStateFromDisk();
    this.stateCache = state;
    return state;
  }

  private async loadStateFromDisk(): Promise<WorkbenchState> {
    try {
      const raw = await readFile(this.stateFilePath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      const validated = workbenchStateSchema.safeParse(parsed);
      if (!validated.success) {
        return this.createDefaultState();
      }
      return validated.data;
    } catch {
      return this.createDefaultState();
    }
  }

  private createDefaultState(): WorkbenchState {
    const now = this.nowIso();
    return {
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      projects: [],
      settings: {
        gateway: {
          mode: "local",
          timeoutMs: WORKBENCH_GATEWAY_DEFAULT_TIMEOUT_MS
        },
        onboarding: {
          providerSetupCompleted: false
        }
      }
    };
  }

  private async writeTransaction<T>(
    operation: (state: WorkbenchState) => { next: WorkbenchState; result: T }
  ): Promise<T> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const { next, result } = operation(state);
      await this.persist(next);
      this.stateCache = next;
      return this.cloneData(result);
    });
  }

  private async enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.pending.then(task, task);
    this.pending = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async persist(state: WorkbenchState): Promise<void> {
    const parentDir = path.dirname(this.stateFilePath);
    await mkdir(parentDir, { recursive: true });

    const tempPath = `${this.stateFilePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
    await rename(tempPath, this.stateFilePath);
  }

  private cloneData<T>(value: T): T {
    return structuredClone(value);
  }
}

function requireProject(state: WorkbenchState, projectId: string): WorkbenchProject {
  const project = state.projects.find((candidate) => candidate.id === projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }
  return project;
}

function requireSession(project: WorkbenchProject, sessionId: string): WorkbenchSession {
  const session = project.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  return session;
}

function deriveSessionTitle(
  currentTitle: string,
  existingMessages: WorkbenchMessage[],
  nextMessage: WorkbenchMessage
): string {
  if (existingMessages.length > 0 || nextMessage.role !== "user") {
    return currentTitle;
  }

  const compact = nextMessage.content.trim().replace(/\s+/g, " ");
  if (!compact) {
    return currentTitle;
  }

  return compact.length > 60 ? `${compact.slice(0, 57)}...` : compact;
}

function normalizeSessionTitle(input: string): string {
  const value = input.trim();
  if (!value) {
    throw new Error("Session title cannot be empty.");
  }
  if (value.length <= 120) {
    return value;
  }
  return `${value.slice(0, 117)}...`;
}

function normalizeGatewaySettings(input: WorkbenchGatewaySettings): WorkbenchGatewaySettings {
  const timeoutMs = Number.isFinite(input.timeoutMs)
    ? Math.max(1000, Math.min(120_000, Math.floor(input.timeoutMs)))
    : WORKBENCH_GATEWAY_DEFAULT_TIMEOUT_MS;
  const remoteUrl = input.remoteUrl?.trim();
  return {
    mode: input.mode === "remote" ? "remote" : "local",
    remoteUrl: remoteUrl || undefined,
    timeoutMs
  };
}
