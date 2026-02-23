import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { resolveAgentAvatarSource } from "@/lib/agent-avatar";
import { cn } from "@/lib/utils";
import {
  AgentProfilePage,
  type AgentProfile,
  type AgentProfileUpdateInput,
} from "@/pages/agents/AgentProfilePage";
import { AgentsPage } from "@/pages/agents/AgentsPage";
import { CreateAgentDialog } from "@/pages/agents/CreateAgentDialog";
import { useCreateAgentDialog } from "@/pages/agents/useCreateAgentDialog";
import {
  FirstRunOnboardingDialog,
  type OpenClawOnboardingGatewayStatus,
} from "@/pages/dashboard/components/FirstRunOnboardingDialog";
import {
  SidebarVersionStatus,
  type SidebarVersionInfo,
} from "@/pages/dashboard/components/SidebarVersionStatus";
import { LogsPage } from "@/pages/logs/LogsPage";
import {
  SettingsPage,
  type InactiveAgentNotificationTarget,
} from "@/pages/settings/SettingsPage";
import { SkillInstallDialog } from "@/pages/skills/SkillInstallDialog";
import { SkillsPage } from "@/pages/skills/SkillsPage";
import type {
  Skill,
  SkillInstallRequest,
  SkillInstallResult,
  SkillRemoveRequest,
  SkillRemoveResult,
  SkillsResponse,
} from "@/pages/skills/types";
import { TasksPage } from "@/pages/tasks/TasksPage";
import {
  formatAbsoluteTime,
  formatRelativeTime,
  resolveTaskUpdatedAt,
  taskStatusLabel,
  taskStatusPillClasses,
} from "@/pages/tasks/utils";
import { WikiPage } from "@/pages/wiki/WikiPage";
import { useWikiPageController } from "@/pages/wiki/useWikiPageController";
import { normalizeWikiPath } from "@/pages/wiki/utils";
import dagre from "@dagrejs/dagre";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import type { ChatStatus, FileUIPart } from "ai";
import {
  BookOpen,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Home,
  MessageSquare,
  MoreHorizontal,
  PackagePlus,
  Plus,
  Settings,
  Sparkles,
  TerminalSquare,
  UsersRound,
  X,
} from "lucide-react";
import type {
  ComponentType,
  DragEvent,
  KeyboardEvent,
  ReactElement,
} from "react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

type PageView =
  | "overview"
  | "tasks"
  | "agents"
  | "skills"
  | "wiki"
  | "logs"
  | "settings";

type AppRoute =
  | {
      kind: "page";
      view: PageView;
      wikiPath?: string;
    }
  | {
      kind: "agent";
      agentId: string;
    }
  | {
      kind: "taskWorkspace";
      taskWorkspaceId: string;
      taskId?: string;
    }
  | {
      kind: "session";
      sessionId: string;
    };

interface HealthResponse {
  ok: boolean;
  mode: "development" | "production";
  homeDir: string;
  timestamp: string;
}

interface Agent {
  id: string;
  displayName: string;
  workspaceDir: string;
  internalConfigDir: string;
  reportsTo: string | null;
  type: "manager" | "individual" | "unknown";
  role?: string;
  providerId: string;
  supportsReportees: boolean;
}

interface Session {
  sessionKey: string;
  sessionId: string;
  title: string;
  updatedAt: number;
  transcriptPath: string;
  workspacePath: string;
  inputChars: number;
  outputChars: number;
  totalChars: number;
  compactionCount: number;
}

interface OverviewResponse {
  agents: Agent[];
  providers: UiProviderOption[];
  totals: {
    agents: number;
  };
}

interface UiProviderOption {
  id: string;
  displayName: string;
  supportsReportees: boolean;
}

interface SessionsResponse {
  agentId: string;
  sessions: Session[];
}

interface TaskEntry {
  createdAt: string;
  createdBy: string;
  content: string;
}

interface TaskRecord {
  taskId: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  assignedTo: string;
  title: string;
  description: string;
  status: "todo" | "doing" | "blocked" | "done" | string;
  statusReason?: string;
  blockers: string[];
  artifacts: TaskEntry[];
  worklog: TaskEntry[];
}

interface TaskWorkspaceRecord {
  taskWorkspaceId: string;
  title: string;
  createdAt: string;
  owner: string;
  tasks: TaskRecord[];
}

interface TaskWorkspacesResponse {
  taskWorkspaces: TaskWorkspaceRecord[];
}

interface TasksResponse {
  tasks: TaskRecord[];
}

interface UiSettings {
  taskCronEnabled: boolean;
  maxInProgressMinutes: number;
  maxParallelFlows: number;
  taskDelegationStrategies: UiTaskDelegationStrategies;
  authentication: UiAuthenticationSettings;
  ceoBootstrapPending: boolean;
}

interface UiBottomUpTaskDelegationStrategy {
  enabled: boolean;
  maxInactivityMinutes: number;
  inactiveAgentNotificationTarget: InactiveAgentNotificationTarget;
}

interface UiTopDownTaskDelegationStrategy {
  enabled: boolean;
  openTasksThreshold: number;
}

interface UiTaskDelegationStrategies {
  topDown: UiTopDownTaskDelegationStrategy;
  bottomUp: UiBottomUpTaskDelegationStrategy;
}

interface UiAuthenticationSettings {
  enabled: boolean;
  username: string;
  hasPassword: boolean;
}

interface UiAuthenticationStatusResponse {
  authentication: {
    enabled: boolean;
    authenticated: boolean;
  };
}

interface OpenClawOnboardingResponse {
  onboarding: {
    shouldShow: boolean;
    hasCeoAgent: boolean;
    ceoBootstrapPending: boolean;
    gateway: OpenClawOnboardingGatewayStatus;
  };
}

type UiVersionInfo = SidebarVersionInfo;

interface DashboardState {
  health: HealthResponse;
  overview: OverviewResponse;
  sessions: SessionsResponse;
  agentSkills: SkillsResponse;
  globalSkills: SkillsResponse;
  taskWorkspaces: TaskWorkspacesResponse;
  settings: UiSettings;
}

interface SidebarAgentSessionItem {
  agentId: string;
  sessionId: string;
  sessionKey: string;
  title: string;
  updatedAt: number;
}

interface WorkspaceSessionResponse {
  agentId: string;
  session: {
    sessionKey: string;
    sessionId: string;
  };
  summary?: {
    title: string;
  };
  message?: string;
}

interface SessionRemoveResponse {
  removedSession?: {
    sessionRef: string;
  };
  message?: string;
}

interface SessionRenameResponse {
  session?: {
    name: string;
    sessionRef: string;
  };
  message?: string;
}

interface SessionSendMessageResponse {
  agentId: string;
  sessionRef: string;
  output: string;
  result: {
    code: number;
    stdout: string;
    stderr: string;
  };
  message?: string;
}

type SessionMessageProgressPhase =
  | "queued"
  | "run_started"
  | "provider_invocation_started"
  | "provider_invocation_completed"
  | "run_completed"
  | "stdout"
  | "stderr"
  | "heartbeat";

interface SessionMessageProgressStreamEvent {
  type: "progress";
  phase: SessionMessageProgressPhase;
  timestamp: string;
  message: string;
}

interface SessionMessageResultStreamEvent {
  type: "result";
  agentId: string;
  sessionRef: string;
  output: string;
  result: {
    code: number;
    stdout: string;
    stderr: string;
  };
  message?: string;
}

interface SessionMessageErrorStreamEvent {
  type: "error";
  timestamp: string;
  error: string;
}

type SessionMessageStreamEvent =
  | SessionMessageProgressStreamEvent
  | SessionMessageResultStreamEvent
  | SessionMessageErrorStreamEvent;

interface SessionReasoningEvent {
  id: string;
  level: "info" | "stdout" | "stderr";
  message: string;
  timestamp: string;
}

interface SessionHistoryResponse {
  agentId: string;
  sessionRef: string;
  history: {
    messages: Array<{
      type: "message" | "compaction";
      role?: "user" | "assistant" | "system";
      content: string;
      timestamp: number;
    }>;
  };
}

interface SessionMessageImageInput {
  dataUrl?: string;
  mediaType?: string;
  name?: string;
}

type UiLogLevel = "info" | "warn" | "error";
type UiLogSource = "opengoat" | "openclaw";

interface UiLogEntry {
  id: number;
  timestamp: string;
  level: UiLogLevel;
  source: UiLogSource;
  message: string;
}

interface UiLogsSnapshotEvent {
  type: "snapshot";
  entries: UiLogEntry[];
}

interface UiLogsLineEvent {
  type: "log";
  entry: UiLogEntry;
}

interface UiLogsHeartbeatEvent {
  type: "heartbeat";
  timestamp: string;
}

interface UiLogsErrorEvent {
  type: "error";
  timestamp: string;
  error: string;
}

type UiLogsStreamEvent =
  | UiLogsSnapshotEvent
  | UiLogsLineEvent
  | UiLogsHeartbeatEvent
  | UiLogsErrorEvent;

interface SessionChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface SidebarItem {
  id: PageView;
  label: string;
  icon: ComponentType<{ className?: string }>;
  hiddenInSidebar?: boolean;
}

interface MetricCard {
  id: string;
  label: string;
  value: number;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}

interface TaskCreateDraft {
  title: string;
  description: string;
  assignedTo: string;
  status: "todo" | "doing" | "pending" | "blocked" | "done";
}

interface TaskEntryDraft {
  kind: "blocker" | "artifact" | "worklog";
  content: string;
}

interface OrgHierarchy {
  agentsById: Map<string, Agent>;
  childrenById: Map<string, string[]>;
  roots: string[];
}

interface OrgNodeData {
  [key: string]: unknown;
  agentId: string;
  displayName: string;
  agentType: Agent["type"];
  providerId: string;
  providerLabel: string;
  role?: string;
  directReports: number;
  totalReports: number;
  collapsed: boolean;
  onToggle: (agentId: string) => void;
}

const NODE_WIDTH = 260;
const NODE_HEIGHT = 108;
const DEFAULT_AGENT_ID = "ceo";
const DEFAULT_TOP_DOWN_OPEN_TASKS_THRESHOLD = 5;
const DEFAULT_MAX_INACTIVITY_MINUTES = 30;
const DEFAULT_MAX_IN_PROGRESS_MINUTES = 4 * 60;
const DEFAULT_MAX_PARALLEL_FLOWS = 3;
const TASK_CRON_INTERVAL_MINUTES = 1;
const MIN_TOP_DOWN_OPEN_TASKS_THRESHOLD = 0;
const MAX_TOP_DOWN_OPEN_TASKS_THRESHOLD = 10_000;
const MIN_MAX_INACTIVITY_MINUTES = 1;
const MAX_MAX_INACTIVITY_MINUTES = 10_080;
const MIN_MAX_IN_PROGRESS_MINUTES = 1;
const MAX_MAX_IN_PROGRESS_MINUTES = 10_080;
const MIN_MAX_PARALLEL_FLOWS = 1;
const MAX_MAX_PARALLEL_FLOWS = 32;
const DEFAULT_LOG_STREAM_LIMIT = 300;
const MAX_UI_LOG_ENTRIES = 1200;
const LOG_FLUSH_INTERVAL_MS = 100;
const LOG_AUTOSCROLL_BOTTOM_THRESHOLD_PX = 24;
const TASK_AUTO_REFRESH_INTERVAL_MS = 10_000;
const TASK_AUTO_REFRESH_HIDDEN_INTERVAL_MS = 30_000;
const MAX_VISIBLE_CEO_AGENT_SESSIONS = 5;
const MAX_VISIBLE_NON_CEO_AGENT_SESSIONS = 2;
const MAX_SESSION_MESSAGE_IMAGE_COUNT = 8;
const MAX_SESSION_MESSAGE_IMAGE_BYTES = 10 * 1024 * 1024;
const SIDEBAR_AGENT_ORDER_STORAGE_KEY =
  "opengoat:dashboard:sidebar-agent-order";
const FIRST_RUN_ONBOARDING_DISMISSED_STORAGE_KEY_PREFIX =
  "opengoat:dashboard:first-run-onboarding:dismissed:";
const TASK_STATUS_OPTIONS = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "In progress" },
  { value: "pending", label: "Pending" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
] as const;

function defaultAuthenticationSettings(): UiAuthenticationSettings {
  return {
    enabled: false,
    username: "",
    hasPassword: false,
  };
}

function defaultUiSettings(): UiSettings {
  return {
    taskCronEnabled: true,
    maxInProgressMinutes: DEFAULT_MAX_IN_PROGRESS_MINUTES,
    maxParallelFlows: DEFAULT_MAX_PARALLEL_FLOWS,
    taskDelegationStrategies: defaultTaskDelegationStrategies(),
    authentication: defaultAuthenticationSettings(),
    ceoBootstrapPending: false,
  };
}

function defaultTaskDelegationStrategies(): UiTaskDelegationStrategies {
  return {
    topDown: {
      enabled: true,
      openTasksThreshold: DEFAULT_TOP_DOWN_OPEN_TASKS_THRESHOLD,
    },
    bottomUp: {
      enabled: false,
      maxInactivityMinutes: DEFAULT_MAX_INACTIVITY_MINUTES,
      inactiveAgentNotificationTarget: "all-managers",
    },
  };
}

function resolveTopDownOpenTasksThresholdValue(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number.parseInt(value, 10)
      : Number.NaN;
  if (!Number.isInteger(parsed) || !Number.isFinite(parsed)) {
    return DEFAULT_TOP_DOWN_OPEN_TASKS_THRESHOLD;
  }
  if (parsed < MIN_TOP_DOWN_OPEN_TASKS_THRESHOLD) {
    return MIN_TOP_DOWN_OPEN_TASKS_THRESHOLD;
  }
  if (parsed > MAX_TOP_DOWN_OPEN_TASKS_THRESHOLD) {
    return MAX_TOP_DOWN_OPEN_TASKS_THRESHOLD;
  }
  return parsed;
}

function resolveMaxInactivityMinutesValue(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number.parseInt(value, 10)
      : Number.NaN;
  if (!Number.isInteger(parsed) || !Number.isFinite(parsed)) {
    return DEFAULT_MAX_INACTIVITY_MINUTES;
  }
  if (parsed < MIN_MAX_INACTIVITY_MINUTES) {
    return MIN_MAX_INACTIVITY_MINUTES;
  }
  if (parsed > MAX_MAX_INACTIVITY_MINUTES) {
    return MAX_MAX_INACTIVITY_MINUTES;
  }
  return parsed;
}

function resolveMaxParallelFlowsValue(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number.parseInt(value, 10)
      : Number.NaN;
  if (!Number.isInteger(parsed) || !Number.isFinite(parsed)) {
    return DEFAULT_MAX_PARALLEL_FLOWS;
  }
  if (parsed < MIN_MAX_PARALLEL_FLOWS) {
    return MIN_MAX_PARALLEL_FLOWS;
  }
  if (parsed > MAX_MAX_PARALLEL_FLOWS) {
    return MAX_MAX_PARALLEL_FLOWS;
  }
  return parsed;
}

function resolveMaxInProgressMinutesValue(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number.parseInt(value, 10)
      : Number.NaN;
  if (!Number.isInteger(parsed) || !Number.isFinite(parsed)) {
    return DEFAULT_MAX_IN_PROGRESS_MINUTES;
  }
  if (parsed < MIN_MAX_IN_PROGRESS_MINUTES) {
    return MIN_MAX_IN_PROGRESS_MINUTES;
  }
  if (parsed > MAX_MAX_IN_PROGRESS_MINUTES) {
    return MAX_MAX_IN_PROGRESS_MINUTES;
  }
  return parsed;
}

function resolveInactiveAgentNotificationTarget(
  value: unknown,
): InactiveAgentNotificationTarget {
  if (value === "all-managers" || value === "ceo-only") {
    return value;
  }
  return defaultTaskDelegationStrategies().bottomUp
    .inactiveAgentNotificationTarget;
}

function normalizeAuthenticationSettings(
  value: unknown,
): UiAuthenticationSettings {
  if (!value || typeof value !== "object") {
    return defaultAuthenticationSettings();
  }

  const raw = value as {
    enabled?: unknown;
    username?: unknown;
    hasPassword?: unknown;
  };
  return {
    enabled: raw.enabled === true,
    username: typeof raw.username === "string" ? raw.username : "",
    hasPassword: raw.hasPassword === true,
  };
}

function normalizeUiSettings(
  settings: Partial<UiSettings> | null | undefined,
): UiSettings {
  const defaults = defaultUiSettings();
  const raw = (settings ?? {}) as Partial<UiSettings> & {
    notifyManagersOfInactiveAgents?: unknown;
    maxInactivityMinutes?: unknown;
    inactiveAgentNotificationTarget?: unknown;
    taskDelegationStrategies?: {
      topDown?: {
        enabled?: unknown;
        openTasksThreshold?: unknown;
      };
      bottomUp?: {
        enabled?: unknown;
        maxInactivityMinutes?: unknown;
        inactiveAgentNotificationTarget?: unknown;
      };
    };
  };

  const rawTopDown = raw.taskDelegationStrategies?.topDown;
  const rawTopDownEnabled =
    typeof rawTopDown?.enabled === "boolean" ? rawTopDown.enabled : undefined;
  const rawTopDownOpenTasksThreshold = rawTopDown?.openTasksThreshold;
  const rawBottomUp = raw.taskDelegationStrategies?.bottomUp;
  const rawBottomUpEnabled =
    typeof rawBottomUp?.enabled === "boolean" ? rawBottomUp.enabled : undefined;
  const rawBottomUpMaxInactivityMinutes = rawBottomUp?.maxInactivityMinutes;
  const rawBottomUpNotificationTarget =
    rawBottomUp?.inactiveAgentNotificationTarget;
  const legacyBottomUpEnabled =
    typeof raw.notifyManagersOfInactiveAgents === "boolean"
      ? raw.notifyManagersOfInactiveAgents
      : undefined;
  const legacyBottomUpMaxInactivityMinutes = raw.maxInactivityMinutes;
  const legacyBottomUpNotificationTarget = raw.inactiveAgentNotificationTarget;

  const bottomUpEnabled =
    rawBottomUpEnabled ??
    legacyBottomUpEnabled ??
    defaults.taskDelegationStrategies.bottomUp.enabled;
  const topDownEnabled =
    rawTopDownEnabled ?? defaults.taskDelegationStrategies.topDown.enabled;
  const topDownOpenTasksThreshold = resolveTopDownOpenTasksThresholdValue(
    rawTopDownOpenTasksThreshold,
  );
  const bottomUpMaxInactivityMinutes = resolveMaxInactivityMinutesValue(
    rawBottomUpMaxInactivityMinutes ?? legacyBottomUpMaxInactivityMinutes,
  );
  const bottomUpInactiveAgentNotificationTarget =
    resolveInactiveAgentNotificationTarget(
      rawBottomUpNotificationTarget ?? legacyBottomUpNotificationTarget,
    );

  return {
    taskCronEnabled:
      typeof raw.taskCronEnabled === "boolean"
        ? raw.taskCronEnabled
        : defaults.taskCronEnabled,
    maxInProgressMinutes: resolveMaxInProgressMinutesValue(
      raw.maxInProgressMinutes,
    ),
    maxParallelFlows: resolveMaxParallelFlowsValue(raw.maxParallelFlows),
    taskDelegationStrategies: {
      topDown: {
        enabled: topDownEnabled,
        openTasksThreshold: topDownOpenTasksThreshold,
      },
      bottomUp: {
        enabled: bottomUpEnabled,
        maxInactivityMinutes: bottomUpMaxInactivityMinutes,
        inactiveAgentNotificationTarget:
          bottomUpInactiveAgentNotificationTarget,
      },
    },
    authentication: normalizeAuthenticationSettings(raw.authentication),
    ceoBootstrapPending:
      typeof raw.ceoBootstrapPending === "boolean"
        ? raw.ceoBootstrapPending
        : defaults.ceoBootstrapPending,
  };
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "tasks", label: "Tasks", icon: Boxes },
  { id: "agents", label: "Agents", icon: UsersRound },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "wiki", label: "Wiki", icon: BookOpen },
  { id: "logs", label: "Logs", icon: TerminalSquare },
];

type OrgChartNode = Node<OrgNodeData, "orgNode">;

const orgChartNodeTypes = {
  orgNode: OrganizationChartNode,
} satisfies NodeTypes;

function SessionPromptAttachmentStrip({
  disabled,
}: {
  disabled: boolean;
}): ReactElement | null {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 border-border/70 border-b px-2 pt-2 pb-1">
      {attachments.files.map((file) => (
        <div key={file.id} className="w-20">
          <div className="group relative overflow-hidden rounded-md border border-border/70 bg-muted/40">
            <img
              alt={file.filename || "Attached image"}
              className="h-20 w-20 object-cover"
              src={file.url}
            />
            <Button
              aria-label={`Remove ${file.filename || "image"}`}
              className="absolute top-1 right-1 h-5 w-5 rounded-full p-0 opacity-95"
              disabled={disabled}
              onClick={() => {
                attachments.remove(file.id);
              }}
              size="icon-sm"
              type="button"
              variant="secondary"
            >
              <X className="size-3" />
            </Button>
          </div>
          <p className="mt-1 truncate text-muted-foreground text-xs">
            {file.filename || "image"}
          </p>
        </div>
      ))}
    </div>
  );
}

function SessionPromptAttachButton({
  disabled,
}: {
  disabled: boolean;
}): ReactElement {
  const attachments = usePromptInputAttachments();
  const isAtLimit = attachments.files.length >= MAX_SESSION_MESSAGE_IMAGE_COUNT;

  return (
    <Button
      aria-label="Attach images"
      className="h-8 w-8 text-muted-foreground"
      disabled={disabled || isAtLimit}
      onClick={() => {
        attachments.openFileDialog();
      }}
      size="icon-sm"
      title={
        isAtLimit
          ? `Maximum ${MAX_SESSION_MESSAGE_IMAGE_COUNT} images per message.`
          : "Attach images"
      }
      type="button"
      variant="ghost"
    >
      <Plus className="size-4" />
    </Button>
  );
}

function SessionPromptDropOverlay(): ReactElement {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary/60 bg-primary/10">
      <div className="rounded-full bg-background/90 px-4 py-2 text-center shadow-sm">
        <p className="font-medium text-sm text-foreground">Drop images here</p>
        <p className="text-muted-foreground text-xs">PNG, JPG, WebP and more</p>
      </div>
    </div>
  );
}

