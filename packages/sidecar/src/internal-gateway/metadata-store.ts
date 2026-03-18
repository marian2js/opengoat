import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type Agent, type AgentCatalog } from "@opengoat/contracts";
import { normalizeAgentId } from "@opengoat/core";
import type {
  CreateAgentRequest,
  UpdateAgentRequest,
} from "../server/types.ts";
import {
  resolveGatewayAgentDir,
  type EmbeddedGatewayPaths,
} from "./paths.ts";

interface StoredAgentMetadata {
  createdAt: string;
  description?: string;
  id: string;
  instructions: string;
  modelId?: string;
  name: string;
  providerId?: string;
  updatedAt: string;
  workspaceDir: string;
}

interface AgentMetadataStore {
  agents: Record<string, StoredAgentMetadata>;
  defaultAgentId: string | undefined;
  order: string[];
  version: 1;
}

const STORE_VERSION = 1 as const;

const DEFAULT_AGENT_INSTRUCTIONS = "You are a helpful assistant.";

function createEmptyStore(): AgentMetadataStore {
  return {
    agents: {},
    defaultAgentId: undefined,
    order: [],
    version: STORE_VERSION,
  };
}

async function loadStore(storePath: string): Promise<AgentMetadataStore> {
  try {
    const raw = await readFile(storePath, "utf8");
    return normalizeStore(JSON.parse(raw) as unknown);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return createEmptyStore();
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid agent metadata store JSON at ${storePath}.`);
    }
    throw error;
  }
}

async function saveStore(storePath: string, store: AgentMetadataStore): Promise<void> {
  const directory = dirname(storePath);
  const temporaryPath = join(
    directory,
    `.tmp-${String(process.pid)}-${String(Date.now())}-${randomUUID()}.json`,
  );

  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  try {
    await rename(temporaryPath, storePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

function normalizeStore(raw: unknown): AgentMetadataStore {
  if (!raw || typeof raw !== "object") {
    return createEmptyStore();
  }

  const record = raw as Record<string, unknown>;
  const rawAgents =
    record.agents && typeof record.agents === "object"
      ? (record.agents as Record<string, unknown>)
      : {};
  const agents = Object.fromEntries(
    Object.entries(rawAgents)
      .flatMap(([agentId, value]) => {
        const normalized = normalizeAgent(value, agentId);
        return normalized ? [[normalized.id, normalized] as const] : [];
      }),
  );

  const order = Array.isArray(record.order)
    ? record.order
        .map((value) => (typeof value === "string" ? normalizeAgentId(value) : ""))
        .filter((value) => value && agents[value])
    : [];

  const defaultAgentId = (() => {
    const candidate =
      typeof record.defaultAgentId === "string"
        ? normalizeAgentId(record.defaultAgentId)
        : undefined;
    return candidate && agents[candidate] ? candidate : undefined;
  })();

  return {
    agents,
    defaultAgentId,
    order: dedupeOrder(order, Object.keys(agents)),
    version: STORE_VERSION,
  };
}

function normalizeAgent(
  raw: unknown,
  fallbackId: string,
): StoredAgentMetadata | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const id = normalizeAgentId(
    typeof record.id === "string" ? record.id : fallbackId,
  );
  const name =
    typeof record.name === "string" && record.name.trim()
      ? record.name.trim()
      : id;
  const createdAt =
    typeof record.createdAt === "string" && record.createdAt.trim()
      ? record.createdAt
      : new Date(0).toISOString();
  const updatedAt =
    typeof record.updatedAt === "string" && record.updatedAt.trim()
      ? record.updatedAt
      : createdAt;
  const workspaceDir =
    typeof record.workspaceDir === "string" && record.workspaceDir.trim()
      ? record.workspaceDir
      : "";

  if (!workspaceDir) {
    return null;
  }

  return {
    createdAt,
    ...(typeof record.description === "string" && record.description.trim()
      ? { description: record.description.trim() }
      : {}),
    id,
    instructions:
      typeof record.instructions === "string" && record.instructions.trim()
        ? record.instructions.trim()
        : DEFAULT_AGENT_INSTRUCTIONS,
    ...(typeof record.modelId === "string" && record.modelId.trim()
      ? { modelId: record.modelId.trim() }
      : {}),
    name,
    ...(typeof record.providerId === "string" && record.providerId.trim()
      ? { providerId: record.providerId.trim() }
      : {}),
    updatedAt,
    workspaceDir,
  };
}

function dedupeOrder(order: string[], knownAgentIds: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const agentId of [...order, ...knownAgentIds]) {
    if (seen.has(agentId)) {
      continue;
    }

    seen.add(agentId);
    result.push(agentId);
  }

  return result;
}

function toAgentRecord(
  paths: EmbeddedGatewayPaths,
  store: AgentMetadataStore,
  metadata: StoredAgentMetadata,
): Agent {
  return {
    agentDir: resolveGatewayAgentDir(paths, metadata.id),
    createdAt: metadata.createdAt,
    ...(metadata.description ? { description: metadata.description } : {}),
    id: metadata.id,
    instructions: metadata.instructions,
    isDefault: store.defaultAgentId === metadata.id,
    ...(metadata.modelId ? { modelId: metadata.modelId } : {}),
    name: metadata.name,
    ...(metadata.providerId ? { providerId: metadata.providerId } : {}),
    updatedAt: metadata.updatedAt,
    workspaceDir: metadata.workspaceDir,
  };
}

export class AgentMetadataStoreService {
  readonly #paths: EmbeddedGatewayPaths;

  constructor(paths: EmbeddedGatewayPaths) {
    this.#paths = paths;
  }

  async listCatalog(): Promise<AgentCatalog> {
    const store = await loadStore(this.#paths.metadataPath);
    const agents = dedupeOrder(store.order, Object.keys(store.agents))
      .map((agentId) => store.agents[agentId])
      .filter((agent): agent is StoredAgentMetadata => Boolean(agent))
      .map((agent) => toAgentRecord(this.#paths, store, agent));

    return {
      agents,
      defaultAgentId: store.defaultAgentId,
      storePath: this.#paths.metadataPath,
    };
  }

  async getAgent(agentId: string): Promise<Agent> {
    const normalizedId = normalizeAgentId(agentId);
    const store = await loadStore(this.#paths.metadataPath);
    const agent = store.agents[normalizedId];
    if (!agent) {
      throw new Error(`Unknown agent: ${normalizedId}`);
    }
    return toAgentRecord(this.#paths, store, agent);
  }

  async createAgent(payload: CreateAgentRequest): Promise<Agent> {
    const store = await loadStore(this.#paths.metadataPath);
    const normalizedId = normalizeAgentId(payload.id ?? payload.name);
    if (store.agents[normalizedId]) {
      throw new Error(`Agent ${normalizedId} already exists.`);
    }

    const timestamp = new Date().toISOString();
    const metadata: StoredAgentMetadata = {
      createdAt: timestamp,
      ...(payload.description ? { description: payload.description.trim() } : {}),
      id: normalizedId,
      instructions:
        payload.instructions?.trim() ?? "",
      ...(payload.modelId ? { modelId: payload.modelId.trim() } : {}),
      name: payload.name.trim(),
      ...(payload.providerId ? { providerId: payload.providerId.trim() } : {}),
      updatedAt: timestamp,
      workspaceDir:
        payload.workspaceDir?.trim() ?? join(this.#paths.workspacesDir, normalizedId),
    };

    store.agents[normalizedId] = metadata;
    store.order = dedupeOrder([...store.order, normalizedId], Object.keys(store.agents));
    if (payload.setAsDefault) {
      store.defaultAgentId = normalizedId;
    }

    await saveStore(this.#paths.metadataPath, store);
    return toAgentRecord(this.#paths, store, metadata);
  }

  async updateAgent(agentId: string, payload: UpdateAgentRequest): Promise<Agent> {
    const normalizedId = normalizeAgentId(agentId);
    const store = await loadStore(this.#paths.metadataPath);
    const existing = store.agents[normalizedId];
    if (!existing) {
      throw new Error(`Unknown agent: ${normalizedId}`);
    }

    const next: StoredAgentMetadata = {
      ...existing,
      ...(payload.description !== undefined
        ? payload.description.trim()
          ? { description: payload.description.trim() }
          : {}
        : {}),
      ...(payload.instructions !== undefined
        ? { instructions: payload.instructions.trim() || existing.instructions }
        : {}),
      ...(payload.modelId !== undefined
        ? payload.modelId.trim()
          ? { modelId: payload.modelId.trim() }
          : {}
        : {}),
      ...(payload.name !== undefined
        ? { name: payload.name.trim() || existing.name }
        : {}),
      ...(payload.providerId !== undefined
        ? payload.providerId.trim()
          ? { providerId: payload.providerId.trim() }
          : {}
        : {}),
      updatedAt: new Date().toISOString(),
      ...(payload.workspaceDir !== undefined
        ? { workspaceDir: payload.workspaceDir.trim() || existing.workspaceDir }
        : {}),
    };

    if (payload.description !== undefined && !payload.description.trim()) {
      delete next.description;
    }
    if (payload.modelId !== undefined && !payload.modelId.trim()) {
      delete next.modelId;
    }
    if (payload.providerId !== undefined && !payload.providerId.trim()) {
      delete next.providerId;
    }

    store.agents[normalizedId] = next;
    if (payload.setAsDefault) {
      store.defaultAgentId = normalizedId;
    }

    await saveStore(this.#paths.metadataPath, store);
    return toAgentRecord(this.#paths, store, next);
  }

  async deleteAgent(agentId: string): Promise<{
    defaultAgentId: string | undefined;
    removedAgent?: Agent;
  }> {
    const normalizedId = normalizeAgentId(agentId);
    const store = await loadStore(this.#paths.metadataPath);
    const existing = store.agents[normalizedId];
    if (!existing) {
      throw new Error(`Unknown agent: ${normalizedId}`);
    }

    const removedAgent = toAgentRecord(this.#paths, store, existing);
    store.agents = Object.fromEntries(
      Object.entries(store.agents).filter(([candidate]) => candidate !== normalizedId),
    );
    store.order = store.order.filter((candidate) => candidate !== normalizedId);
    if (store.defaultAgentId === normalizedId) {
      // Pick the first remaining agent as default, or undefined if none left
      store.defaultAgentId = store.order[0] ?? undefined;
    }

    await saveStore(this.#paths.metadataPath, store);

    return {
      defaultAgentId: store.defaultAgentId,
      removedAgent,
    };
  }
}
