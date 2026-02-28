import {
  PROTOCOL_VERSION,
  RequestError,
  type Agent,
  type AgentSideConnection,
  type AuthenticateRequest,
  type AuthenticateResponse,
  type CancelNotification,
  type ContentBlock,
  type InitializeRequest,
  type InitializeResponse,
  type ListSessionsRequest,
  type ListSessionsResponse,
  type LoadSessionRequest,
  type LoadSessionResponse,
  type NewSessionRequest,
  type NewSessionResponse,
  type PromptRequest,
  type PromptResponse,
  type ResumeSessionRequest,
  type ResumeSessionResponse,
  type SessionModeState,
  type SetSessionModeRequest,
  type SetSessionModeResponse,
  type StopReason
} from "@agentclientprotocol/sdk";
import { randomUUID } from "node:crypto";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../domain/agent-id.js";
import type { AgentDescriptor } from "../../domain/agent.js";
import type { OrchestrationRunResult } from "../../orchestration/index.js";
import type { ProviderInvokeOptions } from "../../providers/index.js";
import type { SessionHistoryResult, SessionSummary } from "../../sessions/index.js";
import { parseAcpSessionMeta } from "../domain/meta.js";
import type { AcpSessionStore } from "../domain/session.js";
import { InMemoryAcpSessionStore } from "./session-store.js";

interface OpenGoatAcpAgentOptions {
  defaultAgentId?: string;
  defaultSessionKeyPrefix?: string;
  replayHistoryLimit?: number;
  verbose?: boolean;
}

interface OpenGoatAcpAgentDeps {
  connection: AgentSideConnection;
  service: OpenGoatAcpService;
  sessionStore?: AcpSessionStore;
  options?: OpenGoatAcpAgentOptions;
}

interface OpenGoatAcpService {
  initialize(): Promise<unknown>;
  listAgents(): Promise<AgentDescriptor[]>;
  runAgent(agentId: string, options: ProviderInvokeOptions): Promise<OrchestrationRunResult>;
  listSessions(agentId?: string, options?: { activeMinutes?: number }): Promise<SessionSummary[]>;
  getSessionHistory(
    agentId?: string,
    options?: { sessionRef?: string; limit?: number; includeCompaction?: boolean }
  ): Promise<SessionHistoryResult>;
}

interface PendingPrompt {
  sessionId: string;
  runId: string;
  settled: boolean;
  resolve: (response: PromptResponse) => void;
  reject: (error: Error) => void;
}

const ACP_AGENT_INFO = {
  name: "opengoat-acp",
  title: "OpenGoat ACP Agent",
  version: "0.1.0"
};

export class OpenGoatAcpAgent implements Agent {
  private readonly connection: AgentSideConnection;
  private readonly service: OpenGoatAcpService;
  private readonly sessionStore: AcpSessionStore;
  private readonly defaultAgentId: string;
  private readonly defaultSessionKeyPrefix: string;
  private readonly replayHistoryLimit: number;
  private readonly log: (message: string) => void;
  private readonly pendingPrompts = new Map<string, PendingPrompt>();
  private readonly cancelledSessions = new Set<string>();

  public constructor(deps: OpenGoatAcpAgentDeps) {
    this.connection = deps.connection;
    this.service = deps.service;
    this.sessionStore = deps.sessionStore ?? new InMemoryAcpSessionStore();
    this.defaultAgentId = normalizeAgentId(deps.options?.defaultAgentId || "") || DEFAULT_AGENT_ID;
    this.defaultSessionKeyPrefix = deps.options?.defaultSessionKeyPrefix?.trim() || "acp";
    this.replayHistoryLimit = Math.max(1, deps.options?.replayHistoryLimit ?? 120);
    this.log = deps.options?.verbose ? (message) => process.stderr.write(`[acp] ${message}\n`) : () => undefined;
  }

