import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { WebSocket, type RawData } from "ws";
import packageJson from "../../package.json" with { type: "json" };
import {
  type AuthOverview,
  type Agent,
  type AgentCatalog,
  type AgentSession,
  type AgentSessionList,
  type ChatActivity,
  type ChatBootstrap,
  type ChatTranscriptMessage,
  type CreateAgentSessionRequest,
  type DeleteAgentResponse,
  type DeleteAgentSessionResponse,
  type ProviderModelCatalog,
} from "@opengoat/contracts";
import { isInternalSessionKey, normalizeAgentId } from "@opengoat/core";
import type { AgentMetadataStoreService } from "./metadata-store.ts";
import {
  defaultModelForProvider,
  normalizeGatewayModelRef,
  splitGatewayModelRef,
} from "./model-defaults.ts";
import { toChatActivityChunk } from "./chat-activity.ts";
import {
  resolveGatewaySessionFile,
  resolveGatewaySessionsDir,
  type EmbeddedGatewayPaths,
} from "./paths.ts";
import { createSignedGatewayDevice } from "./device-identity.ts";
import { loadPackagedTemplate } from "./workspace-bootstrap.ts";
import type {
  CreateAgentRequest,
  UpdateAgentRequest,
} from "../server/types.ts";

interface GatewayAgentListResult {
  agents: {
    id: string;
    name?: string;
  }[];
  defaultId: string;
}

interface GatewayChatHistoryMessage {
  content?: {
    text?: string;
    type?: string;
  }[];
  id?: string;
  message?: {
    content?: {
      text?: string;
      type?: string;
    }[];
    role?: "assistant" | "system" | "user";
    timestamp?: number;
  };
  role?: "assistant" | "system" | "user";
  timestamp?: number;
  ts?: number;
}

interface GatewayChatHistoryResult {
  messages: GatewayChatHistoryMessage[];
  sessionId?: string;
  sessionKey: string;
}

interface GatewayChatRunAck {
  runId: string;
  status: "accepted" | "in_flight" | "ok";
}

interface GatewayEventFrame {
  event: string;
  seq?: number;
  stateVersion?: number;
  type: "event";
  payload?: unknown;
}

interface GatewayResponseFrame {
  error?: {
    code?: string;
    details?: unknown;
    message?: string;
  };
  id: string;
  ok: boolean;
  payload?: unknown;
  type: "res";
}

interface GatewayRequestFrame {
  id: string;
  method: string;
  params?: unknown;
  type: "req";
}

interface PendingGatewayRequest {
  expectFinal: boolean;
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
}

interface GatewayRpcClientOptions {
  caps?: string[];
  clientDisplayName?: string;
  clientName?: string;
  connectDelayMs?: number;
  identityPath: string;
  mode?: string;
  onClose?: (code: number, reason: string) => void;
  onConnectError?: (error: Error) => void;
  onEvent?: (event: GatewayEventFrame) => void;
  onHelloOk?: () => void;
  scopes?: string[];
  token?: string;
  url: string;
}

class GatewayRpcClient {
  readonly #options: GatewayRpcClientOptions;
  readonly #pending = new Map<string, PendingGatewayRequest>();
  #connectNonce: string | null = null;
  #connectSent = false;
  #connectTimer: NodeJS.Timeout | null = null;
  #socket: WebSocket | null = null;

  constructor(options: GatewayRpcClientOptions) {
    this.#options = options;
  }

