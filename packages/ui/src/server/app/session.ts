import { execFile } from "node:child_process";
import { mkdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  DEFAULT_AGENT_ID,
  DEFAULT_ORGANIZATION_PROJECT_DIRNAME,
  DEFAULT_ORGANIZATION_PROJECT_NAME,
} from "./constants.js";
import type {
  AgentRunResult,
  CreateAgentOptions,
  LegacyPreparedSessionRun,
  OpenClawUiService,
  OrganizationAgent,
  SessionHistoryResult,
  SessionRemoveResult,
  SessionRunInfo,
  SessionSummary,
  TaskRecord,
  UiImageInput,
  UiLogBuffer,
  UiRunHooks,
} from "./types.js";

const execFileAsync = promisify(execFile);

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

export async function prepareProjectSession(
  service: OpenClawUiService,
  agentId: string,
  options: {
    sessionRef: string;
    projectPath: string;
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
          projectPath?: string;
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
        projectPath: options.projectPath,
        userMessage: "",
      },
    );

    if (!prepared.enabled || !prepared.info) {
      throw new Error("Session preparation was disabled.");
    }
    return prepared.info;
  }

  throw new Error(
    "Project session preparation is unavailable. Restart the UI server after updating dependencies.",
  );
}

export async function ensureDefaultOrganizationWorkspace(
  service: OpenClawUiService,
  logs: UiLogBuffer,
): Promise<void> {
  try {
    const organizationPath = path.resolve(
      service.getHomeDir(),
      DEFAULT_ORGANIZATION_PROJECT_DIRNAME,
    );
    await mkdir(organizationPath, { recursive: true });

    const sessions = await service.listSessions(DEFAULT_AGENT_ID);
    const normalizedOrganizationPath = normalizeComparableProjectPath(organizationPath);
    const existingProjectSession = sessions.find((session) => {
      return (
        session.sessionKey.startsWith("project:") &&
        normalizeComparableProjectPath(session.projectPath) === normalizedOrganizationPath
      );
    });
    const hasOrganizationWorkspaceSession = sessions.some((session) => {
      return (
        session.sessionKey.startsWith("workspace:") &&
        normalizeComparableProjectPath(session.projectPath) === normalizedOrganizationPath
      );
    });

    if (existingProjectSession) {
      const hasExpectedProjectName =
        existingProjectSession.title.trim() === DEFAULT_ORGANIZATION_PROJECT_NAME;
      if (!hasExpectedProjectName) {
        await renameUiSession(
          service,
          DEFAULT_AGENT_ID,
          DEFAULT_ORGANIZATION_PROJECT_NAME,
          existingProjectSession.sessionKey,
        );
      }
    } else {
      const projectSessionRef = buildProjectSessionRef(
        DEFAULT_ORGANIZATION_PROJECT_NAME,
        organizationPath,
      );
      await prepareProjectSession(service, DEFAULT_AGENT_ID, {
        sessionRef: projectSessionRef,
        projectPath: organizationPath,
        forceNew: false,
      });
      await renameUiSession(
        service,
        DEFAULT_AGENT_ID,
        DEFAULT_ORGANIZATION_PROJECT_NAME,
        projectSessionRef,
      );
    }

    if (!hasOrganizationWorkspaceSession) {
      const workspaceSessionRef = buildWorkspaceSessionRef(
        DEFAULT_ORGANIZATION_PROJECT_NAME,
        organizationPath,
      );
      await prepareProjectSession(service, DEFAULT_AGENT_ID, {
        sessionRef: workspaceSessionRef,
        projectPath: organizationPath,
        forceNew: true,
      });
      await renameUiSession(
        service,
        DEFAULT_AGENT_ID,
        resolveDefaultWorkspaceSessionTitle(),
        workspaceSessionRef,
      );
    }
  } catch (error) {
    logs.append({
      timestamp: new Date().toISOString(),
      level: "warn",
      source: "opengoat",
      message:
        error instanceof Error
          ? `Default Organization workspace setup skipped: ${error.message}`
          : "Default Organization workspace setup skipped.",
    });
  }
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
    projectPath?: string;
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
      cwd: options.projectPath,
      images: options.images,
      ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
      ...(options.hooks ? { hooks: options.hooks } : {}),
      ...(options.onStdout ? { onStdout: options.onStdout } : {}),
      ...(options.onStderr ? { onStderr: options.onStderr } : {}),
    });
  }

  throw new Error("Session messaging is unavailable on this runtime.");
}

export async function resolveSessionProjectPathForRequest(
  service: OpenClawUiService,
  agentId: string,
  sessionRef: string,
  requestedProjectPath: string | undefined,
): Promise<string | undefined> {
  const explicitPath = normalizeOptionalAbsolutePath(requestedProjectPath);
  if (explicitPath) {
    return explicitPath;
  }

  const storedProjectPath = await resolveStoredSessionProjectPath(
    service,
    agentId,
    sessionRef,
  );
  if (storedProjectPath) {
    return storedProjectPath;
  }

  const organizationPath = resolveAbsolutePath(
    path.join(service.getHomeDir(), DEFAULT_ORGANIZATION_PROJECT_DIRNAME),
  );
  const organizationStats = await stat(organizationPath).catch(() => {
    return null;
  });
  if (organizationStats?.isDirectory()) {
    return organizationPath;
  }

  const homePath = resolveAbsolutePath(service.getHomeDir());
  const homeStats = await stat(homePath).catch(() => {
    return null;
  });
  if (homeStats?.isDirectory()) {
    return homePath;
  }

  return undefined;
}

async function resolveStoredSessionProjectPath(
  service: OpenClawUiService,
  agentId: string,
  sessionRef: string,
): Promise<string | undefined> {
  const normalizedSessionRef = sessionRef.trim();
  if (!normalizedSessionRef) {
    return undefined;
  }

  try {
    const sessions = await service.listSessions(agentId);
    const matchingSession = sessions.find((session) => {
      return (
        session.sessionKey === normalizedSessionRef ||
        session.sessionId === normalizedSessionRef
      );
    });
    return normalizeOptionalAbsolutePath(matchingSession?.projectPath);
  } catch {
    return undefined;
  }
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

export function normalizeComparableProjectPath(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }
  const resolved = resolveAbsolutePath(trimmed);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
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

export function normalizeOptionalAbsolutePath(
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return resolveAbsolutePath(trimmed);
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
  const agentIds = new Set(agents.map((agent) => agent.id));

  return Promise.all(
    agents.map(async (agent) => {
      const fallbackReportsTo =
        agent.id === DEFAULT_AGENT_ID ? null : DEFAULT_AGENT_ID;
      const fallbackType: OrganizationAgent["type"] =
        agent.id === DEFAULT_AGENT_ID ? "manager" : "individual";

      try {
        const configPath = path.resolve(agent.internalConfigDir, "config.json");
        const raw = await readFile(configPath, "utf8");
        const parsed = JSON.parse(raw) as {
          role?: string;
          organization?: {
            reportsTo?: string | null;
            type?: string;
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

        return {
          ...agent,
          reportsTo,
          type,
          role,
        };
      } catch {
        return {
          ...agent,
          reportsTo: fallbackReportsTo,
          type: fallbackType,
          role: undefined,
        };
      }
    }),
  );
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

function normalizeTypeValue(
  rawType: string | undefined,
  fallback: OrganizationAgent["type"],
): OrganizationAgent["type"] {
  const normalized = rawType?.trim().toLowerCase();
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
