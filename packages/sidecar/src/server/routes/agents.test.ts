import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createAgentRoutes } from "./agents.ts";

async function createStorePath(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), `${prefix}-`));
  return join(directory, "catalog.json");
}

void test("agent routes manage agents and create sessions", async (context) => {
  const storePath = await createStorePath("opengoat-agents-route");
  const agents = new Map<
    string,
    {
      agentDir: string;
      createdAt: string;
      id: string;
      instructions: string;
      isDefault: boolean;
      modelId?: string;
      name: string;
      providerId?: string;
      updatedAt: string;
      workspaceDir: string;
    }
  >();
  const sessions = new Map<
    string,
    {
      agentId: string;
      agentName: string;
      createdAt: string;
      id: string;
      label?: string;
      sessionFile: string;
      sessionKey: string;
      updatedAt: string;
      workspaceDir: string;
    }[]
  >();

  const runtime = {
    authSessions: {} as never,
    authService: {} as never,
    config: {
      hostname: "127.0.0.1",
      password: "password",
      port: 3000,
      username: "opengoat",
    },
    embeddedGateway: {
      createAgent(payload: {
        modelId?: string;
        name: string;
        providerId?: string;
      }) {
        const timestamp = new Date().toISOString();
        const id = payload.name.toLowerCase();
        const agent = {
          agentDir: `/tmp/${id}`,
          createdAt: timestamp,
          id,
          instructions: `You are ${payload.name}.`,
          isDefault: false,
          ...(payload.modelId ? { modelId: payload.modelId } : {}),
          name: payload.name,
          ...(payload.providerId ? { providerId: payload.providerId } : {}),
          updatedAt: timestamp,
          workspaceDir: `/tmp/${id}/workspace`,
        };
        agents.set(id, agent);
        return agent;
      },
      createSession(payload: { agentId: string; label?: string }) {
        const agent = agents.get(payload.agentId);
        assert.ok(agent);
        const timestamp = new Date().toISOString();
        const session = {
          agentId: agent.id,
          agentName: agent.name,
          createdAt: timestamp,
          id: "session-1",
          ...(payload.label ? { label: payload.label } : {}),
          sessionFile: `/tmp/${agent.id}/session-1.jsonl`,
          sessionKey: `agent:${agent.id}:session:session-1`,
          updatedAt: timestamp,
          workspaceDir: agent.workspaceDir,
        };
        sessions.set(agent.id, [session]);
        return session;
      },
      deleteAgent() {
        return Promise.reject(new Error("unused"));
      },
      getCatalog() {
        return Promise.resolve({
          agents: [...agents.values()],
          defaultAgentId: "main",
          storePath,
        });
      },
      listSessions(agentId?: string) {
        return Promise.resolve({
          ...(agentId ? { agentId } : {}),
          sessions: agentId ? (sessions.get(agentId) ?? []) : [...sessions.values()].flat(),
        });
      },
      updateAgent(
        agentId: string,
        payload: {
          modelId?: string;
          providerId?: string;
        },
      ) {
        const existing = agents.get(agentId);
        assert.ok(existing);
        const next = {
          ...existing,
          ...(payload.modelId !== undefined
            ? payload.modelId
              ? { modelId: payload.modelId }
              : {}
            : {}),
          ...(payload.providerId !== undefined
            ? payload.providerId
              ? { providerId: payload.providerId }
              : {}
            : {}),
          updatedAt: new Date().toISOString(),
        };
        if (payload.modelId !== undefined && !payload.modelId) {
          delete next.modelId;
        }
        if (payload.providerId !== undefined && !payload.providerId) {
          delete next.providerId;
        }
        agents.set(agentId, next);
        return Promise.resolve(next);
      },
    },
    gatewaySupervisor: {} as never,
    startedAt: Date.now(),
    version: "0.1.0-test",
  };
  const app = createAgentRoutes(runtime as never);

  context.after(async () => {
    await rm(dirname(storePath), { force: true, recursive: true });
  });

  const createResponse = await app.request("/", {
    body: JSON.stringify({
      modelId: "gpt-5",
      name: "Research",
      providerId: "openai",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  assert.equal(createResponse.status, 201);

  const catalogResponse = await app.request("/");
  assert.equal(catalogResponse.status, 200);
  const catalog = (await catalogResponse.json()) as {
    agents: { id: string }[];
  };
  assert.ok(catalog.agents.some((agent) => agent.id === "research"));

  const updateResponse = await app.request("/research", {
    body: JSON.stringify({
      modelId: "",
      providerId: "anthropic",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });
  assert.equal(updateResponse.status, 200);
  const updatedAgent = (await updateResponse.json()) as {
    modelId?: string;
    providerId?: string;
  };
  assert.equal(updatedAgent.providerId, "anthropic");
  assert.equal(updatedAgent.modelId, undefined);

  const sessionResponse = await app.request("/sessions", {
    body: JSON.stringify({
      agentId: "research",
      label: "Market open",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  assert.equal(sessionResponse.status, 201);

  const sessionsResponse = await app.request("/sessions?agentId=research");
  assert.equal(sessionsResponse.status, 200);
  const listedSessions = (await sessionsResponse.json()) as {
    sessions: { agentId: string; label?: string }[];
  };
  assert.equal(listedSessions.sessions.length, 1);
  const createdSession = listedSessions.sessions[0];
  assert.ok(createdSession);
  assert.equal(createdSession.agentId, "research");
  assert.equal(createdSession.label, "Market open");
});