  start(): void {
    this.#socket = new WebSocket(this.#options.url, {
      maxPayload: 25 * 1024 * 1024,
    });

    this.#socket.on("open", () => {
      this.#queueConnect();
    });
    this.#socket.on("message", (data: RawData) => {
      this.#handleMessage(data);
    });
    this.#socket.on("close", (code: number, reason: Buffer) => {
      this.stop();
      this.#options.onClose?.(code, reason.toString("utf8"));
    });
    this.#socket.on("error", (error: Error) => {
      this.#options.onConnectError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    });
  }

  stop(): void {
    if (this.#connectTimer) {
      clearTimeout(this.#connectTimer);
      this.#connectTimer = null;
    }

    const pendingError = new Error("gateway client stopped");
    for (const pending of this.#pending.values()) {
      pending.reject(pendingError);
    }
    this.#pending.clear();

    if (this.#socket) {
      this.#socket.removeAllListeners();
      this.#socket.close();
      this.#socket = null;
    }
  }

  request<T = unknown>(
    method: string,
    params?: unknown,
    options?: { expectFinal?: boolean },
  ): Promise<T> {
    if (!this.#socket || this.#socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway not connected"));
    }

    const id = randomUUID();
    const frame: GatewayRequestFrame = {
      id,
      method,
      ...(params === undefined ? {} : { params }),
      type: "req",
    };

    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, {
        expectFinal: options?.expectFinal === true,
        reject,
        resolve: (value) => {
          resolve(value as T);
        },
      });
      this.#socket?.send(JSON.stringify(frame));
    });
  }

  #handleMessage(data: RawData): void {
    let parsed: unknown;
    try {
      const raw =
        typeof data === "string"
          ? data
          : Buffer.isBuffer(data)
            ? data.toString("utf8")
            : Array.isArray(data)
              ? Buffer.concat(data).toString("utf8")
              : Buffer.from(new Uint8Array(data)).toString("utf8");
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      return;
    }

    const frame = parsed as Record<string, unknown>;
    if (frame.type === "event" && typeof frame.event === "string") {
      const event = frame as unknown as GatewayEventFrame;
      if (event.event === "connect.challenge") {
        const nonce =
          event.payload &&
          typeof event.payload === "object" &&
          typeof (event.payload as { nonce?: unknown }).nonce === "string"
            ? (event.payload as { nonce: string }).nonce.trim()
            : "";
        if (!nonce) {
          this.#options.onConnectError?.(new Error("gateway connect challenge missing nonce"));
          this.#socket?.close(1008, "connect challenge missing nonce");
          return;
        }
        this.#connectNonce = nonce;
        void this.#sendConnect();
        return;
      }

      this.#options.onEvent?.(event);
      return;
    }

    if (frame.type !== "res" || typeof frame.id !== "string") {
      return;
    }

    const response = frame as unknown as GatewayResponseFrame;
    const pending = this.#pending.get(response.id);
    if (!pending) {
      return;
    }

    const status =
      response.payload &&
      typeof response.payload === "object" &&
      "status" in response.payload
        ? (response.payload as { status?: unknown }).status
        : undefined;
    if (pending.expectFinal && status === "accepted") {
      return;
    }

    this.#pending.delete(response.id);
    if (response.ok) {
      pending.resolve(response.payload);
      return;
    }

    pending.reject(
      new Error(response.error?.message ?? response.error?.code ?? "gateway request failed"),
    );
  }

  #queueConnect(): void {
    this.#connectNonce = null;
    this.#connectSent = false;
    const timeoutMs = Math.max(250, this.#options.connectDelayMs ?? 2_000);
    this.#connectTimer = setTimeout(() => {
      const socket = this.#socket;
      if (this.#connectSent || socket?.readyState !== WebSocket.OPEN) {
        return;
      }

      this.#options.onConnectError?.(new Error("gateway connect challenge timeout"));
      socket.close(1008, "connect challenge timeout");
    }, timeoutMs);
    this.#connectTimer.unref();
  }

  async #sendConnect(): Promise<void> {
    if (this.#connectSent) {
      return;
    }

    const nonce = this.#connectNonce?.trim();
    if (!nonce) {
      this.#options.onConnectError?.(new Error("gateway connect challenge missing nonce"));
      this.#socket?.close(1008, "connect challenge missing nonce");
      return;
    }

    this.#connectSent = true;
    if (this.#connectTimer) {
      clearTimeout(this.#connectTimer);
      this.#connectTimer = null;
    }

    try {
      const scopes = this.#options.scopes ?? CLIENT_SCOPES;
      const signedDevice = await createSignedGatewayDevice({
        clientId: this.#options.clientName ?? CLIENT_NAME,
        clientMode: this.#options.mode ?? CLIENT_MODE,
        identityPath: this.#options.identityPath,
        nonce,
        platform: process.platform,
        role: "operator",
        scopes,
        ...(this.#options.token ? { token: this.#options.token } : {}),
      });

      await this.request(
        "connect",
        {
          auth: this.#options.token ? { token: this.#options.token } : undefined,
          caps: this.#options.caps ?? [],
          client: {
            displayName: this.#options.clientDisplayName,
            id: this.#options.clientName ?? CLIENT_NAME,
            mode: this.#options.mode ?? CLIENT_MODE,
            platform: process.platform,
            version: CLIENT_VERSION,
          },
          device: signedDevice.device,
          maxProtocol: 3,
          minProtocol: 3,
          role: "operator",
          scopes,
        },
        { expectFinal: false },
      );
      this.#options.onHelloOk?.();
    } catch (error: unknown) {
      this.#options.onConnectError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
      this.#socket?.close(1008, "connect failed");
    }
  }
}

interface GatewayChatEvent {
  errorMessage?: string;
  message?: {
    content?: {
      text?: string;
      type?: string;
    }[];
  };
  runId: string;
  sessionKey: string;
  state: "aborted" | "delta" | "error" | "final";
}

