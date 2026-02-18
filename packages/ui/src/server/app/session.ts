import { execFile } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { DEFAULT_AGENT_ID } from "./constants.js";
import type {
  AgentRunResult,
  CreateAgentOptions,
  LegacyPreparedSessionRun,
  OpenClawUiService,
  OrganizationAgent,
  OrganizationAgentProfile,
  OrganizationAgentProfileUpdateInput,
  SessionHistoryResult,
  SessionRemoveResult,
  SessionRunInfo,
  SessionSummary,
  TaskRecord,
  UiImageInput,
  UiProviderOption,
  UiRunHooks,
} from "./types.js";

const execFileAsync = promisify(execFile);
const DEFAULT_MANAGER_TAGS = ["manager", "leadership"];
const DEFAULT_INDIVIDUAL_TAGS = ["specialized"];
const OPENCLAW_PROVIDER_ID = "openclaw";

interface OrganizationAgentConfigShape {
  id?: unknown;
  displayName?: unknown;
  role?: unknown;
  description?: unknown;
  organization?: {
    type?: unknown;
    reportsTo?: unknown;
    discoverable?: unknown;
    tags?: unknown;
    priority?: unknown;
  };
  runtime?: {
    provider?: {
      id?: unknown;
    };
    adapter?: unknown;
    skills?: {
      assigned?: unknown;
    };
  };
}

export function normalizeReportsTo(
  value: string | null | undefined,
): string | null | undefined {
  if (value === null) {
    return null;
  }

  const normalized = value?.trim();
  if (!normalized || normalized.toLowerCase() === "none") {
    return undefined;
  }

  return normalized;
}

export function normalizeSkills(
  value: string[] | string | undefined,
): string[] | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => item.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : undefined;
}