export function DashboardPage(): ReactElement {
  const [route, setRoute] = useState<AppRoute>(() => getInitialRoute());
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [state, setState] = useState<DashboardState | null>(null);
  const [isAuthenticationEnabled, setAuthenticationEnabled] = useState(false);
  const [isAuthenticated, setAuthenticated] = useState(true);
  const [isAuthChecking, setAuthChecking] = useState(true);
  const [isAuthenticating, setAuthenticating] = useState(false);
  const [authLoginUsername, setAuthLoginUsername] = useState("");
  const [authLoginPassword, setAuthLoginPassword] = useState("");
  const [authLoginError, setAuthLoginError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setMutating] = useState(false);
  const [openSessionMenuId, setOpenSessionMenuId] = useState<string | null>(
    null,
  );
  const [expandedAgentSessionIds, setExpandedAgentSessionIds] = useState<
    Set<string>
  >(() => new Set());
  const [sidebarAgentOrderIds, setSidebarAgentOrderIds] = useState<string[]>(
    () => loadSidebarAgentOrder(),
  );
  const [draggingSidebarAgentId, setDraggingSidebarAgentId] = useState<
    string | null
  >(null);
  const [sidebarDropTarget, setSidebarDropTarget] = useState<{
    agentId: string;
    position: "before" | "after";
  } | null>(null);
  const [selectedSessionRefByAgentId, setSelectedSessionRefByAgentId] =
    useState<Record<string, string>>({});
  const [sessionsByAgentId, setSessionsByAgentId] = useState<
    Record<string, Session[]>
  >({});
  const [skillsByAgentId, setSkillsByAgentId] = useState<
    Record<string, Skill[]>
  >({});
  const [skillInstallDialogState, setSkillInstallDialogState] = useState<{
    open: boolean;
    scope: "agent" | "global";
    agentId: string;
  }>({
    open: false,
    scope: "agent",
    agentId: DEFAULT_AGENT_ID,
  });
  const [agentProfileRefreshNonceById, setAgentProfileRefreshNonceById] =
    useState<Record<string, number>>({});
  const [sessionChatStatus, setSessionChatStatus] =
    useState<ChatStatus>("ready");
  const [isSessionPromptDragActive, setSessionPromptDragActive] =
    useState(false);
  const [sessionMessagesById, setSessionMessagesById] = useState<
    Record<string, SessionChatMessage[]>
  >({});
  const [sessionReasoningById, setSessionReasoningById] = useState<
    Record<string, SessionReasoningEvent[]>
  >({});
  const sessionPromptDragDepthRef = useRef(0);
  const hydratedSessionIdsRef = useRef<Set<string>>(new Set());
  const attemptedSessionFetchAgentIdsRef = useRef<Set<string>>(new Set());
  const activeSessionRunAbortControllerRef = useRef<AbortController | null>(
    null,
  );
  const [taskActorId, setTaskActorId] = useState("ceo");
  const [taskDraftByWorkspaceId, setTaskDraftByWorkspaceId] = useState<
    Record<string, TaskCreateDraft>
  >({});
  const [taskStatusDraftById, setTaskStatusDraftById] = useState<
    Record<string, string>
  >({});
  const [selectedTaskIdsByWorkspaceId, setSelectedTaskIdsByWorkspaceId] =
    useState<Record<string, string[]>>({});
  const [isCreateTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);
  const [createTaskDialogError, setCreateTaskDialogError] = useState<
    string | null
  >(null);
  const [maxInactivityMinutesInput, setMaxInactivityMinutesInput] = useState(
    String(DEFAULT_MAX_INACTIVITY_MINUTES),
  );
  const [topDownOpenTasksThresholdInput, setTopDownOpenTasksThresholdInput] =
    useState(String(DEFAULT_TOP_DOWN_OPEN_TASKS_THRESHOLD));
  const [maxInProgressMinutesInput, setMaxInProgressMinutesInput] = useState(
    String(DEFAULT_MAX_IN_PROGRESS_MINUTES),
  );
  const [maxParallelFlowsInput, setMaxParallelFlowsInput] = useState(
    String(DEFAULT_MAX_PARALLEL_FLOWS),
  );
  const [taskCronEnabledInput, setTaskCronEnabledInput] = useState(true);
  const [
    topDownTaskDelegationEnabledInput,
    setTopDownTaskDelegationEnabledInput,
  ] = useState(true);
  const [
    bottomUpTaskDelegationEnabledInput,
    setBottomUpTaskDelegationEnabledInput,
  ] = useState(false);
  const [
    inactiveAgentNotificationTargetInput,
    setInactiveAgentNotificationTargetInput,
  ] = useState<InactiveAgentNotificationTarget>("all-managers");
  const [uiAuthenticationEnabledInput, setUiAuthenticationEnabledInput] =
    useState(false);
  const [uiAuthenticationUsernameInput, setUiAuthenticationUsernameInput] =
    useState("");
  const [uiAuthenticationHasPassword, setUiAuthenticationHasPassword] =
    useState(false);
  const [
    uiAuthenticationCurrentPasswordInput,
    setUiAuthenticationCurrentPasswordInput,
  ] = useState("");
  const [uiAuthenticationPasswordInput, setUiAuthenticationPasswordInput] =
    useState("");
  const [
    uiAuthenticationPasswordConfirmationInput,
    setUiAuthenticationPasswordConfirmationInput,
  ] = useState("");
  const [
    uiAuthenticationPasswordEditorOpen,
    setUiAuthenticationPasswordEditorOpen,
  ] = useState(false);
  const [taskDetailsError, setTaskDetailsError] = useState<string | null>(null);
  const [versionInfo, setVersionInfo] = useState<UiVersionInfo | null>(null);
  const [isVersionLoading, setVersionLoading] = useState(true);
  const [taskEntryDraft, setTaskEntryDraft] = useState<TaskEntryDraft>({
    kind: "worklog",
    content: "",
  });
  const [uiLogs, setUiLogs] = useState<UiLogEntry[]>([]);
  const [logSourceFilters, setLogSourceFilters] = useState<
    Record<UiLogSource, boolean>
  >({
    opengoat: true,
    openclaw: false,
  });
  const [logsConnectionState, setLogsConnectionState] = useState<
    "connecting" | "live" | "offline"
  >("connecting");
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsAutoScrollEnabled, setLogsAutoScrollEnabled] = useState(true);
  const [onboardingDialogOpen, setOnboardingDialogOpen] = useState(false);
  const [onboardingStatus, setOnboardingStatus] =
    useState<OpenClawOnboardingGatewayStatus | null>(null);
  const [onboardingShouldShow, setOnboardingShouldShow] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [onboardingStatusLoading, setOnboardingStatusLoading] = useState(false);
  const [onboardingStatusError, setOnboardingStatusError] = useState<
    string | null
  >(null);
  const logsViewportRef = useRef<HTMLDivElement | null>(null);
  const pendingUiLogsRef = useRef<UiLogEntry[]>([]);
  const logsFlushTimerRef = useRef<number | null>(null);
  const isLoadingRef = useRef(isLoading);
  const isMutatingRef = useRef(isMutating);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    isMutatingRef.current = isMutating;
  }, [isMutating]);

  const navigateToRoute = useCallback((nextRoute: AppRoute) => {
    const nextPath = routeToPath(nextRoute);
    if (
      typeof window !== "undefined" &&
      `${window.location.pathname}${window.location.search}` !== nextPath
    ) {
      window.history.pushState({}, "", nextPath);
    }
    setRoute(nextRoute);
    setOpenSessionMenuId(null);
  }, []);

  const handleViewChange = useCallback(
    (nextView: PageView) => {
      if (nextView === "tasks") {
        navigateToRoute({
          kind: "taskWorkspace",
          taskWorkspaceId: "tasks",
        });
        return;
      }

      if (nextView === "wiki") {
        navigateToRoute({
          kind: "page",
          view: "wiki",
          wikiPath: "",
        });
        return;
      }

      navigateToRoute({
        kind: "page",
        view: nextView,
      });
    },
    [navigateToRoute],
  );

  const handleWikiNavigate = useCallback(
    (wikiPath: string) => {
      navigateToRoute({
        kind: "page",
        view: "wiki",
        wikiPath,
      });
    },
    [navigateToRoute],
  );

  const wikiController = useWikiPageController({
    enabled: route.kind === "page" && route.view === "wiki",
    wikiPath:
      route.kind === "page" && route.view === "wiki"
        ? route.wikiPath
        : undefined,
    onNavigate: handleWikiNavigate,
    onAuthRequired: dispatchAuthRequiredEvent,
  });

  const refreshAuthenticationStatus = useCallback(async (): Promise<void> => {
    setAuthChecking(true);
    setAuthLoginError(null);
    try {
      const payload = await fetchJson<UiAuthenticationStatusResponse>(
        "/api/auth/status",
      );
      setAuthenticationEnabled(payload.authentication.enabled);
      setAuthenticated(payload.authentication.authenticated);
    } catch (requestError) {
      setAuthenticationEnabled(false);
      setAuthenticated(true);
      setAuthLoginError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to verify UI authentication status.",
      );
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onPopState = (): void => {
      setRoute(parseRoute(window.location.pathname, window.location.search));
      setOpenSessionMenuId(null);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const canonicalPath = routeToPath(route);
    if (
      `${window.location.pathname}${window.location.search}` !== canonicalPath
    ) {
      window.history.replaceState({}, "", canonicalPath);
    }
  }, [route]);

  useEffect(() => {
    setSessionChatStatus("ready");
  }, [route]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        health,
        overview,
        sessions,
        agentSkills,
        globalSkills,
        tasks,
        settings,
      ] = await Promise.all([
        fetchJson<HealthResponse>("/api/health"),
        fetchJson<OverviewResponse>("/api/openclaw/overview"),
        fetchJson<SessionsResponse>(
          `/api/sessions?agentId=${encodeURIComponent(DEFAULT_AGENT_ID)}`,
        ),
        fetchJson<SkillsResponse>(
          `/api/skills?agentId=${encodeURIComponent(DEFAULT_AGENT_ID)}`,
        ),
        fetchJson<SkillsResponse>("/api/skills?global=true"),
        fetchJson<TasksResponse>("/api/tasks").catch(() => {
          return { tasks: [] } satisfies TasksResponse;
        }),
        fetchJson<{ settings: UiSettings }>("/api/settings")
          .then((payload) => payload.settings)
          .catch(() => {
            return defaultUiSettings();
          }),
      ]);

      const normalizedSettings = normalizeUiSettings(settings);

      setState({
        health,
        overview,
        sessions,
        agentSkills,
        globalSkills,
        taskWorkspaces: buildTaskWorkspaceResponse(tasks),
        settings: normalizedSettings,
      });
      setTaskCronEnabledInput(normalizedSettings.taskCronEnabled);
      setTopDownTaskDelegationEnabledInput(
        normalizedSettings.taskDelegationStrategies.topDown.enabled,
      );
      setTopDownOpenTasksThresholdInput(
        String(
          normalizedSettings.taskDelegationStrategies.topDown
            .openTasksThreshold,
        ),
      );
      setMaxInactivityMinutesInput(
        String(
          normalizedSettings.taskDelegationStrategies.bottomUp
            .maxInactivityMinutes,
        ),
      );
      setMaxInProgressMinutesInput(
        String(normalizedSettings.maxInProgressMinutes),
      );
      setMaxParallelFlowsInput(String(normalizedSettings.maxParallelFlows));
      setBottomUpTaskDelegationEnabledInput(
        normalizedSettings.taskDelegationStrategies.bottomUp.enabled,
      );
      setInactiveAgentNotificationTargetInput(
        normalizedSettings.taskDelegationStrategies.bottomUp
          .inactiveAgentNotificationTarget,
      );
      setUiAuthenticationEnabledInput(
        normalizedSettings.authentication.enabled,
      );
      setUiAuthenticationUsernameInput(
        normalizedSettings.authentication.username,
      );
      setUiAuthenticationHasPassword(
        normalizedSettings.authentication.hasPassword,
      );
      attemptedSessionFetchAgentIdsRef.current = new Set([sessions.agentId]);
      setSessionsByAgentId({
        [sessions.agentId]: sessions.sessions,
      });
      setSkillsByAgentId({
        [agentSkills.agentId ?? DEFAULT_AGENT_ID]: agentSkills.skills,
      });
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Failed to load data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshOverview = useCallback(async () => {
    const overview = await fetchJson<OverviewResponse>(
      "/api/openclaw/overview",
    );
    setState((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        overview,
      };
    });
  }, []);

  const loadAgentProfile = useCallback(async (agentId: string) => {
    const response = await fetchJson<{ agent: AgentProfile }>(
      `/api/agents/${encodeURIComponent(agentId)}`,
    );
    return response.agent;
  }, []);

  const saveAgentProfile = useCallback(
    async (agentId: string, payload: AgentProfileUpdateInput) => {
      return fetchJson<{ agent: AgentProfile; message?: string }>(
        `/api/agents/${encodeURIComponent(agentId)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
    },
    [],
  );

  const refreshSessions = useCallback(
    async (agentId: string = DEFAULT_AGENT_ID) => {
      const response = await fetchJson<SessionsResponse>(
        `/api/sessions?agentId=${encodeURIComponent(agentId)}`,
      );
      setSessionsByAgentId((current) => ({
        ...current,
        [response.agentId]: response.sessions,
      }));
      if (response.agentId !== DEFAULT_AGENT_ID) {
        return;
      }

      setState((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          sessions: response,
        };
      });
    },
    [],
  );

  const loadAgentSkills = useCallback(async (agentId: string) => {
    const response = await fetchJson<SkillsResponse>(
      `/api/skills?agentId=${encodeURIComponent(agentId)}`,
    );
    setSkillsByAgentId((current) => ({
      ...current,
      [response.agentId ?? agentId]: response.skills,
    }));
  }, []);

  const refreshGlobalSkills = useCallback(async () => {
    const response = await fetchJson<SkillsResponse>("/api/skills?global=true");
    setState((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        globalSkills: response,
      };
    });
    return response;
  }, []);

  const bumpAgentProfileRefreshNonce = useCallback((agentIds: string[]) => {
    if (agentIds.length === 0) {
      return;
    }
    setAgentProfileRefreshNonceById((current) => {
      const next = { ...current };
      for (const agentId of agentIds) {
        next[agentId] = (next[agentId] ?? 0) + 1;
      }
      return next;
    });
  }, []);

  const openSkillInstallDialog = useCallback(
    (options?: {
      scope?: "agent" | "global";
      agentId?: string;
    }) => {
      const scope = options?.scope === "global" ? "global" : "agent";
      const requestedAgentId = options?.agentId?.trim().toLowerCase();
      setSkillInstallDialogState({
        open: true,
        scope,
        agentId: requestedAgentId || DEFAULT_AGENT_ID,
      });
    },
    [],
  );

  const installSkill = useCallback(
    async (payload: SkillInstallRequest): Promise<SkillInstallResult> => {
      setMutating(true);
      try {
        const response = await fetchJson<{
          result: SkillInstallResult;
          message?: string;
        }>("/api/skills/install", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        await refreshGlobalSkills();
        const affectedAgentIds = new Set<string>([
          ...(response.result.assignedAgentIds ?? []),
        ]);
        if (response.result.agentId) {
          affectedAgentIds.add(response.result.agentId);
        }
        await Promise.all(
          [...affectedAgentIds].map(async (agentId) => {
            await loadAgentSkills(agentId);
          }),
        );
        bumpAgentProfileRefreshNonce([...affectedAgentIds]);

        toast.success(response.message ?? `Installed skill "${response.result.skillId}".`);
        return response.result;
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unable to install skill.";
        toast.error(message);
        throw requestError;
      } finally {
        setMutating(false);
      }
    },
    [bumpAgentProfileRefreshNonce, loadAgentSkills, refreshGlobalSkills],
  );

  const removeSkill = useCallback(
    async (payload: SkillRemoveRequest): Promise<SkillRemoveResult> => {
      setMutating(true);
      try {
        const response = await fetchJson<{
          result: SkillRemoveResult;
          message?: string;
        }>("/api/skills/remove", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        await refreshGlobalSkills();
        const affectedAgentIds = new Set<string>([
          ...(response.result.removedFromAgentIds ?? []),
        ]);
        if (response.result.agentId) {
          affectedAgentIds.add(response.result.agentId);
        }
        await Promise.all(
          [...affectedAgentIds].map(async (agentId) => {
            await loadAgentSkills(agentId);
          }),
        );
        bumpAgentProfileRefreshNonce([...affectedAgentIds]);

        toast.success(response.message ?? `Removed skill "${response.result.skillId}".`);
        return response.result;
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unable to remove skill.";
        toast.error(message);
        throw requestError;
      } finally {
        setMutating(false);
      }
    },
    [bumpAgentProfileRefreshNonce, loadAgentSkills, refreshGlobalSkills],
  );

  const refreshTasks = useCallback(async () => {
    const tasks = await fetchJson<TasksResponse>("/api/tasks");
    setState((current) => {
      if (!current) {
        return current;
      }

      const currentTasks =
        current.taskWorkspaces.taskWorkspaces[0]?.tasks ?? [];
      if (areTaskRecordListsEqual(currentTasks, tasks.tasks)) {
        return current;
      }

      return {
        ...current,
        taskWorkspaces: buildTaskWorkspaceResponse(tasks),
      };
    });
  }, []);

  const loadVersionInfo = useCallback(async () => {
    setVersionLoading(true);
    try {
      const payload = await fetchJson<{ version: UiVersionInfo }>(
        "/api/version",
      );
      setVersionInfo(payload.version);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to check OpenGoat updates.";
      setVersionInfo((current) => {
        if (current) {
          return current;
        }
        return {
          packageName: "opengoat",
          installedVersion: null,
          latestVersion: null,
          updateAvailable: null,
          status: "unknown",
          latestSource: null,
          checkedSources: [],
          checkedAt: new Date().toISOString(),
          error: message,
        };
      });
    } finally {
      setVersionLoading(false);
    }
  }, []);

  const refreshOnboardingStatus = useCallback(async (): Promise<void> => {
    setOnboardingStatusLoading(true);
    setOnboardingStatusError(null);
    try {
      const payload = await fetchJson<OpenClawOnboardingResponse>(
        "/api/openclaw/onboarding",
      );
      setOnboardingShouldShow(payload.onboarding.shouldShow);
      setOnboardingStatus(payload.onboarding.gateway);
      if (!payload.onboarding.shouldShow) {
        setOnboardingDialogOpen(false);
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to check OpenClaw setup status.";
      setOnboardingStatusError(message);
      setOnboardingStatus(null);
    } finally {
      setOnboardingStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuthenticationStatus().catch(() => {
      // handled in refreshAuthenticationStatus
    });
  }, [refreshAuthenticationStatus]);

  useEffect(() => {
    if (isAuthChecking) {
      return;
    }
    if (isAuthenticationEnabled && !isAuthenticated) {
      setState(null);
      setLoading(false);
      setVersionLoading(false);
      return;
    }
    void loadData();
    void loadVersionInfo();
  }, [
    isAuthChecking,
    isAuthenticationEnabled,
    isAuthenticated,
    loadData,
    loadVersionInfo,
  ]);

  const agents = state?.overview.agents ?? [];
  const providers = state?.overview.providers ?? [];
  const onboardingStorageKey = useMemo(() => {
    const homeDir = state?.health.homeDir?.trim();
    return homeDir
      ? `${FIRST_RUN_ONBOARDING_DISMISSED_STORAGE_KEY_PREFIX}${homeDir}`
      : null;
  }, [state?.health.homeDir]);
  const hasLocalCeoAgent = agents.some((agent) => agent.id === DEFAULT_AGENT_ID);
  const shouldShowOnboardingFromLocalState = state
    ? state.settings.ceoBootstrapPending || !hasLocalCeoAgent
    : false;
  const shouldShowOnboardingDialog =
    (onboardingShouldShow || shouldShowOnboardingFromLocalState) &&
    !onboardingDismissed;

  useEffect(() => {
    if (!onboardingStorageKey) {
      setOnboardingDismissed(false);
      return;
    }
    setOnboardingDismissed(loadOnboardingDismissed(onboardingStorageKey));
  }, [onboardingStorageKey]);

  useEffect(() => {
    if (!state?.health.homeDir) {
      return;
    }
    void refreshOnboardingStatus();
  }, [state?.health.homeDir, state?.settings.ceoBootstrapPending, refreshOnboardingStatus]);

  useEffect(() => {
    setOnboardingDialogOpen(shouldShowOnboardingDialog);
  }, [shouldShowOnboardingDialog]);

  useEffect(() => {
    if (agents.length === 0) {
      return;
    }

    for (const agent of agents) {
      if (sessionsByAgentId[agent.id]) {
        continue;
      }
      if (attemptedSessionFetchAgentIdsRef.current.has(agent.id)) {
        continue;
      }
      attemptedSessionFetchAgentIdsRef.current.add(agent.id);
      void refreshSessions(agent.id).catch(() => {
        // Non-fatal: sidebar can still render and start new sessions.
      });
    }
  }, [agents, sessionsByAgentId, refreshSessions]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onAuthRequired = (): void => {
      setAuthenticationEnabled(true);
      setAuthenticated(false);
      setState(null);
      setLoading(false);
      setVersionLoading(false);
      setAuthLoginPassword("");
      setOnboardingDialogOpen(false);
      setOnboardingShouldShow(false);
      setOnboardingStatus(null);
      setOnboardingStatusError(null);
    };
    window.addEventListener("opengoat:auth-required", onAuthRequired);
    return () => {
      window.removeEventListener("opengoat:auth-required", onAuthRequired);
    };
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }

    const agentIds = state.overview.agents.map((agent) => agent.id);
    if (agentIds.length === 0) {
      return;
    }

    const hasTaskActor = agentIds.includes(taskActorId);
    if (!hasTaskActor) {
      setTaskActorId(agentIds[0] ?? "ceo");
    }
  }, [state, taskActorId]);
  const createAgentRequest = useCallback(
    async (payload: {
      name: string;
      reportsTo: string;
      role?: string;
      providerId: string;
    }) => {
      return fetchJson<{ message?: string }>("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    },
    [],
  );
  const createAgentDialog = useCreateAgentDialog({
    agents,
    providers,
    setMutating,
    createAgent: createAgentRequest,
    onCreated: refreshOverview,
  });
  const dismissOnboardingDialog = useCallback(() => {
    setOnboardingDialogOpen(false);
    setOnboardingDismissed(true);
    if (onboardingStorageKey) {
      persistOnboardingDismissed(onboardingStorageKey, true);
    }
  }, [onboardingStorageKey]);
  const hasLoadedState = state !== null;
  const ceoBootstrapPending = state?.settings.ceoBootstrapPending ?? false;
  const taskCronRunning =
    (state?.settings.taskCronEnabled ?? taskCronEnabledInput) &&
    !ceoBootstrapPending;
  const sessions = state?.sessions.sessions ?? [];
  const sessionsById = useMemo(() => {
    const map = new Map<
      string,
      {
        agentId: string;
        session: Session;
      }
    >();

    for (const [agentId, agentSessions] of Object.entries(sessionsByAgentId)) {
      for (const session of agentSessions) {
        map.set(session.sessionId, {
          agentId,
          session,
        });
      }
    }

    return map;
  }, [sessionsByAgentId]);
  const selectedSessionRouteEntry = useMemo(() => {
    if (route.kind !== "session") {
      return null;
    }
    return sessionsById.get(route.sessionId) ?? null;
  }, [route, sessionsById]);
  const selectedSession = selectedSessionRouteEntry?.session ?? null;
  const selectedSessionAgentId = selectedSessionRouteEntry?.agentId ?? null;
  const selectedAgent = useMemo(() => {
    if (route.kind !== "agent") {
      return null;
    }
    return agents.find((agent) => agent.id === route.agentId) ?? null;
  }, [route, agents]);
  const defaultSidebarAgentIds = useMemo(() => {
    if (agents.length === 0) {
      return [];
    }

    const ceo = agents.find((agent) => agent.id === DEFAULT_AGENT_ID) ?? null;
    const others = agents
      .filter((agent) => agent.id !== DEFAULT_AGENT_ID)
      .sort((left, right) =>
        left.displayName.localeCompare(right.displayName, undefined, {
          sensitivity: "base",
        }),
      );

    return (ceo ? [ceo, ...others] : others).map((agent) => agent.id);
  }, [agents]);
  const sortedSidebarAgents = useMemo(() => {
    if (agents.length === 0) {
      return [];
    }

    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    const ordered: Agent[] = [];
    const seen = new Set<string>();

    for (const agentId of sidebarAgentOrderIds) {
      const agent = agentsById.get(agentId);
      if (!agent || seen.has(agentId)) {
        continue;
      }
      ordered.push(agent);
      seen.add(agentId);
    }

    for (const agentId of defaultSidebarAgentIds) {
      if (seen.has(agentId)) {
        continue;
      }
      const agent = agentsById.get(agentId);
      if (!agent) {
        continue;
      }
      ordered.push(agent);
      seen.add(agentId);
    }

    return ordered;
  }, [agents, sidebarAgentOrderIds, defaultSidebarAgentIds]);

  useEffect(() => {
    if (agents.length === 0) {
      return;
    }

    setSidebarAgentOrderIds((current) => {
      const knownIds = new Set(agents.map((agent) => agent.id));
      const next: string[] = [];

      for (const agentId of current) {
        if (!knownIds.has(agentId) || next.includes(agentId)) {
          continue;
        }
        next.push(agentId);
      }

      for (const agentId of defaultSidebarAgentIds) {
        if (!next.includes(agentId)) {
          next.push(agentId);
        }
      }

      return areStringArraysEqual(current, next) ? current : next;
    });
  }, [agents, defaultSidebarAgentIds]);

  useEffect(() => {
    persistSidebarAgentOrder(sidebarAgentOrderIds);
  }, [sidebarAgentOrderIds]);

  const moveSidebarAgent = useCallback(
    (
      sourceAgentId: string,
      targetAgentId: string,
      position: "before" | "after",
    ) => {
      if (!sourceAgentId || !targetAgentId || sourceAgentId === targetAgentId) {
        return;
      }

      setSidebarAgentOrderIds((current) => {
        const sourceIndex = current.indexOf(sourceAgentId);
        const targetIndex = current.indexOf(targetAgentId);
        if (sourceIndex < 0 || targetIndex < 0) {
          return current;
        }

        const next = current.filter((agentId) => agentId !== sourceAgentId);
        const normalizedTargetIndex = next.indexOf(targetAgentId);
        if (normalizedTargetIndex < 0) {
          return current;
        }

        const nextIndex =
          position === "before"
            ? normalizedTargetIndex
            : normalizedTargetIndex + 1;
        next.splice(nextIndex, 0, sourceAgentId);
        return next;
      });
    },
    [],
  );

  const resolveSidebarDropPosition = useCallback(
    (event: DragEvent<HTMLElement>): "before" | "after" => {
      const rect = event.currentTarget.getBoundingClientRect();
      const pointerY = event.clientY - rect.top;
      if (!Number.isFinite(pointerY) || rect.height <= 0) {
        return "after";
      }
      return pointerY < rect.height / 2 ? "before" : "after";
    },
    [],
  );

  const handleSidebarAgentDragStart = useCallback(
    (agentId: string, event: DragEvent<HTMLElement>) => {
      setDraggingSidebarAgentId(agentId);
      setSidebarDropTarget(null);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", agentId);
    },
    [],
  );

  const handleSidebarAgentDragOver = useCallback(
    (targetAgentId: string, event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";

      const sourceAgentId =
        draggingSidebarAgentId ??
        event.dataTransfer.getData("text/plain").trim();
      if (!sourceAgentId || sourceAgentId === targetAgentId) {
        setSidebarDropTarget(null);
        return;
      }

      const position = resolveSidebarDropPosition(event);
      setSidebarDropTarget((current) => {
        if (
          current?.agentId === targetAgentId &&
          current.position === position
        ) {
          return current;
        }
        return {
          agentId: targetAgentId,
          position,
        };
      });
    },
    [draggingSidebarAgentId, resolveSidebarDropPosition],
  );

  const handleSidebarAgentDrop = useCallback(
    (targetAgentId: string, event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const sourceAgentId =
        draggingSidebarAgentId ??
        event.dataTransfer.getData("text/plain").trim();
      const target = sidebarDropTarget ?? {
        agentId: targetAgentId,
        position: resolveSidebarDropPosition(event),
      };
      moveSidebarAgent(sourceAgentId, target.agentId, target.position);
      setDraggingSidebarAgentId(null);
      setSidebarDropTarget(null);
    },
    [
      draggingSidebarAgentId,
      moveSidebarAgent,
      resolveSidebarDropPosition,
      sidebarDropTarget,
    ],
  );

  const handleSidebarListDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      const sourceAgentId =
        draggingSidebarAgentId ??
        event.dataTransfer.getData("text/plain").trim();
      if (!sourceAgentId) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      const agentRows = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>(
          "[data-sidebar-agent-id]",
        ),
      );

      let nextTarget: { agentId: string; position: "before" | "after" } | null =
        null;
      for (const row of agentRows) {
        const targetAgentId = row.dataset.sidebarAgentId?.trim();
        if (!targetAgentId || targetAgentId === sourceAgentId) {
          continue;
        }

        const rect = row.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        if (event.clientY < midpoint) {
          nextTarget = {
            agentId: targetAgentId,
            position: "before",
          };
          break;
        }

        nextTarget = {
          agentId: targetAgentId,
          position: "after",
        };
      }

      setSidebarDropTarget((current) => {
        if (!nextTarget) {
          return null;
        }
        if (
          current?.agentId === nextTarget.agentId &&
          current.position === nextTarget.position
        ) {
          return current;
        }
        return nextTarget;
      });
    },
    [draggingSidebarAgentId],
  );

  const handleSidebarListDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      const sourceAgentId =
        draggingSidebarAgentId ??
        event.dataTransfer.getData("text/plain").trim();
      if (!sourceAgentId || !sidebarDropTarget) {
        setDraggingSidebarAgentId(null);
        setSidebarDropTarget(null);
        return;
      }

      moveSidebarAgent(
        sourceAgentId,
        sidebarDropTarget.agentId,
        sidebarDropTarget.position,
      );
      setDraggingSidebarAgentId(null);
      setSidebarDropTarget(null);
    },
    [draggingSidebarAgentId, moveSidebarAgent, sidebarDropTarget],
  );

  const handleSidebarAgentDragEnd = useCallback(() => {
    setDraggingSidebarAgentId(null);
    setSidebarDropTarget(null);
  }, []);

  const sidebarSessionsByAgent = useMemo(() => {
    return sortedSidebarAgents.map((agent) => {
      const sortedSessions = sortSessionsByUpdatedAt(
        sessionsByAgentId[agent.id] ?? [],
      );
      const sessions = sortedSessions.map((session) => ({
        agentId: agent.id,
        sessionId: session.sessionId,
        sessionKey: session.sessionKey,
        title: session.title,
        updatedAt: session.updatedAt,
      }));
      return {
        agent,
        sessions,
        visibleLimit:
          agent.id === DEFAULT_AGENT_ID
            ? MAX_VISIBLE_CEO_AGENT_SESSIONS
            : MAX_VISIBLE_NON_CEO_AGENT_SESSIONS,
      };
    });
  }, [sortedSidebarAgents, sessionsByAgentId]);

  const selectedSessionAgent = useMemo(() => {
    if (!selectedSessionAgentId) {
      return null;
    }
    return agents.find((agent) => agent.id === selectedSessionAgentId) ?? null;
  }, [agents, selectedSessionAgentId]);

  const selectedWikiTitle =
    route.kind === "page" && route.view === "wiki"
      ? wikiController.title
      : null;

  const activeChatContext = useMemo(() => {
    if (route.kind === "session" && selectedSession && selectedSessionAgentId) {
      return {
        agentId: selectedSessionAgentId,
        sessionRef: selectedSession.sessionKey,
        chatKey: `session:${selectedSessionAgentId}:${selectedSession.sessionId}`,
        historyRef: selectedSession.sessionKey,
      };
    }

    return null;
  }, [route, selectedSession, selectedSessionAgentId]);

  const sessionMessages = useMemo(() => {
    if (!activeChatContext) {
      return [];
    }
    return sessionMessagesById[activeChatContext.chatKey] ?? [];
  }, [activeChatContext, sessionMessagesById]);

  const sessionReasoningEvents = useMemo(() => {
    if (!activeChatContext) {
      return [];
    }
    return sessionReasoningById[activeChatContext.chatKey] ?? [];
  }, [activeChatContext, sessionReasoningById]);

  const sessionReasoningTranscript = useMemo(() => {
    if (sessionReasoningEvents.length === 0) {
      return "";
    }
    return sessionReasoningEvents
      .map((event) => normalizeReasoningLine(event.message))
      .filter((line, index, allLines) => {
        if (!line) {
          return false;
        }
        return index === 0 || line !== allLines[index - 1];
      })
      .map((line) => `- ${line}`)
      .join("\n");
  }, [sessionReasoningEvents]);

  const lastAssistantMessageIndex = useMemo(() => {
    for (let index = sessionMessages.length - 1; index >= 0; index -= 1) {
      if (sessionMessages[index]?.role === "assistant") {
        return index;
      }
    }
    return -1;
  }, [sessionMessages]);

  const shouldRenderReasoning = useMemo(() => {
    return (
      sessionReasoningEvents.length > 0 || sessionChatStatus === "streaming"
    );
  }, [sessionReasoningEvents.length, sessionChatStatus]);

  const shouldRenderReasoningBeforeAssistant = useMemo(() => {
    return (
      shouldRenderReasoning &&
      sessionChatStatus !== "streaming" &&
      lastAssistantMessageIndex >= 0
    );
  }, [lastAssistantMessageIndex, sessionChatStatus, shouldRenderReasoning]);

  useEffect(() => {
    if (!activeChatContext?.historyRef) {
      return;
    }

    const hydrationKey = `${activeChatContext.agentId}:${activeChatContext.historyRef}`;
    if (hydratedSessionIdsRef.current.has(hydrationKey)) {
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams({
      agentId: activeChatContext.agentId,
      sessionRef: activeChatContext.historyRef,
      limit: "200",
    });

    void fetchJson<SessionHistoryResponse>(
      `/api/sessions/history?${params.toString()}`,
    )
      .then((response) => {
        if (cancelled) {
          return;
        }

        const hydratedMessages = mapHistoryToSessionMessages(
          activeChatContext.chatKey,
          response.history.messages,
        );
        setSessionMessagesById((current) => {
          const existing = current[activeChatContext.chatKey];
          if (existing && existing.length > 0) {
            return current;
          }

          return {
            ...current,
            [activeChatContext.chatKey]: hydratedMessages,
          };
        });
      })
      .catch(() => {
        // Non-fatal: session can still continue from an empty client-side state.
      })
      .finally(() => {
        hydratedSessionIdsRef.current.add(hydrationKey);
      });

    return () => {
      cancelled = true;
    };
  }, [activeChatContext]);

  const taskWorkspaces = state?.taskWorkspaces.taskWorkspaces ?? [];
  const selectedTaskWorkspace = useMemo(() => {
    if (route.kind !== "taskWorkspace") {
      return null;
    }
    return (
      taskWorkspaces.find(
        (taskWorkspace) =>
          taskWorkspace.taskWorkspaceId === route.taskWorkspaceId,
      ) ?? null
    );
  }, [taskWorkspaces, route]);
  const selectedTaskId = useMemo(() => {
    if (route.kind !== "taskWorkspace") {
      return null;
    }
    const taskId = route.taskId?.trim();
    return taskId ? taskId : null;
  }, [route]);
  const selectedTask = useMemo(() => {
    if (!selectedTaskWorkspace || !selectedTaskId) {
      return null;
    }
    return (
      selectedTaskWorkspace.tasks.find(
        (task) => task.taskId === selectedTaskId,
      ) ?? null
    );
  }, [selectedTaskWorkspace, selectedTaskId]);
  const selectedTaskIds = useMemo(() => {
    if (!selectedTaskWorkspace) {
      return [];
    }
    return (
      selectedTaskIdsByWorkspaceId[selectedTaskWorkspace.taskWorkspaceId] ?? []
    );
  }, [selectedTaskIdsByWorkspaceId, selectedTaskWorkspace]);
  const selectedTaskIdSet = useMemo(() => {
    return new Set(selectedTaskIds);
  }, [selectedTaskIds]);
  const allTaskIdsInWorkspace = useMemo(() => {
    if (!selectedTaskWorkspace) {
      return [];
    }
    return selectedTaskWorkspace.tasks.map((task) => task.taskId);
  }, [selectedTaskWorkspace]);
  const allTasksSelected =
    allTaskIdsInWorkspace.length > 0 &&
    selectedTaskIds.length === allTaskIdsInWorkspace.length;
  const hasSelectedTasks = selectedTaskIds.length > 0;
  const hasPartialTaskSelection = hasSelectedTasks && !allTasksSelected;
  const selectAllCheckboxState = hasPartialTaskSelection
    ? "indeterminate"
    : allTasksSelected;
  const selectedTaskActivity = useMemo(() => {
    if (!selectedTask) {
      return [];
    }

    const toTimestamp = (value: string): number => {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    return [
      ...selectedTask.artifacts.map((entry) => ({
        type: "artifact" as const,
        createdAt: entry.createdAt,
        createdBy: entry.createdBy,
        content: entry.content,
      })),
      ...selectedTask.worklog.map((entry) => ({
        type: "worklog" as const,
        createdAt: entry.createdAt,
        createdBy: entry.createdBy,
        content: entry.content,
      })),
    ].sort(
      (left, right) =>
        toTimestamp(right.createdAt) - toTimestamp(left.createdAt),
    );
  }, [selectedTask]);
  const selectedTaskDescription = useMemo(() => {
    if (!selectedTask) {
      return "";
    }
    return decodeEscapedMarkdown(selectedTask.description);
  }, [selectedTask]);
  const selectedTaskUpdatedAt = useMemo(() => {
    if (!selectedTask) {
      return "";
    }
    return resolveTaskUpdatedAt(selectedTask.updatedAt, selectedTask.createdAt);
  }, [selectedTask]);
  const agentById = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const agent of agents) {
      map.set(agent.id, agent);
    }
    return map;
  }, [agents]);

  const getAssignableAgents = useCallback(
    (actorId: string): Agent[] => {
      const actor = agentById.get(actorId);
      if (!actor) {
        return [];
      }

      if (actor.type !== "manager") {
        return [actor];
      }

      const queue = [actor.id];
      const seen = new Set<string>([actor.id]);
      const assignable = [actor];

      while (queue.length > 0) {
        const managerId = queue.shift();
        if (!managerId) {
          continue;
        }

        const directReportees = agents.filter(
          (candidate) => candidate.reportsTo === managerId,
        );
        for (const reportee of directReportees) {
          if (seen.has(reportee.id)) {
            continue;
          }
          seen.add(reportee.id);
          assignable.push(reportee);
          queue.push(reportee.id);
        }
      }

      return assignable;
    },
    [agentById, agents],
  );

  useEffect(() => {
    setExpandedAgentSessionIds((current) => {
      if (current.size === 0) {
        return current;
      }
      const validAgentIds = new Set(agents.map((agent) => agent.id));
      let changed = false;
      const next = new Set<string>();
      for (const agentId of current) {
        if (validAgentIds.has(agentId)) {
          next.add(agentId);
          continue;
        }
        changed = true;
      }
      return changed ? next : current;
    });
  }, [agents]);

  useEffect(() => {
    setSelectedSessionRefByAgentId((current) => {
      const validAgentIds = new Set(agents.map((agent) => agent.id));
      const next: Record<string, string> = {};
      let changed = false;

      for (const [agentId, sessionRef] of Object.entries(current)) {
        if (!validAgentIds.has(agentId)) {
          changed = true;
          continue;
        }

        const sessionsForAgent = sessionsByAgentId[agentId] ?? [];
        const exists = sessionsForAgent.some(
          (session) => session.sessionKey === sessionRef,
        );
        if (exists) {
          next[agentId] = sessionRef;
          continue;
        }
        changed = true;
      }

      if (
        !changed &&
        Object.keys(next).length === Object.keys(current).length
      ) {
        return current;
      }

      return next;
    });
  }, [agents, sessionsByAgentId]);

  useEffect(() => {
    if (route.kind === "taskWorkspace") {
      return;
    }

    setTaskDetailsError(null);
  }, [route]);

  useEffect(() => {
    if (route.kind !== "taskWorkspace" || !hasLoadedState) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;
    let inFlight = false;

    const scheduleNext = (delayMs: number): void => {
      if (cancelled) {
        return;
      }
      timeoutId = window.setTimeout(() => {
        void tick();
      }, delayMs);
    };

    const tick = async (): Promise<void> => {
      if (cancelled) {
        return;
      }

      if (document.visibilityState !== "visible") {
        scheduleNext(TASK_AUTO_REFRESH_HIDDEN_INTERVAL_MS);
        return;
      }

      if (isLoadingRef.current || isMutatingRef.current || inFlight) {
        scheduleNext(TASK_AUTO_REFRESH_INTERVAL_MS);
        return;
      }

      inFlight = true;
      try {
        await refreshTasks();
      } catch {
        // Best-effort background refresh.
      } finally {
        inFlight = false;
        scheduleNext(TASK_AUTO_REFRESH_INTERVAL_MS);
      }
    };

    const handleVisibilityChange = (): void => {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }
      if (isLoadingRef.current || isMutatingRef.current || inFlight) {
        return;
      }
      void refreshTasks().catch(() => {
        // Best-effort background refresh.
      });
    };

    if (
      document.visibilityState === "visible" &&
      !isLoadingRef.current &&
      !isMutatingRef.current
    ) {
      void refreshTasks().catch(() => {
        // Best-effort initial refresh when entering task views.
      });
    }
    scheduleNext(TASK_AUTO_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [route.kind, hasLoadedState, refreshTasks]);

  useEffect(() => {
    if (route.kind !== "taskWorkspace" || !selectedTaskId) {
      return;
    }
    if (!selectedTaskWorkspace || selectedTask) {
      return;
    }

    navigateToRoute({
      kind: "taskWorkspace",
      taskWorkspaceId: route.taskWorkspaceId,
    });
    setTaskDetailsError(null);
    setTaskEntryDraft({
      kind: "worklog",
      content: "",
    });
  }, [
    navigateToRoute,
    route,
    selectedTask,
    selectedTaskId,
    selectedTaskWorkspace,
  ]);

  useEffect(() => {
    setSelectedTaskIdsByWorkspaceId((current) => {
      if (taskWorkspaces.length === 0) {
        return {};
      }

      const next: Record<string, string[]> = {};
      for (const taskWorkspace of taskWorkspaces) {
        const existing = current[taskWorkspace.taskWorkspaceId] ?? [];
        const allowedTaskIds = new Set(
          taskWorkspace.tasks.map((task) => task.taskId),
        );
        const filtered = existing.filter((taskId) =>
          allowedTaskIds.has(taskId),
        );
        if (filtered.length > 0) {
          next[taskWorkspace.taskWorkspaceId] = filtered;
        }
      }

      return next;
    });
  }, [taskWorkspaces]);

  useEffect(() => {
    setTaskDraftByWorkspaceId((current) => {
      if (taskWorkspaces.length === 0) {
        return {};
      }

      const next: Record<string, TaskCreateDraft> = {};
      for (const taskWorkspace of taskWorkspaces) {
        const existing = current[taskWorkspace.taskWorkspaceId];
        const allowed = getAssignableAgents(taskActorId);
        const fallbackAssignee = allowed[0]?.id ?? taskActorId;
        const assignedTo = allowed.some(
          (agent) => agent.id === existing?.assignedTo,
        )
          ? existing?.assignedTo ?? fallbackAssignee
          : fallbackAssignee;

        next[taskWorkspace.taskWorkspaceId] = existing
          ? {
              ...existing,
              assignedTo,
            }
          : {
              title: "",
              description: "",
              assignedTo,
              status: "todo",
            };
      }
      return next;
    });

    setTaskStatusDraftById((current) => {
      const statusByTaskId = new Map<string, string>();
      for (const taskWorkspace of taskWorkspaces) {
        for (const task of taskWorkspace.tasks) {
          statusByTaskId.set(task.taskId, task.status);
        }
      }

      const next: Record<string, string> = {};
      for (const [taskId, status] of statusByTaskId.entries()) {
        next[taskId] = status;
      }
      return next;
    });
  }, [taskWorkspaces, getAssignableAgents, taskActorId]);

  const openTaskCount = useMemo(() => {
    if (!state) {
      return 0;
    }

    let count = 0;
    for (const taskWorkspace of state.taskWorkspaces.taskWorkspaces) {
      for (const task of taskWorkspace.tasks) {
        if (task.status.trim().toLowerCase() !== "done") {
          count += 1;
        }
      }
    }
    return count;
  }, [state]);

  const metrics = useMemo<MetricCard[]>(() => {
    if (!state) {
      return [];
    }

    return [
      {
        id: "agents",
        label: "Agents",
        value: state.overview.totals.agents,
        hint: "Organization members",
        icon: UsersRound,
      },
      {
        id: "sessions",
        label: "CEO Sessions",
        value: state.sessions.sessions.length,
        hint: "Saved conversation contexts",
        icon: Clock3,
      },
      {
        id: "open-tasks",
        label: "Open Tasks",
        value: openTaskCount,
        hint: "Tasks not marked done",
        icon: Boxes,
      },
    ];
  }, [openTaskCount, state]);

  async function handleDeleteAgent(agentId: string): Promise<void> {
    if (agentId === "ceo") {
      return;
    }

    const shouldDelete = window.confirm(`Delete agent \"${agentId}\"?`);
    if (!shouldDelete) {
      return;
    }

    setMutating(true);

    try {
      await fetchJson<{ removed: { existed: boolean } }>(
        `/api/agents/${encodeURIComponent(agentId)}?force=true`,
        {
          method: "DELETE",
        },
      );

      toast.success(`Agent \"${agentId}\" removed.`);
      await refreshOverview();
      if (route.kind === "agent" && route.agentId === agentId) {
        navigateToRoute({
          kind: "page",
          view: "agents",
        });
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete agent.";
      toast.error(message);
    } finally {
      setMutating(false);
    }
  }

  async function handleCreateAgentSession(
    agentId: string,
    options?: {
      navigate?: boolean;
      toastOnSuccess?: boolean;
    },
  ): Promise<void> {
    const agent = agents.find((candidate) => candidate.id === agentId) ?? null;
    const workspaceName = agent?.displayName?.trim() || agentId;
    setMutating(true);
    setOpenSessionMenuId(null);

    try {
      const response = await fetchJson<WorkspaceSessionResponse>(
        "/api/workspaces/session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agentId,
            workspaceName,
          }),
        },
      );

      if (options?.toastOnSuccess ?? true) {
        toast.success(
          response.message ??
            `Session created for \"${agent?.displayName ?? agentId}\".`,
        );
      }

      setSelectedSessionRefByAgentId((current) => ({
        ...current,
        [agentId]: response.session.sessionKey,
      }));
      await refreshSessions(agentId);

      if (options?.navigate ?? true) {
        navigateToRoute({
          kind: "session",
          sessionId: response.session.sessionId,
        });
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to create agent session.";
      toast.error(message);
    } finally {
      setMutating(false);
    }
  }

  async function handleSelectSidebarAgent(agentId: string): Promise<void> {
    const sessions = sortSessionsByUpdatedAt(sessionsByAgentId[agentId] ?? []);
    if (sessions.length === 0) {
      await handleCreateAgentSession(agentId, {
        navigate: true,
        toastOnSuccess: false,
      });
      return;
    }

    const selectedSessionRef = selectedSessionRefByAgentId[agentId];
    const nextSession =
      selectedSessionRef &&
      sessions.some((session) => session.sessionKey === selectedSessionRef)
        ? sessions.find(
            (session) => session.sessionKey === selectedSessionRef,
          ) ?? sessions[0]
        : sessions[0];

    if (nextSession) {
      setSelectedSessionRefByAgentId((current) => ({
        ...current,
        [agentId]: nextSession.sessionKey,
      }));
      navigateToRoute({
        kind: "session",
        sessionId: nextSession.sessionId,
      });
    }
    setOpenSessionMenuId(null);
  }

  function handleSelectAgentSession(session: SidebarAgentSessionItem): void {
    setSelectedSessionRefByAgentId((current) => ({
      ...current,
      [session.agentId]: session.sessionKey,
    }));
    navigateToRoute({
      kind: "session",
      sessionId: session.sessionId,
    });
    setOpenSessionMenuId(null);
  }

  async function handleRemoveSession(
    session: SidebarAgentSessionItem,
  ): Promise<void> {
    const confirmed = window.confirm(`Remove session \"${session.title}\"?`);
    if (!confirmed) {
      return;
    }

    setMutating(true);
    setOpenSessionMenuId(null);

    try {
      const response = await fetchJson<SessionRemoveResponse>(
        "/api/sessions/remove",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agentId: session.agentId,
            sessionRef: session.sessionKey,
          }),
        },
      );

      toast.success(
        response.message ?? `Session \"${session.title}\" removed.`,
      );
      await refreshSessions(session.agentId);
      setSelectedSessionRefByAgentId((current) => {
        if (current[session.agentId] !== session.sessionKey) {
          return current;
        }
        const next = { ...current };
        delete next[session.agentId];
        return next;
      });
      if (route.kind === "session" && route.sessionId === session.sessionId) {
        navigateToRoute({
          kind: "page",
          view: "overview",
        });
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to remove session.";
      toast.error(message);
    } finally {
      setMutating(false);
    }
  }

  async function handleRenameSession(
    session: SidebarAgentSessionItem,
  ): Promise<void> {
    const nextName = window
      .prompt(`Rename session \"${session.title}\"`, session.title)
      ?.trim();
    if (!nextName || nextName === session.title) {
      return;
    }

    setMutating(true);
    setOpenSessionMenuId(null);

    try {
      const response = await fetchJson<SessionRenameResponse>(
        "/api/sessions/rename",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agentId: session.agentId,
            sessionRef: session.sessionKey,
            name: nextName,
          }),
        },
      );

      toast.success(response.message ?? `Session renamed to \"${nextName}\".`);
      await refreshSessions(session.agentId);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to rename session.";
      toast.error(message);
    } finally {
      setMutating(false);
    }
  }

  async function handleSignIn(): Promise<void> {
    const username = authLoginUsername.trim().toLowerCase();
    const password = authLoginPassword;
    if (!username || !password) {
      setAuthLoginError("Username and password are required.");
      return;
    }

    setAuthenticating(true);
    setAuthLoginError(null);
    try {
      const response = await fetchJson<{
        authentication: {
          enabled: boolean;
          authenticated: boolean;
        };
        message?: string;
      }>("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });
      setAuthenticationEnabled(response.authentication.enabled);
      setAuthenticated(response.authentication.authenticated);
      setAuthLoginPassword("");
      setAuthLoginError(null);
      toast.success(response.message ?? "Signed in.");
      await refreshAuthenticationStatus();
    } catch (requestError) {
      setAuthLoginError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to sign in.",
      );
    } finally {
      setAuthenticating(false);
    }
  }

  async function handleSignOut(): Promise<void> {
    setMutating(true);
    try {
      await fetchJson<{ message?: string }>("/api/auth/logout", {
        method: "POST",
      });
      setAuthenticated(false);
      setState(null);
      setLoading(false);
      setVersionLoading(false);
      setAuthLoginPassword("");
      toast.success("Signed out.");
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Unable to sign out.",
      );
    } finally {
      setMutating(false);
    }
  }

  function updateTaskDraft(
    taskWorkspaceId: string,
    patch: Partial<TaskCreateDraft>,
  ): void {
    setTaskDraftByWorkspaceId((current) => {
      const existing = current[taskWorkspaceId] ?? {
        title: "",
        description: "",
        assignedTo: taskActorId,
        status: "todo",
      };
      return {
        ...current,
        [taskWorkspaceId]: {
          ...existing,
          ...patch,
        },
      };
    });
  }

  async function handleSaveSettings(): Promise<void> {
    const normalizedAuthUsername = uiAuthenticationUsernameInput
      .trim()
      .toLowerCase();
    const nextAuthPassword = uiAuthenticationPasswordInput;
    const nextAuthPasswordConfirmation =
      uiAuthenticationPasswordConfirmationInput;
    const hasNewAuthPassword = nextAuthPassword.length > 0;
    const currentAuthenticationSettings =
      state?.settings.authentication ?? defaultAuthenticationSettings();
    const authenticationEnabledChanged =
      currentAuthenticationSettings.enabled !== uiAuthenticationEnabledInput;
    const authenticationUsernameChanged =
      currentAuthenticationSettings.username !== normalizedAuthUsername;
    const authenticationSettingsChanged =
      authenticationEnabledChanged ||
      authenticationUsernameChanged ||
      hasNewAuthPassword;
    const requiresCurrentPassword =
      currentAuthenticationSettings.enabled && authenticationSettingsChanged;

    if (uiAuthenticationEnabledInput && !normalizedAuthUsername) {
      toast.error(
        "Authentication username is required when protection is enabled.",
      );
      return;
    }
    if (
      uiAuthenticationEnabledInput &&
      !currentAuthenticationSettings.hasPassword &&
      !hasNewAuthPassword
    ) {
      toast.error(
        "Set a password before enabling UI authentication protection.",
      );
      return;
    }
    if (
      hasNewAuthPassword &&
      nextAuthPassword !== nextAuthPasswordConfirmation
    ) {
      toast.error("Password confirmation does not match.");
      return;
    }
    if (hasNewAuthPassword) {
      const passwordValidationError =
        validateAuthenticationPasswordStrength(nextAuthPassword);
      if (passwordValidationError) {
        toast.error(passwordValidationError);
        return;
      }
    }
    if (
      requiresCurrentPassword &&
      uiAuthenticationCurrentPasswordInput.trim().length === 0
    ) {
      toast.error(
        "Current password is required to change authentication settings.",
      );
      return;
    }

    const parsedMaxInactivityMinutes = Number.parseInt(
      maxInactivityMinutesInput.trim(),
      10,
    );
    const parsedTopDownOpenTasksThreshold = Number.parseInt(
      topDownOpenTasksThresholdInput.trim(),
      10,
    );
    const parsedMaxInProgressMinutes = Number.parseInt(
      maxInProgressMinutesInput.trim(),
      10,
    );
    const parsedMaxParallelFlows = Number.parseInt(
      maxParallelFlowsInput.trim(),
      10,
    );
    const isMaxInactivityValid =
      Number.isFinite(parsedMaxInactivityMinutes) &&
      parsedMaxInactivityMinutes >= MIN_MAX_INACTIVITY_MINUTES &&
      parsedMaxInactivityMinutes <= MAX_MAX_INACTIVITY_MINUTES;
    const isTopDownOpenTasksThresholdValid =
      Number.isFinite(parsedTopDownOpenTasksThreshold) &&
      parsedTopDownOpenTasksThreshold >= MIN_TOP_DOWN_OPEN_TASKS_THRESHOLD &&
      parsedTopDownOpenTasksThreshold <= MAX_TOP_DOWN_OPEN_TASKS_THRESHOLD;
    const isMaxInProgressValid =
      Number.isFinite(parsedMaxInProgressMinutes) &&
      parsedMaxInProgressMinutes >= MIN_MAX_IN_PROGRESS_MINUTES &&
      parsedMaxInProgressMinutes <= MAX_MAX_IN_PROGRESS_MINUTES;
    const isMaxParallelFlowsValid =
      Number.isFinite(parsedMaxParallelFlows) &&
      parsedMaxParallelFlows >= MIN_MAX_PARALLEL_FLOWS &&
      parsedMaxParallelFlows <= MAX_MAX_PARALLEL_FLOWS;
    if (
      taskCronEnabledInput &&
      topDownTaskDelegationEnabledInput &&
      !isTopDownOpenTasksThresholdValid
    ) {
      toast.error(
        `Top-Down open task threshold must be an integer between ${MIN_TOP_DOWN_OPEN_TASKS_THRESHOLD} and ${MAX_TOP_DOWN_OPEN_TASKS_THRESHOLD}.`,
      );
      return;
    }
    if (
      taskCronEnabledInput &&
      bottomUpTaskDelegationEnabledInput &&
      !isMaxInactivityValid
    ) {
      toast.error(
        `Max inactivity time must be an integer between ${MIN_MAX_INACTIVITY_MINUTES} and ${MAX_MAX_INACTIVITY_MINUTES} minutes.`,
      );
      return;
    }
    if (taskCronEnabledInput && !isMaxParallelFlowsValid) {
      toast.error(
        `Max parallel flows must be an integer between ${MIN_MAX_PARALLEL_FLOWS} and ${MAX_MAX_PARALLEL_FLOWS}.`,
      );
      return;
    }
    if (taskCronEnabledInput && !isMaxInProgressValid) {
      toast.error(
        `In progress timeout must be an integer between ${MIN_MAX_IN_PROGRESS_MINUTES} and ${MAX_MAX_IN_PROGRESS_MINUTES} minutes.`,
      );
      return;
    }
    const fallbackMaxInactivityMinutes =
      state?.settings.taskDelegationStrategies.bottomUp.maxInactivityMinutes ??
      DEFAULT_MAX_INACTIVITY_MINUTES;
    const fallbackTopDownOpenTasksThreshold =
      state?.settings.taskDelegationStrategies.topDown.openTasksThreshold ??
      DEFAULT_TOP_DOWN_OPEN_TASKS_THRESHOLD;
    const fallbackMaxInProgressMinutes =
      state?.settings.maxInProgressMinutes ?? DEFAULT_MAX_IN_PROGRESS_MINUTES;
    const fallbackMaxParallelFlows =
      state?.settings.maxParallelFlows ?? DEFAULT_MAX_PARALLEL_FLOWS;
    const resolvedMaxInactivityMinutes = isMaxInactivityValid
      ? parsedMaxInactivityMinutes
      : fallbackMaxInactivityMinutes;
    const resolvedTopDownOpenTasksThreshold = isTopDownOpenTasksThresholdValid
      ? parsedTopDownOpenTasksThreshold
      : fallbackTopDownOpenTasksThreshold;
    const resolvedMaxParallelFlows = isMaxParallelFlowsValid
      ? parsedMaxParallelFlows
      : fallbackMaxParallelFlows;
    const resolvedMaxInProgressMinutes = isMaxInProgressValid
      ? parsedMaxInProgressMinutes
      : fallbackMaxInProgressMinutes;

    setMutating(true);
    try {
      const settingsPayload: {
        taskCronEnabled: boolean;
        maxInProgressMinutes: number;
        maxParallelFlows: number;
        taskDelegationStrategies: {
          topDown: {
            enabled: boolean;
            openTasksThreshold: number;
          };
          bottomUp: {
            enabled: boolean;
            maxInactivityMinutes: number;
            inactiveAgentNotificationTarget: InactiveAgentNotificationTarget;
          };
        };
        authentication?: {
          enabled: boolean;
          username?: string;
          password?: string;
          currentPassword?: string;
        };
      } = {
        taskCronEnabled: taskCronEnabledInput,
        maxInProgressMinutes: resolvedMaxInProgressMinutes,
        maxParallelFlows: resolvedMaxParallelFlows,
        taskDelegationStrategies: {
          topDown: {
            enabled: topDownTaskDelegationEnabledInput,
            openTasksThreshold: resolvedTopDownOpenTasksThreshold,
          },
          bottomUp: {
            enabled: bottomUpTaskDelegationEnabledInput,
            maxInactivityMinutes: resolvedMaxInactivityMinutes,
            inactiveAgentNotificationTarget:
              inactiveAgentNotificationTargetInput,
          },
        },
      };
      if (authenticationSettingsChanged) {
        settingsPayload.authentication = {
          enabled: uiAuthenticationEnabledInput,
          ...(normalizedAuthUsername
            ? {
                username: normalizedAuthUsername,
              }
            : {}),
          ...(hasNewAuthPassword
            ? {
                password: nextAuthPassword,
              }
            : {}),
          ...(requiresCurrentPassword &&
          uiAuthenticationCurrentPasswordInput.trim().length > 0
            ? {
                currentPassword: uiAuthenticationCurrentPasswordInput,
              }
            : {}),
        };
      }

      const response = await persistUiSettings(settingsPayload);
      applyUiSettingsResponse(response);
      setUiAuthenticationCurrentPasswordInput("");
      setUiAuthenticationPasswordInput("");
      setUiAuthenticationPasswordConfirmationInput("");
      setUiAuthenticationPasswordEditorOpen(false);
      const statusMessage = !taskCronEnabledInput
        ? "Task automation checks disabled."
        : response.settings.ceoBootstrapPending
        ? "Task automation checks are waiting for the first CEO message."
        : `Task automation checks enabled every ${TASK_CRON_INTERVAL_MINUTES} minute(s); max parallel flows set to ${resolvedMaxParallelFlows}; in-progress timeout set to ${resolvedMaxInProgressMinutes} minutes; Top-Down ${
            topDownTaskDelegationEnabledInput
              ? `enabled (threshold ${resolvedTopDownOpenTasksThreshold})`
              : "disabled"
          }; Bottom-Up ${
            bottomUpTaskDelegationEnabledInput
              ? `enabled (${resolvedMaxInactivityMinutes} minutes)`
              : "disabled"
          }.`;
      toast.success(response.message ?? statusMessage);
      await refreshAuthenticationStatus();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to update settings.";
      toast.error(message);
    } finally {
      setMutating(false);
    }
  }

  async function persistUiSettings(settings: {
    taskCronEnabled: boolean;
    maxInProgressMinutes: number;
    maxParallelFlows: number;
    taskDelegationStrategies: {
      topDown: {
        enabled: boolean;
        openTasksThreshold: number;
      };
      bottomUp: {
        enabled: boolean;
        maxInactivityMinutes: number;
        inactiveAgentNotificationTarget: InactiveAgentNotificationTarget;
      };
    };
    authentication?: {
      enabled: boolean;
      username?: string;
      password?: string;
      currentPassword?: string;
    };
  }): Promise<{ settings: UiSettings; message?: string }> {
    return fetchJson<{
      settings: UiSettings;
      message?: string;
    }>("/api/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });
  }

  function applyUiSettingsResponse(response: { settings: UiSettings }): void {
    const normalizedSettings = normalizeUiSettings(response.settings);

    setState((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        settings: normalizedSettings,
      };
    });
    setTaskCronEnabledInput(normalizedSettings.taskCronEnabled);
    setTopDownTaskDelegationEnabledInput(
      normalizedSettings.taskDelegationStrategies.topDown.enabled,
    );
    setTopDownOpenTasksThresholdInput(
      String(
        normalizedSettings.taskDelegationStrategies.topDown.openTasksThreshold,
      ),
    );
    setMaxInactivityMinutesInput(
      String(
        normalizedSettings.taskDelegationStrategies.bottomUp
          .maxInactivityMinutes,
      ),
    );
    setMaxInProgressMinutesInput(
      String(normalizedSettings.maxInProgressMinutes),
    );
    setMaxParallelFlowsInput(String(normalizedSettings.maxParallelFlows));
    setBottomUpTaskDelegationEnabledInput(
      normalizedSettings.taskDelegationStrategies.bottomUp.enabled,
    );
    setInactiveAgentNotificationTargetInput(
      normalizedSettings.taskDelegationStrategies.bottomUp
        .inactiveAgentNotificationTarget,
    );
    setUiAuthenticationEnabledInput(normalizedSettings.authentication.enabled);
    setUiAuthenticationUsernameInput(
      normalizedSettings.authentication.username,
    );
    setUiAuthenticationHasPassword(
      normalizedSettings.authentication.hasPassword,
    );
  }

  async function handleCreateTask(
    taskWorkspaceId: string,
    options?: { fromDialog?: boolean },
  ): Promise<void> {
    const draft = taskDraftByWorkspaceId[taskWorkspaceId];
    const title = draft?.title.trim() ?? "";
    const description = draft?.description.trim() ?? "";
    const assignedTo = draft?.assignedTo?.trim();
    const status = draft?.status ?? "todo";

    if (!title) {
      if (options?.fromDialog) {
        setCreateTaskDialogError("Task title is required.");
      } else {
        toast.error("Task title is required.");
      }
      return;
    }
    if (!description) {
      if (options?.fromDialog) {
        setCreateTaskDialogError("Task description is required.");
      } else {
        toast.error("Task description is required.");
      }
      return;
    }
    if (!assignedTo) {
      if (options?.fromDialog) {
        setCreateTaskDialogError("Task assignee is required.");
      } else {
        toast.error("Task assignee is required.");
      }
      return;
    }

    setMutating(true);
    if (options?.fromDialog) {
      setCreateTaskDialogError(null);
    }
    try {
      const response = await fetchJson<{ message?: string }>("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorId: taskActorId,
          title,
          description,
          assignedTo,
          status,
        }),
      });

      setTaskDraftByWorkspaceId((current) => {
        return {
          ...current,
          [taskWorkspaceId]: {
            ...(current[taskWorkspaceId] ?? {
              title: "",
              description: "",
              assignedTo,
              status: "todo",
            }),
            title: "",
            description: "",
          },
        };
      });
      if (options?.fromDialog) {
        setCreateTaskDialogOpen(false);
        setCreateTaskDialogError(null);
      } else {
        toast.success(response.message ?? `Task \"${title}\" created.`);
      }
      await refreshTasks();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to create task.";
      if (options?.fromDialog) {
        setCreateTaskDialogError(message);
      } else {
        toast.error(message);
      }
    } finally {
      setMutating(false);
    }
  }

  function updateSelectedTasks(
    taskWorkspaceId: string,
    updater: (currentSelected: Set<string>) => Set<string>,
  ): void {
    setSelectedTaskIdsByWorkspaceId((current) => {
      const currentSelected = new Set(current[taskWorkspaceId] ?? []);
      const nextSelected = updater(currentSelected);
      const next = { ...current };
      if (nextSelected.size === 0) {
        delete next[taskWorkspaceId];
      } else {
        next[taskWorkspaceId] = [...nextSelected];
      }
      return next;
    });
  }

  function handleToggleTaskSelection(
    taskWorkspaceId: string,
    taskId: string,
    checked: boolean,
  ): void {
    updateSelectedTasks(taskWorkspaceId, (currentSelected) => {
      if (checked) {
        currentSelected.add(taskId);
      } else {
        currentSelected.delete(taskId);
      }
      return currentSelected;
    });
  }

  function handleToggleSelectAllTasks(
    taskWorkspaceId: string,
    taskIds: string[],
    checked: boolean,
  ): void {
    updateSelectedTasks(taskWorkspaceId, () => {
      return checked ? new Set(taskIds) : new Set<string>();
    });
  }

  async function handleDeleteSelectedTasks(
    taskWorkspaceId: string,
    taskIds: string[],
  ): Promise<void> {
    if (taskIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${taskIds.length} task${
        taskIds.length === 1 ? "" : "s"
      }? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setMutating(true);
    try {
      const response = await fetchJson<{
        deletedTaskIds: string[];
        deletedCount: number;
        message?: string;
      }>("/api/tasks/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorId: taskActorId,
          taskIds,
        }),
      });

      setSelectedTaskIdsByWorkspaceId((current) => {
        const next = { ...current };
        delete next[taskWorkspaceId];
        return next;
      });
      if (selectedTaskId && response.deletedTaskIds.includes(selectedTaskId)) {
        if (route.kind === "taskWorkspace") {
          navigateToRoute({
            kind: "taskWorkspace",
            taskWorkspaceId: route.taskWorkspaceId,
          });
        }
        setTaskDetailsError(null);
        setTaskEntryDraft({
          kind: "worklog",
          content: "",
        });
      }

      toast.success(
        response.message ??
          `Deleted ${response.deletedCount} task${
            response.deletedCount === 1 ? "" : "s"
          }.`,
      );
      await refreshTasks();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete selected tasks.";
      toast.error(message);
    } finally {
      setMutating(false);
    }
  }

  function handleOpenTaskDetails(taskId: string): void {
    if (route.kind !== "taskWorkspace") {
      return;
    }
    navigateToRoute({
      kind: "taskWorkspace",
      taskWorkspaceId: route.taskWorkspaceId,
      taskId,
    });
    setTaskDetailsError(null);
    setTaskEntryDraft({
      kind: "worklog",
      content: "",
    });
  }

  async function handleUpdateTaskStatus(
    taskId: string,
    options?: { fromDetails?: boolean },
  ): Promise<void> {
    const status = (taskStatusDraftById[taskId] ?? "").trim();
    if (!status) {
      if (options?.fromDetails) {
        setTaskDetailsError("Task status is required.");
      } else {
        toast.error("Task status is required.");
      }
      return;
    }

    const normalizedStatus = status.toLowerCase();
    const reason =
      normalizedStatus === "blocked" || normalizedStatus === "pending"
        ? window
            .prompt(
              `Reason is required when setting status to ${normalizedStatus}.`,
            )
            ?.trim()
        : undefined;
    if (
      (normalizedStatus === "blocked" || normalizedStatus === "pending") &&
      !reason
    ) {
      if (options?.fromDetails) {
        setTaskDetailsError(
          `Reason is required for status "${normalizedStatus}".`,
        );
      } else {
        toast.error(`Reason is required for status "${normalizedStatus}".`);
      }
      return;
    }

    setMutating(true);
    if (options?.fromDetails) {
      setTaskDetailsError(null);
    } else {
    }
    try {
      const response = await fetchJson<{ message?: string }>(
        `/api/tasks/${encodeURIComponent(taskId)}/status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actorId: taskActorId,
            status,
            reason,
          }),
        },
      );

      if (options?.fromDetails) {
        setTaskDetailsError(null);
      } else {
        toast.success(response.message ?? `Task \"${taskId}\" updated.`);
      }
      await refreshTasks();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to update task status.";
      if (options?.fromDetails) {
        setTaskDetailsError(message);
      } else {
        toast.error(message);
      }
    } finally {
      setMutating(false);
    }
  }

  async function handleAddTaskEntry(
    taskId: string,
    kind: "blocker" | "artifact" | "worklog",
    contentOverride?: string,
    options?: { fromDetails?: boolean },
  ): Promise<void> {
    const label = kind === "blocker" ? "blocker" : kind;
    const content = (
      contentOverride ??
      window.prompt(`Add ${label} for task \"${taskId}\"`) ??
      ""
    ).trim();
    if (!content) {
      if (options?.fromDetails) {
        setTaskDetailsError(`A ${label} entry cannot be empty.`);
      }
      return;
    }

    setMutating(true);
    if (options?.fromDetails) {
      setTaskDetailsError(null);
    } else {
    }
    try {
      const response = await fetchJson<{ message?: string }>(
        `/api/tasks/${encodeURIComponent(taskId)}/${kind}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actorId: taskActorId,
            content,
          }),
        },
      );

      if (options?.fromDetails) {
        setTaskEntryDraft((current) => ({
          ...current,
          content: "",
        }));
      } else {
        toast.success(response.message ?? `${label} added.`);
      }
      await refreshTasks();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : `Unable to add task ${label}.`;
      if (options?.fromDetails) {
        setTaskDetailsError(message);
      } else {
        toast.error(message);
      }
    } finally {
      setMutating(false);
    }
  }

  function appendSessionMessage(
    chatKey: string,
    hydrationKey: string | null,
    message: SessionChatMessage,
  ): void {
    if (hydrationKey) {
      hydratedSessionIdsRef.current.add(hydrationKey);
    }
    setSessionMessagesById((current) => {
      const next = current[chatKey]
        ? [...current[chatKey], message]
        : [message];
      return {
        ...current,
        [chatKey]: next,
      };
    });
  }

  function replaceSessionReasoningEvents(
    chatKey: string,
    events: SessionReasoningEvent[],
  ): void {
    setSessionReasoningById((current) => ({
      ...current,
      [chatKey]: events,
    }));
  }

  function appendSessionReasoningEvent(
    chatKey: string,
    event: SessionReasoningEvent,
  ): void {
    setSessionReasoningById((current) => {
      const existing = current[chatKey] ?? [];
      const maxEvents = 160;
      const next =
        existing.length >= maxEvents
          ? [...existing.slice(existing.length - (maxEvents - 1)), event]
          : [...existing, event];
      return {
        ...current,
        [chatKey]: next,
      };
    });
  }

  function handleSessionPromptInputError(error: {
    code: "max_files" | "max_file_size" | "accept";
    message: string;
  }): void {
    if (error.code === "max_files") {
      toast.error(
        `You can attach up to ${MAX_SESSION_MESSAGE_IMAGE_COUNT} images per message.`,
      );
      return;
    }
    if (error.code === "max_file_size") {
      toast.error(
        `Each image must be ${Math.floor(
          MAX_SESSION_MESSAGE_IMAGE_BYTES / (1024 * 1024),
        )}MB or smaller.`,
      );
      return;
    }
    if (error.code === "accept") {
      toast.error("Only image files are supported.");
      return;
    }

    toast.error(error.message);
  }

  async function handleSessionPromptSubmit(
    promptMessage: PromptInputMessage,
  ): Promise<void> {
    if (!activeChatContext) {
      return;
    }

    const text = promptMessage.text.trim();
    const images = toSessionMessageImages(promptMessage.files);
    if (promptMessage.files.length > 0 && images.length === 0) {
      toast.error("Unable to process attached image files. Please try again.");
      return;
    }

    if (!text && images.length === 0) {
      return;
    }

    const message =
      text ||
      (images.length === 1
        ? "Please analyze the attached image."
        : "Please analyze the attached images.");
    const userMessage = text
      ? images.length > 0
        ? `${text}\n\n(Attached ${images.length} image${
            images.length === 1 ? "" : "s"
          }.)`
        : text
      : `Sent ${images.length} image${images.length === 1 ? "" : "s"}.`;

    const hydrationKey = `${activeChatContext.agentId}:${activeChatContext.sessionRef}`;
    const chatKey = activeChatContext.chatKey;
    appendSessionMessage(activeChatContext.chatKey, hydrationKey, {
      id: `${activeChatContext.chatKey}:user:${Date.now()}`,
      role: "user",
      content: userMessage,
    });
    replaceSessionReasoningEvents(chatKey, []);
    setSessionChatStatus("streaming");
    const abortController = new AbortController();
    activeSessionRunAbortControllerRef.current = abortController;

    try {
      const payload = {
        agentId: activeChatContext.agentId,
        sessionRef: activeChatContext.sessionRef,
        message,
        images,
      };
      const response = await sendSessionMessageStream(payload, {
        signal: abortController.signal,
        onEvent: (event) => {
          if (event.type !== "progress") {
            return;
          }

          appendSessionReasoningEvent(chatKey, {
            id: `${chatKey}:reasoning:${Date.now()}:${event.phase}`,
            level:
              event.phase === "stderr"
                ? "stderr"
                : event.phase === "stdout"
                ? "stdout"
                : "info",
            timestamp: event.timestamp,
            message: event.message,
          });
        },
      });

      const assistantReply =
        response.output.trim() || "No output was returned.";
      appendSessionMessage(activeChatContext.chatKey, hydrationKey, {
        id: `${activeChatContext.chatKey}:assistant:${Date.now()}`,
        role: "assistant",
        content: assistantReply,
      });
      appendSessionReasoningEvent(chatKey, {
        id: `${chatKey}:reasoning:${Date.now()}:completed`,
        level: "info",
        timestamp: new Date().toISOString(),
        message:
          response.result.code === 0
            ? "Run completed."
            : `Run completed with code ${response.result.code}.`,
      });
      setSessionChatStatus(response.result.code === 0 ? "ready" : "error");
      await refreshSessions(activeChatContext.agentId);
    } catch (requestError) {
      if (isAbortError(requestError)) {
        appendSessionReasoningEvent(chatKey, {
          id: `${chatKey}:reasoning:${Date.now()}:stopped`,
          level: "info",
          timestamp: new Date().toISOString(),
          message: "Run stopped.",
        });
        setSessionChatStatus("ready");
        return;
      }

      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to send session message.";
      const normalizedError =
        message === "Not Found"
          ? "Session message endpoint is unavailable. Refresh/restart the UI server to load the latest API routes."
          : message;
      appendSessionMessage(activeChatContext.chatKey, hydrationKey, {
        id: `${activeChatContext.chatKey}:assistant-error:${Date.now()}`,
        role: "assistant",
        content: normalizedError,
      });
      appendSessionReasoningEvent(chatKey, {
        id: `${chatKey}:reasoning:${Date.now()}:error`,
        level: "stderr",
        timestamp: new Date().toISOString(),
        message: normalizedError,
      });
      setSessionChatStatus("error");
    } finally {
      if (activeSessionRunAbortControllerRef.current === abortController) {
        activeSessionRunAbortControllerRef.current = null;
      }
    }
  }

  const handleStopSessionPrompt = useCallback(() => {
    const controller = activeSessionRunAbortControllerRef.current;
    if (!controller || controller.signal.aborted) {
      return;
    }
    controller.abort();
  }, []);

  useEffect(() => {
    return () => {
      const controller = activeSessionRunAbortControllerRef.current;
      if (controller && !controller.signal.aborted) {
        controller.abort();
      }
    };
  }, []);

  async function sendSessionMessageStream(
    payload: {
      agentId: string;
      sessionRef: string;
      message: string;
      images?: SessionMessageImageInput[];
    },
    options?: {
      onEvent?: (event: SessionMessageStreamEvent) => void;
      signal?: AbortSignal;
    },
  ): Promise<SessionSendMessageResponse> {
    const routes = [
      "/api/sessions/message/stream",
      "/api/session/message/stream",
    ];
    let lastError: unknown;

    for (const routePath of routes) {
      try {
        const response = await fetch(routePath, {
          method: "POST",
          signal: options?.signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const message = await readResponseError(response);
          throw new Error(message);
        }

        const body = response.body;
        if (!body) {
          throw new Error("Streaming response body is unavailable.");
        }

        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalResponse: SessionSendMessageResponse | null = null;

        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
              continue;
            }

            const event = JSON.parse(trimmed) as SessionMessageStreamEvent;
            options?.onEvent?.(event);
            if (event.type === "error") {
              throw new Error(event.error || "Unable to send session message.");
            }
            if (event.type === "result") {
              finalResponse = {
                agentId: event.agentId,
                sessionRef: event.sessionRef,
                output: event.output,
                result: event.result,
                message: event.message,
              };
            }
          }

          if (done) {
            break;
          }
        }

        if (buffer.trim()) {
          const event = JSON.parse(buffer.trim()) as SessionMessageStreamEvent;
          options?.onEvent?.(event);
          if (event.type === "error") {
            throw new Error(event.error || "Unable to send session message.");
          }
          if (event.type === "result") {
            finalResponse = {
              agentId: event.agentId,
              sessionRef: event.sessionRef,
              output: event.output,
              result: event.result,
              message: event.message,
            };
          }
        }

        if (finalResponse) {
          return finalResponse;
        }

        throw new Error("Session message stream ended without a final result.");
      } catch (error) {
        lastError = error;
        if (!(error instanceof Error) || error.message !== "Not Found") {
          throw error;
        }
      }
    }

    return sendSessionMessage(payload, options?.signal);
  }

  async function sendSessionMessage(
    payload: {
      agentId: string;
      sessionRef: string;
      message: string;
      images?: SessionMessageImageInput[];
    },
    signal?: AbortSignal,
  ): Promise<SessionSendMessageResponse> {
    const routes = ["/api/sessions/message", "/api/session/message"];
    let lastError: unknown;

    for (const routePath of routes) {
      try {
        return await fetchJson<SessionSendMessageResponse>(routePath, {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        lastError = error;
        if (!(error instanceof Error) || error.message !== "Not Found") {
          throw error;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Unable to send session message.");
  }

  const flushPendingUiLogs = useCallback(() => {
    const queued = pendingUiLogsRef.current;
    if (queued.length === 0) {
      return;
    }
    pendingUiLogsRef.current = [];
    setUiLogs((current) => {
      const next = [...current, ...queued];
      if (next.length <= MAX_UI_LOG_ENTRIES) {
        return next;
      }
      return next.slice(next.length - MAX_UI_LOG_ENTRIES);
    });
  }, []);

  const scheduleUiLogFlush = useCallback(() => {
    if (logsFlushTimerRef.current !== null) {
      return;
    }
    logsFlushTimerRef.current = window.setTimeout(() => {
      logsFlushTimerRef.current = null;
      flushPendingUiLogs();
    }, LOG_FLUSH_INTERVAL_MS);
  }, [flushPendingUiLogs]);

  const queueUiLogEntry = useCallback(
    (entry: UiLogEntry) => {
      pendingUiLogsRef.current.push(entry);
      scheduleUiLogFlush();
    },
    [scheduleUiLogFlush],
  );

  const filteredUiLogs = useMemo(() => {
    return uiLogs.filter((entry) => logSourceFilters[entry.source]);
  }, [logSourceFilters, uiLogs]);

  const handleLogsViewportScroll = useCallback(() => {
    const viewport = logsViewportRef.current;
    if (!viewport) {
      return;
    }
    const distanceToBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const nextAutoScroll =
      distanceToBottom <= LOG_AUTOSCROLL_BOTTOM_THRESHOLD_PX;
    setLogsAutoScrollEnabled((current) =>
      current === nextAutoScroll ? current : nextAutoScroll,
    );
  }, []);

  useEffect(() => {
    if (!logsAutoScrollEnabled) {
      return;
    }
    const viewport = logsViewportRef.current;
    if (!viewport) {
      return;
    }
    viewport.scrollTop = viewport.scrollHeight;
  }, [filteredUiLogs.length, logsAutoScrollEnabled]);

  useEffect(() => {
    return () => {
      if (logsFlushTimerRef.current !== null) {
        clearTimeout(logsFlushTimerRef.current);
        logsFlushTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (route.kind !== "page" || route.view !== "logs") {
      return;
    }

    const abortController = new AbortController();
    setLogsConnectionState("connecting");
    setLogsError(null);
    setLogsAutoScrollEnabled(true);

    const run = async (): Promise<void> => {
      try {
        await streamUiLogs(
          {
            signal: abortController.signal,
            limit: DEFAULT_LOG_STREAM_LIMIT,
            follow: true,
          },
          {
            onSnapshot: (entries) => {
              pendingUiLogsRef.current = [];
              setUiLogs(() => {
                const trimmed =
                  entries.length > MAX_UI_LOG_ENTRIES
                    ? entries.slice(entries.length - MAX_UI_LOG_ENTRIES)
                    : entries;
                return [...trimmed];
              });
              setLogsConnectionState("live");
            },
            onLog: (entry) => {
              queueUiLogEntry(entry);
              setLogsConnectionState("live");
            },
          },
        );

        if (!abortController.signal.aborted) {
          flushPendingUiLogs();
          setLogsConnectionState("offline");
          setLogsError("Logs stream disconnected.");
        }
      } catch (streamError) {
        if (abortController.signal.aborted) {
          return;
        }
        flushPendingUiLogs();
        setLogsConnectionState("offline");
        setLogsError(
          streamError instanceof Error
            ? streamError.message
            : "Unable to load logs.",
        );
      }
    };

    void run();

    return () => {
      abortController.abort();
      if (logsFlushTimerRef.current !== null) {
        clearTimeout(logsFlushTimerRef.current);
        logsFlushTimerRef.current = null;
      }
      flushPendingUiLogs();
    };
  }, [flushPendingUiLogs, queueUiLogEntry, route]);

  const currentAuthenticationSettings =
    state?.settings.authentication ?? defaultAuthenticationSettings();
  const normalizedUiAuthenticationUsernameInput = uiAuthenticationUsernameInput
    .trim()
    .toLowerCase();
  const authenticationEnabledChanged =
    currentAuthenticationSettings.enabled !== uiAuthenticationEnabledInput;
  const authenticationUsernameChanged =
    currentAuthenticationSettings.username !==
    normalizedUiAuthenticationUsernameInput;
  const hasPendingAuthenticationPasswordUpdate =
    uiAuthenticationPasswordInput.length > 0;
  const showAuthenticationPasswordEditor =
    !uiAuthenticationEnabledInput ||
    !uiAuthenticationHasPassword ||
    uiAuthenticationPasswordEditorOpen;
  const showAuthenticationCurrentPasswordInput =
    currentAuthenticationSettings.enabled &&
    (authenticationEnabledChanged ||
      authenticationUsernameChanged ||
      hasPendingAuthenticationPasswordUpdate);
  const activeSidebarAgentId =
    route.kind === "agent"
      ? route.agentId
      : route.kind === "session"
      ? selectedSessionAgentId
      : null;
  const handleSessionPromptDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!dragEventHasFiles(event)) {
        return;
      }
      sessionPromptDragDepthRef.current += 1;
      setSessionPromptDragActive(true);
    },
    [],
  );
  const handleSessionPromptDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!dragEventHasFiles(event)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!isSessionPromptDragActive) {
        setSessionPromptDragActive(true);
      }
    },
    [isSessionPromptDragActive],
  );
  const handleSessionPromptDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!dragEventHasFiles(event)) {
        return;
      }
      if (
        event.currentTarget.contains(
          event.relatedTarget as globalThis.Node | null,
        )
      ) {
        return;
      }
      sessionPromptDragDepthRef.current = 0;
      setSessionPromptDragActive(false);
    },
    [],
  );
  const handleSessionPromptDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!dragEventHasFiles(event)) {
      return;
    }
    sessionPromptDragDepthRef.current = 0;
    setSessionPromptDragActive(false);
  }, []);
  const handleSessionPromptTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (sessionChatStatus !== "streaming") {
        return;
      }
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing
      ) {
        // Keep typing enabled while streaming, but prevent accidental submit.
        event.preventDefault();
      }
    },
    [sessionChatStatus],
  );
  const renderAgentSessionRow = (
    session: SidebarAgentSessionItem,
    key: string,
  ): ReactElement => {
    const sessionMenuId = `${session.agentId}:${session.sessionId}`;
    const isActiveSession =
      route.kind === "session" && route.sessionId === session.sessionId;

    return (
      <div key={key} className="group/session relative">
        <button
          type="button"
          title={`${session.title} (${session.sessionKey})`}
          onClick={() => {
            handleSelectAgentSession(session);
          }}
          className={cn(
            "flex w-full items-center rounded-md px-3 py-1.5 pr-8 text-left text-[13px] transition-colors",
            isActiveSession
              ? "bg-accent/75 text-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          )}
        >
          <span className="inline-block size-4 shrink-0" aria-hidden="true" />
          <span className="ml-2 truncate">{session.title}</span>
        </button>
        <button
          type="button"
          aria-label={`Session menu for ${session.title}`}
          title="Session menu"
          disabled={isMutating}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpenSessionMenuId((current) =>
              current === sessionMenuId ? null : sessionMenuId,
            );
          }}
          className={cn(
            "absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50",
            openSessionMenuId === sessionMenuId
              ? "opacity-100"
              : "opacity-0 group-hover/session:opacity-100",
          )}
        >
          <MoreHorizontal className="size-3.5" />
        </button>
        {openSessionMenuId === sessionMenuId ? (
          <div className="absolute right-1 top-8 z-20 min-w-[120px] rounded-md border border-border bg-card p-1 shadow-lg">
            <button
              type="button"
              className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent/80"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void handleRenameSession(session);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-danger hover:bg-danger/10"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void handleRemoveSession(session);
              }}
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  if (isAuthChecking) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <Toaster />
        <div className="rounded-xl border border-border/70 bg-card/70 px-6 py-5 text-sm text-muted-foreground">
          Checking UI authentication status...
        </div>
      </div>
    );
  }

  if (isAuthenticationEnabled && !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-4 text-foreground">
        <Toaster />
        <Card className="w-full max-w-md border-border/70 bg-card/80">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">UI Sign In Required</CardTitle>
            <CardDescription>
              This OpenGoat UI is password protected. Sign in to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="ui-signin-username"
              >
                Username
              </label>
              <Input
                id="ui-signin-username"
                autoComplete="username"
                value={authLoginUsername}
                disabled={isAuthenticating}
                onChange={(event) => {
                  setAuthLoginUsername(event.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="ui-signin-password"
              >
                Password
              </label>
              <Input
                id="ui-signin-password"
                type="password"
                autoComplete="current-password"
                value={authLoginPassword}
                disabled={isAuthenticating}
                onChange={(event) => {
                  setAuthLoginPassword(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSignIn();
                  }
                }}
              />
            </div>
            {authLoginError ? (
              <p className="text-xs text-destructive">{authLoginError}</p>
            ) : null}
            <Button
              className="w-full"
              disabled={isAuthenticating}
              onClick={() => {
                void handleSignIn();
              }}
            >
              {isAuthenticating ? "Signing In..." : "Sign In"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background text-[14px] text-foreground">
      <Toaster />
      <div className="flex h-full">
        <aside
          className={cn(
            "opengoat-sidebar hidden border-r border-border bg-card transition-[width] duration-200 md:flex md:flex-col",
            isSidebarCollapsed ? "md:w-16" : "md:w-64",
          )}
        >
          <div className="flex h-14 items-center border-b border-border px-3">
            <div className="flex size-8 items-center justify-center rounded-md bg-accent text-base leading-none">
              <span aria-hidden="true">🐐</span>
            </div>
            {!isSidebarCollapsed ? (
              <p className="ml-2 text-sm font-semibold">OpenGoat UI</p>
            ) : null}
            <button
              type="button"
              className="ml-auto inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setSidebarCollapsed((value) => !value)}
              aria-label={
                isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="size-4 icon-stroke-1_2" />
              ) : (
                <ChevronLeft className="size-4 icon-stroke-1_2" />
              )}
            </button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            {!isSidebarCollapsed ? (
              <p className="px-3 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground">
                Main Menu
              </p>
            ) : null}
            {SIDEBAR_ITEMS.filter((item) => !item.hiddenInSidebar).map(
              (item) => {
                const Icon = item.icon;
                const active =
                  (route.kind === "page" && item.id === route.view) ||
                  (route.kind === "taskWorkspace" && item.id === "tasks") ||
                  (route.kind === "agent" && item.id === "agents");

                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => handleViewChange(item.id)}
                    className={cn(
                      "mb-1 flex w-full items-center rounded-lg border px-3 py-2.5 text-[14px] font-medium transition-colors",
                      active
                        ? "border-border bg-accent/90 text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-accent/60 hover:text-foreground",
                      isSidebarCollapsed && "justify-center px-2",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {!isSidebarCollapsed ? (
                      <span className="ml-2">{item.label}</span>
                    ) : null}
                  </button>
                );
              },
            )}

            <Separator className="my-2 bg-border/70" />
            {!isSidebarCollapsed ? (
              <>
                <p className="px-3 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground">
                  Agents & Sessions
                </p>
                <div
                  className="space-y-1"
                  onDragOver={handleSidebarListDragOver}
                  onDrop={handleSidebarListDrop}
                >
                  {sidebarSessionsByAgent.map(
                    ({ agent, sessions, visibleLimit }) => {
                      const isAgentActive = activeSidebarAgentId === agent.id;
                      const isExpanded = expandedAgentSessionIds.has(agent.id);
                      const hasHiddenSessions = sessions.length > visibleLimit;
                      const visibleSessions = isExpanded
                        ? sessions
                        : sessions.slice(0, visibleLimit);
                      const dropIndicatorPosition =
                        draggingSidebarAgentId &&
                        draggingSidebarAgentId !== agent.id &&
                        sidebarDropTarget?.agentId === agent.id
                          ? sidebarDropTarget.position
                          : null;

                      return (
                        <div
                          key={agent.id}
                          data-sidebar-agent-id={agent.id}
                          draggable
                          onDragStart={(event) => {
                            handleSidebarAgentDragStart(agent.id, event);
                          }}
                          onDragOver={(event) => {
                            handleSidebarAgentDragOver(agent.id, event);
                          }}
                          onDrop={(event) => {
                            handleSidebarAgentDrop(agent.id, event);
                          }}
                          onDragEnd={handleSidebarAgentDragEnd}
                          className={cn(
                            "relative rounded-lg border px-1 py-1 transition-colors cursor-grab active:cursor-grabbing",
                            isAgentActive
                              ? "border-border/80 bg-accent/35"
                              : draggingSidebarAgentId
                              ? "border-transparent"
                              : "border-transparent hover:border-border/50 hover:bg-accent/20",
                            draggingSidebarAgentId === agent.id && "opacity-60",
                            dropIndicatorPosition !== null &&
                              "border-primary/60",
                          )}
                        >
                          {dropIndicatorPosition ? (
                            <span
                              className={cn(
                                "pointer-events-none absolute left-2 right-2 z-10 h-0.5 rounded-full bg-primary shadow-[0_0_0_1px_hsl(var(--background))]",
                                dropIndicatorPosition === "before"
                                  ? "-top-px"
                                  : "-bottom-px",
                              )}
                              aria-hidden="true"
                            />
                          ) : null}
                          <div className="group/agent flex items-center">
                            <button
                              type="button"
                              title={`Open ${agent.displayName}`}
                              onClick={() => {
                                void handleSelectSidebarAgent(agent.id);
                              }}
                              className="flex min-w-0 flex-1 items-center rounded-md px-2 py-1.5 text-left"
                            >
                              <AgentAvatar
                                agentId={agent.id}
                                displayName={agent.displayName}
                                size="xs"
                              />
                              <span
                                className={cn(
                                  "ml-2 truncate text-[13px] font-medium",
                                  isAgentActive
                                    ? "text-foreground"
                                    : "text-muted-foreground",
                                )}
                              >
                                {agent.displayName}
                              </span>
                            </button>
                            <button
                              type="button"
                              aria-label={`New session with ${agent.displayName}`}
                              title="New session"
                              disabled={isMutating || isLoading}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleCreateAgentSession(agent.id, {
                                  navigate: true,
                                });
                              }}
                              className="mr-1 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/agent:opacity-100 disabled:opacity-40"
                            >
                              <Plus className="size-3.5 icon-stroke-1" />
                            </button>
                          </div>

                          {visibleSessions.length > 0 ? (
                            <div className="space-y-0.5 pb-1">
                              {visibleSessions.map((session) =>
                                renderAgentSessionRow(
                                  session,
                                  `${agent.id}:${session.sessionId}`,
                                ),
                              )}
                              {hasHiddenSessions ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedAgentSessionIds((current) => {
                                      const next = new Set(current);
                                      if (next.has(agent.id)) {
                                        next.delete(agent.id);
                                      } else {
                                        next.add(agent.id);
                                      }
                                      return next;
                                    });
                                    setOpenSessionMenuId(null);
                                  }}
                                  className="flex w-full items-center rounded-md px-3 py-1 text-left text-[12px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                                >
                                  <span
                                    className="inline-block size-4 shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span className="ml-2">
                                    {isExpanded
                                      ? "Show less"
                                      : `Show more (${
                                          sessions.length - visibleLimit
                                        })`}
                                  </span>
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    },
                  )}
                </div>
              </>
            ) : (
              <div
                className="space-y-1"
                onDragOver={handleSidebarListDragOver}
                onDrop={handleSidebarListDrop}
              >
                {sidebarSessionsByAgent.map(({ agent }) => {
                  const isAgentActive = activeSidebarAgentId === agent.id;
                  const dropIndicatorPosition =
                    draggingSidebarAgentId &&
                    draggingSidebarAgentId !== agent.id &&
                    sidebarDropTarget?.agentId === agent.id
                      ? sidebarDropTarget.position
                      : null;

                  return (
                    <button
                      key={agent.id}
                      type="button"
                      data-sidebar-agent-id={agent.id}
                      draggable
                      onDragStart={(event) => {
                        handleSidebarAgentDragStart(agent.id, event);
                      }}
                      onDragOver={(event) => {
                        handleSidebarAgentDragOver(agent.id, event);
                      }}
                      onDrop={(event) => {
                        handleSidebarAgentDrop(agent.id, event);
                      }}
                      onDragEnd={handleSidebarAgentDragEnd}
                      title={agent.displayName}
                      onClick={() => {
                        void handleSelectSidebarAgent(agent.id);
                      }}
                      className={cn(
                        "relative flex w-full items-center justify-center rounded-lg border py-2 transition-colors",
                        isAgentActive
                          ? "border-border bg-accent/90"
                          : draggingSidebarAgentId
                          ? "border-transparent"
                          : "border-transparent hover:border-border/60 hover:bg-accent/60",
                        draggingSidebarAgentId === agent.id && "opacity-60",
                        dropIndicatorPosition !== null && "border-primary/60",
                      )}
                    >
                      {dropIndicatorPosition ? (
                        <span
                          className={cn(
                            "pointer-events-none absolute left-1 right-1 z-10 h-0.5 rounded-full bg-primary shadow-[0_0_0_1px_hsl(var(--background))]",
                            dropIndicatorPosition === "before"
                              ? "-top-px"
                              : "-bottom-px",
                          )}
                          aria-hidden="true"
                        />
                      ) : null}
                      <AgentAvatar
                        agentId={agent.id}
                        displayName={agent.displayName}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </nav>

          <div className="border-t border-border p-3">
            <div
              className={cn(
                "flex items-center gap-2",
                isSidebarCollapsed
                  ? "flex-col justify-center"
                  : "justify-between",
              )}
            >
              <SidebarVersionStatus
                versionInfo={versionInfo}
                isVersionLoading={isVersionLoading}
                isSidebarCollapsed={isSidebarCollapsed}
              />

              <button
                type="button"
                title="Settings"
                aria-label="Settings"
                onClick={() => {
                  navigateToRoute({
                    kind: "page",
                    view: "settings",
                  });
                }}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-md border transition-colors",
                  route.kind === "page" && route.view === "settings"
                    ? "border-border bg-accent/90 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Settings className="size-4" />
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-border bg-background px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {route.kind === "agent" ? (
                <div className="flex min-w-0 items-center gap-3">
                  {selectedAgent ? (
                    <AgentAvatar
                      agentId={selectedAgent.id}
                      displayName={selectedAgent.displayName}
                      size="md"
                    />
                  ) : null}
                  <div className="flex min-w-0 items-center gap-2">
                    <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                      {selectedAgent?.displayName ?? route.agentId}
                    </h1>
                    <button
                      type="button"
                      title={`Open chat with ${
                        selectedAgent?.displayName ?? route.agentId
                      }`}
                      aria-label={`Open chat with ${
                        selectedAgent?.displayName ?? route.agentId
                      }`}
                      onClick={() => {
                        void handleSelectSidebarAgent(route.agentId);
                      }}
                      disabled={isMutating || isLoading || !selectedAgent}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border/60 hover:bg-accent/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <MessageSquare className="size-4 icon-stroke-1_2" />
                    </button>
                  </div>
                </div>
              ) : route.kind === "session" ? (
                <div className="flex min-w-0 items-center gap-3">
                  <AgentAvatar
                    agentId={selectedSessionAgent?.id ?? DEFAULT_AGENT_ID}
                    displayName={
                      selectedSessionAgent?.displayName ??
                      DEFAULT_AGENT_ID.toUpperCase()
                    }
                    size="md"
                  />
                  <div className="flex min-w-0 items-center gap-2">
                    <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                      {selectedSessionAgent?.displayName ??
                        DEFAULT_AGENT_ID.toUpperCase()}
                    </h1>
                    <span
                      className="h-5 w-px shrink-0 bg-border/80"
                      aria-hidden="true"
                    />
                    <span
                      className="max-w-[42vw] truncate rounded-full border border-border/70 bg-accent/40 px-3 py-1 text-sm font-medium text-foreground/90"
                      title={selectedSession?.title ?? "Session"}
                    >
                      {selectedSession?.title ?? "Session"}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <h1
                    className={cn(
                      "font-semibold tracking-tight text-xl sm:text-2xl",
                    )}
                  >
                    {route.kind === "page" && route.view === "wiki"
                      ? selectedWikiTitle
                      : viewTitle(
                          route,
                          selectedSession,
                          selectedTaskWorkspace,
                        )}
                  </h1>
                </div>
              )}

              {route.kind === "page" && route.view === "agents" ? (
                <Button
                  size="sm"
                  onClick={createAgentDialog.openDialog}
                  disabled={isLoading || isMutating}
                >
                  Create Agent
                </Button>
              ) : null}

              {route.kind === "page" && route.view === "skills" ? (
                <Button
                  size="sm"
                  onClick={() => {
                    openSkillInstallDialog({
                      scope: "agent",
                    });
                  }}
                  disabled={isLoading || isMutating}
                >
                  <PackagePlus className="size-4" />
                  Install Skill
                </Button>
              ) : null}

              {route.kind === "page" && route.view === "overview" ? (
                <button
                  type="button"
                  onClick={() => {
                    navigateToRoute({
                      kind: "page",
                      view: "settings",
                    });
                  }}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                    taskCronRunning
                      ? "border-success/50 bg-success/15 text-success hover:bg-success/20"
                      : "border-red-500/70 bg-red-600/25 text-red-200 hover:bg-red-600/35",
                  )}
                  title="Open settings"
                  aria-label="Open settings"
                >
                  {taskCronRunning ? "Running" : "Stopped"}
                </button>
              ) : null}

              {route.kind === "taskWorkspace" ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setCreateTaskDialogError(null);
                    setCreateTaskDialogOpen(true);
                  }}
                  disabled={isLoading || isMutating || !selectedTaskWorkspace}
                >
                  Create Task
                </Button>
              ) : null}

              {route.kind === "page" && route.view === "wiki" ? (
                <div className="flex items-center gap-2">
                  {wikiController.isEditing ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-10"
                      disabled={
                        wikiController.isSaving || wikiController.isDeleting
                      }
                      onClick={wikiController.cancelEditing}
                    >
                      Cancel
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    className="h-10"
                    onClick={() => {
                      if (wikiController.isEditing) {
                        void wikiController.save();
                        return;
                      }
                      wikiController.startEditing();
                    }}
                    disabled={
                      wikiController.isLoading ||
                      wikiController.isSaving ||
                      wikiController.isDeleting ||
                      (!wikiController.isEditing && !wikiController.page)
                    }
                  >
                    {wikiController.isEditing
                      ? wikiController.isSaving
                        ? "Saving..."
                        : "Save Update"
                      : "Update"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-10"
                    disabled={
                      wikiController.isLoading ||
                      wikiController.isSaving ||
                      wikiController.isDeleting ||
                      !wikiController.page
                    }
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        !window.confirm(
                          `Delete wiki page "${wikiController.title}"? This action cannot be undone.`,
                        )
                      ) {
                        return;
                      }
                      void wikiController.deletePage();
                    }}
                  >
                    {wikiController.isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              ) : null}
            </div>
          </header>

          <CreateAgentDialog
            open={createAgentDialog.isOpen}
            form={createAgentDialog.form}
            managerOptions={createAgentDialog.managerOptions}
            providerOptions={createAgentDialog.providerOptions}
            error={createAgentDialog.error}
            isLoading={isLoading}
            isSubmitting={createAgentDialog.isSubmitting}
            onOpenChange={createAgentDialog.setOpen}
            onNameChange={createAgentDialog.setName}
            onRoleChange={createAgentDialog.setRole}
            onReportsToChange={createAgentDialog.setReportsTo}
            onProviderIdChange={createAgentDialog.setProviderId}
            onSubmit={() => {
              void createAgentDialog.submitFromDialog();
            }}
            onCancel={() => createAgentDialog.setOpen(false)}
          />

          <SkillInstallDialog
            open={skillInstallDialogState.open}
            initialScope={skillInstallDialogState.scope}
            initialAgentId={skillInstallDialogState.agentId}
            agents={agents}
            defaultAgentId={DEFAULT_AGENT_ID}
            isBusy={isLoading || isMutating}
            onInstallSkill={installSkill}
            onOpenChange={(open) => {
              setSkillInstallDialogState((current) => ({
                ...current,
                open,
              }));
            }}
          />

          <FirstRunOnboardingDialog
            open={onboardingDialogOpen}
            status={onboardingStatus}
            isLoading={onboardingStatusLoading}
            error={onboardingStatusError}
            onRefresh={() => {
              void refreshOnboardingStatus();
            }}
            onDismiss={dismissOnboardingDialog}
          />

          {selectedTaskWorkspace ? (
            <Dialog
              open={isCreateTaskDialogOpen}
              onOpenChange={(open) => {
                setCreateTaskDialogOpen(open);
                setCreateTaskDialogError(null);
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Task</DialogTitle>
                </DialogHeader>

                {(() => {
                  const draft = taskDraftByWorkspaceId[
                    selectedTaskWorkspace.taskWorkspaceId
                  ] ?? {
                    title: "",
                    description: "",
                    assignedTo: taskActorId,
                    status: "todo" as const,
                  };
                  const assignableAgents = getAssignableAgents(taskActorId);

                  return (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label
                          className="text-xs uppercase tracking-wide text-muted-foreground"
                          htmlFor="createTaskActor"
                        >
                          Task Owner
                        </label>
                        <select
                          id="createTaskActor"
                          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          value={taskActorId}
                          onChange={(event) =>
                            setTaskActorId(event.target.value)
                          }
                        >
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.displayName} ({agent.id})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5 md:col-span-2">
                          <label
                            className="text-xs uppercase tracking-wide text-muted-foreground"
                            htmlFor="createTaskTitle"
                          >
                            Title
                          </label>
                          <Input
                            id="createTaskTitle"
                            value={draft.title}
                            onChange={(event) =>
                              updateTaskDraft(
                                selectedTaskWorkspace.taskWorkspaceId,
                                {
                                  title: event.target.value,
                                },
                              )
                            }
                            placeholder="Implement feature"
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <label
                            className="text-xs uppercase tracking-wide text-muted-foreground"
                            htmlFor="createTaskDescription"
                          >
                            Description
                          </label>
                          <textarea
                            id="createTaskDescription"
                            className="min-h-[96px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            value={draft.description}
                            onChange={(event) =>
                              updateTaskDraft(
                                selectedTaskWorkspace.taskWorkspaceId,
                                {
                                  description: event.target.value,
                                },
                              )
                            }
                            placeholder="Define acceptance criteria."
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label
                            className="text-xs uppercase tracking-wide text-muted-foreground"
                            htmlFor="createTaskAssign"
                          >
                            Assign To
                          </label>
                          <select
                            id="createTaskAssign"
                            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            value={draft.assignedTo}
                            onChange={(event) =>
                              updateTaskDraft(
                                selectedTaskWorkspace.taskWorkspaceId,
                                {
                                  assignedTo: event.target.value,
                                },
                              )
                            }
                          >
                            {assignableAgents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.displayName} ({agent.id})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label
                            className="text-xs uppercase tracking-wide text-muted-foreground"
                            htmlFor="createTaskStatus"
                          >
                            Initial Status
                          </label>
                          <select
                            id="createTaskStatus"
                            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            value={draft.status}
                            onChange={(event) =>
                              updateTaskDraft(
                                selectedTaskWorkspace.taskWorkspaceId,
                                {
                                  status: event.target
                                    .value as TaskCreateDraft["status"],
                                },
                              )
                            }
                          >
                            {TASK_STATUS_OPTIONS.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {createTaskDialogError ? (
                  <p className="text-sm text-danger">{createTaskDialogError}</p>
                ) : null}

                <DialogFooter>
                  <Button
                    variant="secondary"
                    onClick={() => setCreateTaskDialogOpen(false)}
                    disabled={isMutating}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      void handleCreateTask(
                        selectedTaskWorkspace.taskWorkspaceId,
                        {
                          fromDialog: true,
                        },
                      );
                    }}
                    disabled={isMutating || isLoading}
                  >
                    Create Task
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}

          <Dialog
            open={
              route.kind === "taskWorkspace" &&
              Boolean(route.taskId) &&
              Boolean(selectedTask)
            }
            onOpenChange={(open) => {
              if (!open) {
                if (route.kind === "taskWorkspace" && route.taskId) {
                  navigateToRoute({
                    kind: "taskWorkspace",
                    taskWorkspaceId: route.taskWorkspaceId,
                  });
                }
                setTaskDetailsError(null);
                setTaskEntryDraft({
                  kind: "worklog",
                  content: "",
                });
              }
            }}
          >
            {selectedTask ? (
              <DialogContent className="h-[82vh] max-h-[82vh] max-w-[880px] gap-0 overflow-hidden p-0">
                <DialogHeader className="border-b border-border/70 px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <DialogTitle className="truncate text-2xl leading-tight font-semibold tracking-tight">
                        {selectedTask.title}
                      </DialogTitle>
                      <DialogDescription className="mt-1">
                        {selectedTask.taskId}
                      </DialogDescription>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground">{`Assignee @${selectedTask.assignedTo}`}</span>
                        <span className="rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground">{`Owner @${selectedTask.owner}`}</span>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                            taskStatusPillClasses(selectedTask.status),
                          )}
                        >
                          {taskStatusLabel(selectedTask.status)}
                        </span>
                        <span
                          className="rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground"
                          title={formatAbsoluteTime(selectedTask.createdAt)}
                        >
                          {`Created ${formatRelativeTime(
                            selectedTask.createdAt,
                          )}`}
                        </span>
                        <span
                          className="rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground"
                          title={formatAbsoluteTime(selectedTaskUpdatedAt)}
                        >
                          {`Updated ${formatRelativeTime(
                            selectedTaskUpdatedAt,
                          )}`}
                        </span>
                      </div>
                    </div>

                    <div className="w-full max-w-[220px] space-y-1 sm:w-auto">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Update Status
                      </p>
                      <div className="flex items-center gap-2">
                        <select
                          className="h-9 min-w-[118px] flex-1 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          value={
                            taskStatusDraftById[selectedTask.taskId] ??
                            selectedTask.status
                          }
                          onChange={(event) =>
                            setTaskStatusDraftById((current) => ({
                              ...current,
                              [selectedTask.taskId]: event.target.value,
                            }))
                          }
                        >
                          {TASK_STATUS_OPTIONS.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-9 shrink-0 px-3"
                          disabled={isMutating || isLoading}
                          onClick={() => {
                            void handleUpdateTaskStatus(selectedTask.taskId, {
                              fromDetails: true,
                            });
                          }}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <section>
                    <h3 className="text-base font-medium">Description</h3>
                    <div className="mt-2 text-base leading-relaxed text-foreground">
                      <MessageResponse>
                        {selectedTaskDescription}
                      </MessageResponse>
                    </div>
                  </section>

                  <section className="mt-7">
                    <h3 className="text-base font-medium">Blockers</h3>
                    {selectedTask.blockers.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No blockers.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {selectedTask.blockers.map((blocker, index) => (
                          <li
                            key={`${selectedTask.taskId}:blocker:${index}`}
                            className="rounded-md border border-border/60 bg-background/30 px-3 py-2 text-sm"
                          >
                            <MessageResponse>
                              {decodeEscapedMarkdown(blocker)}
                            </MessageResponse>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="mt-7">
                    <h3 className="text-base font-medium">Activity</h3>
                    {selectedTaskActivity.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No artifacts or worklog entries yet.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {selectedTaskActivity.map((entry, index) => (
                          <article
                            key={`${selectedTask.taskId}:activity:${entry.type}:${index}`}
                            className="rounded-md border border-border/60 bg-background/30 px-4 py-3"
                          >
                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                {entry.type}
                              </span>
                              <span className="text-xs text-muted-foreground">{`@${
                                entry.createdBy
                              } • ${formatEntryDate(entry.createdAt)}`}</span>
                            </div>
                            <div className="text-sm leading-relaxed">
                              <MessageResponse>
                                {decodeEscapedMarkdown(entry.content)}
                              </MessageResponse>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <div className="border-t border-border/70 bg-background/70 px-6 py-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Add Entry
                  </p>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        className="h-9 min-w-[128px] rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        value={taskEntryDraft.kind}
                        onChange={(event) =>
                          setTaskEntryDraft((current) => ({
                            ...current,
                            kind: event.target.value as TaskEntryDraft["kind"],
                          }))
                        }
                      >
                        <option value="worklog">Worklog</option>
                        <option value="artifact">Artifact</option>
                        <option value="blocker">Blocker</option>
                      </select>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-9 px-3"
                        disabled={
                          isMutating ||
                          isLoading ||
                          !taskEntryDraft.content.trim()
                        }
                        onClick={() => {
                          void handleAddTaskEntry(
                            selectedTask.taskId,
                            taskEntryDraft.kind,
                            taskEntryDraft.content,
                            {
                              fromDetails: true,
                            },
                          );
                        }}
                      >
                        Add
                      </Button>
                    </div>
                    <textarea
                      className="min-h-[72px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      value={taskEntryDraft.content}
                      onChange={(event) =>
                        setTaskEntryDraft((current) => ({
                          ...current,
                          content: event.target.value,
                        }))
                      }
                      placeholder={`Add ${taskEntryDraft.kind} details...`}
                    />
                  </div>
                  {taskDetailsError ? (
                    <p className="mt-2 text-sm text-danger">
                      {taskDetailsError}
                    </p>
                  ) : null}
                </div>
              </DialogContent>
            ) : null}
          </Dialog>

          <div className="border-b border-border px-3 py-2 md:hidden">
            <div className="flex gap-1 overflow-x-auto">
              {SIDEBAR_ITEMS.filter((item) => !item.hiddenInSidebar).map(
                (item) => {
                  const Icon = item.icon;
                  const active =
                    (route.kind === "page" && item.id === route.view) ||
                    (route.kind === "taskWorkspace" && item.id === "tasks");

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleViewChange(item.id)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm whitespace-nowrap",
                        active
                          ? "border-border bg-accent text-foreground"
                          : "border-transparent text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </button>
                  );
                },
              )}
            </div>
          </div>

          <main
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6",
              route.kind === "session" ? "overflow-hidden" : "overflow-y-auto",
            )}
          >
            {error ? (
              <Card className="border-danger/40 bg-danger/5">
                <CardContent className="pt-5">
                  <p className="text-sm text-danger">{error}</p>
                </CardContent>
              </Card>
            ) : null}

            {!state && isLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading runtime data...
              </p>
            ) : null}

            {state ? (
              <div
                className={cn(
                  route.kind === "session"
                    ? "flex min-h-0 flex-1 flex-col"
                    : "space-y-4",
                )}
              >
                {route.kind === "page" && route.view === "overview" ? (
                  <>
                    <section>
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">
                          Runtime Overview
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {metrics.map((metric) => {
                          const Icon = metric.icon;
                          return (
                            <Card
                              key={metric.id}
                              className="border-border/70 bg-card/70"
                            >
                              <CardHeader className="pb-1">
                                <div className="flex items-center justify-between gap-3">
                                  <CardDescription className="text-[14px] font-medium text-muted-foreground">
                                    {metric.label}
                                  </CardDescription>
                                  <span className="inline-flex size-8 items-center justify-center rounded-lg border border-border/70 bg-accent/60 text-muted-foreground">
                                    <Icon className="size-4 icon-stroke-1_2" />
                                  </span>
                                </div>
                                <CardTitle className="text-5xl leading-none font-medium tracking-tight">
                                  {metric.value}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <p className="text-[13px] text-muted-foreground">
                                  {metric.hint}
                                </p>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </section>

                    {agents.length >= 2 ? (
                      <OrganizationChartPanel
                        agents={agents}
                        providers={providers}
                        onCreateAgentClick={createAgentDialog.openDialog}
                        isCreateAgentDisabled={isLoading || isMutating}
                      />
                    ) : agents.length === 1 ? (
                      <OrganizationGetStartedPanel
                        ceoAgent={
                          agents.find(
                            (agent) => agent.id === DEFAULT_AGENT_ID,
                          ) ??
                          agents[0] ??
                          null
                        }
                        onCreateAgentClick={createAgentDialog.openDialogForCeo}
                        isCreateAgentDisabled={isLoading || isMutating}
                      />
                    ) : null}
                  </>
                ) : null}

                {route.kind === "page" && route.view === "agents" ? (
                  <AgentsPage
                    agents={agents}
                    isMutating={isMutating}
                    onSelectAgent={(agentId) => {
                      navigateToRoute({
                        kind: "agent",
                        agentId,
                      });
                    }}
                    onDeleteAgent={(agentId) => {
                      void handleDeleteAgent(agentId);
                    }}
                    renderAgentAvatar={(agent) => (
                      <AgentAvatar
                        agentId={agent.id}
                        displayName={agent.displayName}
                      />
                    )}
                  />
                ) : null}

                {route.kind === "taskWorkspace" ? (
                  <TasksPage
                    selectedTaskWorkspace={selectedTaskWorkspace}
                    missingTaskWorkspaceId={route.taskWorkspaceId}
                    taskActorId={taskActorId}
                    agents={agents}
                    onTaskActorChange={setTaskActorId}
                    hasSelectedTasks={hasSelectedTasks}
                    selectedTaskIdsCount={selectedTaskIds.length}
                    onDeleteSelectedTasks={() => {
                      if (!selectedTaskWorkspace) {
                        return;
                      }
                      void handleDeleteSelectedTasks(
                        selectedTaskWorkspace.taskWorkspaceId,
                        selectedTaskIds,
                      );
                    }}
                    isMutating={isMutating}
                    isLoading={isLoading}
                    selectAllCheckboxState={selectAllCheckboxState}
                    onToggleSelectAllTasks={(checked) => {
                      if (!selectedTaskWorkspace) {
                        return;
                      }
                      handleToggleSelectAllTasks(
                        selectedTaskWorkspace.taskWorkspaceId,
                        allTaskIdsInWorkspace,
                        checked,
                      );
                    }}
                    selectedTaskIdSet={selectedTaskIdSet}
                    onToggleTaskSelection={(taskId, checked) => {
                      if (!selectedTaskWorkspace) {
                        return;
                      }
                      handleToggleTaskSelection(
                        selectedTaskWorkspace.taskWorkspaceId,
                        taskId,
                        checked,
                      );
                    }}
                    onOpenTaskDetails={handleOpenTaskDetails}
                  />
                ) : null}

                {route.kind === "agent" ? (
                  <AgentProfilePage
                    agentId={route.agentId}
                    selectedAgent={selectedAgent}
                    agents={agents}
                    providers={providers}
                    isBusy={isLoading || isMutating}
                    profileRefreshNonce={
                      agentProfileRefreshNonceById[route.agentId] ?? 0
                    }
                    onLoadProfile={loadAgentProfile}
                    onSaveProfile={saveAgentProfile}
                    onRefreshOverview={refreshOverview}
                    onOpenChat={(agentId) => {
                      void handleSelectSidebarAgent(agentId);
                    }}
                    onOpenInstallSkillModal={(agentId) => {
                      openSkillInstallDialog({
                        scope: "agent",
                        agentId,
                      });
                    }}
                    onBackToAgents={() => {
                      navigateToRoute({
                        kind: "page",
                        view: "agents",
                      });
                    }}
                  />
                ) : null}

                {route.kind === "session" ? (
                  activeChatContext ? (
                    <div className="flex min-h-0 flex-1 flex-col">
                      <Conversation className="min-h-0 flex-1">
                        <ConversationContent className="gap-4 p-4">
                          {sessionMessages.length === 0 ? (
                            <ConversationEmptyState
                              icon={<MessageSquare className="size-10" />}
                              title="Start this session"
                              description="Send your first message below."
                            />
                          ) : (
                            <>
                              {sessionMessages.map((message, index) => (
                                <Fragment key={message.id}>
                                  {shouldRenderReasoningBeforeAssistant &&
                                  index === lastAssistantMessageIndex ? (
                                    <Message
                                      from="assistant"
                                      key={`${message.id}:thinking`}
                                    >
                                      <MessageContent className="w-full max-w-full bg-transparent px-0 py-0">
                                        <Reasoning
                                          autoCloseOnFinish={false}
                                          defaultOpen={false}
                                          isStreaming={
                                            sessionChatStatus === "streaming"
                                          }
                                        >
                                          <ReasoningTrigger />
                                          <ReasoningContent className="max-h-56 overflow-y-auto pr-1">
                                            {sessionReasoningTranscript ||
                                              "Waiting for runtime updates..."}
                                          </ReasoningContent>
                                        </Reasoning>
                                      </MessageContent>
                                    </Message>
                                  ) : null}

                                  <Message from={message.role}>
                                    <MessageContent>
                                      {message.role === "user" ? (
                                        <p className="whitespace-pre-wrap break-words">
                                          {message.content}
                                        </p>
                                      ) : (
                                        <MessageResponse>
                                          {message.content}
                                        </MessageResponse>
                                      )}
                                    </MessageContent>
                                  </Message>
                                </Fragment>
                              ))}
                              {shouldRenderReasoning &&
                              !shouldRenderReasoningBeforeAssistant ? (
                                <Message
                                  from="assistant"
                                  key={`${activeChatContext.chatKey}:thinking`}
                                >
                                  <MessageContent className="w-full max-w-full bg-transparent px-0 py-0">
                                    <Reasoning
                                      autoCloseOnFinish={false}
                                      defaultOpen={false}
                                      isStreaming={
                                        sessionChatStatus === "streaming"
                                      }
                                    >
                                      <ReasoningTrigger />
                                      <ReasoningContent className="max-h-56 overflow-y-auto pr-1">
                                        {sessionReasoningTranscript ||
                                          "Waiting for runtime updates..."}
                                      </ReasoningContent>
                                    </Reasoning>
                                  </MessageContent>
                                </Message>
                              ) : null}
                            </>
                          )}
                        </ConversationContent>
                        <ConversationScrollButton />
                      </Conversation>

                      <div
                        className="relative mt-4 shrink-0"
                        onDragEnter={handleSessionPromptDragEnter}
                        onDragLeave={handleSessionPromptDragLeave}
                        onDragOver={handleSessionPromptDragOver}
                        onDrop={handleSessionPromptDrop}
                      >
                        <PromptInput
                          accept="image/*"
                          className={cn(
                            "shrink-0 transition-colors",
                            isSessionPromptDragActive &&
                              "[&_[data-slot=input-group]]:border-primary/60 [&_[data-slot=input-group]]:bg-primary/5 [&_[data-slot=input-group]]:ring-1 [&_[data-slot=input-group]]:ring-primary/40",
                          )}
                          maxFileSize={MAX_SESSION_MESSAGE_IMAGE_BYTES}
                          maxFiles={MAX_SESSION_MESSAGE_IMAGE_COUNT}
                          multiple
                          onError={handleSessionPromptInputError}
                          onSubmit={(message) => {
                            void handleSessionPromptSubmit(message);
                          }}
                        >
                          <PromptInputBody>
                            <SessionPromptAttachmentStrip
                              disabled={
                                isLoading ||
                                isMutating ||
                                sessionChatStatus === "streaming"
                              }
                            />
                            <PromptInputTextarea
                              className="!border-0 !border-b-0 !shadow-none"
                              placeholder="Message this session..."
                              onKeyDown={handleSessionPromptTextareaKeyDown}
                              disabled={isLoading || isMutating}
                            />
                          </PromptInputBody>
                          <PromptInputFooter
                            align="block-end"
                            className="items-center justify-between gap-2 !border-0 !border-t-0 bg-transparent px-2 pt-1 pb-2 shadow-none"
                          >
                            <SessionPromptAttachButton
                              disabled={
                                isLoading ||
                                isMutating ||
                                sessionChatStatus === "streaming"
                              }
                            />
                            <PromptInputSubmit
                              className="ml-auto"
                              status={sessionChatStatus}
                              onStop={handleStopSessionPrompt}
                              disabled={isLoading || isMutating}
                            />
                          </PromptInputFooter>
                        </PromptInput>
                        {isSessionPromptDragActive ? (
                          <SessionPromptDropOverlay />
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-xl border border-border/70 bg-background/40 px-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        {`No saved session was found for id ${route.sessionId}.`}
                      </p>
                    </div>
                  )
                ) : null}

                {route.kind === "page" && route.view === "skills" ? (
                  <SkillsPage
                    agents={agents}
                    globalSkills={state.globalSkills.skills}
                    skillsByAgentId={skillsByAgentId}
                    isBusy={isLoading || isMutating}
                    onLoadAgentSkills={loadAgentSkills}
                    onRemoveSkill={removeSkill}
                  />
                ) : null}

                {route.kind === "page" && route.view === "wiki" ? (
                  <WikiPage controller={wikiController} />
                ) : null}

                {route.kind === "page" && route.view === "logs" ? (
                  <LogsPage
                    logSourceFilters={logSourceFilters}
                    onLogSourceFilterChange={(source, checked) => {
                      setLogSourceFilters((current) => ({
                        ...current,
                        [source]: checked,
                      }));
                    }}
                    logsConnectionState={logsConnectionState}
                    onClear={() => {
                      setUiLogs([]);
                      pendingUiLogsRef.current = [];
                    }}
                    logsAutoScrollEnabled={logsAutoScrollEnabled}
                    onJumpToLatest={() => {
                      const viewport = logsViewportRef.current;
                      if (viewport) {
                        viewport.scrollTop = viewport.scrollHeight;
                      }
                      setLogsAutoScrollEnabled(true);
                    }}
                    logsViewportRef={logsViewportRef}
                    onViewportScroll={handleLogsViewportScroll}
                    logsError={logsError}
                    uiLogs={uiLogs}
                    filteredUiLogs={filteredUiLogs}
                  />
                ) : null}

                {route.kind === "page" && route.view === "settings" ? (
                  <SettingsPage
                    ceoBootstrapPending={ceoBootstrapPending}
                    defaultAgentId={DEFAULT_AGENT_ID}
                    taskCronIntervalMinutes={TASK_CRON_INTERVAL_MINUTES}
                    taskCronEnabledInput={taskCronEnabledInput}
                    topDownTaskDelegationEnabledInput={
                      topDownTaskDelegationEnabledInput
                    }
                    topDownOpenTasksThresholdInput={
                      topDownOpenTasksThresholdInput
                    }
                    bottomUpTaskDelegationEnabledInput={
                      bottomUpTaskDelegationEnabledInput
                    }
                    minTopDownOpenTasksThreshold={
                      MIN_TOP_DOWN_OPEN_TASKS_THRESHOLD
                    }
                    maxTopDownOpenTasksThreshold={
                      MAX_TOP_DOWN_OPEN_TASKS_THRESHOLD
                    }
                    maxInactivityMinutesInput={maxInactivityMinutesInput}
                    maxInProgressMinutesInput={maxInProgressMinutesInput}
                    minMaxInactivityMinutes={MIN_MAX_INACTIVITY_MINUTES}
                    maxMaxInactivityMinutes={MAX_MAX_INACTIVITY_MINUTES}
                    minMaxInProgressMinutes={MIN_MAX_IN_PROGRESS_MINUTES}
                    maxMaxInProgressMinutes={MAX_MAX_IN_PROGRESS_MINUTES}
                    maxParallelFlowsInput={maxParallelFlowsInput}
                    minMaxParallelFlows={MIN_MAX_PARALLEL_FLOWS}
                    maxMaxParallelFlows={MAX_MAX_PARALLEL_FLOWS}
                    inactiveAgentNotificationTargetInput={
                      inactiveAgentNotificationTargetInput
                    }
                    uiAuthenticationEnabledInput={uiAuthenticationEnabledInput}
                    uiAuthenticationUsernameInput={
                      uiAuthenticationUsernameInput
                    }
                    uiAuthenticationHasPassword={uiAuthenticationHasPassword}
                    uiAuthenticationPasswordEditorOpen={
                      uiAuthenticationPasswordEditorOpen
                    }
                    showAuthenticationPasswordEditor={
                      showAuthenticationPasswordEditor
                    }
                    showAuthenticationCurrentPasswordInput={
                      showAuthenticationCurrentPasswordInput
                    }
                    uiAuthenticationCurrentPasswordInput={
                      uiAuthenticationCurrentPasswordInput
                    }
                    uiAuthenticationPasswordInput={
                      uiAuthenticationPasswordInput
                    }
                    uiAuthenticationPasswordConfirmationInput={
                      uiAuthenticationPasswordConfirmationInput
                    }
                    isAuthenticationEnabled={isAuthenticationEnabled}
                    isAuthenticated={isAuthenticated}
                    isMutating={isMutating}
                    isLoading={isLoading}
                    onOpenCeoChat={(agentId) => {
                      void handleSelectSidebarAgent(agentId);
                    }}
                    onTaskCronEnabledChange={(checked) => {
                      setTaskCronEnabledInput(checked);
                    }}
                    onMaxParallelFlowsInputChange={(value) => {
                      setMaxParallelFlowsInput(value);
                    }}
                    onTopDownTaskDelegationEnabledChange={(checked) => {
                      setTopDownTaskDelegationEnabledInput(checked);
                    }}
                    onTopDownOpenTasksThresholdInputChange={(value) => {
                      setTopDownOpenTasksThresholdInput(value);
                    }}
                    onBottomUpTaskDelegationEnabledChange={(checked) => {
                      setBottomUpTaskDelegationEnabledInput(checked);
                    }}
                    onMaxInactivityMinutesInputChange={(value) => {
                      setMaxInactivityMinutesInput(value);
                    }}
                    onMaxInProgressMinutesInputChange={(value) => {
                      setMaxInProgressMinutesInput(value);
                    }}
                    onInactiveAgentNotificationTargetInputChange={(
                      nextValue,
                    ) => {
                      setInactiveAgentNotificationTargetInput(nextValue);
                    }}
                    onUiAuthenticationEnabledChange={(checked) => {
                      setUiAuthenticationEnabledInput(checked);
                      if (!checked) {
                        setUiAuthenticationPasswordEditorOpen(false);
                      }
                    }}
                    onUiAuthenticationUsernameInputChange={(value) => {
                      setUiAuthenticationUsernameInput(value);
                    }}
                    onOpenPasswordEditor={() => {
                      setUiAuthenticationPasswordEditorOpen(true);
                      setUiAuthenticationCurrentPasswordInput("");
                      setUiAuthenticationPasswordInput("");
                      setUiAuthenticationPasswordConfirmationInput("");
                    }}
                    onClosePasswordEditor={() => {
                      setUiAuthenticationPasswordEditorOpen(false);
                      setUiAuthenticationCurrentPasswordInput("");
                      setUiAuthenticationPasswordInput("");
                      setUiAuthenticationPasswordConfirmationInput("");
                    }}
                    onUiAuthenticationCurrentPasswordInputChange={(value) => {
                      setUiAuthenticationCurrentPasswordInput(value);
                    }}
                    onUiAuthenticationPasswordInputChange={(value) => {
                      setUiAuthenticationPasswordInput(value);
                    }}
                    onUiAuthenticationPasswordConfirmationInputChange={(
                      value,
                    ) => {
                      setUiAuthenticationPasswordConfirmationInput(value);
                    }}
                    onSignOut={() => {
                      void handleSignOut();
                    }}
                    onSaveSettings={() => {
                      void handleSaveSettings();
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}

function OrganizationGetStartedPanel({
  ceoAgent,
  onCreateAgentClick,
  isCreateAgentDisabled,
}: {
  ceoAgent: Agent | null;
  onCreateAgentClick: () => void;
  isCreateAgentDisabled: boolean;
}): ReactElement {
  const ceoName =
    ceoAgent?.displayName?.trim() || DEFAULT_AGENT_ID.toUpperCase();
  const ceoRole = ceoAgent?.role?.trim() || "Organization CEO";

  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-[20px] font-medium">
          Build Your Organization
        </CardTitle>
        <CardDescription className="text-[14px]">
          Your CEO is ready. Create the next agent and they will report to CEO
          by default.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-background via-background/95 to-accent/25 p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_55%)]" />
          <div className="relative flex flex-col items-center gap-3">
            <div className="w-full max-w-md rounded-xl border border-border/70 bg-card/80 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <AgentAvatar
                  agentId={ceoAgent?.id ?? DEFAULT_AGENT_ID}
                  displayName={ceoName}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="truncate text-lg font-medium text-foreground">
                    {ceoName}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {ceoRole}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex h-10 w-px bg-border/70" />

            <Button
              size="sm"
              onClick={onCreateAgentClick}
              disabled={isCreateAgentDisabled}
              className="h-10 px-4 text-[14px]"
            >
              <Plus className="mr-1 size-4" />
              Create Agent
            </Button>

            <p className="text-center text-xs text-muted-foreground sm:text-sm">
              The new agent will be created as a direct report to CEO.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrganizationChartPanel({
  agents,
  providers,
  onCreateAgentClick,
  isCreateAgentDisabled,
}: {
  agents: Agent[];
  providers: UiProviderOption[];
  onCreateAgentClick: () => void;
  isCreateAgentDisabled: boolean;
}): ReactElement {
  const orgChartRef = useRef<ReactFlowInstance<OrgChartNode, Edge> | null>(
    null,
  );
  const orgChartViewportRef = useRef<HTMLDivElement | null>(null);
  const hierarchy = useMemo(() => buildOrgHierarchy(agents), [agents]);
  const providerLabelById = useMemo(
    () => buildProviderLabelById(providers),
    [providers],
  );
  const fitViewOptions = useMemo(() => {
    return {
      padding: 0.06,
      minZoom: 0.2,
      maxZoom: 1.8,
    };
  }, []);
  const topologySignature = useMemo(() => {
    return [...agents]
      .map((agent) => {
        return `${agent.id}:${normalizeReportsTo(agent.reportsTo) ?? "root"}`;
      })
      .sort((left, right) => left.localeCompare(right))
      .join("|");
  }, [agents]);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    setCollapsedNodeIds((previous) => {
      const knownIds = new Set(hierarchy.agentsById.keys());
      const filtered = new Set<string>();
      for (const id of previous) {
        if (knownIds.has(id)) {
          filtered.add(id);
        }
      }
      return filtered;
    });
  }, [hierarchy]);

  const toggleNode = useCallback((agentId: string) => {
    setCollapsedNodeIds((previous) => {
      const next = new Set(previous);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }, []);

  const flowModel = useMemo(() => {
    return buildFlowModel({
      hierarchy,
      collapsedNodeIds,
      providerLabelById,
      onToggle: toggleNode,
    });
  }, [hierarchy, collapsedNodeIds, providerLabelById, toggleNode]);

  const fitOrgChartViewport = useCallback(
    (duration = 0) => {
      const instance = orgChartRef.current;
      const viewport = orgChartViewportRef.current;
      if (!instance || !viewport || flowModel.nodes.length === 0) {
        return;
      }

      instance.fitView({
        ...fitViewOptions,
      });

      const minY = Math.min(...flowModel.nodes.map((node) => node.position.y));
      if (!Number.isFinite(minY)) {
        return;
      }

      const currentViewport = instance.getViewport();
      const currentTop = minY * currentViewport.zoom + currentViewport.y;
      const targetTop = Math.max(8, viewport.clientHeight * 0.02);
      const offset = currentTop - targetTop;
      if (offset <= 1) {
        return;
      }

      instance.setViewport(
        {
          ...currentViewport,
          y: currentViewport.y - offset,
        },
        {
          duration,
        },
      );
    },
    [fitViewOptions, flowModel.nodes],
  );

  useEffect(() => {
    if (!orgChartRef.current || flowModel.nodes.length === 0) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      fitOrgChartViewport(250);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [topologySignature, flowModel.nodes.length, fitOrgChartViewport]);

  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-[20px] font-medium">
            Organization Chart
          </CardTitle>
          <CardDescription className="text-[14px]">
            Multi-level hierarchy with zoom, pan, and per-branch expand/collapse
            controls.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onCreateAgentClick}
            disabled={isCreateAgentDisabled}
          >
            Create Agent
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {flowModel.nodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No organization nodes found.
          </p>
        ) : (
          <div
            ref={orgChartViewportRef}
            className="h-[640px] rounded-xl border border-border/70 bg-background/45"
          >
            <ReactFlow
              nodes={flowModel.nodes}
              edges={flowModel.edges}
              nodeTypes={orgChartNodeTypes}
              fitViewOptions={fitViewOptions}
              minZoom={0.2}
              maxZoom={1.8}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag
              zoomOnScroll
              proOptions={{ hideAttribution: true }}
              onInit={(instance) => {
                orgChartRef.current = instance;
                window.requestAnimationFrame(() => {
                  fitOrgChartViewport();
                });
              }}
            >
              <Background color="hsl(var(--border))" gap={20} size={1} />
              <Controls showInteractive={false} position="bottom-left" />
            </ReactFlow>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AgentAvatar({
  agentId,
  displayName,
  size = "sm",
  className,
}: {
  agentId: string;
  displayName: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}): ReactElement {
  const avatarSource = useMemo(() => {
    return resolveAgentAvatarSource(agentId);
  }, [agentId]);
  const [avatarSrc, setAvatarSrc] = useState(avatarSource.src);

  useEffect(() => {
    setAvatarSrc(avatarSource.src);
  }, [avatarSource.src]);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 overflow-hidden rounded-full border border-border/80 bg-background/80",
        size === "md" ? "size-9" : size === "sm" ? "size-8" : "size-7",
        className,
      )}
    >
      <img
        src={avatarSrc}
        alt={`${displayName} avatar`}
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
        onError={() => {
          const fallbackSrc = avatarSource.fallbackSrc;
          if (!fallbackSrc) {
            return;
          }
          setAvatarSrc((current) => {
            return current === fallbackSrc ? current : fallbackSrc;
          });
        }}
      />
    </span>
  );
}

function OrganizationChartNode({
  id,
  data,
}: NodeProps<OrgChartNode>): ReactElement {
  const isManager = data.agentType === "manager";
  const hasReportees = data.totalReports > 0;
  const managerReportees = data.totalReports;
  const providerLabel = data.providerLabel;

  return (
    <div className="relative w-[260px] rounded-xl border border-border/80 bg-card/95 px-3 py-3 shadow-sm">
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border !border-border !bg-background"
        isConnectable={false}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <AgentAvatar
            agentId={data.agentId}
            displayName={data.displayName}
            className="mt-0.5"
          />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium">
              {data.displayName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {data.role ?? data.agentId}
            </p>
          </div>
        </div>

        {isManager ? (
          hasReportees ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.onToggle(id);
              }}
              className="inline-flex min-w-6 items-center justify-center rounded-md border border-border bg-background px-1.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={
                data.collapsed
                  ? `Expand ${data.displayName}`
                  : `Collapse ${data.displayName}`
              }
              title={`${managerReportees} reportee${
                managerReportees === 1 ? "" : "s"
              }`}
            >
              {managerReportees}
            </button>
          ) : (
            <span
              className="inline-flex min-w-6 items-center justify-center rounded-md border border-border bg-background px-1.5 text-[10px] font-medium text-muted-foreground"
              title="0 reportees"
            >
              {managerReportees}
            </span>
          )
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {hasReportees
            ? `${data.directReports} direct report${
                data.directReports > 1 ? "s" : ""
              }`
            : "No direct reports"}
        </p>
        <span
          className="inline-flex max-w-[96px] shrink-0 items-center rounded-sm border border-border/70 bg-background/60 px-1.5 py-0.5 text-[10px] leading-4 text-muted-foreground"
          title={providerLabel}
        >
          <span className="truncate">{providerLabel}</span>
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border !border-border !bg-background"
        isConnectable={false}
      />
    </div>
  );
}

function buildOrgHierarchy(agents: Agent[]): OrgHierarchy {
  const sortedAgents = [...agents].sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
  const agentsById = new Map(sortedAgents.map((agent) => [agent.id, agent]));
  const childrenById = new Map<string, string[]>();
  const roots: string[] = [];

  for (const agent of sortedAgents) {
    childrenById.set(agent.id, []);
  }

  for (const agent of sortedAgents) {
    const reportsTo = normalizeReportsTo(agent.reportsTo);
    if (!reportsTo || reportsTo === agent.id || !agentsById.has(reportsTo)) {
      roots.push(agent.id);
      continue;
    }

    const siblings = childrenById.get(reportsTo);
    if (siblings) {
      siblings.push(agent.id);
    }
  }

  for (const siblingIds of childrenById.values()) {
    siblingIds.sort((left, right) => {
      const leftAgent = agentsById.get(left);
      const rightAgent = agentsById.get(right);
      return (leftAgent?.displayName ?? left).localeCompare(
        rightAgent?.displayName ?? right,
      );
    });
  }

  roots.sort((left, right) => {
    const leftAgent = agentsById.get(left);
    const rightAgent = agentsById.get(right);
    return (leftAgent?.displayName ?? left).localeCompare(
      rightAgent?.displayName ?? right,
    );
  });

  if (roots.length === 0 && sortedAgents.length > 0) {
    roots.push(sortedAgents[0]?.id ?? "");
  }

  return {
    agentsById,
    childrenById,
    roots: roots.filter(Boolean),
  };
}

function buildProviderLabelById(
  providers: UiProviderOption[],
): Map<string, string> {
  const labels = new Map<string, string>();
  for (const provider of providers) {
    const providerId = provider.id.trim().toLowerCase();
    const displayName = provider.displayName.trim();
    if (!providerId || !displayName || labels.has(providerId)) {
      continue;
    }
    labels.set(providerId, displayName);
  }
  return labels;
}

function resolveProviderLabel(
  providerId: string,
  labelsById: Map<string, string>,
): string {
  const normalized = providerId.trim().toLowerCase();
  if (!normalized) {
    return "Unknown";
  }
  const label = labelsById.get(normalized);
  if (label) {
    return label;
  }

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => {
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
}

function buildFlowModel(params: {
  hierarchy: OrgHierarchy;
  collapsedNodeIds: Set<string>;
  providerLabelById: Map<string, string>;
  onToggle: (agentId: string) => void;
}): {
  nodes: OrgChartNode[];
  edges: Edge[];
} {
  const { hierarchy, collapsedNodeIds, providerLabelById, onToggle } = params;

  if (hierarchy.agentsById.size === 0) {
    return {
      nodes: [],
      edges: [],
    };
  }

  const visibleNodeIds: string[] = [];
  const visibleEdges: Array<{ source: string; target: string }> = [];
  const visited = new Set<string>();

  const traverse = (agentId: string): void => {
    if (visited.has(agentId)) {
      return;
    }

    visited.add(agentId);
    visibleNodeIds.push(agentId);

    const children = hierarchy.childrenById.get(agentId) ?? [];
    if (collapsedNodeIds.has(agentId)) {
      return;
    }

    for (const childId of children) {
      visibleEdges.push({ source: agentId, target: childId });
      traverse(childId);
    }
  };

  for (const rootId of hierarchy.roots) {
    traverse(rootId);
  }

  for (const agentId of hierarchy.agentsById.keys()) {
    if (!visited.has(agentId)) {
      traverse(agentId);
    }
  }

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => {
    return {};
  });
  graph.setGraph({
    rankdir: "TB",
    nodesep: 42,
    ranksep: 86,
    marginx: 24,
    marginy: 24,
  });

  for (const agentId of visibleNodeIds) {
    graph.setNode(agentId, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }

  for (const edge of visibleEdges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);
  const totalReportsById = buildTotalReportsById(hierarchy.childrenById);

  const nodes = visibleNodeIds.map((agentId) => {
    const agent = hierarchy.agentsById.get(agentId);
    const layout = graph.node(agentId) as { x: number; y: number } | undefined;
    const directReports = hierarchy.childrenById.get(agentId)?.length ?? 0;
    const providerId = agent?.providerId ?? "openclaw";
    const totalReports = totalReportsById.get(agentId) ?? 0;

    return {
      id: agentId,
      type: "orgNode",
      position: {
        x: (layout?.x ?? 0) - NODE_WIDTH / 2,
        y: (layout?.y ?? 0) - NODE_HEIGHT / 2,
      },
      data: {
        agentId,
        displayName: agent?.displayName ?? agentId,
        agentType: agent?.type ?? "unknown",
        providerId,
        providerLabel: resolveProviderLabel(providerId, providerLabelById),
        role: resolveAgentRoleLabel(agent),
        directReports,
        totalReports,
        collapsed: collapsedNodeIds.has(agentId),
        onToggle,
      },
    } satisfies OrgChartNode;
  });

  const edges = visibleEdges.map((edge) => {
    return {
      id: `${edge.source}->${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: "smoothstep",
      animated: false,
      style: {
        stroke: "hsl(var(--border))",
        strokeWidth: 1.4,
      },
    } satisfies Edge;
  });

  return {
    nodes,
    edges,
  };
}