interface GatewayAgentEventPayload {
  data?: Record<string, unknown>;
  runId: string;
  seq: number;
  sessionKey?: string;
  stream: string;
  ts?: number;
}

interface GatewaySessionRow {
  derivedTitle?: string;
  displayName?: string;
  key: string;
  label?: string;
  model?: string;
  modelProvider?: string;
  sessionId?: string;
  updatedAt: number | null;
}

interface GatewaySessionsListResult {
  sessions: GatewaySessionRow[];
}

interface GatewaySessionEntry {
  label?: string;
  model?: string;
  modelProvider?: string;
  sessionId: string;
  updatedAt?: number;
}

interface GatewaySessionsPatchResult {
  entry: GatewaySessionEntry;
  key: string;
}

interface GatewayConnectionTarget {
  token: string;
  url: string;
}

const CLIENT_NAME = "gateway-client";
const CLIENT_MODE = "backend";
const CLIENT_SCOPES = ["operator.admin", "operator.read", "operator.write"];
const CLIENT_VERSION = packageJson.version;

function extractMessageText(
  content?: {
    text?: string;
    type?: string;
  }[],
): string {
  return (content ?? [])
    .flatMap((part) => (part.type === "text" && typeof part.text === "string" ? [part.text] : []))
    .join("\n")
    .trim();
}

function toChatTranscriptMessage(
  value: GatewayChatHistoryMessage,
): ChatTranscriptMessage | null {
  // Support both flat shape (role/content at top level) and nested shape (under .message)
  const role = value.role ?? value.message?.role;
  if (role !== "assistant" && role !== "system" && role !== "user") {
    return null;
  }

  const content = value.content ?? value.message?.content;
  const timestamp = value.timestamp ?? value.message?.timestamp ?? value.ts;

  return {
    createdAt: new Date(timestamp ?? Date.now()).toISOString(),
    id: value.id ?? randomUUID(),
    role,
    text: extractMessageText(content),
  };
}

function resolveSessionLabel(row: GatewaySessionRow, agentName: string): string {
  return (
    row.label?.trim() ??
    row.displayName?.trim() ??
    row.derivedTitle?.trim() ??
    `${agentName} chat`
  );
}

function toAgentSession(params: {
  agent: Agent;
  paths: EmbeddedGatewayPaths;
  row: GatewaySessionRow;
}): AgentSession & { model?: string } {
  const updatedAt = params.row.updatedAt
    ? new Date(params.row.updatedAt).toISOString()
    : new Date().toISOString();
  const sessionId = params.row.sessionId ?? params.row.key;

  return {
    agentId: params.agent.id,
    agentName: params.agent.name,
    createdAt: updatedAt,
    id: sessionId,
    label: resolveSessionLabel(params.row, params.agent.name),
    sessionFile: resolveGatewaySessionFile(params.paths, params.agent.id, sessionId),
    sessionKey: params.row.key,
    updatedAt,
    workspaceDir: params.agent.workspaceDir,
    ...(params.row.model ? { model: params.row.model } : {}),
  };
}

function reorderIds<T extends { id: string }>(items: T[], preferredId?: string): T[] {
  if (!preferredId) {
    return items;
  }

  return [...items].sort((left, right) => {
    if (left.id === preferredId) {
      return -1;
    }
    if (right.id === preferredId) {
      return 1;
    }
    return 0;
  });
}

function sameProvider(left?: string, right?: string): boolean {
  const normalizedLeft = left?.trim();
  const normalizedRight = right?.trim();
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  return normalizedLeft.toLowerCase() === normalizedRight.toLowerCase();
}

function addModelCandidate(target: string[], modelRef?: string): void {
  const normalized = modelRef?.trim();
  if (!normalized || target.includes(normalized)) {
    return;
  }
  target.push(normalized);
}

export function resolveCompatibleAgentModelRef(params: {
  agent: Agent;
  authOverview: Pick<AuthOverview, "selectedModelId" | "selectedProviderId">;
  providerCatalog: {
    currentModelRef?: string | undefined;
    models: ProviderModelCatalog["models"];
    providerId: string;
  };
}): string | undefined {
  const effectiveProviderId =
    params.agent.providerId?.trim() ?? params.authOverview.selectedProviderId?.trim();
  if (!effectiveProviderId) {
    return normalizeGatewayModelRef({
      modelId: params.agent.modelId,
      providerId: params.agent.providerId,
    });
  }

  const allowedModelRefs = new Set<string>(
    params.providerCatalog.models
      .map((entry) => entry.modelRef.trim())
      .filter((entry) => entry.length > 0),
  );
  const candidates: string[] = [];

  if (params.agent.providerId?.trim()) {
    addModelCandidate(
      candidates,
      normalizeGatewayModelRef({
        modelId: params.agent.modelId,
        providerId: params.agent.providerId,
      }),
    );
  }

  if (
    params.authOverview.selectedModelId?.trim() &&
    sameProvider(params.authOverview.selectedProviderId, effectiveProviderId)
  ) {
    addModelCandidate(
      candidates,
      normalizeGatewayModelRef({
        modelId: params.authOverview.selectedModelId,
        providerId: effectiveProviderId,
      }),
    );
  }

  addModelCandidate(candidates, params.providerCatalog.currentModelRef);
  addModelCandidate(candidates, defaultModelForProvider(effectiveProviderId));
  addModelCandidate(candidates, params.providerCatalog.models[0]?.modelRef);

  return candidates.find((candidate) => allowedModelRefs.has(candidate));
}