  public async initialize(_params: InitializeRequest): Promise<InitializeResponse> {
    await this.service.initialize();

    return {
      protocolVersion: PROTOCOL_VERSION,
      agentInfo: ACP_AGENT_INFO,
      authMethods: [],
      agentCapabilities: {
        loadSession: true,
        promptCapabilities: {
          embeddedContext: true,
          image: true,
          audio: false
        },
        mcpCapabilities: {
          http: false,
          sse: false
        },
        sessionCapabilities: {
          list: {},
          resume: {}
        }
      }
    };
  }

  public async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
    const meta = parseAcpSessionMeta(params._meta);
    const sessionId = randomUUID();
    const agentId = await this.resolveAgentId(meta.agentId);
    const sessionRef = meta.sessionKey || `${this.defaultSessionKeyPrefix}:${sessionId}:main`;
    const now = Date.now();

    this.sessionStore.put({
      sessionId,
      agentId,
      sessionRef,
      cwd: params.cwd,
      createdAt: now,
      updatedAt: now
    });
    this.log(`newSession ${sessionId} -> agent=${agentId} sessionRef=${sessionRef}`);

    return {
      sessionId,
      modes: await this.buildModeState(agentId)
    };
  }

  public async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    const meta = parseAcpSessionMeta(params._meta);
    const agentId = await this.resolveAgentId(meta.agentId);
    const sessionRef = meta.sessionKey || params.sessionId;
    const now = Date.now();

    this.sessionStore.put({
      sessionId: params.sessionId,
      agentId,
      sessionRef,
      cwd: params.cwd,
      createdAt: now,
      updatedAt: now
    });
    this.log(`loadSession ${params.sessionId} -> agent=${agentId} sessionRef=${sessionRef}`);

    await this.replaySessionHistory(params.sessionId, agentId, sessionRef);

    return {
      modes: await this.buildModeState(agentId)
    };
  }

  public async unstable_resumeSession(params: ResumeSessionRequest): Promise<ResumeSessionResponse> {
    const meta = parseAcpSessionMeta(params._meta);
    const agentId = await this.resolveAgentId(meta.agentId);
    const sessionRef = meta.sessionKey || params.sessionId;
    const now = Date.now();

    this.sessionStore.put({
      sessionId: params.sessionId,
      agentId,
      sessionRef,
      cwd: params.cwd,
      createdAt: now,
      updatedAt: now
    });
    this.log(`resumeSession ${params.sessionId} -> agent=${agentId} sessionRef=${sessionRef}`);

    return {
      modes: await this.buildModeState(agentId)
    };
  }

  public async unstable_listSessions(params: ListSessionsRequest): Promise<ListSessionsResponse> {
    const meta = parseAcpSessionMeta(params._meta);
    const agentId = await this.resolveAgentId(meta.agentId);
    const all = await this.service.listSessions(agentId);

    const cursorTs = params.cursor ? Number(params.cursor) : undefined;
    const filtered = Number.isFinite(cursorTs) ? all.filter((entry) => entry.updatedAt < (cursorTs as number)) : all;
    const pageSize = readPositiveInt(params._meta, ["limit"], 100);
    const page = filtered.slice(0, pageSize);
    const nextCursor = filtered.length > pageSize ? String(page[page.length - 1]?.updatedAt ?? "") : undefined;

    return {
      sessions: page.map((entry) => ({
        sessionId: entry.sessionKey,
        cwd: params.cwd || process.cwd(),
        title: `${agentId}/${entry.sessionKey}`,
        updatedAt: new Date(entry.updatedAt).toISOString(),
        _meta: {
          sessionKey: entry.sessionKey,
          agentId
        }
      })),
      nextCursor: nextCursor || undefined
    };
  }

  public async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse> {
    const session = this.requireSession(params.sessionId);
    const modeId = params.modeId?.trim();
    if (!modeId) {
      return {};
    }

    const agentId = await this.resolveAgentId(modeId);
    this.sessionStore.update(params.sessionId, {
      agentId,
      updatedAt: Date.now()
    });

    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "current_mode_update",
        currentModeId: agentId
      }
    });

    return {};
  }

  public async authenticate(_params: AuthenticateRequest): Promise<AuthenticateResponse> {
    return {};
  }

  public async prompt(params: PromptRequest): Promise<PromptResponse> {
    const session = this.requireSession(params.sessionId);
    const meta = parseAcpSessionMeta(params._meta);
    const promptText = extractPromptText(params.prompt).trim();
    if (!promptText) {
      throw RequestError.invalidParams("Prompt must include at least one text content block.");
    }

    const agentId = await this.resolveAgentId(meta.agentId || session.agentId);
    const sessionRef = meta.sessionKey || session.sessionRef;
    const runId = randomUUID();

    if (this.cancelledSessions.delete(params.sessionId)) {
      return { stopReason: "cancelled" };
    }

    this.sessionStore.update(params.sessionId, {
      agentId,
      sessionRef,
      updatedAt: Date.now()
    });

    return new Promise<PromptResponse>((resolve, reject) => {
      const pending: PendingPrompt = {
        sessionId: params.sessionId,
        runId,
        settled: false,
        resolve,
        reject
      };
      this.pendingPrompts.set(params.sessionId, pending);
      this.sessionStore.setActiveRun(params.sessionId, {
        runId,
        sessionId: params.sessionId,
        cancelled: false
      });

      if (this.cancelledSessions.delete(params.sessionId)) {
        void this.resolvePrompt(pending, { stopReason: "cancelled" });
        return;
      }

      void this.executePromptRun({
        pending,
        params,
        agentId,
        sessionRef,
        message: promptText,
        meta
      });
    });
  }

  public async cancel(params: CancelNotification): Promise<void> {
    const active = this.sessionStore.getActiveRun(params.sessionId);
    if (!active) {
      const pending = this.pendingPrompts.get(params.sessionId);
      if (pending) {
        await this.resolvePrompt(pending, { stopReason: "cancelled" });
        return;
      }
      this.cancelledSessions.add(params.sessionId);
      return;
    }

    this.sessionStore.setActiveRun(params.sessionId, { ...active, cancelled: true });
    const pending = this.pendingPrompts.get(params.sessionId);
    if (!pending) {
      this.sessionStore.clearActiveRun(params.sessionId);
      return;
    }

    await this.resolvePrompt(pending, { stopReason: "cancelled" });
  }

  private async executePromptRun(params: {
    pending: PendingPrompt;
    params: PromptRequest;
    agentId: string;
    sessionRef: string;
    message: string;
    meta: ReturnType<typeof parseAcpSessionMeta>;
  }): Promise<void> {
    try {
      const result = await this.service.runAgent(params.agentId, {
        message: params.message,
        sessionRef: params.sessionRef,
        forceNewSession: params.meta.forceNewSession,
        disableSession: params.meta.disableSession,
        cwd: this.requireSession(params.params.sessionId).cwd
      });

      const active = this.sessionStore.getActiveRun(params.params.sessionId);
      if (!active || active.runId !== params.pending.runId || active.cancelled) {
        await this.resolvePrompt(params.pending, { stopReason: "cancelled" });
        return;
      }

      const text = extractAssistantText(result);
      const stopReason: StopReason = result.code === 0 ? "end_turn" : "refusal";
      await this.resolvePrompt(params.pending, { stopReason, text });
    } catch (error) {
      const active = this.sessionStore.getActiveRun(params.params.sessionId);
      if (active?.cancelled) {
        await this.resolvePrompt(params.pending, { stopReason: "cancelled" });
        return;
      }

      const err = error instanceof Error ? error : new Error(String(error));
      this.rejectPrompt(params.pending, err);
    }
  }

  private async resolvePrompt(
    pending: PendingPrompt,
    input: { stopReason: StopReason; text?: string }
  ): Promise<void> {
    if (pending.settled) {
      return;
    }

    pending.settled = true;
    this.pendingPrompts.delete(pending.sessionId);
    this.sessionStore.clearActiveRun(pending.sessionId);

    if (input.text?.trim()) {
      await this.connection.sessionUpdate({
        sessionId: pending.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: {
            type: "text",
            text: input.text
          }
        }
      });
    }

    pending.resolve({
      stopReason: input.stopReason
    });
  }

  private rejectPrompt(pending: PendingPrompt, error: Error): void {
    if (pending.settled) {
      return;
    }

    pending.settled = true;
    this.pendingPrompts.delete(pending.sessionId);
    this.sessionStore.clearActiveRun(pending.sessionId);
    pending.reject(error);
  }

  private async buildModeState(currentAgentId: string): Promise<SessionModeState> {
    const agents = await this.service.listAgents();
    if (agents.length === 0) {
      return {
        currentModeId: this.defaultAgentId,
        availableModes: [
          {
            id: this.defaultAgentId,
            name: "Manager",
            description: "Default OpenGoat manager agent (goat / head of organization)."
          }
        ]
      };
    }

    return {
      currentModeId: currentAgentId,
      availableModes: agents.map((agent) => ({
        id: agent.id,
        name: agent.displayName || agent.id,
        description: `Route prompts to agent "${agent.id}".`
      }))
    };
  }

  private requireSession(sessionId: string) {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw RequestError.invalidParams(`Session not found: ${sessionId}`);
    }
    return session;
  }

  private async resolveAgentId(candidate: string | undefined): Promise<string> {
    const requested = normalizeAgentId(candidate || "");
    const agents = await this.service.listAgents();
    const available = new Set(agents.map((agent) => agent.id));

    if (requested && available.has(requested)) {
      return requested;
    }
    if (available.has(this.defaultAgentId)) {
      return this.defaultAgentId;
    }
    return agents[0]?.id || this.defaultAgentId;
  }

  private async replaySessionHistory(sessionId: string, agentId: string, sessionRef: string): Promise<void> {
    const history = await this.service.getSessionHistory(agentId, {
      sessionRef,
      limit: this.replayHistoryLimit,
      includeCompaction: true
    });

    for (const item of history.messages) {
      if (item.type === "message" && item.role === "assistant") {
        await this.connection.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: {
              type: "text",
              text: item.content
            }
          }
        });
        continue;
      }

      if (item.type === "message" && item.role === "user") {
        await this.connection.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: "user_message_chunk",
            content: {
              type: "text",
              text: item.content
            }
          }
        });
        continue;
      }

      if (item.type === "compaction") {
        await this.connection.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: "agent_thought_chunk",
            content: {
              type: "text",
              text: `[Session compaction summary]\n${item.content}`
            }
          }
        });
      }
    }
  }
}

function extractPromptText(prompt: ContentBlock[]): string {
  const parts: string[] = [];
  for (const block of prompt) {
    if (block.type === "text") {
      parts.push(block.text);
      continue;
    }
    if (block.type === "resource") {
      const resourceText = extractEmbeddedResourceText(block.resource);
      if (resourceText) {
        parts.push(resourceText);
      }
      continue;
    }
    if (block.type === "resource_link") {
      const descriptor = block.title?.trim() || block.name?.trim() || block.uri?.trim();
      if (descriptor) {
        parts.push(`[resource] ${descriptor}`);
      }
    }
  }

  return parts.join("\n").trim();
}

function extractEmbeddedResourceText(resource: unknown): string | undefined {
  if (!resource || typeof resource !== "object") {
    return undefined;
  }

  if ("text" in resource && typeof resource.text === "string" && resource.text.trim()) {
    return resource.text;
  }

  return undefined;
}

function extractAssistantText(result: OrchestrationRunResult): string {
  return result.stdout.trim();
}

function readPositiveInt(meta: unknown, keys: string[], fallback: number): number {
  if (!meta || typeof meta !== "object") {
    return fallback;
  }

  const record = meta as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
  }

  return fallback;
}