function buildTotalReportsById(
  childrenById: Map<string, string[]>,
): Map<string, number> {
  const descendantsById = new Map<string, Set<string>>();

  const collectDescendants = (
    agentId: string,
    lineage: Set<string>,
  ): Set<string> => {
    const cached = descendantsById.get(agentId);
    if (cached) {
      return cached;
    }

    if (lineage.has(agentId)) {
      return new Set();
    }

    const nextLineage = new Set(lineage);
    nextLineage.add(agentId);

    const descendants = new Set<string>();
    for (const childId of childrenById.get(agentId) ?? []) {
      descendants.add(childId);
      for (const descendantId of collectDescendants(childId, nextLineage)) {
        descendants.add(descendantId);
      }
    }

    descendants.delete(agentId);
    descendantsById.set(agentId, descendants);
    return descendants;
  };

  const totalsById = new Map<string, number>();
  for (const agentId of childrenById.keys()) {
    totalsById.set(agentId, collectDescendants(agentId, new Set()).size);
  }

  return totalsById;
}

function normalizeReportsTo(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "null" || normalized === "none") {
    return null;
  }
  return normalized;
}

function resolveAgentRoleLabel(agent: Agent | undefined): string | undefined {
  const explicitRole = agent?.role?.trim();
  if (explicitRole) {
    const genericRole = explicitRole.toLowerCase();
    if (
      genericRole === "manager" ||
      genericRole === "individual contributor" ||
      genericRole === "team member"
    ) {
      return undefined;
    }
    return explicitRole;
  }
  return undefined;
}

