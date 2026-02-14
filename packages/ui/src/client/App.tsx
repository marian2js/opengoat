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
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { resolveAgentAvatarSource } from "@/lib/agent-avatar";
import { cn } from "@/lib/utils";
import { AgentsPage } from "@/pages/agents/AgentsPage";
import { LogsPage } from "@/pages/logs/LogsPage";
import { SkillsPage } from "@/pages/skills/SkillsPage";
import type { SkillsResponse } from "@/pages/skills/types";
import { TasksPage } from "@/pages/tasks/TasksPage";
import { taskStatusLabel, taskStatusPillClasses } from "@/pages/tasks/utils";
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
} from "@xyflow/react";
import type { ChatStatus, FileUIPart } from "ai";
import {
  BookOpen,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Folder,
  FolderOpen,
  FolderPlus,
  Home,
  MessageSquare,
  MoreHorizontal,
  Pin,
  Plus,
  Settings,
  Sparkles,
  TerminalSquare,
  UsersRound,
} from "lucide-react";
import type { ComponentType, ReactElement } from "react";
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
}

interface Session {
  sessionKey: string;
  sessionId: string;
  title: string;
  updatedAt: number;
  transcriptPath: string;
  workspacePath: string;
  projectPath?: string;
  inputChars: number;
  outputChars: number;
  totalChars: number;
  compactionCount: number;
}

interface OverviewResponse {
  agents: Agent[];
  totals: {
    agents: number;
  };
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
  project: string;
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
  notifyManagersOfInactiveAgents: boolean;
  maxInactivityMinutes: number;
  inactiveAgentNotificationTarget: InactiveAgentNotificationTarget;
  authentication: UiAuthenticationSettings;
}

type InactiveAgentNotificationTarget = "all-managers" | "ceo-only";

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

interface UiVersionInfo {
  packageName: string;
  installedVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean | null;
  status: "latest" | "update-available" | "unpublished" | "unknown";
  checkedAt: string;
  error?: string;
}

interface DashboardState {
  health: HealthResponse;
  overview: OverviewResponse;
  sessions: SessionsResponse;
  agentSkills: SkillsResponse;
  globalSkills: SkillsResponse;
  taskWorkspaces: TaskWorkspacesResponse;
  settings: UiSettings;
}

interface Project {
  sessionKey: string;
  sessionId: string;
  name: string;
  projectPath: string;
  updatedAt: number;
}

interface WorkspaceSessionItem {
  sessionId: string;
  sessionKey: string;
  title: string;
  updatedAt: number;
}

interface WorkspaceNode {
  id: string;
  name: string;
  projectSessionKey?: string;
  projectPath: string;
  sessions: WorkspaceSessionItem[];
  updatedAt: number;
}

interface AgentProjectOption {
  id: string;
  name: string;
  projectPath: string;
}

interface CreateProjectResponse {
  agentId: string;
  project: {
    name: string;
    path: string;
    sessionRef: string;
  };
  session: {
    sessionKey: string;
    sessionId: string;
  };
  message?: string;
}

