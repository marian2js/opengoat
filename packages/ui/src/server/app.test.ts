import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenGoatUiServer, type OpenClawUiService } from "./app.js";

interface AgentDescriptor {
  id: string;
  displayName: string;
  workspaceDir: string;
  internalConfigDir: string;
}

interface AgentCreationResult {
  agent: AgentDescriptor;
  createdPaths: string[];
  skippedPaths: string[];
}

interface AgentDeletionResult {
  agentId: string;
  existed: boolean;
  removedPaths: string[];
  skippedPaths: string[];
}

interface SessionSummary {
  sessionKey: string;
  sessionId: string;
  title: string;
  updatedAt: number;
  transcriptPath: string;
  workspacePath: string;
  workingPath?: string;
  inputChars: number;
  outputChars: number;
  totalChars: number;
  compactionCount: number;
}

interface ResolvedSkill {
  id: string;
  name: string;
  description: string;
  source: string;
}

interface SessionRunInfo {
  agentId: string;
  sessionKey: string;
  sessionId: string;
  transcriptPath: string;
  workspacePath: string;
  workingPath: string;
  isNewSession: boolean;
}

let activeServer: Awaited<ReturnType<typeof createOpenGoatUiServer>> | undefined;

afterEach(async () => {
  if (activeServer) {
    await activeServer.close();
    activeServer = undefined;
  }
});