function validateAuthenticationPasswordStrength(
  password: string,
): string | undefined {
  if (password.length < 12) {
    return "Password must be at least 12 characters long.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/\d/.test(password)) {
    return "Password must include at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one symbol.";
  }
  return undefined;
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  return (
    "name" in error &&
    typeof error.name === "string" &&
    error.name === "AbortError"
  );
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => {
    return null;
  });

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Request failed with ${response.status}`;
    const code =
      payload &&
      typeof payload === "object" &&
      "code" in payload &&
      typeof payload.code === "string"
        ? payload.code
        : undefined;
    if (response.status === 401 && code === "AUTH_REQUIRED") {
      dispatchAuthRequiredEvent();
      throw new Error("Authentication required. Sign in to continue.");
    }
    throw new Error(message);
  }

  return payload as T;
}

async function readResponseError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => {
    return null;
  });

  const errorCode =
    payload &&
    typeof payload === "object" &&
    "code" in payload &&
    typeof payload.code === "string"
      ? payload.code
      : undefined;
  if (response.status === 401 && errorCode === "AUTH_REQUIRED") {
    dispatchAuthRequiredEvent();
    return "Authentication required. Sign in to continue.";
  }

  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return `Request failed with ${response.status}`;
}

function dispatchAuthRequiredEvent(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event("opengoat:auth-required"));
}

async function streamUiLogs(
  options: {
    signal: AbortSignal;
    limit: number;
    follow: boolean;
  },
  handlers: {
    onSnapshot: (entries: UiLogEntry[]) => void;
    onLog: (entry: UiLogEntry) => void;
  },
): Promise<void> {
  const query = new URLSearchParams({
    limit: String(options.limit),
    follow: options.follow ? "1" : "0",
  });
  const response = await fetch(`/api/logs/stream?${query.toString()}`, {
    method: "GET",
    signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(await readResponseError(response));
  }

  const body = response.body;
  if (!body) {
    throw new Error("Log stream response body is unavailable.");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const event = JSON.parse(trimmed) as UiLogsStreamEvent;
      if (event.type === "error") {
        throw new Error(event.error || "Log stream failed.");
      }
      if (event.type === "snapshot") {
        handlers.onSnapshot(event.entries);
      }
      if (event.type === "log") {
        handlers.onLog(event.entry);
      }
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer.trim()) as UiLogsStreamEvent;
    if (event.type === "error") {
      throw new Error(event.error || "Log stream failed.");
    }
    if (event.type === "snapshot") {
      handlers.onSnapshot(event.entries);
    }
    if (event.type === "log") {
      handlers.onLog(event.entry);
    }
  }
}

function areTaskRecordListsEqual(
  left: TaskRecord[],
  right: TaskRecord[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftTask = left[index];
    const rightTask = right[index];
    if (!leftTask || !rightTask) {
      return false;
    }

    if (
      leftTask.taskId !== rightTask.taskId ||
      leftTask.createdAt !== rightTask.createdAt ||
      leftTask.updatedAt !== rightTask.updatedAt ||
      leftTask.owner !== rightTask.owner ||
      leftTask.assignedTo !== rightTask.assignedTo ||
      leftTask.title !== rightTask.title ||
      leftTask.description !== rightTask.description ||
      leftTask.status !== rightTask.status ||
      (leftTask.statusReason ?? "") !== (rightTask.statusReason ?? "")
    ) {
      return false;
    }

    if (!areStringArraysEqual(leftTask.blockers, rightTask.blockers)) {
      return false;
    }
    if (!areTaskEntryListsEqual(leftTask.artifacts, rightTask.artifacts)) {
      return false;
    }
    if (!areTaskEntryListsEqual(leftTask.worklog, rightTask.worklog)) {
      return false;
    }
  }

  return true;
}

function areTaskEntryListsEqual(
  left: TaskEntry[],
  right: TaskEntry[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftEntry = left[index];
    const rightEntry = right[index];
    if (!leftEntry || !rightEntry) {
      return false;
    }

    if (
      leftEntry.createdAt !== rightEntry.createdAt ||
      leftEntry.createdBy !== rightEntry.createdBy ||
      leftEntry.content !== rightEntry.content
    ) {
      return false;
    }
  }

  return true;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function buildTaskWorkspaceResponse(
  response: TasksResponse,
): TaskWorkspacesResponse {
  return {
    taskWorkspaces: [
      {
        taskWorkspaceId: "tasks",
        title: "Tasks",
        createdAt: "",
        owner: DEFAULT_AGENT_ID,
        tasks: response.tasks,
      },
    ],
  };
}

function viewTitle(
  route: AppRoute,
  selectedSession: Session | null,
  selectedTaskWorkspace: TaskWorkspaceRecord | null,
): string {
  if (route.kind === "session") {
    return selectedSession?.title ?? "Session";
  }

  if (route.kind === "agent") {
    return "Agent";
  }

  if (route.kind === "taskWorkspace") {
    return selectedTaskWorkspace?.title ?? "Tasks";
  }

  switch (route.view) {
    case "overview":
      return "Dashboard";
    case "tasks":
      return "Tasks";
    case "agents":
      return "Agents";
    case "skills":
      return "Skills";
    case "wiki":
      return "Wiki";
    case "logs":
      return "Logs";
    case "settings":
      return "Settings";
    default:
      return "Dashboard";
  }
}

function getInitialRoute(): AppRoute {
  if (typeof window === "undefined") {
    return { kind: "page", view: "overview" };
  }

  return parseRoute(window.location.pathname, window.location.search);
}

function parseRoute(pathname: string, search = ""): AppRoute {
  const trimmed = pathname.trim() || "/";
  const normalized = trimmed.length > 1 ? trimmed.replace(/\/+$/, "") : trimmed;
  const taskIdFromQuery = parseTaskIdFromSearch(search);

  if (
    normalized === "/" ||
    normalized === "/dashboard" ||
    normalized === "/overview"
  ) {
    return { kind: "page", view: "overview" };
  }

  if (normalized === "/agents") {
    return { kind: "page", view: "agents" };
  }

  if (normalized.startsWith("/agents/")) {
    const agentId = decodeURIComponent(
      normalized.slice("/agents/".length),
    ).trim();
    if (agentId) {
      return {
        kind: "agent",
        agentId,
      };
    }
  }

  if (normalized === "/tasks") {
    return {
      kind: "taskWorkspace",
      taskWorkspaceId: "tasks",
      ...(taskIdFromQuery ? { taskId: taskIdFromQuery } : {}),
    };
  }

  if (normalized.startsWith("/tasks/")) {
    const taskWorkspaceId = decodeURIComponent(
      normalized.slice("/tasks/".length),
    ).trim();
    if (taskWorkspaceId) {
      return {
        kind: "taskWorkspace",
        taskWorkspaceId,
        ...(taskIdFromQuery ? { taskId: taskIdFromQuery } : {}),
      };
    }
  }

  if (normalized === "/skills") {
    return { kind: "page", view: "skills" };
  }

  if (normalized === "/wiki") {
    return { kind: "page", view: "wiki", wikiPath: "" };
  }

  if (normalized.startsWith("/wiki/")) {
    const wikiPath = normalizeWikiPath(
      decodeURIComponent(normalized.slice("/wiki/".length)),
    );
    return {
      kind: "page",
      view: "wiki",
      wikiPath,
    };
  }

  if (normalized === "/logs") {
    return { kind: "page", view: "logs" };
  }

  if (normalized === "/settings") {
    return { kind: "page", view: "settings" };
  }

  if (normalized.startsWith("/session/")) {
    const sessionId = decodeURIComponent(
      normalized.slice("/session/".length),
    ).trim();
    if (sessionId) {
      return {
        kind: "session",
        sessionId,
      };
    }
  }

  if (normalized.startsWith("/sessions/")) {
    const sessionId = decodeURIComponent(
      normalized.slice("/sessions/".length),
    ).trim();
    if (sessionId) {
      return {
        kind: "session",
        sessionId,
      };
    }
  }

  return { kind: "page", view: "overview" };
}

function routeToPath(route: AppRoute): string {
  if (route.kind === "session") {
    return `/session/${encodeURIComponent(route.sessionId)}`;
  }

  if (route.kind === "agent") {
    return `/agents/${encodeURIComponent(route.agentId)}`;
  }

  if (route.kind === "taskWorkspace") {
    const basePath =
      route.taskWorkspaceId === "tasks"
        ? "/tasks"
        : `/tasks/${encodeURIComponent(route.taskWorkspaceId)}`;
    const taskId = route.taskId?.trim();
    if (!taskId) {
      return basePath;
    }
    return `${basePath}?task=${encodeURIComponent(taskId)}`;
  }

  if (route.view === "wiki") {
    const wikiPath = normalizeWikiPath(route.wikiPath);
    if (!wikiPath) {
      return "/wiki";
    }
    return `/wiki/${wikiPath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")}`;
  }

  if (route.view === "overview") {
    return "/dashboard";
  }

  return `/${route.view}`;
}