interface PickProjectResponse {
  project: {
    name: string;
    path: string;
  };
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

interface WorkspaceRenameResponse {
  workspace: {
    name: string;
    sessionRef: string;
  };
  message?: string;
}

interface WorkspaceDeleteResponse {
  removedWorkspace?: {
    sessionRef: string;
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

interface CreateAgentForm {
  name: string;
  role: string;
  reportsTo: string;
}

interface SidebarItem {
  id: PageView;
  label: string;
  icon: ComponentType<{ className?: string }>;
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
  project: string;
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
  role?: string;
  directReports: number;
  totalReports: number;
  collapsed: boolean;
  onToggle: (agentId: string) => void;
}

const NODE_WIDTH = 260;
const NODE_HEIGHT = 108;
const DEFAULT_AGENT_ID = "ceo";
const DEFAULT_MAX_INACTIVITY_MINUTES = 30;
const TASK_CRON_INTERVAL_MINUTES = 1;
const MIN_MAX_INACTIVITY_MINUTES = 1;
const MAX_MAX_INACTIVITY_MINUTES = 10_080;
const DEFAULT_LOG_STREAM_LIMIT = 300;
const MAX_UI_LOG_ENTRIES = 1200;
const LOG_FLUSH_INTERVAL_MS = 100;
const LOG_AUTOSCROLL_BOTTOM_THRESHOLD_PX = 24;
const TASK_AUTO_REFRESH_INTERVAL_MS = 10_000;
const TASK_AUTO_REFRESH_HIDDEN_INTERVAL_MS = 30_000;
const MAX_VISIBLE_WORKSPACE_SESSIONS = 10;
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
    notifyManagersOfInactiveAgents: true,
    maxInactivityMinutes: DEFAULT_MAX_INACTIVITY_MINUTES,
    inactiveAgentNotificationTarget: "all-managers",
    authentication: defaultAuthenticationSettings(),
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

const DEFAULT_FORM: CreateAgentForm = {
  name: "",
  role: "",
  reportsTo: "ceo",
};

type OrgChartNode = Node<OrgNodeData, "orgNode">;

const orgChartNodeTypes = {
  orgNode: OrganizationChartNode,
} satisfies NodeTypes;

export function App(): ReactElement {
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
  const [createForm, setCreateForm] = useState<CreateAgentForm>(DEFAULT_FORM);
  const [hoveredWorkspaceId, setHoveredWorkspaceId] = useState<string | null>(
    null,
  );
  const [openWorkspaceMenuId, setOpenWorkspaceMenuId] = useState<string | null>(
    null,
  );
  const [openSessionMenuId, setOpenSessionMenuId] = useState<string | null>(
    null,
  );
  const [collapsedWorkspaceIds, setCollapsedWorkspaceIds] = useState<
    Set<string>
  >(() => new Set());
  const [expandedWorkspaceSessionIds, setExpandedWorkspaceSessionIds] =
    useState<Set<string>>(() => new Set());
  const [pinnedSessionIds, setPinnedSessionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [sessionChatStatus, setSessionChatStatus] =
    useState<ChatStatus>("ready");
  const [sessionMessagesById, setSessionMessagesById] = useState<
    Record<string, SessionChatMessage[]>
  >({});
  const [sessionReasoningById, setSessionReasoningById] = useState<
    Record<string, SessionReasoningEvent[]>
  >({});
  const [sessionsByAgentId, setSessionsByAgentId] = useState<
    Record<string, Session[]>
  >({});
  const [selectedProjectIdByAgentId, setSelectedProjectIdByAgentId] = useState<
    Record<string, string>
  >({});
  const hydratedSessionIdsRef = useRef<Set<string>>(new Set());
  const [taskActorId, setTaskActorId] = useState("ceo");
  const [taskDraftByWorkspaceId, setTaskDraftByWorkspaceId] = useState<
    Record<string, TaskCreateDraft>
  >({});
  const [taskStatusDraftById, setTaskStatusDraftById] = useState<
    Record<string, string>
  >({});
  const [selectedTaskIdsByWorkspaceId, setSelectedTaskIdsByWorkspaceId] =
    useState<Record<string, string[]>>({});
  const [isCreateAgentDialogOpen, setCreateAgentDialogOpen] = useState(false);
  const [createAgentDialogError, setCreateAgentDialogError] = useState<
    string | null
  >(null);
  const [isCreateTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);
  const [createTaskDialogError, setCreateTaskDialogError] = useState<
    string | null
  >(null);
  const [maxInactivityMinutesInput, setMaxInactivityMinutesInput] = useState(
    String(DEFAULT_MAX_INACTIVITY_MINUTES),
  );
  const [taskCronEnabledInput, setTaskCronEnabledInput] = useState(true);
  const [
    notifyManagersOfInactiveAgentsInput,
    setNotifyManagersOfInactiveAgentsInput,
  ] = useState(true);
  const [
    inactiveAgentNotificationTargetInput,
    setInactiveAgentNotificationTargetInput,
  ] = useState<InactiveAgentNotificationTarget>("all-managers");
  const [
    uiAuthenticationEnabledInput,
    setUiAuthenticationEnabledInput,
  ] = useState(false);
  const [
    uiAuthenticationUsernameInput,
    setUiAuthenticationUsernameInput,
  ] = useState("");
  const [
    uiAuthenticationHasPassword,
    setUiAuthenticationHasPassword,
  ] = useState(false);
  const [
    uiAuthenticationCurrentPasswordInput,
    setUiAuthenticationCurrentPasswordInput,
  ] = useState("");
  const [
    uiAuthenticationPasswordInput,
    setUiAuthenticationPasswordInput,
  ] = useState("");
  const [
    uiAuthenticationPasswordConfirmationInput,
    setUiAuthenticationPasswordConfirmationInput,
  ] = useState("");
  const [
    uiAuthenticationPasswordEditorOpen,
    setUiAuthenticationPasswordEditorOpen,
  ] = useState(false);
  const [isTaskDetailsDialogOpen, setTaskDetailsDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
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
      window.location.pathname !== nextPath
    ) {
      window.history.pushState({}, "", nextPath);
    }
    setRoute(nextRoute);
    setHoveredWorkspaceId(null);
    setOpenWorkspaceMenuId(null);
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
      setRoute(parseRoute(window.location.pathname));
      setHoveredWorkspaceId(null);
      setOpenWorkspaceMenuId(null);
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
    if (window.location.pathname !== canonicalPath) {
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

      setState({
        health,
        overview,
        sessions,
        agentSkills,
        globalSkills,
        taskWorkspaces: buildTaskWorkspaceResponse(tasks),
        settings,
      });
      setTaskCronEnabledInput(settings.taskCronEnabled);
      setMaxInactivityMinutesInput(String(settings.maxInactivityMinutes));
      setNotifyManagersOfInactiveAgentsInput(
        settings.notifyManagersOfInactiveAgents,
      );
      setInactiveAgentNotificationTargetInput(
        settings.inactiveAgentNotificationTarget,
      );
      setUiAuthenticationEnabledInput(settings.authentication.enabled);
      setUiAuthenticationUsernameInput(settings.authentication.username);
      setUiAuthenticationHasPassword(settings.authentication.hasPassword);
      setSessionsByAgentId({
        [sessions.agentId]: sessions.sessions,
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

  const openCreateAgentDialog = useCallback(() => {
    setCreateAgentDialogError(null);
    setCreateAgentDialogOpen(true);
  }, []);

  const openCreateAgentDialogForCeo = useCallback(() => {
    setCreateForm((current) => ({
      ...current,
      reportsTo: DEFAULT_AGENT_ID,
    }));
    openCreateAgentDialog();
  }, [openCreateAgentDialog]);

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
          checkedAt: new Date().toISOString(),
          error: message,
        };
      });
    } finally {
      setVersionLoading(false);
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

  useEffect(() => {
    if (route.kind !== "agent") {
      return;
    }

    if (sessionsByAgentId[route.agentId]) {
      return;
    }

    void refreshSessions(route.agentId).catch(() => {
      // Non-fatal: agent page can still render and allow new messages.
    });
  }, [route, sessionsByAgentId, refreshSessions]);

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

    setCreateForm((current) => {
      if (agentIds.includes(current.reportsTo)) {
        return current;
      }

      return {
        ...current,
        reportsTo: agentIds[0] ?? "ceo",
      };
    });

    const hasTaskActor = agentIds.includes(taskActorId);
    if (!hasTaskActor) {
      setTaskActorId(agentIds[0] ?? "ceo");
    }
  }, [state, taskActorId]);

  const agents = state?.overview.agents ?? [];
  const hasLoadedState = state !== null;
  const sessions = state?.sessions.sessions ?? [];
  const selectedSession = useMemo(() => {
    if (route.kind !== "session") {
      return null;
    }
    return (
      sessions.find((session) => session.sessionId === route.sessionId) ?? null
    );
  }, [route, sessions]);
  const selectedAgent = useMemo(() => {
    if (route.kind !== "agent") {
      return null;
    }
    return agents.find((agent) => agent.id === route.agentId) ?? null;
  }, [route, agents]);
  const defaultEntryAgent = useMemo(() => {
    return agents.find((agent) => agent.id === DEFAULT_AGENT_ID) ?? null;
  }, [agents]);

  const workspaceNodes = useMemo<WorkspaceNode[]>(() => {
    const sessionsByPath = new Map<
      string,
      {
        projectPath: string;
        sessions: WorkspaceSessionItem[];
        project?: Project;
        latestUpdatedAt: number;
      }
    >();

    for (const session of sessions) {
      const projectPath = session.projectPath?.trim();
      if (!projectPath) {
        continue;
      }

      const pathKey = normalizePathForComparison(projectPath);
      if (!pathKey) {
        continue;
      }

      const existing = sessionsByPath.get(pathKey) ?? {
        projectPath,
        sessions: [],
        latestUpdatedAt: 0,
      };
      if (!existing.projectPath) {
        existing.projectPath = projectPath;
      }
      existing.latestUpdatedAt = Math.max(
        existing.latestUpdatedAt,
        session.updatedAt,
      );

      if (session.sessionKey.startsWith("project:")) {
        const currentProject = existing.project;
        if (!currentProject || session.updatedAt >= currentProject.updatedAt) {
          existing.project = {
            sessionKey: session.sessionKey,
            sessionId: session.sessionId,
            name: session.title,
            projectPath,
            updatedAt: session.updatedAt,
          };
        }
      } else {
        existing.sessions.push({
          sessionId: session.sessionId,
          sessionKey: session.sessionKey,
          title: session.title,
          updatedAt: session.updatedAt,
        });
      }

      sessionsByPath.set(pathKey, existing);
    }

    for (const entry of sessionsByPath.values()) {
      entry.sessions.sort((left, right) => right.updatedAt - left.updatedAt);
    }

    return [...sessionsByPath.values()]
      .map((entry) => {
        const project = entry.project;
        const projectPath = entry.projectPath;
        return {
          id:
            project?.sessionId ??
            `workspace:${normalizeProjectSegment(projectPath)}`,
          name: project?.name?.trim() || deriveWorkspaceName(projectPath),
          projectSessionKey: project?.sessionKey,
          projectPath,
          sessions: entry.sessions,
          updatedAt: project?.updatedAt ?? entry.latestUpdatedAt,
        };
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }, [sessions]);
  const pinnedWorkspaceSessions = useMemo<
    Array<WorkspaceSessionItem & { workspaceId: string }>
  >(() => {
    if (pinnedSessionIds.size === 0) {
      return [];
    }

    return workspaceNodes.flatMap((workspace) =>
      workspace.sessions
        .filter((session) => pinnedSessionIds.has(session.sessionId))
        .map((session) => ({
          ...session,
          workspaceId: workspace.id,
        })),
    );
  }, [workspaceNodes, pinnedSessionIds]);

  const taskProjectOptions = useMemo(() => {
    if (workspaceNodes.length === 0) {
      return [
        {
          label: "~",
          projectPath: "~",
        },
      ];
    }

    return workspaceNodes.map((workspace) => ({
      label: workspace.name,
      projectPath: workspace.projectPath,
    }));
  }, [workspaceNodes]);

  const versionStatus = useMemo(() => {
    if (isVersionLoading && !versionInfo) {
      return {
        label: "Checking updates",
        toneClassName: "text-muted-foreground",
      } as const;
    }

    if (versionInfo?.status === "update-available") {
      return {
        label: versionInfo.latestVersion
          ? `Update ${versionInfo.latestVersion}`
          : "Update available",
        toneClassName: "text-amber-300",
      } as const;
    }

    if (versionInfo?.status === "latest") {
      return {
        label: "Latest",
        toneClassName: "text-emerald-300",
      } as const;
    }

    if (versionInfo?.status === "unpublished") {
      return {
        label: "Release pending",
        toneClassName: "text-sky-300",
      } as const;
    }

    return {
      label: versionInfo?.installedVersion
        ? "Status unavailable"
        : "Version unavailable",
      toneClassName: "text-muted-foreground",
    } as const;
  }, [isVersionLoading, versionInfo]);

  const installedVersionLabel = versionInfo?.installedVersion?.trim() || "—";
  const versionSummaryLabel = `${versionStatus.label} · v${installedVersionLabel}`;

  const defaultTaskProjectPath = taskProjectOptions[0]?.projectPath ?? "~";
  const workspaceProjectNameByPath = useMemo(() => {
    const next = new Map<string, string>();
    for (const workspace of workspaceNodes) {
      const key = normalizePathForComparison(workspace.projectPath);
      if (!key) {
        continue;
      }
      next.set(key, workspace.name);
    }
    return next;
  }, [workspaceNodes]);
  const resolveTaskProjectLabel = useCallback(
    (projectPath: string | undefined): string => {
      const cleanedPath = projectPath?.trim() ?? "";
      if (!cleanedPath || cleanedPath === "~") {
        return "Home";
      }

      const normalizedPath = normalizePathForComparison(cleanedPath);
      if (normalizedPath) {
        const workspaceName = workspaceProjectNameByPath.get(normalizedPath);
        if (workspaceName) {
          return workspaceName;
        }
      }

      return deriveWorkspaceName(cleanedPath);
    },
    [workspaceProjectNameByPath],
  );

  const agentProjectOptions = useMemo<AgentProjectOption[]>(() => {
    if (workspaceNodes.length > 0) {
      return workspaceNodes.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        projectPath: workspace.projectPath,
      }));
    }

    const homeDir = state?.health.homeDir?.trim() || "~";
    return [
      {
        id: "home",
        name: "Home",
        projectPath: homeDir,
      },
    ];
  }, [workspaceNodes, state?.health.homeDir]);