describe("OpenGoat UI server API", () => {
  it("returns health metadata", async () => {
    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService()
    });

    const response = await activeServer.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      homeDir: "/tmp/opengoat-home"
    });
  });

  it("creates agents through the api", async () => {
    const createAgent = vi.fn<OpenClawUiService["createAgent"]>(async (name: string): Promise<AgentCreationResult> => {
      return {
        agent: {
          id: "developer",
          displayName: name,
          workspaceDir: "/tmp/workspace",
          internalConfigDir: "/tmp/internal"
        },
        createdPaths: [],
        skippedPaths: []
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        createAgent
      }
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/agents",
      payload: {
        name: "Developer",
        type: "individual",
        skills: "manager,testing"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(createAgent).toHaveBeenCalledWith("Developer", {
      type: "individual",
      reportsTo: undefined,
      skills: ["manager", "testing"]
    });
  });

  it("creates project session through the api", async () => {
    const prepareSession = vi.fn<NonNullable<OpenClawUiService["prepareSession"]>>(async (_agentId, options): Promise<SessionRunInfo> => {
      const sessionKey = options?.sessionRef ?? "agent:goat:main";
      const isProject = sessionKey.startsWith("project:");
      return {
        agentId: "goat",
        sessionKey,
        sessionId: isProject ? "project-session-1" : "workspace-session-1",
        transcriptPath: "/tmp/transcript.jsonl",
        workspacePath: "/tmp/workspace",
        workingPath: options?.workingPath ?? "/tmp/opengoat",
        isNewSession: !isProject
      };
    });
    const renameSession = vi.fn<NonNullable<OpenClawUiService["renameSession"]>>(async (_agentId, title = "Session", sessionRef = "agent:goat:main"): Promise<SessionSummary> => {
      return {
        sessionKey: sessionRef,
        sessionId: sessionRef.startsWith("project:") ? "project-session-1" : "workspace-session-1",
        title,
        updatedAt: Date.now(),
        transcriptPath: "/tmp/transcript.jsonl",
        workspacePath: "/tmp/workspace",
        workingPath: "/tmp/opengoat",
        inputChars: 0,
        outputChars: 0,
        totalChars: 0,
        compactionCount: 0
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        prepareSession,
        renameSession
      }
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/projects",
      payload: {
        folderPath: "/tmp",
        folderName: "tmp"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prepareSession).toHaveBeenCalledTimes(2);
    expect(renameSession).toHaveBeenCalledTimes(2);

    const payload = response.json() as {
      project: { name: string; path: string; sessionRef: string };
      session: { sessionKey: string };
    };
    expect(payload.project.name).toBe("tmp");
    expect(payload.project.path).toBe("/tmp");
    expect(payload.project.sessionRef.startsWith("project:")).toBe(true);
    expect(payload.session.sessionKey.startsWith("workspace:")).toBe(true);
  });

  it("creates project session through legacy core fallback when prepareSession is unavailable", async () => {
    const prepareRunSession = vi.fn(async (_paths: unknown, _agentId: string, request: { sessionRef?: string; workingPath?: string }): Promise<{ enabled: true; info: SessionRunInfo }> => {
      const sessionKey = request.sessionRef ?? "agent:goat:main";
      const isProject = sessionKey.startsWith("project:");
      return {
        enabled: true,
        info: {
          agentId: "goat",
          sessionKey,
          sessionId: isProject ? "legacy-project-session-1" : "legacy-workspace-session-1",
          transcriptPath: "/tmp/transcript.jsonl",
          workspacePath: "/tmp/workspace",
          workingPath: request.workingPath ?? "/tmp",
          isNewSession: !isProject
        }
      };
    });

    const legacyService = {
      ...createMockService(),
      prepareSession: undefined,
      getPaths: () => {
        return { homeDir: "/tmp/opengoat-home" };
      },
      sessionService: {
        prepareRunSession
      }
    };

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: legacyService
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/projects",
      payload: {
        folderPath: "/tmp",
        folderName: "tmp"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prepareRunSession).toHaveBeenCalledTimes(2);
    const payload = response.json() as { session: { sessionKey: string } };
    expect(payload.session.sessionKey.startsWith("workspace:")).toBe(true);
  });

  it("returns unsupported for native picker on non-macos platforms", async () => {
    if (process.platform === "darwin") {
      return;
    }

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService()
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/projects/pick"
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      error: "Native folder picker is currently supported on macOS only."
    });
  });

  it("creates a nested workspace session and assigns a default title", async () => {
    const prepareSession = vi.fn<NonNullable<OpenClawUiService["prepareSession"]>>(async (): Promise<SessionRunInfo> => {
      return {
        agentId: "goat",
        sessionKey: "workspace:tmp",
        sessionId: "session-2",
        transcriptPath: "/tmp/transcript-2.jsonl",
        workspacePath: "/tmp/workspace",
        workingPath: "/tmp",
        isNewSession: true
      };
    });
    const renameSession = vi.fn<NonNullable<OpenClawUiService["renameSession"]>>(async (): Promise<SessionSummary> => {
      return {
        sessionKey: "workspace:tmp",
        sessionId: "session-2",
        title: "New Session",
        updatedAt: Date.now(),
        transcriptPath: "/tmp/transcript-2.jsonl",
        workspacePath: "/tmp/workspace",
        workingPath: "/tmp",
        inputChars: 0,
        outputChars: 0,
        totalChars: 0,
        compactionCount: 0
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        prepareSession,
        renameSession
      }
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/workspaces/session",
      payload: {
        workingPath: "/tmp",
        workspaceName: "tmp"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prepareSession).toHaveBeenCalledTimes(1);
    expect(renameSession).toHaveBeenCalledTimes(1);
  });

  it("renames and removes workspace entries", async () => {
    const renameSession = vi.fn<NonNullable<OpenClawUiService["renameSession"]>>(async (): Promise<SessionSummary> => {
      return {
        sessionKey: "project:tmp",
        sessionId: "session-1",
        title: "Renamed",
        updatedAt: Date.now(),
        transcriptPath: "/tmp/transcript-1.jsonl",
        workspacePath: "/tmp/workspace",
        workingPath: "/tmp",
        inputChars: 0,
        outputChars: 0,
        totalChars: 0,
        compactionCount: 0
      };
    });
    const removeSession = vi.fn<NonNullable<OpenClawUiService["removeSession"]>>(async (): Promise<{
      sessionKey: string;
      sessionId: string;
      title: string;
      transcriptPath: string;
    }> => {
      return {
        sessionKey: "project:tmp",
        sessionId: "session-1",
        title: "tmp",
        transcriptPath: "/tmp/transcript-1.jsonl"
      };
    });
    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        renameSession,
        removeSession
      }
    });

    const renameResponse = await activeServer.inject({
      method: "POST",
      url: "/api/workspaces/rename",
      payload: {
        sessionRef: "project:tmp",
        name: "Renamed"
      }
    });
    expect(renameResponse.statusCode).toBe(200);
    expect(renameSession).toHaveBeenCalledWith("goat", "Renamed", "project:tmp");

    const deleteResponse = await activeServer.inject({
      method: "POST",
      url: "/api/workspaces/delete",
      payload: {
        sessionRef: "project:tmp"
      }
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(removeSession).toHaveBeenCalledTimes(1);
    expect(removeSession).toHaveBeenCalledWith("goat", "project:tmp");

    const removeSessionResponse = await activeServer.inject({
      method: "POST",
      url: "/api/sessions/remove",
      payload: {
        sessionRef: "agent:goat:main"
      }
    });
    expect(removeSessionResponse.statusCode).toBe(200);
    expect(removeSession).toHaveBeenCalledWith("goat", "agent:goat:main");

    const renameSessionResponse = await activeServer.inject({
      method: "POST",
      url: "/api/sessions/rename",
      payload: {
        sessionRef: "agent:goat:main",
        name: "Renamed Session"
      }
    });
    expect(renameSessionResponse.statusCode).toBe(200);
    expect(renameSession).toHaveBeenCalledWith("goat", "Renamed Session", "agent:goat:main");
  });

  it("sends a message to an existing session", async () => {
    const runAgent = vi.fn<NonNullable<OpenClawUiService["runAgent"]>>(async (): Promise<{
      code: number;
      stdout: string;
      stderr: string;
      providerId: string;
    }> => {
      return {
        code: 0,
        stdout: "assistant response",
        stderr: "",
        providerId: "openclaw"
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        runAgent
      }
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/sessions/message",
      payload: {
        agentId: "goat",
        sessionRef: "workspace:tmp",
        workingPath: "/tmp",
        message: "hello"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(runAgent).toHaveBeenCalledWith("goat", {
      message: "hello",
      sessionRef: "workspace:tmp",
      cwd: "/tmp"
    });
    expect(response.json()).toMatchObject({
      output: "assistant response",
      result: {
        code: 0
      }
    });

    const aliasResponse = await activeServer.inject({
      method: "POST",
      url: "/api/session/message",
      payload: {
        agentId: "goat",
        sessionRef: "workspace:tmp",
        workingPath: "/tmp",
        message: "hello alias"
      }
    });
    expect(aliasResponse.statusCode).toBe(200);
  });
});

function createMockService(): OpenClawUiService {
  return {
    initialize: async () => {
      return undefined;
    },
    getHomeDir: () => "/tmp/opengoat-home",
    listAgents: async (): Promise<AgentDescriptor[]> => [],
    createAgent: async (name: string): Promise<AgentCreationResult> => {
      return {
        agent: {
          id: name.toLowerCase(),
          displayName: name,
          workspaceDir: "/tmp/workspace",
          internalConfigDir: "/tmp/internal"
        },
        createdPaths: [],
        skippedPaths: []
      };
    },
    deleteAgent: async (agentId: string): Promise<AgentDeletionResult> => {
      return {
        agentId,
        existed: true,
        removedPaths: [],
        skippedPaths: []
      };
    },
    listSessions: async (): Promise<SessionSummary[]> => [],
    listSkills: async (): Promise<ResolvedSkill[]> => [],
    listGlobalSkills: async (): Promise<ResolvedSkill[]> => [],
    renameSession: async (_agentId, title = "Session", sessionRef = "agent:goat:main"): Promise<SessionSummary> => {
      return {
        sessionKey: sessionRef,
        sessionId: "session-1",
        title,
        updatedAt: Date.now(),
        transcriptPath: "/tmp/transcript.jsonl",
        workspacePath: "/tmp/workspace",
        workingPath: "/tmp",
        inputChars: 0,
        outputChars: 0,
        totalChars: 0,
        compactionCount: 0
      };
    },
    removeSession: async (_agentId, sessionRef = "agent:goat:main"): Promise<{
      sessionKey: string;
      sessionId: string;
      title: string;
      transcriptPath: string;
    }> => {
      return {
        sessionKey: sessionRef,
        sessionId: "session-1",
        title: "Session",
        transcriptPath: "/tmp/transcript.jsonl"
      };
    },
    prepareSession: async (): Promise<SessionRunInfo> => {
      return {
        agentId: "goat",
        sessionKey: "agent:goat:main",
        sessionId: "session-1",
        transcriptPath: "/tmp/transcript.jsonl",
        workspacePath: "/tmp/workspace",
        workingPath: "/tmp",
        isNewSession: true
      };
    },
    runAgent: async (): Promise<{
      code: number;
      stdout: string;
      stderr: string;
      providerId: string;
    }> => {
      return {
        code: 0,
        stdout: "ok",
        stderr: "",
        providerId: "openclaw"
      };
    }
  };
}
