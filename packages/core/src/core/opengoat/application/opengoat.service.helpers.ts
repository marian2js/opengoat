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

export function resolveInProgressTimeoutMinutes(
  value: number | undefined,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 4 * 60;
  }
  return Math.floor(value);
}

const DEFAULT_MAX_PARALLEL_FLOWS = 3;
const MIN_MAX_PARALLEL_FLOWS = 1;
const MAX_MAX_PARALLEL_FLOWS = 32;
const DEFAULT_TOP_DOWN_OPEN_TASKS_THRESHOLD = 5;
const MIN_TOP_DOWN_OPEN_TASKS_THRESHOLD = 0;
const MAX_TOP_DOWN_OPEN_TASKS_THRESHOLD = 10_000;

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
  value: "all-managers" | "goat-only" | "ceo-only" | undefined,
): "all-managers" | "goat-only" {
  return value === "goat-only" || value === "ceo-only"
    ? "goat-only"
    : "all-managers";
}

export interface BottomUpTaskDelegationStrategyConfig {
  enabled?: boolean;
  inactiveMinutes?: number;
  notificationTarget?: "all-managers" | "goat-only" | "ceo-only";
}

export interface TopDownTaskDelegationStrategyConfig {
  enabled?: boolean;
  openTasksThreshold?: number;
}

export interface TaskDelegationStrategiesConfig {
  topDown?: TopDownTaskDelegationStrategyConfig;
  bottomUp?: BottomUpTaskDelegationStrategyConfig;
}

export interface ResolvedTopDownTaskDelegationStrategy {
  enabled: boolean;
  openTasksThreshold: number;
}

export interface ResolvedBottomUpTaskDelegationStrategy {
  enabled: boolean;
  inactiveMinutes: number;
  notificationTarget: "all-managers" | "goat-only";
}

export function resolveTopDownOpenTasksThreshold(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_TOP_DOWN_OPEN_TASKS_THRESHOLD;
  }

  const normalized = Math.floor(value);
  if (normalized < MIN_TOP_DOWN_OPEN_TASKS_THRESHOLD) {
    return MIN_TOP_DOWN_OPEN_TASKS_THRESHOLD;
  }
  if (normalized > MAX_TOP_DOWN_OPEN_TASKS_THRESHOLD) {
    return MAX_TOP_DOWN_OPEN_TASKS_THRESHOLD;
  }
  return normalized;
}

export function resolveTopDownTaskDelegationStrategy(options: {
  delegationStrategies?: TaskDelegationStrategiesConfig;
}): ResolvedTopDownTaskDelegationStrategy {
  const topDownConfig = options.delegationStrategies?.topDown;
  const enabled =
    typeof topDownConfig?.enabled === "boolean" ? topDownConfig.enabled : true;

  return {
    enabled,
    openTasksThreshold: resolveTopDownOpenTasksThreshold(
      topDownConfig?.openTasksThreshold,
    ),
  };
}