  const selectedAgentProject = useMemo(() => {
    if (route.kind !== "agent") {
      return null;
    }

    const selectedProjectId = selectedProjectIdByAgentId[route.agentId];
    if (selectedProjectId) {
      const match = agentProjectOptions.find(
        (project) => project.id === selectedProjectId,
      );
      if (match) {
        return match;
      }
    }

    return agentProjectOptions[0] ?? null;
  }, [route, selectedProjectIdByAgentId, agentProjectOptions]);

  useEffect(() => {
    if (route.kind !== "agent") {
      return;
    }

    if (!selectedAgentProject) {
      return;
    }

    const currentProjectId = selectedProjectIdByAgentId[route.agentId];
    if (currentProjectId === selectedAgentProject.id) {
      return;
    }

    setSelectedProjectIdByAgentId((current) => ({
      ...current,
      [route.agentId]: selectedAgentProject.id,
    }));
  }, [route, selectedAgentProject, selectedProjectIdByAgentId]);

  const selectedAgentSessions = useMemo(() => {
    if (route.kind !== "agent") {
      return [];
    }

    return sessionsByAgentId[route.agentId] ?? [];
  }, [route, sessionsByAgentId]);

  const selectedAgentWorkspaceSession = useMemo(() => {
    if (route.kind !== "agent" || !selectedAgentProject) {
      return null;
    }

    const targetPath = normalizePathForComparison(
      selectedAgentProject.projectPath,
    );
    const candidates = selectedAgentSessions
      .filter((session) => {
        return normalizePathForComparison(session.projectPath) === targetPath;
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);

    return candidates[0] ?? null;
  }, [route, selectedAgentProject, selectedAgentSessions]);
  const selectedSessionProjectName = useMemo(() => {
    if (route.kind !== "session" || !selectedSession) {
      return null;
    }
    return resolveTaskProjectLabel(selectedSession.projectPath);
  }, [route, selectedSession, resolveTaskProjectLabel]);
  const selectedWikiTitle =
    route.kind === "page" && route.view === "wiki"
      ? wikiController.title
      : null;

  const activeChatContext = useMemo(() => {
    if (route.kind === "session" && selectedSession) {
      return {
        agentId: DEFAULT_AGENT_ID,
        sessionRef: selectedSession.sessionKey,
        projectPath: selectedSession.projectPath,
        chatKey: `session:${selectedSession.sessionId}`,
        historyRef: selectedSession.sessionKey,
      };
    }

    if (route.kind === "agent" && selectedAgentProject) {
      const sessionRef =
        selectedAgentWorkspaceSession?.sessionKey ??
        buildFrontendAgentProjectSessionRef(
          route.agentId,
          selectedAgentProject.projectPath,
        );
      return {
        agentId: route.agentId,
        sessionRef,
        projectPath: selectedAgentProject.projectPath,
        chatKey: `agent:${route.agentId}:${sessionRef}`,
        historyRef: selectedAgentWorkspaceSession?.sessionKey ?? null,
      };
    }

    return null;
  }, [
    route,
    selectedSession,
    selectedAgentProject,
    selectedAgentWorkspaceSession,
  ]);

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
    setCollapsedWorkspaceIds((current) => {
      const validIds = new Set(workspaceNodes.map((workspace) => workspace.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of current) {
        if (validIds.has(id)) {
          next.add(id);
          continue;
        }
        changed = true;
      }
      return changed ? next : current;
    });
  }, [workspaceNodes]);

  useEffect(() => {
    setExpandedWorkspaceSessionIds((current) => {
      const validIds = new Set(workspaceNodes.map((workspace) => workspace.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of current) {
        if (validIds.has(id)) {
          next.add(id);
          continue;
        }
        changed = true;
      }
      return changed ? next : current;
    });
  }, [workspaceNodes]);

  useEffect(() => {
    setPinnedSessionIds((current) => {
      if (current.size === 0) {
        return current;
      }

      const validSessionIds = new Set(
        workspaceNodes.flatMap((workspace) =>
          workspace.sessions.map((session) => session.sessionId),
        ),
      );
      let changed = false;
      const next = new Set<string>();
      for (const sessionId of current) {
        if (validSessionIds.has(sessionId)) {
          next.add(sessionId);
          continue;
        }
        changed = true;
      }
      return changed ? next : current;
    });
  }, [workspaceNodes]);

  useEffect(() => {
    if (route.kind === "taskWorkspace") {
      return;
    }

    setTaskDetailsDialogOpen(false);
    setSelectedTaskId(null);
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
    if (!isTaskDetailsDialogOpen) {
      return;
    }

    if (!selectedTask) {
      setTaskDetailsDialogOpen(false);
      setSelectedTaskId(null);
    }
  }, [isTaskDetailsDialogOpen, selectedTask]);

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
              project: defaultTaskProjectPath,
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
  }, [
    taskWorkspaces,
    getAssignableAgents,
    taskActorId,
    defaultTaskProjectPath,
  ]);

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