export function normalizeRole(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export async function prepareUiSession(
  service: OpenClawUiService,
  agentId: string,
  options: {
    sessionRef: string;
    forceNew: boolean;
  },
): Promise<SessionRunInfo> {
  if (typeof service.prepareSession === "function") {
    return service.prepareSession(agentId, options);
  }

  const legacy = service as OpenClawUiService & {
    sessionService?: {
      prepareRunSession?: (
        paths: unknown,
        legacyAgentId: string,
        request: {
          sessionRef?: string;
          forceNew?: boolean;
          userMessage: string;
        },
      ) => Promise<LegacyPreparedSessionRun>;
      renameSession?: (
        paths: unknown,
        legacyAgentId: string,
        title: string,
        sessionRef?: string,
      ) => Promise<SessionSummary>;
      removeSession?: (
        paths: unknown,
        legacyAgentId: string,
        sessionRef?: string,
      ) => Promise<SessionRemoveResult>;
    };
  };

  if (
    typeof legacy.getPaths === "function" &&
    typeof legacy.sessionService?.prepareRunSession === "function"
  ) {
    const prepared = await legacy.sessionService.prepareRunSession(
      legacy.getPaths(),
      agentId,
      {
        sessionRef: options.sessionRef,
        forceNew: options.forceNew,
        userMessage: "",
      },
    );

    if (!prepared.enabled || !prepared.info) {
      throw new Error("Session preparation was disabled.");
    }
    return prepared.info;
  }

  throw new Error(
    "Session preparation is unavailable. Restart the UI server after updating dependencies.",
  );
}

export async function renameUiSession(
  service: OpenClawUiService,
  agentId: string,
  title: string,
  sessionRef: string,
): Promise<SessionSummary> {
  if (typeof service.renameSession === "function") {
    return service.renameSession(agentId, title, sessionRef);
  }

  const legacy = service as OpenClawUiService & {
    sessionService?: {
      renameSession?: (
        paths: unknown,
        legacyAgentId: string,
        nextTitle: string,
        legacySessionRef?: string,
      ) => Promise<SessionSummary>;
    };
  };
  if (
    typeof legacy.getPaths === "function" &&
    typeof legacy.sessionService?.renameSession === "function"
  ) {
    return legacy.sessionService.renameSession(
      legacy.getPaths(),
      agentId,
      title,
      sessionRef,
    );
  }

  throw new Error("Session rename is unavailable on this runtime.");
}

export async function removeUiSession(
  service: OpenClawUiService,
  agentId: string,
  sessionRef: string,
): Promise<SessionRemoveResult> {
  if (typeof service.removeSession === "function") {
    return service.removeSession(agentId, sessionRef);
  }

  const legacy = service as OpenClawUiService & {
    sessionService?: {
      removeSession?: (
        paths: unknown,
        legacyAgentId: string,
        legacySessionRef?: string,
      ) => Promise<SessionRemoveResult>;
    };
  };
  if (
    typeof legacy.getPaths === "function" &&
    typeof legacy.sessionService?.removeSession === "function"
  ) {
    return legacy.sessionService.removeSession(
      legacy.getPaths(),
      agentId,
      sessionRef,
    );
  }

  throw new Error("Session removal is unavailable on this runtime.");
}

export async function getUiSessionHistory(
  service: OpenClawUiService,
  agentId: string,
  options: {
    sessionRef: string;
    limit?: number;
  },
): Promise<SessionHistoryResult> {
  if (typeof service.getSessionHistory === "function") {
    return service.getSessionHistory(agentId, {
      sessionRef: options.sessionRef,
      limit: options.limit,
    });
  }

  const legacy = service as OpenClawUiService & {
    sessionService?: {
      getSessionHistory?: (
        paths: unknown,
        legacyAgentId: string,
        request: {
          sessionRef?: string;
          limit?: number;
          includeCompaction?: boolean;
        },
      ) => Promise<SessionHistoryResult>;
    };
  };
  if (
    typeof legacy.getPaths === "function" &&
    typeof legacy.sessionService?.getSessionHistory === "function"
  ) {
    return legacy.sessionService.getSessionHistory(legacy.getPaths(), agentId, {
      sessionRef: options.sessionRef,
      limit: options.limit,
    });
  }

  throw new Error("Session history is unavailable on this runtime.");
}

export async function runUiSessionMessage(
  service: OpenClawUiService,
  agentId: string,
  options: {
    sessionRef: string;
    message: string;
    images?: UiImageInput[];
    abortSignal?: AbortSignal;
    hooks?: UiRunHooks;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
  },
): Promise<AgentRunResult> {
  if (typeof service.runAgent === "function") {
    return service.runAgent(agentId, {
      message: options.message,
      sessionRef: options.sessionRef,
      images: options.images,
      ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
      ...(options.hooks ? { hooks: options.hooks } : {}),
      ...(options.onStdout ? { onStdout: options.onStdout } : {}),
      ...(options.onStderr ? { onStderr: options.onStderr } : {}),
    });
  }

  throw new Error("Session messaging is unavailable on this runtime.");
}

export async function createUiTask(
  service: OpenClawUiService,
  actorId: string,
  options: {
    title: string;
    description: string;
    project?: string;
    assignedTo?: string;
    status?: string;
  },
): Promise<TaskRecord> {
  if (typeof service.createTask === "function") {
    return service.createTask(actorId, options);
  }

  throw new Error("Task creation is unavailable on this runtime.");
}

export async function listUiTasks(
  service: OpenClawUiService,
  options: { assignee?: string; limit?: number } = {},
): Promise<TaskRecord[]> {
  if (typeof service.listTasks === "function") {
    return service.listTasks(options);
  }

  throw new Error("Task listing is unavailable on this runtime.");
}

export async function deleteUiTasks(
  service: OpenClawUiService,
  actorId: string,
  taskIds: string[],
): Promise<{ deletedTaskIds: string[]; deletedCount: number }> {
  if (typeof service.deleteTasks === "function") {
    return service.deleteTasks(actorId, taskIds);
  }

  throw new Error("Task deletion is unavailable on this runtime.");
}

export async function updateUiTaskStatus(
  service: OpenClawUiService,
  actorId: string,
  taskId: string,
  status: string,
  reason?: string,
): Promise<TaskRecord> {
  if (typeof service.updateTaskStatus === "function") {
    return service.updateTaskStatus(actorId, taskId, status, reason);
  }

  throw new Error("Task status updates are unavailable on this runtime.");
}

export async function addUiTaskBlocker(
  service: OpenClawUiService,
  actorId: string,
  taskId: string,
  content: string,
): Promise<TaskRecord> {
  if (typeof service.addTaskBlocker === "function") {
    return service.addTaskBlocker(actorId, taskId, content);
  }

  throw new Error("Task blocker updates are unavailable on this runtime.");
}

export async function addUiTaskArtifact(
  service: OpenClawUiService,
  actorId: string,
  taskId: string,
  content: string,
): Promise<TaskRecord> {
  if (typeof service.addTaskArtifact === "function") {
    return service.addTaskArtifact(actorId, taskId, content);
  }

  throw new Error("Task artifact updates are unavailable on this runtime.");
}

export async function addUiTaskWorklog(
  service: OpenClawUiService,
  actorId: string,
  taskId: string,
  content: string,
): Promise<TaskRecord> {
  if (typeof service.addTaskWorklog === "function") {
    return service.addTaskWorklog(actorId, taskId, content);
  }

  throw new Error("Task worklog updates are unavailable on this runtime.");
}

export async function resolveProjectFolder(
  folderName: string | undefined,
  folderPath: string | undefined,
): Promise<{ name: string; path: string }> {
  const explicitPath = folderPath?.trim();
  if (explicitPath) {
    const resolvedPath = resolveAbsolutePath(explicitPath);
    const stats = await stat(resolvedPath).catch(() => {
      return null;
    });
    if (!stats || !stats.isDirectory()) {
      throw new Error(`Project path is not a directory: ${resolvedPath}`);
    }

    const explicitName = folderName?.trim();
    return {
      name: explicitName || path.basename(resolvedPath),
      path: resolvedPath,
    };
  }

  const normalizedFolderName = normalizeDesktopFolderName(folderName);
  if (!normalizedFolderName) {
    throw new Error("folderName is required.");
  }

  const desktopDir = path.resolve(homedir(), "Desktop");
  const projectPath = path.resolve(desktopDir, normalizedFolderName);
  const stats = await stat(projectPath).catch(() => {
    return null;
  });
  if (!stats || !stats.isDirectory()) {
    throw new Error(`Desktop folder does not exist: ${projectPath}`);
  }

  return {
    name: normalizedFolderName,
    path: projectPath,
  };
}

function normalizeDesktopFolderName(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed === "." || trimmed === "..") {
    return null;
  }

  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    return null;
  }

  return trimmed;
}