function parseTaskIdFromSearch(search: string): string | undefined {
  if (!search) {
    return undefined;
  }
  const taskId = new URLSearchParams(search).get("task")?.trim();
  return taskId ? taskId : undefined;
}

function normalizePathForComparison(pathname: string | undefined): string {
  return (
    pathname
      ?.trim()
      .replace(/[\\/]+$/, "")
      .toLowerCase() ?? ""
  );
}

function sortSessionsByUpdatedAt(sessions: Session[]): Session[] {
  return [...sessions].sort((left, right) => right.updatedAt - left.updatedAt);
}

function loadSidebarAgentOrder(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SIDEBAR_AGENT_ORDER_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is string => {
      return typeof entry === "string" && entry.trim().length > 0;
    });
  } catch {
    return [];
  }
}

function persistSidebarAgentOrder(agentIds: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (agentIds.length === 0) {
      window.localStorage.removeItem(SIDEBAR_AGENT_ORDER_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      SIDEBAR_AGENT_ORDER_STORAGE_KEY,
      JSON.stringify(agentIds),
    );
  } catch {
    // Non-fatal: sidebar order will fall back to default sorting.
  }
}

function loadOnboardingDismissed(storageKey: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

function persistOnboardingDismissed(storageKey: string, dismissed: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (dismissed) {
      window.localStorage.setItem(storageKey, "1");
      return;
    }
    window.localStorage.removeItem(storageKey);
  } catch {
    // Non-fatal: onboarding may appear again if persistence fails.
  }
}