  async function handleCreateAgent(options?: {
    fromDialog?: boolean;
  }): Promise<void> {
    if (!createForm.name.trim()) {
      if (options?.fromDialog) {
        setCreateAgentDialogError("Agent name is required.");
      } else {
        toast.error("Agent name is required.");
      }
      return;
    }

    if (!state || agents.length === 0) {
      if (options?.fromDialog) {
        setCreateAgentDialogError("No available manager targets found.");
      } else {
        toast.error("No available manager targets found.");
      }
      return;
    }

    const allowedReportsTo = new Set(agents.map((agent) => agent.id));
    const reportsTo = allowedReportsTo.has(createForm.reportsTo)
      ? createForm.reportsTo
      : agents[0]?.id ?? "";
    if (!reportsTo) {
      if (options?.fromDialog) {
        setCreateAgentDialogError("Reports To is required.");
      } else {
        toast.error("Reports To is required.");
      }
      return;
    }

    const submittedName = createForm.name;
    const submittedNameTrimmed = submittedName.trim();
    const submittedRole = createForm.role.trim();

    setMutating(true);
    if (options?.fromDialog) {
      setCreateAgentDialogError(null);
    } else {
    }

    try {
      const response = await fetchJson<{ message?: string }>("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: createForm.name,
          reportsTo,
          ...(submittedRole ? { role: submittedRole } : {}),
        }),
      });

      toast.success(
        response.message ?? `Agent \"${submittedName}\" processed.`,
      );
      setCreateForm((current) => {
        if (current.name.trim() !== submittedNameTrimmed) {
          return current;
        }
        return { ...current, name: "", role: "" };
      });
      if (options?.fromDialog) {
        setCreateAgentDialogOpen(false);
      }
      await refreshOverview();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to create agent.";
      if (options?.fromDialog) {
        setCreateAgentDialogError(message);
      } else {
        toast.error(message);
      }
    } finally {
      setMutating(false);
    }
  }

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

  async function handleAddProject(): Promise<void> {
    setMutating(true);

    try {
      const picked = await fetchJson<PickProjectResponse>(
        "/api/projects/pick",
        {
          method: "POST",
        },
      );

      const response = await fetchJson<CreateProjectResponse>("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId: "ceo",
          folderName: picked.project.name,
          folderPath: picked.project.path,
        }),
      });

      toast.success(
        response.message ?? `Project \"${response.project.name}\" added.`,
      );
      await refreshSessions();
      navigateToRoute({
        kind: "session",
        sessionId: response.session.sessionId,
      });
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to add project.";
      toast.error(message);
    } finally {
      setMutating(false);
    }
  }

  async function handleCreateWorkspaceSession(
    workspace: WorkspaceNode,
  ): Promise<void> {
    setMutating(true);
    setOpenWorkspaceMenuId(null);
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
            agentId: "ceo",
            projectPath: workspace.projectPath,
            workspaceName: workspace.name,
          }),
        },
      );

      toast.success(
        response.message ?? `Session created in \"${workspace.name}\".`,
      );
      await refreshSessions();
      navigateToRoute({
        kind: "session",
        sessionId: response.session.sessionId,
      });
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to create workspace session.";
      toast.error(message);
    } finally {
      setMutating(false);
    }
  }

  async function handleRenameWorkspace(
    workspace: WorkspaceNode,
  ): Promise<void> {
    if (!workspace.projectSessionKey) {
      toast.error("Workspace metadata is unavailable for rename.");
      return;
    }

    const nextName = window
      .prompt(`Rename workspace \"${workspace.name}\"`, workspace.name)
      ?.trim();
    if (!nextName || nextName === workspace.name) {
      return;
    }

    setMutating(true);
    setOpenWorkspaceMenuId(null);
    setOpenSessionMenuId(null);

    try {
      const response = await fetchJson<WorkspaceRenameResponse>(
        "/api/workspaces/rename",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agentId: "ceo",
            sessionRef: workspace.projectSessionKey,
            name: nextName,
          }),
        },
      );

      toast.success(
        response.message ?? `Workspace renamed to \"${nextName}\".`,
      );
      await refreshSessions();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to rename workspace.";
      toast.error(message);
    } finally {
      setMutating(false);
    }
  }

  async function handleDeleteWorkspace(
    workspace: WorkspaceNode,
  ): Promise<void> {
    if (!workspace.projectSessionKey) {
      toast.error("Workspace metadata is unavailable for removal.");
      return;
    }

    const confirmed = window.confirm(
      `Remove workspace \"${workspace.name}\" from sidebar? Sessions will be kept.`,
    );
    if (!confirmed) {
      return;
    }

    setMutating(true);
    setOpenWorkspaceMenuId(null);
    setOpenSessionMenuId(null);

    try {
      const response = await fetchJson<WorkspaceDeleteResponse>(
        "/api/workspaces/delete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agentId: "ceo",
            sessionRef: workspace.projectSessionKey,
          }),
        },
      );

      toast.success(
        response.message ?? `Workspace \"${workspace.name}\" removed.`,
      );
      await refreshSessions();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to remove workspace.";
      toast.error(message);
    } finally {
      setMutating(false);
    }
  }

  async function handleRemoveSession(
    session: WorkspaceSessionItem,
  ): Promise<void> {
    const confirmed = window.confirm(`Remove session \"${session.title}\"?`);
    if (!confirmed) {
      return;
    }

    setMutating(true);
    setOpenSessionMenuId(null);
    setOpenWorkspaceMenuId(null);

    try {
      const response = await fetchJson<SessionRemoveResponse>(
        "/api/sessions/remove",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agentId: "ceo",
            sessionRef: session.sessionKey,
          }),
        },
      );

      toast.success(
        response.message ?? `Session \"${session.title}\" removed.`,
      );
      await refreshSessions();
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
    session: WorkspaceSessionItem,
  ): Promise<void> {
    const nextName = window
      .prompt(`Rename session \"${session.title}\"`, session.title)
      ?.trim();
    if (!nextName || nextName === session.title) {
      return;
    }

    setMutating(true);
    setOpenSessionMenuId(null);
    setOpenWorkspaceMenuId(null);

    try {
      const response = await fetchJson<SessionRenameResponse>(
        "/api/sessions/rename",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agentId: "ceo",
            sessionRef: session.sessionKey,
            name: nextName,
          }),
        },
      );

      toast.success(response.message ?? `Session renamed to \"${nextName}\".`);
      await refreshSessions();
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
        project: defaultTaskProjectPath,
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
      toast.error("Authentication username is required when protection is enabled.");
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
    if (hasNewAuthPassword && nextAuthPassword !== nextAuthPasswordConfirmation) {
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
      toast.error("Current password is required to change authentication settings.");
      return;
    }

    const parsedMaxInactivityMinutes = Number.parseInt(
      maxInactivityMinutesInput.trim(),
      10,
    );
    const isMaxInactivityValid =
      Number.isFinite(parsedMaxInactivityMinutes) &&
      parsedMaxInactivityMinutes >= MIN_MAX_INACTIVITY_MINUTES &&
      parsedMaxInactivityMinutes <= MAX_MAX_INACTIVITY_MINUTES;
    if (
      taskCronEnabledInput &&
      notifyManagersOfInactiveAgentsInput &&
      !isMaxInactivityValid
    ) {
      toast.error(
        `Max inactivity time must be an integer between ${MIN_MAX_INACTIVITY_MINUTES} and ${MAX_MAX_INACTIVITY_MINUTES} minutes.`,
      );
      return;
    }
    const fallbackMaxInactivityMinutes =
      state?.settings.maxInactivityMinutes ?? DEFAULT_MAX_INACTIVITY_MINUTES;
    const resolvedMaxInactivityMinutes = isMaxInactivityValid
      ? parsedMaxInactivityMinutes
      : fallbackMaxInactivityMinutes;

    setMutating(true);
    try {
      const settingsPayload: {
        taskCronEnabled: boolean;
        notifyManagersOfInactiveAgents: boolean;
        maxInactivityMinutes: number;
        inactiveAgentNotificationTarget: InactiveAgentNotificationTarget;
        authentication?: {
          enabled: boolean;
          username?: string;
          password?: string;
          currentPassword?: string;
        };
      } = {
        taskCronEnabled: taskCronEnabledInput,
        notifyManagersOfInactiveAgents: notifyManagersOfInactiveAgentsInput,
        maxInactivityMinutes: resolvedMaxInactivityMinutes,
        inactiveAgentNotificationTarget:
          inactiveAgentNotificationTargetInput,
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
        : notifyManagersOfInactiveAgentsInput
          ? `Task automation checks enabled every ${TASK_CRON_INTERVAL_MINUTES} minute(s); inactivity notifications enabled (${resolvedMaxInactivityMinutes} minutes).`
          : `Task automation checks enabled every ${TASK_CRON_INTERVAL_MINUTES} minute(s); inactivity notifications disabled.`;
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

  async function persistUiSettings(
    settings: {
      taskCronEnabled: boolean;
      notifyManagersOfInactiveAgents: boolean;
      maxInactivityMinutes: number;
      inactiveAgentNotificationTarget: InactiveAgentNotificationTarget;
      authentication?: {
        enabled: boolean;
        username?: string;
        password?: string;
        currentPassword?: string;
      };
    },
  ): Promise<{ settings: UiSettings; message?: string }> {
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
    setState((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        settings: response.settings,
      };
    });
    setTaskCronEnabledInput(response.settings.taskCronEnabled);
    setMaxInactivityMinutesInput(
      String(response.settings.maxInactivityMinutes),
    );
    setNotifyManagersOfInactiveAgentsInput(
      response.settings.notifyManagersOfInactiveAgents,
    );
    setInactiveAgentNotificationTargetInput(
      response.settings.inactiveAgentNotificationTarget,
    );
    setUiAuthenticationEnabledInput(response.settings.authentication.enabled);
    setUiAuthenticationUsernameInput(response.settings.authentication.username);
    setUiAuthenticationHasPassword(response.settings.authentication.hasPassword);
  }

  async function handleCreateTask(
    taskWorkspaceId: string,
    options?: { fromDialog?: boolean },
  ): Promise<void> {
    const draft = taskDraftByWorkspaceId[taskWorkspaceId];
    const validTaskProjects = new Set(
      taskProjectOptions.map((option) => option.projectPath),
    );
    const rawProject = draft?.project.trim() ?? "";
    const title = draft?.title.trim() ?? "";
    const description = draft?.description.trim() ?? "";
    const project =
      validTaskProjects.size > 0 && !validTaskProjects.has(rawProject)
        ? defaultTaskProjectPath
        : rawProject || defaultTaskProjectPath;
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
          project,
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
              project: defaultTaskProjectPath,
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
        setTaskDetailsDialogOpen(false);
        setSelectedTaskId(null);
        setTaskDetailsError(null);
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
    setSelectedTaskId(taskId);
    setTaskDetailsDialogOpen(true);
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

    try {
      const payload = {
        agentId: activeChatContext.agentId,
        sessionRef: activeChatContext.sessionRef,
        projectPath: activeChatContext.projectPath,
        message,
        images,
      };
      const response = await sendSessionMessageStream(payload, {
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
    }
  }

  async function sendSessionMessageStream(
    payload: {
      agentId: string;
      sessionRef: string;
      projectPath?: string;
      message: string;
      images?: SessionMessageImageInput[];
    },
    options?: {
      onEvent?: (event: SessionMessageStreamEvent) => void;
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

    return sendSessionMessage(payload);
  }

  async function sendSessionMessage(payload: {
    agentId: string;
    sessionRef: string;
    projectPath?: string;
    message: string;
    images?: SessionMessageImageInput[];
  }): Promise<SessionSendMessageResponse> {
    const routes = ["/api/sessions/message", "/api/session/message"];
    let lastError: unknown;

    for (const routePath of routes) {
      try {
        return await fetchJson<SessionSendMessageResponse>(routePath, {
          method: "POST",
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
  const renderWorkspaceSessionRow = (
    session: WorkspaceSessionItem,
    key: string,
  ): ReactElement => {
    const isPinnedSession = pinnedSessionIds.has(session.sessionId);

    return (
      <div key={key} className="group/session relative">
        <button
          type="button"
          title={`${session.title} (${session.sessionKey})`}
          onClick={() => {
            navigateToRoute({
              kind: "session",
              sessionId: session.sessionId,
            });
            setOpenWorkspaceMenuId(null);
          }}
          className="flex w-full items-center rounded-md px-3 py-1 pr-8 text-left text-[13px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <span className="inline-block size-4 shrink-0" aria-hidden="true" />
          <span className="ml-2 truncate">{session.title}</span>
        </button>
        <button
          type="button"
          aria-label={
            isPinnedSession
              ? `Unpin ${session.title}`
              : `Pin ${session.title}`
          }
          title={isPinnedSession ? "Unpin session" : "Pin session"}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setPinnedSessionIds((current) => {
              const next = new Set(current);
              if (next.has(session.sessionId)) {
                next.delete(session.sessionId);
              } else {
                next.add(session.sessionId);
              }
              return next;
            });
            setOpenSessionMenuId(null);
          }}
          className={cn(
            "absolute left-3 top-1/2 z-10 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded-sm transition-colors hover:text-foreground",
            isPinnedSession
              ? "text-foreground"
              : "text-muted-foreground opacity-0 group-hover/session:opacity-100",
          )}
        >
          <Pin className="size-3 icon-stroke-1" />
        </button>
        <button
          type="button"
          aria-label={`Session menu for ${session.title}`}
          title="Session menu"
          disabled={isMutating}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpenWorkspaceMenuId(null);
            setOpenSessionMenuId((current) =>
              current === session.sessionId ? null : session.sessionId,
            );
          }}
          className={cn(
            "absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50",
            openSessionMenuId === session.sessionId
              ? "opacity-100"
              : "opacity-0 group-hover/session:opacity-100",
          )}
        >
          <MoreHorizontal className="size-3.5" />
        </button>
        {openSessionMenuId === session.sessionId ? (
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
              <label className="text-sm font-medium text-foreground" htmlFor="ui-signin-username">
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
              <label className="text-sm font-medium text-foreground" htmlFor="ui-signin-password">
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
            {SIDEBAR_ITEMS.map((item) => {
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
            })}

            <Separator className="my-2 bg-border/70" />

            {!isSidebarCollapsed && pinnedWorkspaceSessions.length > 0 ? (
              <div className="mb-1 mt-0.5 space-y-0.5">
                {pinnedWorkspaceSessions.map((session) =>
                  renderWorkspaceSessionRow(
                    session,
                    `pinned:${session.workspaceId}:${session.sessionId}`,
                  ),
                )}
                <Separator className="my-2 bg-border/60" />
              </div>
            ) : null}

            <button
              type="button"
              title="Add Project"
              onClick={() => {
                void handleAddProject();
              }}
              className={cn(
                "mb-1 flex w-full items-center rounded-lg border border-transparent px-3 py-2.5 text-[14px] text-muted-foreground transition-colors hover:border-border/60 hover:bg-accent/60 hover:text-foreground",
                isSidebarCollapsed && "justify-center px-2",
              )}
              disabled={isMutating || isLoading}
            >
              <FolderPlus className="size-4 shrink-0" />
              {!isSidebarCollapsed ? (
                <span className="ml-2">Add Project</span>
              ) : null}
            </button>

            {workspaceNodes.map((workspace) => {
              const isWorkspaceCollapsed = collapsedWorkspaceIds.has(
                workspace.id,
              );
              const visibleSessionsForWorkspace = workspace.sessions.filter(
                (session) => !pinnedSessionIds.has(session.sessionId),
              );
              const isWorkspaceSessionsExpanded =
                expandedWorkspaceSessionIds.has(workspace.id);
              const hasHiddenWorkspaceSessions =
                visibleSessionsForWorkspace.length > MAX_VISIBLE_WORKSPACE_SESSIONS;
              const visibleWorkspaceSessions = isWorkspaceSessionsExpanded
                ? visibleSessionsForWorkspace
                : visibleSessionsForWorkspace.slice(
                    0,
                    MAX_VISIBLE_WORKSPACE_SESSIONS,
                  );
              const canManageWorkspace = Boolean(workspace.projectSessionKey);
              const FolderIcon = isWorkspaceCollapsed ? Folder : FolderOpen;

              return (
                <div key={workspace.id} className="relative mb-1">
                  <div
                    className="relative"
                    onMouseEnter={() => setHoveredWorkspaceId(workspace.id)}
                    onMouseLeave={() => {
                      setHoveredWorkspaceId((current) =>
                        current === workspace.id ? null : current,
                      );
                    }}
                  >
                    <button
                      type="button"
                      title={`${workspace.name} (${workspace.projectPath})`}
                      onClick={() => {
                        setCollapsedWorkspaceIds((current) => {
                          const next = new Set(current);
                          if (next.has(workspace.id)) {
                            next.delete(workspace.id);
                          } else {
                            next.add(workspace.id);
                          }
                          return next;
                        });
                        setOpenWorkspaceMenuId(null);
                        setOpenSessionMenuId(null);
                      }}
                      className={cn(
                        "flex w-full items-center rounded-lg border border-transparent px-3 py-2.5 pr-16 text-[14px] text-muted-foreground transition-colors hover:border-border/60 hover:bg-accent/60 hover:text-foreground",
                        isSidebarCollapsed && "justify-center px-2 pr-2",
                      )}
                    >
                      <FolderIcon className="size-4 shrink-0" />
                      {!isSidebarCollapsed ? (
                        <span className="ml-2 truncate">{workspace.name}</span>
                      ) : null}
                    </button>

                    {!isSidebarCollapsed &&
                    (hoveredWorkspaceId === workspace.id ||
                      openWorkspaceMenuId === workspace.id) ? (
                      <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`New session in ${workspace.name}`}
                          title="New Session"
                          disabled={isMutating}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setOpenSessionMenuId(null);
                            void handleCreateWorkspaceSession(workspace);
                          }}
                          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                        >
                          <Plus className="size-3.5 icon-stroke-1" />
                        </button>
                        {canManageWorkspace ? (
                          <button
                            type="button"
                            aria-label={`Workspace menu for ${workspace.name}`}
                            title="More"
                            disabled={isMutating}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setOpenSessionMenuId(null);
                              setOpenWorkspaceMenuId((current) =>
                                current === workspace.id ? null : workspace.id,
                              );
                            }}
                            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                          >
                            <MoreHorizontal className="size-3.5 icon-stroke-1" />
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {!isSidebarCollapsed &&
                    canManageWorkspace &&
                    openWorkspaceMenuId === workspace.id ? (
                      <div className="absolute right-2 top-9 z-20 min-w-[140px] rounded-md border border-border bg-card p-1 shadow-lg">
                        <button
                          type="button"
                          className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent/80"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void handleRenameWorkspace(workspace);
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
                            void handleDeleteWorkspace(workspace);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {!isSidebarCollapsed && !isWorkspaceCollapsed ? (
                    <div className="mt-0.5 space-y-0.5">
                      {visibleWorkspaceSessions.map((session) =>
                        renderWorkspaceSessionRow(session, session.sessionId),
                      )}
                      {hasHiddenWorkspaceSessions ? (
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedWorkspaceSessionIds((current) => {
                              const next = new Set(current);
                              if (next.has(workspace.id)) {
                                next.delete(workspace.id);
                              } else {
                                next.add(workspace.id);
                              }
                              return next;
                            });
                            setOpenSessionMenuId(null);
                          }}
                          className="flex w-full items-center rounded-md px-3 py-1 text-left text-[13px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                        >
                          <span
                            className="inline-block size-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="ml-2">
                            {isWorkspaceSessionsExpanded
                              ? "Show less"
                              : `Show more (${visibleSessionsForWorkspace.length - MAX_VISIBLE_WORKSPACE_SESSIONS})`}
                          </span>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="border-t border-border p-3">
            {!isSidebarCollapsed ? (
              <p
                className="mb-2 truncate px-1 text-[11px]"
                title={`OpenGoat v${installedVersionLabel} · ${versionStatus.label}`}
              >
                <span className="text-muted-foreground">OpenGoat </span>
                <span className="font-semibold text-foreground">
                  v{installedVersionLabel}
                </span>
                <span className="text-muted-foreground"> · </span>
                <span className={versionStatus.toneClassName}>
                  {versionStatus.label}
                </span>
              </p>
            ) : (
              <div className="mb-2 flex justify-center">
                <div
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-md border border-border/70 bg-accent/40 text-[10px] text-muted-foreground",
                  )}
                  title={versionSummaryLabel}
                  aria-label={versionSummaryLabel}
                >
                  v
                </div>
              </div>
            )}

            <div
              className={cn(
                "flex items-center",
                isSidebarCollapsed ? "justify-center" : "justify-end",
              )}
            >
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
                  <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                    {selectedAgent?.displayName ?? route.agentId}
                  </h1>
                </div>
              ) : route.kind === "session" ? (
                <div className="flex min-w-0 items-center gap-3">
                  <AgentAvatar
                    agentId={defaultEntryAgent?.id ?? DEFAULT_AGENT_ID}
                    displayName={
                      defaultEntryAgent?.displayName ??
                      DEFAULT_AGENT_ID.toUpperCase()
                    }
                    size="md"
                  />
                  <div className="flex min-w-0 items-center gap-2">
                    <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                      {defaultEntryAgent?.displayName ??
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
                      : viewTitle(route, selectedSession, selectedTaskWorkspace)}
                  </h1>
                </div>
              )}

              {route.kind === "page" && route.view === "agents" ? (
                <Button
                  size="sm"
                  onClick={openCreateAgentDialog}
                  disabled={isLoading || isMutating}
                >
                  Create Agent
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
                    state?.settings.taskCronEnabled ?? taskCronEnabledInput
                      ? "border-success/50 bg-success/15 text-success hover:bg-success/20"
                      : "border-red-500/70 bg-red-600/25 text-red-200 hover:bg-red-600/35",
                  )}
                  title="Open settings"
                  aria-label="Open settings"
                >
                  {state?.settings.taskCronEnabled ?? taskCronEnabledInput
                    ? "Running"
                    : "Stopped"}
                </button>
              ) : null}

              {route.kind === "agent" ? (
                <div className="flex min-w-[220px] items-center gap-2">
                  <label
                    className="text-xs uppercase tracking-wide text-muted-foreground"
                    htmlFor="agentProjectSelector"
                  >
                    Project
                  </label>
                  <select
                    id="agentProjectSelector"
                    className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={selectedAgentProject?.id ?? ""}
                    onChange={(event) => {
                      const nextProjectId = event.target.value;
                      setSelectedProjectIdByAgentId((current) => ({
                        ...current,
                        [route.agentId]: nextProjectId,
                      }));
                    }}
                  >
                    {agentProjectOptions.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {route.kind === "session" ? (
                <div className="flex min-w-[220px] items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Project
                  </span>
                  <span
                    className="inline-flex h-9 min-w-0 flex-1 items-center rounded-md border border-border bg-background px-3 text-sm text-foreground"
                    title={selectedSessionProjectName ?? "Home"}
                  >
                    <span className="truncate">
                      {selectedSessionProjectName ?? "Home"}
                    </span>
                  </span>
                </div>
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
                      disabled={wikiController.isSaving || wikiController.isDeleting}
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

          <Dialog
            open={isCreateAgentDialogOpen}
            onOpenChange={(open) => {
              setCreateAgentDialogOpen(open);
              setCreateAgentDialogError(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Agent</DialogTitle>
                <DialogDescription>
                  Create an agent and assign a reporting manager.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label
                    className="text-xs uppercase tracking-wide text-muted-foreground"
                    htmlFor="createAgentName"
                  >
                    Name
                  </label>
                  <Input
                    id="createAgentName"
                    value={createForm.name}
                    onChange={(event) =>
                      setCreateForm((value) => ({
                        ...value,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Developer"
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        createForm.name.trim() &&
                        !isMutating &&
                        !isLoading
                      ) {
                        event.preventDefault();
                        void handleCreateAgent({
                          fromDialog: true,
                        });
                      }
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    className="text-xs uppercase tracking-wide text-muted-foreground"
                    htmlFor="createAgentRole"
                  >
                    Role (Optional)
                  </label>
                  <Input
                    id="createAgentRole"
                    value={createForm.role}
                    onChange={(event) =>
                      setCreateForm((value) => ({
                        ...value,
                        role: event.target.value,
                      }))
                    }
                    placeholder="Software Engineer"
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        createForm.name.trim() &&
                        !isMutating &&
                        !isLoading
                      ) {
                        event.preventDefault();
                        void handleCreateAgent({
                          fromDialog: true,
                        });
                      }
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    className="text-xs uppercase tracking-wide text-muted-foreground"
                    htmlFor="createAgentReportsTo"
                  >
                    Reports To
                  </label>
                  <select
                    id="createAgentReportsTo"
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={createForm.reportsTo}
                    onChange={(event) =>
                      setCreateForm((value) => ({
                        ...value,
                        reportsTo: event.target.value,
                      }))
                    }
                  >
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.displayName} ({agent.id})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    You can only assign existing agents as manager.
                  </p>
                </div>
              </div>

              {createAgentDialogError ? (
                <p className="text-sm text-danger">{createAgentDialogError}</p>
              ) : null}

              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => setCreateAgentDialogOpen(false)}
                  disabled={isMutating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    void handleCreateAgent({
                      fromDialog: true,
                    });
                  }}
                  disabled={isMutating || isLoading || !createForm.name.trim()}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
                    project: defaultTaskProjectPath,
                    assignedTo: taskActorId,
                    status: "todo" as const,
                  };
                  const assignableAgents = getAssignableAgents(taskActorId);
                  const projectValue = taskProjectOptions.some(
                    (option) => option.projectPath === draft.project,
                  )
                    ? draft.project
                    : defaultTaskProjectPath;

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
                            htmlFor="createTaskProject"
                          >
                            Project
                          </label>
                          <select
                            id="createTaskProject"
                            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            value={projectValue}
                            onChange={(event) =>
                              updateTaskDraft(
                                selectedTaskWorkspace.taskWorkspaceId,
                                {
                                  project: event.target.value,
                                },
                              )
                            }
                          >
                            {taskProjectOptions.map((projectOption) => (
                              <option
                                key={projectOption.projectPath}
                                value={projectOption.projectPath}
                              >
                                {projectOption.label}
                              </option>
                            ))}
                          </select>
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
            open={isTaskDetailsDialogOpen && Boolean(selectedTask)}
            onOpenChange={(open) => {
              setTaskDetailsDialogOpen(open);
              if (!open) {
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
                            {blocker}
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
                            <p className="text-sm leading-relaxed">
                              {entry.content}
                            </p>
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
              {SIDEBAR_ITEMS.map((item) => {
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
              })}

              <button
                type="button"
                onClick={() => {
                  void handleAddProject();
                }}
                className="inline-flex items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                disabled={isMutating || isLoading}
              >
                <FolderPlus className="size-4" />
                Add Project
              </button>
            </div>
          </div>

          <main
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6",
              route.kind === "session" || route.kind === "agent"
                ? "overflow-hidden"
                : "overflow-y-auto",
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
                  route.kind === "session" || route.kind === "agent"
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
                      <div className="grid gap-3 xl:grid-cols-3">
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
                        onCreateAgentClick={openCreateAgentDialog}
                        isCreateAgentDisabled={isLoading || isMutating}
                      />
                    ) : agents.length === 1 ? (
                      <OrganizationGetStartedPanel
                        ceoAgent={
                          agents.find((agent) => agent.id === DEFAULT_AGENT_ID) ??
                          agents[0] ??
                          null
                        }
                        onCreateAgentClick={openCreateAgentDialogForCeo}
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
                    onBackToTasks={() => {
                      navigateToRoute({
                        kind: "taskWorkspace",
                        taskWorkspaceId: "tasks",
                      });
                    }}
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
                    resolveTaskProjectLabel={resolveTaskProjectLabel}
                  />
                ) : null}

                {route.kind === "session" || route.kind === "agent" ? (
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
                                      <MessageResponse>
                                        {message.content}
                                      </MessageResponse>
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

                      <PromptInput
                        accept="image/*"
                        className="mt-4 shrink-0"
                        onSubmit={(message) => {
                          void handleSessionPromptSubmit(message);
                        }}
                      >
                        <PromptInputBody>
                          <PromptInputTextarea
                            placeholder={
                              route.kind === "agent"
                                ? `Message ${
                                    selectedAgent?.displayName ?? route.agentId
                                  }...`
                                : "Message this session..."
                            }
                            disabled={
                              sessionChatStatus === "streaming" ||
                              isLoading ||
                              isMutating
                            }
                          />
                        </PromptInputBody>
                        <PromptInputFooter className="justify-end">
                          <PromptInputSubmit
                            status={sessionChatStatus}
                            disabled={
                              sessionChatStatus === "streaming" ||
                              isLoading ||
                              isMutating
                            }
                          />
                        </PromptInputFooter>
                      </PromptInput>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {route.kind === "session"
                        ? `No saved session was found for id ${route.sessionId}.`
                        : `No chat workspace is available for agent ${route.agentId}.`}
                    </p>
                  )
                ) : null}

                {route.kind === "page" && route.view === "skills" ? (
                  <SkillsPage
                    liveAssignedSkillsCount={state.agentSkills.skills.length}
                    liveGlobalSkillsCount={state.globalSkills.skills.length}
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
                  <section className="mx-auto w-full max-w-3xl space-y-6">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Control background automation checks and inactive-agent
                        alerts.
                      </p>
                    </div>

                    <section className="overflow-hidden rounded-xl border border-border/70 bg-background/40">
                      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                        <div className="space-y-1">
                          <h2 className="text-sm font-semibold text-foreground">
                            Background Task Automation
                          </h2>
                          <p className="text-xs text-muted-foreground">
                            Keep this on to run recurring background checks.
                            These checks drive task follow-ups (like todo and
                            blocked reminders) and optional inactivity alerts.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Check cadence: every {TASK_CRON_INTERVAL_MINUTES}{" "}
                            minute.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={taskCronEnabledInput}
                            disabled={isMutating || isLoading}
                            onCheckedChange={(checked) => {
                              setTaskCronEnabledInput(checked);
                            }}
                            aria-label="Toggle task automation checks"
                          />
                          <span
                            className={cn(
                              "text-xs font-medium",
                              taskCronEnabledInput
                                ? "text-success"
                                : "text-muted-foreground",
                            )}
                          >
                            {taskCronEnabledInput
                              ? "Enabled"
                              : "Disabled"}
                          </span>
                        </div>
                      </div>

                      <Separator className="bg-border/60" />

                      <div
                        className={cn(
                          "space-y-4 px-5 py-4",
                          !taskCronEnabledInput && "opacity-60",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-foreground">
                              Notify Managers of Inactive Agents
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              Alert managers when their reportees have no recent
                              assistant activity.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={notifyManagersOfInactiveAgentsInput}
                              disabled={
                                !taskCronEnabledInput || isMutating || isLoading
                              }
                              onCheckedChange={(checked) => {
                                setNotifyManagersOfInactiveAgentsInput(checked);
                              }}
                              aria-label="Toggle inactive-agent manager notifications"
                            />
                            <span
                              className={cn(
                                "text-xs font-medium",
                                notifyManagersOfInactiveAgentsInput &&
                                  taskCronEnabledInput
                                  ? "text-success"
                                  : "text-muted-foreground",
                              )}
                            >
                              {notifyManagersOfInactiveAgentsInput &&
                              taskCronEnabledInput
                                ? "Enabled"
                                : "Disabled"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label
                            className="text-sm font-medium text-foreground"
                            htmlFor="maxInactivityMinutes"
                          >
                            Max Inactivity Time
                          </label>
                          <div className="flex max-w-sm items-center gap-3">
                            <Input
                              id="maxInactivityMinutes"
                              type="number"
                              min={MIN_MAX_INACTIVITY_MINUTES}
                              max={MAX_MAX_INACTIVITY_MINUTES}
                              step={1}
                              value={maxInactivityMinutesInput}
                              disabled={
                                !taskCronEnabledInput ||
                                !notifyManagersOfInactiveAgentsInput ||
                                isMutating ||
                                isLoading
                              }
                              onChange={(event) => {
                                setMaxInactivityMinutesInput(
                                  event.target.value,
                                );
                              }}
                            />
                            <span className="text-sm text-muted-foreground">
                              minutes
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Managers are notified after this many minutes with
                            no assistant activity.
                          </p>
                        </div>

                        <Separator className="bg-border/50" />

                        <div className="space-y-2">
                          <label
                            className="text-sm font-medium text-foreground"
                            htmlFor="inactiveAgentNotificationTarget"
                          >
                            Notify CEO only
                          </label>
                          <Select
                            value={inactiveAgentNotificationTargetInput}
                            onValueChange={(nextValue) => {
                              setInactiveAgentNotificationTargetInput(
                                nextValue as InactiveAgentNotificationTarget,
                              );
                            }}
                            disabled={
                              !taskCronEnabledInput ||
                              !notifyManagersOfInactiveAgentsInput ||
                              isMutating ||
                              isLoading
                            }
                          >
                            <SelectTrigger
                              id="inactiveAgentNotificationTarget"
                              className="max-w-sm"
                            >
                              <SelectValue placeholder="Select who gets inactivity notifications" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all-managers">
                                Notify all managers
                              </SelectItem>
                              <SelectItem value="ceo-only">
                                Notify only CEO
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {inactiveAgentNotificationTargetInput === "ceo-only"
                              ? "Only the CEO receives inactivity alerts, and only for agents that report directly to the CEO."
                              : "Every manager receives inactivity alerts for their own direct reports."}
                          </p>
                        </div>

                        {!taskCronEnabledInput ? (
                          <p className="text-xs text-muted-foreground">
                            Background checks are paused. Enable task automation
                            above to resume todo, blocked, and inactivity
                            checks.
                          </p>
                        ) : !notifyManagersOfInactiveAgentsInput ? (
                          <p className="text-xs text-muted-foreground">
                            Task automation is still running every{" "}
                            {TASK_CRON_INTERVAL_MINUTES} minute for todo and
                            blocked follow-ups. Only inactivity alerts are
                            paused.
                          </p>
                        ) : null}
                      </div>
                    </section>

                    <section className="overflow-hidden rounded-xl border border-border/70 bg-background/40">
                      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                        <div className="space-y-1">
                          <h2 className="text-sm font-semibold text-foreground">
                            UI Authentication
                          </h2>
                          <p className="text-xs text-muted-foreground">
                            Require a username and password before API access to this UI.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Use HTTPS when exposing this port publicly.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={uiAuthenticationEnabledInput}
                            disabled={isMutating || isLoading}
                            onCheckedChange={(checked) => {
                              setUiAuthenticationEnabledInput(checked);
                              if (!checked) {
                                setUiAuthenticationPasswordEditorOpen(false);
                              }
                            }}
                            aria-label="Toggle UI authentication"
                          />
                          <span
                            className={cn(
                              "text-xs font-medium",
                              uiAuthenticationEnabledInput
                                ? "text-success"
                                : "text-muted-foreground",
                            )}
                          >
                            {uiAuthenticationEnabledInput ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      </div>

                      <Separator className="bg-border/60" />

                      <div className="space-y-4 px-5 py-4">
                        <div className="space-y-2">
                          <label
                            className="text-sm font-medium text-foreground"
                            htmlFor="uiAuthenticationUsername"
                          >
                            Username
                          </label>
                          <Input
                            id="uiAuthenticationUsername"
                            autoComplete="username"
                            value={uiAuthenticationUsernameInput}
                            disabled={isMutating || isLoading}
                            onChange={(event) => {
                              setUiAuthenticationUsernameInput(event.target.value);
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            3-64 characters: lowercase letters, numbers, dots, dashes, or underscores.
                          </p>
                        </div>

                        {uiAuthenticationEnabledInput &&
                        uiAuthenticationHasPassword &&
                        !uiAuthenticationPasswordEditorOpen ? (
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/30 px-3 py-3">
                            <p className="text-xs text-muted-foreground">
                              Password is already configured. Use Change Password to rotate credentials.
                            </p>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={isMutating || isLoading}
                              onClick={() => {
                                setUiAuthenticationPasswordEditorOpen(true);
                                setUiAuthenticationCurrentPasswordInput("");
                                setUiAuthenticationPasswordInput("");
                                setUiAuthenticationPasswordConfirmationInput("");
                              }}
                            >
                              Change Password
                            </Button>
                          </div>
                        ) : null}

                        {showAuthenticationPasswordEditor ? (
                          <div className="space-y-4">
                            {uiAuthenticationEnabledInput &&
                            uiAuthenticationHasPassword &&
                            uiAuthenticationPasswordEditorOpen ? (
                              <div className="flex items-center justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={isMutating || isLoading}
                                  onClick={() => {
                                    setUiAuthenticationPasswordEditorOpen(false);
                                    setUiAuthenticationCurrentPasswordInput("");
                                    setUiAuthenticationPasswordInput("");
                                    setUiAuthenticationPasswordConfirmationInput("");
                                  }}
                                >
                                  Cancel Password Change
                                </Button>
                              </div>
                            ) : null}

                            {showAuthenticationCurrentPasswordInput ? (
                              <div className="space-y-2">
                                <label
                                  className="text-sm font-medium text-foreground"
                                  htmlFor="uiAuthenticationCurrentPassword"
                                >
                                  Current Password
                                </label>
                                <Input
                                  id="uiAuthenticationCurrentPassword"
                                  type="password"
                                  autoComplete="current-password"
                                  value={uiAuthenticationCurrentPasswordInput}
                                  disabled={isMutating || isLoading}
                                  onChange={(event) => {
                                    setUiAuthenticationCurrentPasswordInput(
                                      event.target.value,
                                    );
                                  }}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Required when changing authentication settings.
                                </p>
                              </div>
                            ) : null}

                            <div className="space-y-2">
                              <label
                                className="text-sm font-medium text-foreground"
                                htmlFor="uiAuthenticationPassword"
                              >
                                {uiAuthenticationHasPassword
                                  ? "New Password"
                                  : "Password"}
                              </label>
                              <Input
                                id="uiAuthenticationPassword"
                                type="password"
                                autoComplete="new-password"
                                value={uiAuthenticationPasswordInput}
                                disabled={isMutating || isLoading}
                                onChange={(event) => {
                                  setUiAuthenticationPasswordInput(event.target.value);
                                }}
                              />
                            </div>

                            <div className="space-y-2">
                              <label
                                className="text-sm font-medium text-foreground"
                                htmlFor="uiAuthenticationPasswordConfirm"
                              >
                                Confirm Password
                              </label>
                              <Input
                                id="uiAuthenticationPasswordConfirm"
                                type="password"
                                autoComplete="new-password"
                                value={uiAuthenticationPasswordConfirmationInput}
                                disabled={isMutating || isLoading}
                                onChange={(event) => {
                                  setUiAuthenticationPasswordConfirmationInput(
                                    event.target.value,
                                  );
                                }}
                              />
                              <p className="text-xs text-muted-foreground">
                                Use at least 12 characters with uppercase, lowercase, number, and symbol.
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </section>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        Status:{" "}
                        <span className="font-medium text-foreground">
                          {!taskCronEnabledInput
                            ? "Background checks paused"
                            : !notifyManagersOfInactiveAgentsInput
                              ? "Background checks active (inactivity notifications paused)"
                              : inactiveAgentNotificationTargetInput ===
                                  "ceo-only"
                                ? "Background checks active (direct CEO inactivity notifications only)"
                                : "Background checks active for all managers"}
                          </span>
                      </p>
                      <div className="flex items-center gap-2">
                        {isAuthenticationEnabled && isAuthenticated ? (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              void handleSignOut();
                            }}
                            disabled={isMutating || isLoading}
                          >
                            Sign Out
                          </Button>
                        ) : null}
                        <Button
                          onClick={() => {
                            void handleSaveSettings();
                          }}
                          disabled={isMutating || isLoading}
                        >
                          Save Settings
                        </Button>
                      </div>
                    </div>
                  </section>
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
  onCreateAgentClick,
  isCreateAgentDisabled,
}: {
  agents: Agent[];
  onCreateAgentClick: () => void;
  isCreateAgentDisabled: boolean;
}): ReactElement {
  const hierarchy = useMemo(() => buildOrgHierarchy(agents), [agents]);
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
      onToggle: toggleNode,
    });
  }, [hierarchy, collapsedNodeIds, toggleNode]);

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
          <div className="h-[640px] rounded-xl border border-border/70 bg-background/45">
            <ReactFlow
              nodes={flowModel.nodes}
              edges={flowModel.edges}
              nodeTypes={orgChartNodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2}
              maxZoom={1.8}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag
              zoomOnScroll
              proOptions={{ hideAttribution: true }}
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
  size?: "sm" | "md";
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
        size === "md" ? "size-9" : "size-8",
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
  const hasReportees = data.totalReports > 0;

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

        {hasReportees ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              data.onToggle(id);
            }}
            className="inline-flex min-w-10 items-center justify-center rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={
              data.collapsed
                ? `Expand ${data.displayName}`
                : `Collapse ${data.displayName}`
            }
          >
            {data.totalReports}
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <p className="text-xs text-muted-foreground">
          {hasReportees
            ? `${data.directReports} direct report${
                data.directReports > 1 ? "s" : ""
              }`
            : "No direct reports"}
        </p>
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

function buildFlowModel(params: {
  hierarchy: OrgHierarchy;
  collapsedNodeIds: Set<string>;
  onToggle: (agentId: string) => void;
}): {
  nodes: OrgChartNode[];
  edges: Edge[];
} {
  const { hierarchy, collapsedNodeIds, onToggle } = params;

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
        role: resolveAgentRoleLabel(agent),
        directReports,
        totalReports: totalReportsById.get(agentId) ?? 0,
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

function validateAuthenticationPasswordStrength(password: string): string | undefined {
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

function areTaskRecordListsEqual(left: TaskRecord[], right: TaskRecord[]): boolean {
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
      leftTask.project !== rightTask.project ||
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

function areTaskEntryListsEqual(left: TaskEntry[], right: TaskEntry[]): boolean {
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

  return parseRoute(window.location.pathname);
}

function parseRoute(pathname: string): AppRoute {
  const trimmed = pathname.trim() || "/";
  const normalized = trimmed.length > 1 ? trimmed.replace(/\/+$/, "") : trimmed;

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
    return `/sessions/${encodeURIComponent(route.sessionId)}`;
  }

  if (route.kind === "agent") {
    return `/agents/${encodeURIComponent(route.agentId)}`;
  }

  if (route.kind === "taskWorkspace") {
    if (route.taskWorkspaceId === "tasks") {
      return "/tasks";
    }
    return `/tasks/${encodeURIComponent(route.taskWorkspaceId)}`;
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

function normalizePathForComparison(pathname: string | undefined): string {
  return (
    pathname
      ?.trim()
      .replace(/[\\/]+$/, "")
      .toLowerCase() ?? ""
  );
}

function deriveWorkspaceName(projectPath: string): string {
  const normalizedPath = projectPath.trim().replace(/[\\/]+$/, "");
  if (!normalizedPath) {
    return "Project";
  }

  const segments = normalizedPath.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] || normalizedPath || "Project";
}

function buildFrontendAgentProjectSessionRef(
  agentId: string,
  projectPath: string,
): string {
  const normalizedAgent = normalizeProjectSegment(agentId);
  const normalizedPath = normalizeProjectSegment(projectPath);
  const suffix = normalizedPath.slice(-24) || "workspace";
  return `ui-agent:${normalizedAgent}-${suffix}`;
}

function normalizeProjectSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "project";
}

function toSessionMessageImages(
  files: FileUIPart[],
): SessionMessageImageInput[] {
  const images: SessionMessageImageInput[] = [];

  for (const file of files) {
    const mediaType = file.mediaType?.trim();
    if (!mediaType?.toLowerCase().startsWith("image/")) {
      continue;
    }

    const dataUrl = file.url?.trim();
    if (!dataUrl?.startsWith("data:")) {
      continue;
    }

    images.push({
      dataUrl,
      mediaType,
      name: file.filename,
    });
  }

  return images;
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