export function buildProjectSessionRef(
  projectName: string,
  projectPath: string,
): string {
  const segment = normalizeProjectSegment(projectName);
  const suffix = normalizeProjectSegment(projectPath).slice(-10) || "session";
  return `project:${segment}-${suffix}`;
}

export function normalizeUiImages(images: UiImageInput[] | undefined): UiImageInput[] {
  if (!images || images.length === 0) {
    return [];
  }

  return images.filter((image) => {
    if (!image || typeof image !== "object") {
      return false;
    }

    const dataUrl = image.dataUrl?.trim();
    const mediaType = image.mediaType?.trim();
    return Boolean(
      dataUrl &&
        dataUrl.startsWith("data:") &&
        mediaType?.toLowerCase().startsWith("image/"),
    );
  });
}

export function buildWorkspaceSessionRef(
  workspaceName: string,
  workspacePath: string,
): string {
  const segment = normalizeProjectSegment(workspaceName);
  const suffix = normalizeProjectSegment(workspacePath).slice(-10) || "workspace";
  const nonce = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296)
    .toString(36)
    .padStart(2, "0")}`;
  return `workspace:${segment}-${suffix}-${nonce}`;
}

export function resolveDefaultWorkspaceSessionTitle(): string {
  return "New Session";
}

export function resolveAbsolutePath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "~") {
    return homedir();
  }
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return path.resolve(homedir(), trimmed.slice(2));
  }
  return path.resolve(trimmed);
}

function normalizeProjectSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "project";
}

export async function pickProjectFolderFromSystem(): Promise<{
  name: string;
  path: string;
}> {
  if (process.platform === "darwin") {
    const script =
      'POSIX path of (choose folder with prompt "Select a project folder")';
    const { stdout } = await execFileAsync("osascript", ["-e", script], {
      timeout: 120_000,
    });
    const selectedPath = stdout.trim().replace(/[\\/]+$/, "");
    if (!selectedPath) {
      throw new Error("No folder was selected.");
    }
    const resolvedPath = path.resolve(selectedPath);
    const stats = await stat(resolvedPath).catch(() => {
      return null;
    });
    if (!stats || !stats.isDirectory()) {
      throw new Error(`Selected folder is not accessible: ${resolvedPath}`);
    }
    return {
      name: path.basename(resolvedPath),
      path: resolvedPath,
    };
  }

  throw new Error("Native folder picker is currently supported on macOS only.");
}

export async function resolveOrganizationAgents(
  service: OpenClawUiService,
): Promise<OrganizationAgent[]> {
  const agents = await service.listAgents();
  const agentIds = buildKnownAgentIdSet(agents);
  const providers = await resolveUiProviders(service);
  const providerReporteeSupportById = new Map(
    providers.map((provider) => [provider.id, provider.supportsReportees]),
  );

  return Promise.all(
    agents.map(async (agent) => {
      const fallbackReportsTo =
        agent.id === DEFAULT_AGENT_ID ? null : DEFAULT_AGENT_ID;
      const fallbackType: OrganizationAgent["type"] =
        agent.id === DEFAULT_AGENT_ID ? "manager" : "individual";
      const fallbackProviderId = "openclaw";

      try {
        const configPath = path.resolve(agent.internalConfigDir, "config.json");
        const raw = await readFile(configPath, "utf8");
        const parsed = JSON.parse(raw) as {
          role?: string;
          organization?: {
            reportsTo?: string | null;
            type?: string;
          };
          runtime?: {
            provider?: {
              id?: string;
            };
            adapter?: string;
          };
        };

        const organization = parsed.organization;
        const reportsTo = normalizeReportsToValue(
          organization?.reportsTo,
          fallbackReportsTo,
          agentIds,
        );
        const type = normalizeTypeValue(organization?.type, fallbackType);
        const role = normalizeRoleValue(parsed.role);
        const providerId =
          normalizeProviderIdValue(parsed.runtime?.provider?.id) ??
          normalizeProviderIdValue(parsed.runtime?.adapter) ??
          fallbackProviderId;

        return {
          ...agent,
          reportsTo,
          type,
          role,
          providerId,
          supportsReportees: resolveProviderReporteeSupport(
            providerId,
            providerReporteeSupportById,
          ),
        };
      } catch {
        const providerId = fallbackProviderId;
        return {
          ...agent,
          reportsTo: fallbackReportsTo,
          type: fallbackType,
          role: undefined,
          providerId,
          supportsReportees: resolveProviderReporteeSupport(
            providerId,
            providerReporteeSupportById,
          ),
        };
      }
    }),
  );
}

export async function resolveOrganizationAgentProfile(
  service: OpenClawUiService,
  rawAgentId: string,
): Promise<OrganizationAgentProfile | null> {
  const requestedAgentId = normalizeOptionalStringValue(rawAgentId);
  if (!requestedAgentId) {
    return null;
  }

  const agents = await resolveOrganizationAgents(service);
  const agent = findOrganizationAgentById(agents, requestedAgentId);
  if (!agent) {
    return null;
  }

  const knownAgentIds = buildKnownAgentIdSet(agents);
  const configPath = path.resolve(agent.internalConfigDir, "config.json");
  const parsed = await readAgentConfig(configPath);

  const fallbackType = resolveKnownAgentType(agent);
  const resolvedType = normalizeTypeValue(parsed.organization?.type, fallbackType);
  const type: "manager" | "individual" =
    resolvedType === "manager" ? "manager" : "individual";
  const reportsTo = normalizeReportsToValue(
    parsed.organization?.reportsTo as string | null | undefined,
    agent.reportsTo,
    knownAgentIds,
  );
  const displayName =
    normalizeOptionalStringValue(parsed.displayName) ?? agent.displayName;
  const role =
    normalizeOptionalStringValue(parsed.role) ??
    resolveDefaultAgentRole(agent.id, type);
  const description =
    normalizeOptionalStringValue(parsed.description) ??
    resolveDefaultAgentDescription(role, type, displayName);
  const discoverable = normalizeBooleanValue(
    parsed.organization?.discoverable,
    true,
  );
  const tags = normalizeStringListValue(parsed.organization?.tags) ?? [
    ...resolveDefaultTags(type),
  ];
  const priority = normalizePriorityValue(
    parsed.organization?.priority,
    resolveDefaultPriority(type),
  );
  const providerId =
    normalizeProviderIdValue(parsed.runtime?.provider?.id) ??
    normalizeProviderIdValue(parsed.runtime?.adapter) ??
    agent.providerId;
  const skills = normalizeStringListValue(parsed.runtime?.skills?.assigned) ?? [];

  return {
    ...agent,
    displayName,
    reportsTo,
    type,
    role,
    description,
    discoverable,
    tags,
    priority,
    providerId,
    skills,
  };
}

export async function updateOrganizationAgentProfile(
  service: OpenClawUiService,
  rawAgentId: string,
  input: OrganizationAgentProfileUpdateInput,
): Promise<OrganizationAgentProfile> {
  const profile = await resolveOrganizationAgentProfile(service, rawAgentId);
  if (!profile) {
    throw new Error(`Agent "${rawAgentId}" does not exist.`);
  }

  const providers = await resolveUiProviders(service);
  const availableProviderIds = new Set(providers.map((provider) => provider.id));
  const agents = await resolveOrganizationAgents(service);
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));

  const requestedType = input.type
    ? normalizeTypeValue(input.type, profile.type)
    : profile.type;
  const nextType: "manager" | "individual" =
    requestedType === "manager" ? "manager" : "individual";

  const hasReportsToChange = hasOwnField(input, "reportsTo");
  const normalizedReportsToInput = hasReportsToChange
    ? normalizeReportTargetInput(input.reportsTo)
    : undefined;
  if (normalizedReportsToInput) {
    const managerAgent = agentsById.get(normalizedReportsToInput);
    if (!managerAgent) {
      throw new Error(`Manager "${normalizedReportsToInput}" does not exist.`);
    }
    if (managerAgent.providerId !== OPENCLAW_PROVIDER_ID) {
      throw new Error(
        `Cannot assign "${normalizedReportsToInput}" as manager because only OpenClaw agents can be managers (found provider "${managerAgent.providerId}").`,
      );
    }
    if (managerAgent.supportsReportees === false) {
      throw new Error(
        `Cannot assign "${normalizedReportsToInput}" as manager because provider "${managerAgent.providerId}" does not support reportees.`,
      );
    }
  }

  let nextReportsTo = profile.reportsTo;
  if (hasReportsToChange && normalizedReportsToInput !== undefined) {
    if (typeof service.setAgentManager !== "function") {
      throw new Error(
        "Agent manager assignment is unavailable. Restart the UI server after updating dependencies.",
      );
    }
    const updated = await service.setAgentManager(
      profile.id,
      normalizedReportsToInput,
    );
    nextReportsTo = updated.reportsTo;
  }

  const hasProviderChange = hasOwnField(input, "providerId");
  const normalizedProviderId = hasProviderChange
    ? normalizeProviderIdValue(input.providerId)
    : undefined;
  if (hasProviderChange) {
    if (!normalizedProviderId || !availableProviderIds.has(normalizedProviderId)) {
      throw new Error(
        `providerId must be one of: ${[...availableProviderIds].join(", ")}`,
      );
    }
    if (typeof service.setAgentProvider !== "function") {
      throw new Error(
        "Agent provider assignment is unavailable. Restart the UI server after updating dependencies.",
      );
    }
    if (normalizedProviderId !== profile.providerId) {
      await service.setAgentProvider(profile.id, normalizedProviderId);
    }
  }

  const refreshed = await resolveOrganizationAgentProfile(service, profile.id);
  if (!refreshed) {
    throw new Error(`Agent "${profile.id}" does not exist.`);
  }

  const configPath = path.resolve(refreshed.internalConfigDir, "config.json");
  const parsed = await readAgentConfig(configPath);
  const config = toObjectRecord(parsed as unknown);
  const organization = toObjectRecord(config.organization);
  const runtime = toObjectRecord(config.runtime);
  const runtimeProvider = toObjectRecord(runtime.provider);
  const runtimeSkills = toObjectRecord(runtime.skills);

  const displayName = normalizeDisplayNameInput(input.displayName, refreshed.displayName);
  const role = normalizeRoleInput(
    input.role,
    resolveDefaultAgentRole(refreshed.id, nextType),
  );
  const previousDefaultDescription = resolveDefaultAgentDescription(
    refreshed.role ??
      resolveDefaultAgentRole(
        refreshed.id,
        refreshed.type === "manager" ? "manager" : "individual",
      ),
    refreshed.type === "manager" ? "manager" : "individual",
    refreshed.displayName,
  );
  const description = normalizeDescriptionInput(
    input.description,
    refreshed.description,
    {
      previousDefaultDescription,
      nextDefaultDescription: resolveDefaultAgentDescription(
        role,
        nextType,
        displayName,
      ),
      roleChanged: role !== refreshed.role,
      typeChanged: nextType !== refreshed.type,
      displayNameChanged: displayName !== refreshed.displayName,
    },
  );
  const discoverable = normalizeBooleanValue(
    input.discoverable,
    refreshed.discoverable,
  );
  const tags =
    normalizeStringListValue(input.tags) ?? (hasOwnField(input, "tags")
      ? []
      : refreshed.tags);
  const priority = normalizePriorityValue(input.priority, refreshed.priority);
  const skills =
    normalizeStringListValue(input.skills) ?? (hasOwnField(input, "skills")
      ? []
      : refreshed.skills);
  const providerId = normalizedProviderId ?? refreshed.providerId;
  const reportsTo = nextReportsTo;

  const nextConfig = {
    ...config,
    id: refreshed.id,
    displayName,
    role,
    description,
    organization: {
      ...organization,
      type: nextType,
      reportsTo,
      discoverable,
      tags,
      priority,
    },
    runtime: {
      ...runtime,
      provider: {
        ...runtimeProvider,
        id: providerId,
      },
      skills: {
        ...runtimeSkills,
        assigned: skills,
      },
    },
  };

  await writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");

  const updatedProfile = await resolveOrganizationAgentProfile(service, refreshed.id);
  if (!updatedProfile) {
    throw new Error(`Agent "${refreshed.id}" does not exist.`);
  }
  return updatedProfile;
}

export async function resolveUiProviders(
  service: OpenClawUiService,
): Promise<UiProviderOption[]> {
  const providers: UiProviderOption[] = [];
  const seenProviderIds = new Set<string>();

  if (typeof service.listProviders !== "function") {
    return [{ id: "openclaw", displayName: "OpenClaw", supportsReportees: true }];
  }

  const rawProviders = await service.listProviders();
  for (const provider of rawProviders) {
    const providerId = normalizeProviderIdValue(provider.id);
    if (!providerId) {
      continue;
    }
    if (seenProviderIds.has(providerId)) {
      continue;
    }
    seenProviderIds.add(providerId);
    providers.push({
      id: providerId,
      displayName: normalizeProviderDisplayName(provider.displayName, providerId),
      supportsReportees: provider.capabilities.reportees === true,
    });
  }

  if (!seenProviderIds.has("openclaw")) {
    providers.push({
      id: "openclaw",
      displayName: "OpenClaw",
      supportsReportees: true,
    });
  }

  return sortUiProviders(providers);
}

async function readAgentConfig(
  configPath: string,
): Promise<OrganizationAgentConfigShape> {
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as OrganizationAgentConfigShape;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function buildKnownAgentIdSet(
  agents: Array<{ id: string }>,
): Set<string> {
  const knownAgentIds = new Set<string>();
  for (const agent of agents) {
    const raw = agent.id.trim();
    if (raw) {
      knownAgentIds.add(raw);
    }
    const normalized = normalizeAgentIdValue(agent.id);
    if (normalized) {
      knownAgentIds.add(normalized);
    }
  }
  return knownAgentIds;
}

function findOrganizationAgentById(
  agents: OrganizationAgent[],
  requestedAgentId: string,
): OrganizationAgent | undefined {
  const exact = agents.find((entry) => entry.id === requestedAgentId);
  if (exact) {
    return exact;
  }

  const normalizedRequested = normalizeAgentIdValue(requestedAgentId);
  if (!normalizedRequested) {
    return undefined;
  }

  return agents.find((entry) => {
    return normalizeAgentIdValue(entry.id) === normalizedRequested;
  });
}

function hasOwnField<T extends object>(
  target: T,
  key: PropertyKey,
): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function toObjectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeAgentIdValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
}

function normalizeProviderIdValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
}

function resolveProviderReporteeSupport(
  providerId: string,
  supportById: Map<string, boolean>,
): boolean {
  const supported = supportById.get(providerId);
  if (supported !== undefined) {
    return supported;
  }
  return providerId === "openclaw";
}

function normalizeProviderDisplayName(
  value: unknown,
  providerId: string,
): string {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }

  return providerId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => {
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
}

function sortUiProviders(providers: UiProviderOption[]): UiProviderOption[] {
  const sorted = [...providers];
  sorted.sort((left, right) => {
    const leftIsOpenClaw = left.id === "openclaw";
    const rightIsOpenClaw = right.id === "openclaw";
    if (leftIsOpenClaw && !rightIsOpenClaw) {
      return -1;
    }
    if (!leftIsOpenClaw && rightIsOpenClaw) {
      return 1;
    }

    return left.displayName.localeCompare(right.displayName, undefined, {
      sensitivity: "base",
    });
  });
  return sorted;
}

function normalizeReportsToValue(
  value: string | null | undefined,
  fallback: string | null,
  knownAgentIds: Set<string>,
): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "null" || normalized === "none") {
    return null;
  }

  return knownAgentIds.has(normalized) ? normalized : fallback;
}

function normalizeReportTargetInput(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  const normalized = normalizeAgentIdValue(value);
  if (!normalized || normalized === "none" || normalized === "null") {
    return null;
  }
  return normalized;
}

function resolveKnownAgentType(
  agent: OrganizationAgent,
): "manager" | "individual" {
  if (agent.type === "manager" || agent.type === "individual") {
    return agent.type;
  }
  return agent.id === DEFAULT_AGENT_ID ? "manager" : "individual";
}

function normalizeTypeValue(
  rawType: unknown,
  fallback: OrganizationAgent["type"],
): OrganizationAgent["type"] {
  if (typeof rawType !== "string") {
    return fallback;
  }
  const normalized = rawType.trim().toLowerCase();
  if (normalized === "manager" || normalized === "individual") {
    return normalized;
  }
  return fallback;
}

function normalizeRoleValue(rawRole: string | undefined): string | undefined {
  const normalized = rawRole?.trim();
  if (normalized) {
    const genericRole = normalized.toLowerCase();
    if (
      genericRole === "manager" ||
      genericRole === "individual contributor" ||
      genericRole === "team member"
    ) {
      return undefined;
    }
    return normalized;
  }
  return undefined;
}

function normalizeOptionalStringValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeDisplayNameInput(
  value: string | undefined,
  fallback: string,
): string {
  const normalized = normalizeOptionalStringValue(value);
  return normalized ?? fallback;
}

function normalizeRoleInput(value: string | undefined, fallback: string): string {
  const normalized = normalizeOptionalStringValue(value);
  return normalized ?? fallback;
}

function normalizeDescriptionInput(
  value: string | undefined,
  previous: string,
  options: {
    previousDefaultDescription: string;
    nextDefaultDescription: string;
    roleChanged: boolean;
    typeChanged: boolean;
    displayNameChanged: boolean;
  },
): string {
  const normalized = normalizeOptionalStringValue(value);
  if (normalized) {
    return normalized;
  }

  if (value !== undefined) {
    return options.nextDefaultDescription;
  }

  const shouldAutoRegenerate =
    (options.roleChanged || options.typeChanged || options.displayNameChanged) &&
    previous.trim() === options.previousDefaultDescription.trim();
  if (shouldAutoRegenerate) {
    return options.nextDefaultDescription;
  }
  return previous;
}

function normalizeStringListValue(value: unknown): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  if (rawItems.length === 0) {
    return undefined;
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of rawItems) {
    if (typeof item !== "string") {
      continue;
    }
    const cleaned = item.trim();
    if (!cleaned || seen.has(cleaned)) {
      continue;
    }
    seen.add(cleaned);
    normalized.push(cleaned);
  }

  return normalized;
}

function normalizeBooleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function normalizePriorityValue(value: unknown, fallback: number): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.trunc(parsed);
}

function resolveDefaultTags(type: "manager" | "individual"): string[] {
  return type === "manager" ? DEFAULT_MANAGER_TAGS : DEFAULT_INDIVIDUAL_TAGS;
}

function resolveDefaultPriority(type: "manager" | "individual"): number {
  return type === "manager" ? 100 : 50;
}

function resolveDefaultAgentRole(
  agentId: string,
  type: "manager" | "individual",
): string {
  if (agentId === DEFAULT_AGENT_ID) {
    return "CEO";
  }
  return type === "manager" ? "Manager" : "Team Member";
}

function resolveDefaultAgentDescription(
  role: string,
  type: "manager" | "individual",
  displayName: string,
): string {
  if (type === "manager") {
    return `${role} coordinating direct reports.`;
  }
  return `${role} OpenClaw agent for ${displayName}.`;
}

export function toCreateAgentOptions(
  input: {
    type?: "manager" | "individual";
    reportsTo?: string | null;
    skills?: string[] | string;
    role?: string;
  },
): CreateAgentOptions {
  const skills = normalizeSkills(input.skills);
  const createOptions: CreateAgentOptions = {
    type: input.type,
    reportsTo: normalizeReportsTo(input.reportsTo),
    skills,
  };
  const role = normalizeRole(input.role);
  if (role) {
    createOptions.role = role;
  }
  return createOptions;
}
