import { homedir } from "node:os";
import path from "node:path";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../domain/agent-id.js";
import type { TaskRecord } from "../../boards/index.js";

export type OpenClawAgentPathEntry = {
  id: string;
  workspace: string;
  agentDir: string;
};

type AgentReportNode = {
  agentId: string;
  metadata: {
    reportsTo: string | null;
  };
};

type ReporteeGraph = Map<string, string[]>;

export function containsAlreadyExistsMessage(
  stdout: string,
  stderr: string,
): boolean {
  const text = `${stdout}\n${stderr}`.toLowerCase();
  return /\balready exists?\b/.test(text);
}

export function containsAgentNotFoundMessage(
  stdout: string,
  stderr: string,
): boolean {
  const text = `${stdout}\n${stderr}`.toLowerCase();
  return /\b(not found|does not exist|no such agent|unknown agent|could not find|no agent found|not exist)\b/.test(
    text,
  );
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function resolveInactiveMinutes(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 30;
  }
  return Math.floor(value);
}

const DEFAULT_MAX_PARALLEL_FLOWS = 3;
const MIN_MAX_PARALLEL_FLOWS = 1;
const MAX_MAX_PARALLEL_FLOWS = 32;

export function resolveMaxParallelFlows(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MAX_PARALLEL_FLOWS;
  }

  const normalized = Math.floor(value);
  if (normalized < MIN_MAX_PARALLEL_FLOWS) {
    return MIN_MAX_PARALLEL_FLOWS;
  }
  if (normalized > MAX_MAX_PARALLEL_FLOWS) {
    return MAX_MAX_PARALLEL_FLOWS;
  }
  return normalized;
}

export function resolveInactiveAgentNotificationTarget(
  value: "all-managers" | "ceo-only" | undefined,
): "all-managers" | "ceo-only" {
  return value === "ceo-only" ? "ceo-only" : "all-managers";
}

export function extractManagedSkillsDir(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as { managedSkillsDir?: unknown };
  if (typeof record.managedSkillsDir !== "string") {
    return null;
  }

  const managedSkillsDir = record.managedSkillsDir.trim();
  return managedSkillsDir || null;
}

export function extractOpenClawAgents(payload: unknown): OpenClawAgentPathEntry[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const entries: OpenClawAgentPathEntry[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const record = entry as {
      id?: unknown;
      workspace?: unknown;
      agentDir?: unknown;
    };
    const id = normalizeAgentId(String(record.id ?? ""));
    if (!id) {
      continue;
    }
    entries.push({
      id,
      workspace: typeof record.workspace === "string" ? record.workspace : "",
      agentDir: typeof record.agentDir === "string" ? record.agentDir : "",
    });
  }

  return entries;
}

export function extractOpenClawAgentEntry(
  payload: unknown,
  agentId: string,
): { workspace: string; agentDir: string } | null {
  const normalizedAgentId = normalizeAgentId(agentId);
  if (!normalizedAgentId) {
    return null;
  }

  for (const entry of extractOpenClawAgents(payload)) {
    if (entry.id !== normalizedAgentId) {
      continue;
    }
    return {
      workspace: entry.workspace,
      agentDir: entry.agentDir,
    };
  }

  return null;
}

export function pathMatches(left: string, right: string): boolean {
  const leftNormalized = normalizePathForCompare(left);
  const rightNormalized = normalizePathForCompare(right);
  if (!leftNormalized || !rightNormalized) {
    return false;
  }
  return leftNormalized === rightNormalized;
}

