import { describe, expect, it, vi } from "vitest";
import type {
  AgentSideConnection,
  ListSessionsResponse,
  LoadSessionResponse,
  NewSessionResponse,
  PromptResponse
} from "@agentclientprotocol/sdk";
import { OpenGoatAcpAgent } from "../../packages/core/src/core/acp/index.js";

function createHarness(overrides: Partial<ReturnType<typeof createDefaultService>> = {}) {
  const sessionUpdate = vi.fn(async () => undefined);
  const connection = {
    sessionUpdate
  } as unknown as AgentSideConnection;

  const service = {
    ...createDefaultService(),
    ...overrides
  };

  const agent = new OpenGoatAcpAgent({
    connection,
    service
  });

  return { agent, service, sessionUpdate };
}

describe("OpenGoatAcpAgent", () => {
  it("creates a session with mode metadata and defaults to goat", async () => {
    const { agent } = createHarness();

    const response = (await agent.newSession({
      cwd: "/tmp/project",
      mcpServers: []
    })) as NewSessionResponse;

    expect(response.sessionId).toBeTruthy();
    expect(response.modes?.currentModeId).toBe("goat");
    expect(response.modes?.availableModes.map((entry) => entry.id)).toEqual(["goat", "developer"]);
  });

  it("runs prompt through OpenGoat and emits assistant chunk", async () => {
    const runAgent = vi.fn(async () => ({
      code: 0,
      stdout: "hello from OpenGoat",
      stderr: "",
      providerId: "openclaw",
      agentId: "goat",
      entryAgentId: "goat",
      tracePath: "/tmp/trace.json"
    }));
    const { agent, sessionUpdate } = createHarness({ runAgent });
    const session = await agent.newSession({
      cwd: "/tmp/project",
      mcpServers: []
    });

    const response = (await agent.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "ping" }],
      _meta: {
        agentId: "goat",
        sessionKey: "agent:goat:main"
      }
    })) as PromptResponse;

    expect(response.stopReason).toBe("end_turn");
    expect(runAgent).toHaveBeenCalledWith(
      "goat",
      expect.objectContaining({
        message: "ping",
        sessionRef: "agent:goat:main"
      })
    );
    expect(sessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: session.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: {
            type: "text",
            text: "hello from OpenGoat"
          }
        }
      })
    );
  });

  it("supports cancellation for an active prompt", async () => {
    let resolveRun: ((value: Awaited<ReturnType<ReturnType<typeof createDefaultService>["runAgent"]>>) => void) | undefined;
    const runAgent = vi.fn(
      async () =>
        new Promise((resolve) => {
          resolveRun = resolve;
        })
    );
    const { agent } = createHarness({ runAgent });
    const session = await agent.newSession({
      cwd: "/tmp/project",
      mcpServers: []
    });

    const pending = agent.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "slow request" }]
    });
    await agent.cancel({ sessionId: session.sessionId });

    await expect(pending).resolves.toEqual({ stopReason: "cancelled" });

    resolveRun?.({
      code: 0,
      stdout: "late answer",
      stderr: "",
      providerId: "openclaw",
      agentId: "goat",
      entryAgentId: "goat",
      tracePath: "/tmp/trace.json"
    });
  });

  it("replays history on load and lists sessions", async () => {
    const { agent, sessionUpdate } = createHarness({
      getSessionHistory: vi.fn(async () => ({
        sessionKey: "main",
        sessionId: "s-main",
        transcriptPath: "/tmp/s-main.jsonl",
        messages: [
          { type: "message", role: "user", content: "hello", timestamp: 1 },
          { type: "message", role: "assistant", content: "hi there", timestamp: 2 }
        ]
      })),
      listSessions: vi.fn(async () => [
        {
          sessionKey: "main",
          sessionId: "s-main",
          title: "Main",
          updatedAt: 100,
          transcriptPath: "/tmp/s-main.jsonl",
          inputChars: 1,
          outputChars: 1,
          totalChars: 2,
          compactionCount: 0
        }
      ])
    });

    const load = (await agent.loadSession({
      sessionId: "acp-s-1",
      cwd: "/tmp/project",
      mcpServers: []
    })) as LoadSessionResponse;
    expect(load.modes?.availableModes.length).toBeGreaterThan(0);
    expect(sessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "acp-s-1",
        update: expect.objectContaining({
          sessionUpdate: "user_message_chunk"
        })
      })
    );

    const listed = (await agent.unstable_listSessions?.({
      cwd: "/tmp/project"
    })) as ListSessionsResponse;
    expect(listed.sessions).toHaveLength(1);
    expect(listed.sessions[0]?.sessionId).toBe("main");
  });
});

function createDefaultService() {
  return {
    initialize: vi.fn(async () => ({ defaultAgent: "goat" })),
    listAgents: vi.fn(async () => [
      { id: "goat", displayName: "Goat" },
      { id: "developer", displayName: "Developer" }
    ]),
    runAgent: vi.fn(async () => ({
      code: 0,
      stdout: "ok",
      stderr: "",
      providerId: "openclaw",
      agentId: "goat",
      entryAgentId: "goat",
      tracePath: "/tmp/trace.json"
    })),
    listSessions: vi.fn(async () => []),
    getSessionHistory: vi.fn(async () => ({
      sessionKey: "main",
      messages: []
    }))
  };
}
