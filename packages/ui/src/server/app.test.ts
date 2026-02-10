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
    const prepareSession = vi.fn<OpenClawUiService["prepareSession"]>(
      async (): Promise<SessionRunInfo> => {
        return {
          agentId: "goat",
          sessionKey: "project:opengoat",
          sessionId: "session-1",
          transcriptPath: "/tmp/transcript.jsonl",
          workspacePath: "/tmp/workspace",
          workingPath: "/tmp/opengoat",
          isNewSession: true
        };
      }
    );

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        prepareSession
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
    expect(prepareSession).toHaveBeenCalledTimes(1);

    const payload = response.json() as {
      project: { name: string; path: string; sessionRef: string };
      session: { sessionKey: string };
    };
    expect(payload.project.name).toBe("tmp");
    expect(payload.project.path).toBe("/tmp");
    expect(payload.project.sessionRef.startsWith("project:")).toBe(true);
    expect(payload.session.sessionKey).toBe("project:opengoat");
  });

  it("creates project session through legacy core fallback when prepareSession is unavailable", async () => {
    const prepareRunSession = vi.fn(async (): Promise<{ enabled: true; info: SessionRunInfo }> => {
      return {
        enabled: true,
        info: {
          agentId: "goat",
          sessionKey: "project:legacy",
          sessionId: "legacy-session-1",
          transcriptPath: "/tmp/transcript.jsonl",
          workspacePath: "/tmp/workspace",
          workingPath: "/tmp",
          isNewSession: true
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
    expect(prepareRunSession).toHaveBeenCalledTimes(1);
    const payload = response.json() as { session: { sessionKey: string } };
    expect(payload.session.sessionKey).toBe("project:legacy");
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
    }
  };
}