function dragEventHasFiles(event: { dataTransfer: DataTransfer | null }): boolean {
  if (!event.dataTransfer) {
    return false;
  }
  return [...event.dataTransfer.types].includes("Files");
}

function toSessionMessageImages(
  files: FileUIPart[],
): SessionMessageImageInput[] {
  const images: SessionMessageImageInput[] = [];

  for (const file of files) {
    const dataUrl = file.url?.trim();
    if (!dataUrl?.startsWith("data:")) {
      continue;
    }
    const mediaType = resolveImageMediaType(file.mediaType, dataUrl);
    if (!mediaType) {
      continue;
    }

    images.push({
      dataUrl,
      mediaType,
      ...(file.filename?.trim()
        ? {
            name: file.filename.trim(),
          }
        : {}),
    });
  }

  return images;
}

function resolveImageMediaType(
  explicitMediaType: string | undefined,
  dataUrl: string,
): string | undefined {
  const normalizedExplicit = normalizeMediaType(explicitMediaType);
  if (normalizedExplicit?.startsWith("image/")) {
    return normalizedExplicit;
  }

  const dataUrlMediaType = extractDataUrlMediaType(dataUrl);
  if (dataUrlMediaType?.startsWith("image/")) {
    return dataUrlMediaType;
  }

  return undefined;
}