export function resolveBottomUpTaskDelegationStrategy(options: {
  inactiveMinutes?: number;
  notificationTarget?: "all-managers" | "goat-only" | "ceo-only";
  notifyInactiveAgents?: boolean;
  delegationStrategies?: TaskDelegationStrategiesConfig;
}): ResolvedBottomUpTaskDelegationStrategy {
  const bottomUpConfig = options.delegationStrategies?.bottomUp;
  const bottomUpEnabled = bottomUpConfig?.enabled;
  const enabled = typeof bottomUpEnabled === "boolean"
    ? bottomUpEnabled
    : typeof options.notifyInactiveAgents === "boolean"
      ? options.notifyInactiveAgents
      : false;

  return {
    enabled,
    inactiveMinutes: resolveInactiveMinutes(
      bottomUpConfig?.inactiveMinutes ?? options.inactiveMinutes,
    ),
    notificationTarget: resolveInactiveAgentNotificationTarget(
      bottomUpConfig?.notificationTarget ?? options.notificationTarget,
    ),
  };
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

export function buildTaskSessionRef(agentId: string, _taskId: string): string {
  return buildNotificationSessionRef(agentId);
}

export function buildInactiveSessionRef(
  managerAgentId: string,
  _subjectAgentId: string,
): string {
  return buildNotificationSessionRef(managerAgentId);
}

export function buildNotificationSessionRef(agentId: string): string {
  const normalizedAgentId = normalizeAgentId(agentId) || DEFAULT_AGENT_ID;
  return `agent:${normalizedAgentId}:agent_${normalizedAgentId}_notifications`;
}

export function buildTodoTaskMessage(params: {
  task: TaskRecord;
  notificationTimestamp?: string;
}): string {
  const statusUpdateReminder = "Make sure the task status is updated";
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
  const notificationTimestamp = resolveNotificationTimestamp(
    params.notificationTimestamp,
  );

  return [
    `Task #${params.task.taskId} is assigned to you and currently in TODO. Please work on it now.`,
    ...(notificationTimestamp
      ? [`Notification timestamp: ${notificationTimestamp}`]
      : []),
    "",
    `Task ID: ${params.task.taskId}`,
    `Title: ${params.task.title}`,
    `Description: ${params.task.description}`,
    `Status: ${params.task.status}`,
    `Owner: @${params.task.owner}`,
    `Assigned to: @${params.task.assignedTo}`,
    `Created at: ${params.task.createdAt}`,
    `Blockers: ${blockers}`,
    "Artifacts:",
    artifacts,
    "Worklog:",
    worklog,
    "",
    statusUpdateReminder,
  ].join("\n");
}

export function buildPendingTaskMessage(params: {
  task: TaskRecord;
  pendingMinutes: number;
  notificationTimestamp?: string;
}): string {
  const statusUpdateReminder = "Make sure the task status is updated";
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
  const notificationTimestamp = resolveNotificationTimestamp(
    params.notificationTimestamp,
  );

  return [
    `Task #${params.task.taskId} is still in PENDING after ${params.pendingMinutes} minutes.`,
    ...(notificationTimestamp
      ? [`Notification timestamp: ${notificationTimestamp}`]
      : []),
    "Please continue working on it or update the task status if needed.",
    "",
    `Task ID: ${params.task.taskId}`,
    `Title: ${params.task.title}`,
    `Description: ${params.task.description}`,
    `Status: ${params.task.status}`,
    `Owner: @${params.task.owner}`,
    `Assigned to: @${params.task.assignedTo}`,
    `Created at: ${params.task.createdAt}`,
    `Reason: ${params.task.statusReason ?? "n/a"}`,
    `Blockers: ${blockers}`,
    "Artifacts:",
    artifacts,
    "Worklog:",
    worklog,
    "",
    statusUpdateReminder,
  ].join("\n");
}

export function buildDoingTaskMessage(params: {
  task: TaskRecord;
  doingMinutes: number;
  notificationTimestamp?: string;
}): string {
  const statusUpdateReminder = "Make sure the task status is updated";
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
  const notificationTimestamp = resolveNotificationTimestamp(
    params.notificationTimestamp,
  );

  return [
    `Task #${params.task.taskId} is still in progress after ${params.doingMinutes} minutes.`,
    ...(notificationTimestamp
      ? [`Notification timestamp: ${notificationTimestamp}`]
      : []),
    "Please continue working on it or update the task status if needed.",
    "",
    `Task ID: ${params.task.taskId}`,
    `Title: ${params.task.title}`,
    `Description: ${params.task.description}`,
    `Status: ${params.task.status}`,
    `Owner: @${params.task.owner}`,
    `Assigned to: @${params.task.assignedTo}`,
    `Created at: ${params.task.createdAt}`,
    `Blockers: ${blockers}`,
    "Artifacts:",
    artifacts,
    "Worklog:",
    worklog,
    "",
    statusUpdateReminder,
  ].join("\n");
}

export function buildBlockedTaskMessage(params: {
  task: TaskRecord;
  notificationTimestamp?: string;
}): string {
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
  const notificationTimestamp = resolveNotificationTimestamp(
    params.notificationTimestamp,
  );

  return [
    `Task #${params.task.taskId}, assigned to your reportee "@${params.task.assignedTo}" is blocked because of ${blockerReason}. Help unblocking it.`,
    ...(notificationTimestamp
      ? [`Notification timestamp: ${notificationTimestamp}`]
      : []),
    "",
    `Task ID: ${params.task.taskId}`,
    `Title: ${params.task.title}`,
    `Description: ${params.task.description}`,
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

export function buildTopDownTaskDelegationMessage(params: {
  openTasksThreshold: number;
  openTasksCount: number;
  totalAgents: number;
  managerAgents: number;
  ceoDirectReportees: number;
  openTasks: Array<{
    taskId: string;
    title: string;
    status: string;
    assignedTo: string;
  }>;
  notificationTimestamp?: string;
}): string {
  const notificationTimestamp = resolveNotificationTimestamp(
    params.notificationTimestamp,
  );
  const openTasksPreview = params.openTasks.slice(0, 8);
  const statusCounts = new Map<string, number>();
  for (const task of params.openTasks) {
    const key = task.status.trim().toLowerCase() || "unknown";
    statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1);
  }
  const statusSummary =
    statusCounts.size === 0
      ? "none"
      : [...statusCounts.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([status, count]) => `${status}:${count}`)
          .join(", ");

  const lines = [
    `Open tasks are at ${params.openTasksCount}, which is at or below the Top-Down threshold (${params.openTasksThreshold}).`,
    ...(notificationTimestamp
      ? [`Notification timestamp: ${notificationTimestamp}`]
      : []),
    `Organization context: ${params.totalAgents} total agents, ${params.managerAgents} managers, ${params.ceoDirectReportees} direct Goat reportees.`,
    `Open task status distribution: ${statusSummary}.`,
    "",
    "Goat guidance for creating next tasks:",
    "1. Review current project status and near-term objectives before creating work.",
    "2. Keep decisions aligned with MISSION, VISION, and STRATEGY.",
    "3. Prioritize high-value, low-effort tasks when possible.",
    "4. Match task size to organization capacity: larger teams can absorb broader scopes, smaller teams need tighter scopes.",
    "5. Delegate realistically to reportees; tag reportees who should decompose work and pass it down.",
    "6. Balance long-term direction with short-term deliverables that can be completed now.",
    "",
    "Open tasks snapshot:",
    ...(openTasksPreview.length === 0
      ? ["- none"]
      : openTasksPreview.map(
          (task) =>
            `- ${task.taskId} [${task.status}] @${task.assignedTo}: ${task.title}`,
        )),
    ...(params.openTasks.length > openTasksPreview.length
      ? [`- ...and ${params.openTasks.length - openTasksPreview.length} more`]
      : []),
    "",
    "Create and assign the next set of practical, high-impact tasks now.",
  ];

  return lines.join("\n");
}

export function buildInactiveAgentMessage(params: {
  managerAgentId: string;
  subjectAgentId: string;
  subjectName: string;
  role: string;
  directReporteesCount: number;
  indirectReporteesCount: number;
  inactiveMinutes: number;
  notificationTimestamp?: string;
  lastActionTimestamp?: number;
}): string {
  return buildInactiveAgentsMessage({
    inactiveMinutes: params.inactiveMinutes,
    notificationTimestamp: params.notificationTimestamp,
    candidates: [
      {
        subjectAgentId: params.subjectAgentId,
        subjectName: params.subjectName,
        role: params.role,
        directReporteesCount: params.directReporteesCount,
        indirectReporteesCount: params.indirectReporteesCount,
        lastActionTimestamp: params.lastActionTimestamp,
      },
    ],
  });
}

export function buildInactiveAgentsMessage(params: {
  inactiveMinutes: number;
  notificationTimestamp?: string;
  candidates: Array<{
    subjectAgentId: string;
    subjectName: string;
    role: string;
    directReporteesCount: number;
    indirectReporteesCount: number;
    lastActionTimestamp?: number;
  }>;
}): string {
  const notificationTimestamp = resolveNotificationTimestamp(
    params.notificationTimestamp,
  );
  const candidates = [...params.candidates].sort((left, right) =>
    left.subjectAgentId.localeCompare(right.subjectAgentId),
  );
  if (candidates.length === 0) {
    return [
      `No inactive reportees were found in the last ${params.inactiveMinutes} minutes.`,
      ...(notificationTimestamp
        ? [`Notification timestamp: ${notificationTimestamp}`]
        : []),
    ].join("\n");
  }

  if (candidates.length === 1) {
    const candidate = candidates[0]!;
    const subjectName = candidate.subjectName || `@${candidate.subjectAgentId}`;
    const lastAction =
      typeof candidate.lastActionTimestamp === "number" &&
      Number.isFinite(candidate.lastActionTimestamp)
        ? new Date(candidate.lastActionTimestamp).toISOString()
        : null;

    return [
      `Your reportee "@${candidate.subjectAgentId}" (${candidate.subjectName}) has no activity in the last ${params.inactiveMinutes} minutes.`,
      ...(notificationTimestamp
        ? [`Notification timestamp: ${notificationTimestamp}`]
        : []),
      ...(candidate.role ? [`Role: ${candidate.role}`] : []),
      `${subjectName} has ${candidate.directReporteesCount} direct and ${candidate.indirectReporteesCount} indirect reportees.`,
      ...(lastAction ? [`Last action: ${lastAction}`] : []),
      "Please check in and unblock progress.",
    ].join("\n");
  }

  const lines = [
    `You have ${candidates.length} reportees with no activity in the last ${params.inactiveMinutes} minutes.`,
    ...(notificationTimestamp
      ? [`Notification timestamp: ${notificationTimestamp}`]
      : []),
    "Inactive reportees:",
  ];
  for (const candidate of candidates) {
    const lastAction =
      typeof candidate.lastActionTimestamp === "number" &&
      Number.isFinite(candidate.lastActionTimestamp)
        ? new Date(candidate.lastActionTimestamp).toISOString()
        : "none recorded";
    const role = candidate.role?.trim()
      ? candidate.role.trim()
      : "unspecified";
    lines.push(
      `- "@${candidate.subjectAgentId}" (${candidate.subjectName || "Unnamed"}) | Role: ${role} | Reportees: ${candidate.directReporteesCount} direct, ${candidate.indirectReporteesCount} indirect | Last action: ${lastAction}`,
    );
  }
  lines.push("Please check in and unblock progress.");
  return lines.join("\n");
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

function resolveNotificationTimestamp(
  value: string | undefined,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
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