export function pathIsWithin(containerPath: string, candidatePath: string): boolean {
  const normalizedContainer = normalizePathForCompare(containerPath);
  const normalizedCandidate = normalizePathForCompare(candidatePath);
  if (!normalizedContainer || !normalizedCandidate) {
    return false;
  }
  const relative = path.relative(normalizedContainer, normalizedCandidate);
  if (!relative) {
    return true;
  }
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function normalizePathForCompare(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const resolved = path.resolve(trimmed);
  if (process.platform === "win32") {
    return resolved.toLowerCase();
  }
  return resolved;
}

export function buildTaskSessionRef(agentId: string, taskId: string): string {
  const normalizedAgentId = normalizeAgentId(agentId) || DEFAULT_AGENT_ID;
  const normalizedTaskId = normalizeAgentId(taskId) || "task";
  return `agent:${normalizedAgentId}:agent_${normalizedAgentId}_task_${normalizedTaskId}`;
}

export function buildInactiveSessionRef(
  managerAgentId: string,
  subjectAgentId: string,
): string {
  const manager = normalizeAgentId(managerAgentId) || DEFAULT_AGENT_ID;
  const subject = normalizeAgentId(subjectAgentId) || "agent";
  return `agent:${manager}:agent_${manager}_inactive_${subject}`;
}

export function buildTodoTaskMessage(params: { task: TaskRecord }): string {
  const blockers =
    params.task.blockers.length > 0 ? params.task.blockers.join("; ") : "None";
  const artifacts =
    params.task.artifacts.length > 0
      ? params.task.artifacts
          .map(
            (entry) =>
              `- ${entry.createdAt} @${entry.createdBy}: ${entry.content}`,
          )
          .join("\n")
      : "- None";
  const worklog =
    params.task.worklog.length > 0
      ? params.task.worklog
          .map(
            (entry) =>
              `- ${entry.createdAt} @${entry.createdBy}: ${entry.content}`,
          )
          .join("\n")
      : "- None";

  return [
    `Task #${params.task.taskId} is assigned to you and currently in TODO. Please work on it now.`,
    "",
    `Task ID: ${params.task.taskId}`,
    `Title: ${params.task.title}`,
    `Description: ${params.task.description}`,
    `Project: ${params.task.project}`,
    `Status: ${params.task.status}`,
    `Owner: @${params.task.owner}`,
    `Assigned to: @${params.task.assignedTo}`,
    `Created at: ${params.task.createdAt}`,
    `Blockers: ${blockers}`,
    "Artifacts:",
    artifacts,
    "Worklog:",
    worklog,
  ].join("\n");
}

export function buildBlockedTaskMessage(params: { task: TaskRecord }): string {
  const blockerReason =
    params.task.blockers.length > 0
      ? params.task.blockers.join("; ")
      : params.task.statusReason?.trim() || "no blocker details were provided";
  const artifacts =
    params.task.artifacts.length > 0
      ? params.task.artifacts
          .map(
            (entry) =>
              `- ${entry.createdAt} @${entry.createdBy}: ${entry.content}`,
          )
          .join("\n")
      : "- None";
  const worklog =
    params.task.worklog.length > 0
      ? params.task.worklog
          .map(
            (entry) =>
              `- ${entry.createdAt} @${entry.createdBy}: ${entry.content}`,
          )
          .join("\n")
      : "- None";

  return [
    `Task #${params.task.taskId}, assigned to your reportee "@${params.task.assignedTo}" is blocked because of ${blockerReason}. Help unblocking it.`,
    "",
    `Task ID: ${params.task.taskId}`,
    `Title: ${params.task.title}`,
    `Description: ${params.task.description}`,
    `Project: ${params.task.project}`,
    `Status: ${params.task.status}`,
    `Owner: @${params.task.owner}`,
    `Assigned to: @${params.task.assignedTo}`,
    `Created at: ${params.task.createdAt}`,
    "Artifacts:",
    artifacts,
    "Worklog:",
    worklog,
  ].join("\n");
}

export function buildInactiveAgentMessage(params: {
  managerAgentId: string;
  subjectAgentId: string;
  subjectName: string;
  role: string;
  directReporteesCount: number;
  indirectReporteesCount: number;
  inactiveMinutes: number;
  lastActionTimestamp?: number;
}): string {
  const lastAction =
    typeof params.lastActionTimestamp === "number" &&
    Number.isFinite(params.lastActionTimestamp)
      ? new Date(params.lastActionTimestamp).toISOString()
      : null;
  return [
    `Your reportee "@${params.subjectAgentId}" (${params.subjectName}) has no activity in the last ${params.inactiveMinutes} minutes.`,
    ...(params.role ? [`Role: ${params.role}`] : []),
    `${
      params.subjectName || `@${params.subjectAgentId}`
    } has ${params.directReporteesCount} direct and ${params.indirectReporteesCount} indirect reportees.`,
    ...(lastAction ? [`Last action: ${lastAction}`] : []),
    "Please check in and unblock progress.",
  ].join("\n");
}

export function buildReporteeStats(manifests: AgentReportNode[]): {
  directByManager: Map<string, number>;
  totalByManager: Map<string, number>;
} {
  const graph = buildReporteeGraph(manifests);
  const directByManager = new Map<string, number>();
  for (const [managerAgentId, directReportees] of graph.entries()) {
    directByManager.set(managerAgentId, directReportees.length);
  }
  const totalByManager = buildTotalReporteeCountByManager(graph);
  return {
    directByManager,
    totalByManager,
  };
}

function buildReporteeGraph(manifests: AgentReportNode[]): ReporteeGraph {
  const graph: ReporteeGraph = new Map();
  for (const manifest of manifests) {
    const reportsTo = manifest.metadata.reportsTo;
    if (!reportsTo) {
      continue;
    }
    const reportees = graph.get(reportsTo) ?? [];
    reportees.push(manifest.agentId);
    graph.set(reportsTo, reportees);
  }

  for (const [managerAgentId, reportees] of graph.entries()) {
    graph.set(
      managerAgentId,
      [...reportees].sort((left, right) => left.localeCompare(right)),
    );
  }
  return graph;
}

function buildTotalReporteeCountByManager(
  graph: ReporteeGraph,
): Map<string, number> {
  const descendantsByManager = new Map<string, Set<string>>();
  const inProgress = new Set<string>();

  const resolveDescendants = (managerAgentId: string): Set<string> => {
    const cached = descendantsByManager.get(managerAgentId);
    if (cached) {
      return cached;
    }
    if (inProgress.has(managerAgentId)) {
      return new Set();
    }

    inProgress.add(managerAgentId);
    const descendants = new Set<string>();
    for (const reporteeAgentId of graph.get(managerAgentId) ?? []) {
      descendants.add(reporteeAgentId);
      const reporteeDescendants = resolveDescendants(reporteeAgentId);
      for (const descendantAgentId of reporteeDescendants) {
        descendants.add(descendantAgentId);
      }
    }
    inProgress.delete(managerAgentId);
    descendantsByManager.set(managerAgentId, descendants);
    return descendants;
  };

  const totalByManager = new Map<string, number>();
  for (const managerAgentId of graph.keys()) {
    totalByManager.set(
      managerAgentId,
      resolveDescendants(managerAgentId).size,
    );
  }
  return totalByManager;
}

export function assertAgentExists(
  manifests: AgentReportNode[],
  agentId: string,
): void {
  if (manifests.some((manifest) => manifest.agentId === agentId)) {
    return;
  }
  throw new Error(`Agent "${agentId}" does not exist.`);
}

export function collectAllReportees(
  manifests: AgentReportNode[],
  managerAgentId: string,
): string[] {
  const graph = buildReporteeGraph(manifests);
  const visited = new Set<string>();
  const queue = [...(graph.get(managerAgentId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current === managerAgentId || visited.has(current)) {
      continue;
    }
    visited.add(current);
    queue.push(...(graph.get(current) ?? []));
  }

  return [...visited].sort((left, right) => left.localeCompare(right));
}

export function prepareOpenClawCommandEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const mergedPath = dedupePathEntries([
    ...resolvePreferredOpenClawCommandPaths(env),
    ...(env.PATH?.split(path.delimiter) ?? []),
  ]);

  return {
    ...env,
    PATH: mergedPath.join(path.delimiter),
  };
}

function resolvePreferredOpenClawCommandPaths(
  env: NodeJS.ProcessEnv,
): string[] {
  const homeDir = homedir();
  const preferredPaths: string[] = [
    path.dirname(process.execPath),
    path.join(homeDir, ".npm-global", "bin"),
    path.join(homeDir, ".npm", "bin"),
    path.join(homeDir, ".local", "bin"),
    path.join(homeDir, ".volta", "bin"),
    path.join(homeDir, ".fnm", "current", "bin"),
    path.join(homeDir, ".asdf", "shims"),
    path.join(homeDir, "bin"),
  ];

  const npmPrefixCandidates = dedupePathEntries([
    env.npm_config_prefix ?? "",
    env.NPM_CONFIG_PREFIX ?? "",
    process.env.npm_config_prefix ?? "",
    process.env.NPM_CONFIG_PREFIX ?? "",
  ]);
  for (const prefix of npmPrefixCandidates) {
    preferredPaths.push(path.join(prefix, "bin"));
  }

  if (process.platform === "darwin") {
    preferredPaths.push(
      "/opt/homebrew/bin",
      "/opt/homebrew/opt/node@22/bin",
      "/usr/local/opt/node@22/bin",
    );
  }

  return preferredPaths;
}

function dedupePathEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    deduped.push(trimmed);
  }
  return deduped;
}

export function isSpawnPermissionOrMissing(
  error: unknown,
): error is NodeJS.ErrnoException {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;
  return code === "EACCES" || code === "ENOENT";
}