function normalizeMediaType(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function extractDataUrlMediaType(dataUrl: string): string | undefined {
  const separatorIndex = dataUrl.indexOf(",");
  if (separatorIndex <= 5) {
    return undefined;
  }

  const header = dataUrl.slice(5, separatorIndex);
  const mediaType = header.split(";")[0]?.trim().toLowerCase();
  return mediaType || undefined;
}

function mapHistoryToSessionMessages(
  sessionId: string,
  history: Array<{
    type: "message" | "compaction";
    role?: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
  }>,
): SessionChatMessage[] {
  const messages: SessionChatMessage[] = [];

  for (let index = 0; index < history.length; index += 1) {
    const item = history[index];
    if (!item || item.type !== "message") {
      continue;
    }
    if (item.role !== "user" && item.role !== "assistant") {
      continue;
    }

    messages.push({
      id: `${sessionId}:history:${item.timestamp}:${index}`,
      role: item.role,
      content: item.content,
    });
  }

  return messages;
}

function normalizeReasoningLine(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^\[(?:info|stderr|stdout)\]\s*/i, "")
    .trim();
}

function formatEntryDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) {
    return timestamp;
  }
  return date.toLocaleString();
}

function decodeEscapedMarkdown(value: string): string {
  if (
    !value.includes("\\n") &&
    !value.includes("\\r") &&
    !value.includes("\\t")
  ) {
    return value;
  }

  return value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t");
}