export class EmbeddedGatewayClient {
  readonly #authState: {
    getOverview(): Promise<Pick<AuthOverview, "selectedModelId" | "selectedProviderId">>;
    getProviderModelCatalog(providerId: string): Promise<ProviderModelCatalog>;
  };
  readonly #metadataStore: AgentMetadataStoreService;
  readonly #paths: EmbeddedGatewayPaths;
  readonly #target: GatewayConnectionTarget;

  constructor(params: {
    authService: {
      getOverview(): Promise<Pick<AuthOverview, "selectedModelId" | "selectedProviderId">>;
      getProviderModelCatalog(providerId: string): Promise<ProviderModelCatalog>;
    };
    metadataStore: AgentMetadataStoreService;
    paths: EmbeddedGatewayPaths;
    target: GatewayConnectionTarget;
  }) {
    this.#authState = params.authService;
    this.#metadataStore = params.metadataStore;
    this.#paths = params.paths;
    this.#target = params.target;
  }

  async getCatalog(): Promise<AgentCatalog> {
    const metadataCatalog = await this.#metadataStore.listCatalog();
    const defaultAgent =
      metadataCatalog.agents.find((agent) => agent.id === metadataCatalog.defaultAgentId) ??
      metadataCatalog.agents[0];
    if (defaultAgent) {
      await this.ensureAgentExists(defaultAgent);
    }
    const gatewayCatalog = await this.request<GatewayAgentListResult>("agents.list", {});
    const availableIds = new Set(
      gatewayCatalog.agents.map((agent) => normalizeAgentId(agent.id)),
    );

    return {
      agents: reorderIds(
        metadataCatalog.agents.filter((agent) => availableIds.has(agent.id)),
        metadataCatalog.defaultAgentId,
      ),
      defaultAgentId: metadataCatalog.defaultAgentId,
      storePath: metadataCatalog.storePath,
    };
  }

  async getAgent(agentId: string): Promise<Agent> {
    return await this.#metadataStore.getAgent(agentId);
  }

  async getDefaultAgent(): Promise<Agent> {
    const catalog = await this.getCatalog();
    const agent =
      catalog.agents.find((candidate) => candidate.id === catalog.defaultAgentId) ??
      catalog.agents[0];
    if (!agent) {
      throw new Error("No agents are configured.");
    }
    return agent;
  }

  async createAgent(payload: CreateAgentRequest): Promise<Agent> {
    const metadata = await this.#metadataStore.createAgent(payload);
    const result = await this.request<{ agentId: string }>("agents.create", {
      name: metadata.id,
      workspace: metadata.workspaceDir,
    });

    if (normalizeAgentId(result.agentId) !== metadata.id) {
      throw new Error(
        `Embedded runtime created agent ${result.agentId}, but ${metadata.id} was expected.`,
      );
    }

    await this.applyAgentWorkspace(metadata);
    return metadata;
  }

  async updateAgent(agentId: string, payload: UpdateAgentRequest): Promise<Agent> {
    const metadata = await this.#metadataStore.updateAgent(agentId, payload);
    await this.ensureAgentExists(metadata);
    const model = normalizeGatewayModelRef(metadata);
    await this.request("agents.update", {
      agentId: metadata.id,
      ...(payload.name?.trim() ? { name: metadata.name } : {}),
      ...(model ? { model } : {}),
      ...(payload.workspaceDir?.trim() ? { workspace: metadata.workspaceDir } : {}),
    });

    await this.applyAgentWorkspace(metadata);
    return metadata;
  }

  async deleteAgent(agentId: string): Promise<DeleteAgentResponse> {
    const sessions = await this.listSessions(agentId);
    const metadata = await this.#metadataStore.deleteAgent(agentId);
    await this.request("agents.delete", {
      agentId: normalizeAgentId(agentId),
      deleteFiles: true,
    });

    return {
      agentId: normalizeAgentId(agentId),
      deletedSessions: sessions.sessions.length,
      removedPaths: metadata.removedAgent
        ? [
            metadata.removedAgent.agentDir,
            metadata.removedAgent.workspaceDir,
            resolveGatewaySessionsDir(this.#paths, metadata.removedAgent.id),
          ]
        : [],
    };
  }

  async listSessions(agentId?: string): Promise<AgentSessionList> {
    const catalog = await this.getCatalog();
    const agentMap = new Map(catalog.agents.map((agent) => [agent.id, agent]));
    const rows = await this.request<GatewaySessionsListResult>("sessions.list", {
      agentId: agentId?.trim(),
      includeDerivedTitles: true,
      includeLastMessage: false,
      limit: 100,
    });
    const sessions = rows.sessions
      .map((row) => {
        const parsedAgentId = row.key.startsWith("agent:")
          ? normalizeAgentId(row.key.split(":")[1] ?? "")
          : "";
        if (!parsedAgentId) {
          return null;
        }
        const normalizedAgentId = parsedAgentId;
        const agent = agentMap.get(normalizedAgentId);
        return agent ? toAgentSession({ agent, paths: this.#paths, row }) : null;
      })
      .filter((session): session is AgentSession => Boolean(session))
      .filter((session) => !isInternalSessionKey(session.sessionKey))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    return {
      ...(agentId ? { agentId } : {}),
      sessions,
    };
  }

  async createSession(payload: CreateAgentSessionRequest): Promise<AgentSession> {
    const agent = await this.getAgent(payload.agentId);
    await this.ensureAgentExists(agent);
    const authOverview = await this.#authState.getOverview();
    const fallbackModelRef = await this.#resolveCompatibleModelRef({
      agent,
      authOverview,
    });
    const sessionKey = payload.internal
      ? `session:internal:${agent.id}:${randomUUID()}`
      : `agent:${agent.id}:session:${randomUUID()}`;
    const patch = await this.request<GatewaySessionsPatchResult>("sessions.patch", {
      key: sessionKey,
      ...(payload.label?.trim() ? { label: payload.label.trim() } : {}),
      ...(fallbackModelRef ? { model: fallbackModelRef } : {}),
    });

    if (payload.initialPrompt?.trim()) {
      await this.request<GatewayChatRunAck>(
        "chat.send",
        {
          idempotencyKey: randomUUID(),
          message: payload.initialPrompt.trim(),
          sessionKey,
        },
        { expectFinal: false },
      );
    }

    return {
      agentId: agent.id,
      agentName: agent.name,
      createdAt: new Date(patch.entry.updatedAt ?? Date.now()).toISOString(),
      id: patch.entry.sessionId,
      ...(payload.label?.trim() ? { label: payload.label.trim() } : {}),
      sessionFile: resolveGatewaySessionFile(this.#paths, agent.id, patch.entry.sessionId),
      sessionKey: patch.key,
      updatedAt: new Date(patch.entry.updatedAt ?? Date.now()).toISOString(),
      workspaceDir: agent.workspaceDir,
    };
  }

  async updateSessionLabel(sessionId: string, label: string): Promise<AgentSession> {
    const sessions = await this.listSessions();
    const session = sessions.sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const patch = await this.request<GatewaySessionsPatchResult>("sessions.patch", {
      key: session.sessionKey,
      label,
    });

    return {
      ...session,
      label,
      updatedAt: new Date(patch.entry.updatedAt ?? Date.now()).toISOString(),
    };
  }

  async deleteSession(sessionId: string): Promise<DeleteAgentSessionResponse> {
    const sessions = await this.listSessions();
    const session = sessions.sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Remove the session .jsonl file
    await rm(session.sessionFile, { force: true });

    // Remove from OpenClaw's sessions.json registry
    const sessionsJsonPath = join(
      resolveGatewaySessionsDir(this.#paths, session.agentId),
      "sessions.json",
    );
    try {
      const raw = await readFile(sessionsJsonPath, "utf8");
      const registry = JSON.parse(raw) as Record<string, unknown>;
      delete registry[session.sessionKey];
      await writeFile(sessionsJsonPath, JSON.stringify(registry, null, 2));
    } catch {
      // sessions.json may not exist or be unreadable — ignore
    }

    return { sessionId };
  }

  async bootstrapConversation(
    agentId?: string,
    sessionId?: string,
  ): Promise<ChatBootstrap> {
    if (!agentId) {
      const catalog = await this.getCatalog();
      const defaultAgent = catalog.agents.find((a) => a.isDefault) ?? catalog.agents[0];
      if (!defaultAgent) {
        throw new Error("No agents are configured. Create a project first.");
      }
      agentId = defaultAgent.id;
    }
    const agent = await this.getAgent(agentId);
    await this.ensureAgentExists(agent);
    const authOverview = await this.#authState.getOverview();
    const fallbackModelRef = await this.#resolveCompatibleModelRef({
      agent,
      authOverview,
    });
    const session = await this.ensureConversationSession({
      agent,
      ...(fallbackModelRef ? { fallbackModelRef } : {}),
      ...(sessionId ? { requestedSessionId: sessionId } : {}),
    });
    const history = await this.request<GatewayChatHistoryResult>("chat.history", {
      limit: 200,
      sessionKey: session.sessionKey,
    });
    const catalog = await this.getCatalog();
    const resolved = splitGatewayModelRef(fallbackModelRef);

    return {
      agent,
      agents: catalog.agents,
      messages: history.messages
        .map((message) => toChatTranscriptMessage(message))
        .filter((message): message is ChatTranscriptMessage => Boolean(message)),
      ...(resolved.modelId ? { resolvedModelId: resolved.modelId } : {}),
      ...(resolved.providerId ? { resolvedProviderId: resolved.providerId } : {}),
      session,
    };
  }

  async streamConversation(params: {
    agentId?: string;
    message: UIMessage;
    sessionId?: string;
  }): Promise<Response> {
    const agent = params.agentId
      ? await this.getAgent(params.agentId)
      : await this.getDefaultAgent();
    await this.ensureAgentExists(agent);
    const authOverview = await this.#authState.getOverview();
    const fallbackModelRef = await this.#resolveCompatibleModelRef({
      agent,
      authOverview,
    });
    const session = await this.ensureConversationSession({
      agent,
      ...(fallbackModelRef ? { fallbackModelRef } : {}),
      ...(params.sessionId ? { requestedSessionId: params.sessionId } : {}),
    });
    const fallbackProviderId =
      splitGatewayModelRef(fallbackModelRef).providerId ??
      agent.providerId ??
      authOverview.selectedProviderId;
    // Extract file parts from the message
    const allFileParts = params.message.parts.filter(
      (part): part is { type: "file"; mediaType: string; url: string; filename?: string } =>
        part.type === "file" &&
        "mediaType" in part &&
        typeof (part as Record<string, unknown>).mediaType === "string",
    );

    // Image attachments → pass through as OpenClaw multimodal attachments
    const attachments = allFileParts
      .filter((part) => part.mediaType.startsWith("image/"))
      .map((part) => ({
        content: part.url,
        mimeType: part.mediaType,
        ...(part.filename ? { fileName: part.filename } : {}),
      }));

    // Non-image files (text, PDF, code, etc.) → decode content and prepend to user text
    const textFileContents: string[] = [];
    for (const filePart of allFileParts) {
      if (filePart.mediaType.startsWith("image/")) {
        continue;
      }
      try {
        const dataUrlMatch = filePart.url.match(
          /^data:[^;]*;base64,(.+)$/,
        );
        if (dataUrlMatch?.[1]) {
          const decoded = Buffer.from(dataUrlMatch[1], "base64").toString(
            "utf-8",
          );
          const name = filePart.filename ?? "file";
          textFileContents.push(
            `<file name="${name}">\n${decoded}\n</file>`,
          );
        }
      } catch {
        // Skip files that can't be decoded as text
      }
    }

    const rawUserText = params.message.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("\n")
      .trim();
    if (!rawUserText && textFileContents.length === 0 && attachments.length === 0) {
      throw new Error("Chat message cannot be empty.");
    }
    const userText = textFileContents.length > 0
      ? `${textFileContents.join("\n\n")}\n\n${rawUserText}`
      : rawUserText;

    const bootstrap = await this.bootstrapConversation(agent.id);
    const originalMessages: UIMessage<unknown, { activity: ChatActivity }>[] = [
      ...bootstrap.messages.map((message) => ({
        id: message.id,
        parts: message.text
          ? [{ text: message.text, type: "text" as const }]
          : [],
        role: message.role,
      })),
      params.message as UIMessage<unknown, { activity: ChatActivity }>,
    ];
    const assistantMessageId = randomUUID();
    const assistantTextPartId = `${assistantMessageId}:text`;

    const stream = createUIMessageStream<UIMessage<unknown, { activity: ChatActivity }>>({
      execute: async ({ writer }) => {
        let runId = "";
        let currentAssistantText = "";
        let started = false;
        let messageStarted = false;
        let finishedResolve!: () => void;
        let finishedReject!: (error: Error) => void;
        const finished = new Promise<void>((resolve, reject) => {
          finishedResolve = resolve;
          finishedReject = reject;
        });

        function ensureMessageStarted(): void {
          if (messageStarted) {
            return;
          }

          writer.write({
            messageId: assistantMessageId,
            type: "start",
          });
          messageStarted = true;
        }

        const streamClient = await this.connect({
          caps: ["tool-events"],
          onEvent: (event) => {
            if (event.event === "agent" && event.payload && typeof event.payload === "object") {
              const payload = event.payload as GatewayAgentEventPayload;
              if (payload.sessionKey !== session.sessionKey || payload.runId !== runId) {
                return;
              }

              const activityChunk = toChatActivityChunk(payload);
              if (!activityChunk) {
                return;
              }

              ensureMessageStarted();
              writer.write(activityChunk);
              return;
            }

            const payload =
              event.event === "chat" && event.payload && typeof event.payload === "object"
                ? (event.payload as GatewayChatEvent)
                : null;
            if (payload?.sessionKey !== session.sessionKey || payload.runId !== runId) {
              return;
            }

            if (payload.state === "delta") {
              const fullText = extractMessageText(payload.message?.content);
              const nextDelta = fullText.slice(currentAssistantText.length);
              if (!started && fullText) {
                ensureMessageStarted();
                writer.write({ id: assistantTextPartId, type: "text-start" });
                started = true;
              }
              if (nextDelta) {
                currentAssistantText = fullText;
                writer.write({
                  delta: nextDelta,
                  id: assistantTextPartId,
                  type: "text-delta",
                });
              }
              return;
            }

            if (payload.state === "final") {
              const fullText = extractMessageText(payload.message?.content);
              const trailing = fullText.slice(currentAssistantText.length);
              if (!started) {
                ensureMessageStarted();
                writer.write({ id: assistantTextPartId, type: "text-start" });
                started = true;
              }
              if (trailing) {
                writer.write({
                  delta: trailing,
                  id: assistantTextPartId,
                  type: "text-delta",
                });
              }
              writer.write({ id: assistantTextPartId, type: "text-end" });
              writer.write({ finishReason: "stop", type: "finish" });
              finishedResolve();
              return;
            }

            if (payload.state === "error") {
              const message =
                payload.errorMessage ?? "The assistant could not complete the turn.";
              writer.write({
                errorText: message,
                type: "error",
              });
              finishedReject(new Error(message));
            }
          },
        });

        try {
          const ack = await streamClient.request<GatewayChatRunAck>(
            "chat.send",
            {
              ...(attachments.length > 0 ? { attachments } : {}),
              idempotencyKey: params.message.id,
              message: userText,
              sessionKey: session.sessionKey,
            },
            { expectFinal: false },
          );
          runId = ack.runId;
          await finished;
        } finally {
          streamClient.stop();
        }
      },
      originalMessages,
    });

    return createUIMessageStreamResponse({
      headers: {
        "x-opengoat-agent-id": agent.id,
        ...(fallbackProviderId ? { "x-opengoat-provider-id": fallbackProviderId } : {}),
        ...(fallbackModelRef ? { "x-opengoat-model-id": fallbackModelRef } : {}),
      },
      stream,
    });
  }

  async applyAgentWorkspace(agent: Agent): Promise<void> {
    const hasCustomInstructions = Boolean(agent.instructions.trim());

    const soulContent = hasCustomInstructions
      ? `# SOUL.md - ${agent.name}\n\n${agent.instructions.trim()}\n`
      : await loadPackagedTemplate("SOUL.md");
    const identityContent = hasCustomInstructions
      ? `# IDENTITY.md - ${agent.name}\n\n- Name: ${agent.name}\n`
      : await loadPackagedTemplate("IDENTITY.md");
    const userContent = await loadPackagedTemplate("USER.md");

    await this.request("agents.files.set", {
      agentId: agent.id,
      content: soulContent,
      name: "SOUL.md",
    });
    await this.request("agents.files.set", {
      agentId: agent.id,
      content: identityContent,
      name: "IDENTITY.md",
    });
    await this.request("agents.files.set", {
      agentId: agent.id,
      content: userContent,
      name: "USER.md",
    });
    if (normalizeGatewayModelRef(agent)) {
      await this.request("agents.update", {
        agentId: agent.id,
        model: normalizeGatewayModelRef(agent),
      });
    }
  }

  private async ensureConversationSession(params: {
    agent: Agent;
    requestedSessionId?: string;
    fallbackModelRef?: string;
  }): Promise<AgentSession> {
    if (params.requestedSessionId) {
      const sessions = await this.listSessions(params.agent.id);
      const existing = sessions.sessions.find(
        (candidate) => candidate.id === params.requestedSessionId,
      );
      if (existing) {
        return await this.syncConversationSession(existing, params.fallbackModelRef);
      }
    }

    const sessions = await this.request<GatewaySessionsListResult>("sessions.list", {
      agentId: params.agent.id,
      includeDerivedTitles: true,
      limit: 25,
    });
    const latest = sessions.sessions.find(
      (row) => !isInternalSessionKey(row.key),
    );
    if (latest?.sessionId) {
      return await this.syncConversationSession(
        toAgentSession({ agent: params.agent, paths: this.#paths, row: latest }),
        params.fallbackModelRef,
      );
    }

    const key = `agent:${params.agent.id}:main`;
    const patch = await this.request<GatewaySessionsPatchResult>("sessions.patch", {
      key,
      label: `${params.agent.name} chat`,
      ...(params.fallbackModelRef ? { model: params.fallbackModelRef } : {}),
    });

    return {
      agentId: params.agent.id,
      agentName: params.agent.name,
      createdAt: new Date(patch.entry.updatedAt ?? Date.now()).toISOString(),
      id: patch.entry.sessionId,
      label: `${params.agent.name} chat`,
      sessionFile: resolveGatewaySessionFile(this.#paths, params.agent.id, patch.entry.sessionId),
      sessionKey: patch.key,
      updatedAt: new Date(patch.entry.updatedAt ?? Date.now()).toISOString(),
      workspaceDir: params.agent.workspaceDir,
    };
  }

  private async syncConversationSession(
    session: AgentSession & { model?: string },
    fallbackModelRef?: string,
  ): Promise<AgentSession> {
    // Skip the patch if no model change is needed — avoids bumping updatedAt
    // which would re-sort the session to the top of the list on open.
    if (!fallbackModelRef || session.model === fallbackModelRef) {
      return session;
    }

    const patch = await this.request<GatewaySessionsPatchResult>("sessions.patch", {
      key: session.sessionKey,
      model: fallbackModelRef,
    });

    return {
      ...session,
      updatedAt: new Date(patch.entry.updatedAt ?? Date.now()).toISOString(),
    };
  }

  private async request<T>(
    method: string,
    params?: unknown,
    options?: { expectFinal?: boolean },
  ): Promise<T> {
    const client = await this.connect();
    try {
      return await client.request<T>(method, params, options);
    } finally {
      client.stop();
    }
  }

  private async ensureAgentExists(agent: Agent): Promise<void> {
    const gatewayCatalog = await this.request<GatewayAgentListResult>("agents.list", {});
    const exists = gatewayCatalog.agents.some(
      (candidate) => normalizeAgentId(candidate.id) === agent.id,
    );

    if (!exists) {
      const created = await this.request<{ agentId: string }>("agents.create", {
        name: agent.name,
        workspace: agent.workspaceDir,
      });

      if (normalizeAgentId(created.agentId) !== agent.id) {
        throw new Error(
          `Embedded runtime created agent ${created.agentId}, but ${agent.id} was expected.`,
        );
      }
    }
  }

  async #resolveCompatibleModelRef(params: {
    agent: Agent;
    authOverview: Pick<AuthOverview, "selectedModelId" | "selectedProviderId">;
  }): Promise<string | undefined> {
    const effectiveProviderId =
      params.agent.providerId?.trim() ?? params.authOverview.selectedProviderId?.trim();
    if (!effectiveProviderId) {
      return normalizeGatewayModelRef(params.agent);
    }

    const providerCatalog = await this.#authState.getProviderModelCatalog(effectiveProviderId);
    return resolveCompatibleAgentModelRef({
      agent: params.agent,
      authOverview: params.authOverview,
      providerCatalog,
    });
  }

  private async connect(options?: {
    caps?: string[];
    onEvent?: (event: GatewayEventFrame) => void;
  }): Promise<{
    request<T = unknown>(
      method: string,
      params?: unknown,
      requestOptions?: { expectFinal?: boolean },
    ): Promise<T>;
    stop(): void;
  }> {
    return await new Promise((resolve, reject) => {
      let settled = false;
      const client = new GatewayRpcClient({
        clientDisplayName: "OpenGoat",
        clientName: CLIENT_NAME,
        connectDelayMs: 0,
        ...(options?.caps ? { caps: options.caps } : {}),
        identityPath: this.#paths.deviceIdentityPath,
        mode: CLIENT_MODE,
        onClose: (code, reason) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(
              new Error(
                `Embedded runtime closed during connect (${String(code)}): ${reason}`,
              ),
            );
          }
        },
        onConnectError: (error) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(error);
          }
        },
        ...(options?.onEvent ? { onEvent: options.onEvent } : {}),
        onHelloOk: () => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeout);
          resolve(client);
        },
        scopes: CLIENT_SCOPES,
        token: this.#target.token,
        url: this.#target.url.replace(/^http/i, "ws"),
      });

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          client.stop();
          reject(new Error("Timed out connecting to the embedded runtime."));
        }
      }, 10_000);
      timeout.unref();
      client.start();
    });
  }
}
