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
import { Checkbox } from "@/components/ui/checkbox";
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
  Boxes,
  CircleAlert,
  CircleCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  Clock3,
  Folder,
  FolderOpen,
  FolderPlus,
  Home,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { ComponentType, ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Fragment } from "react";
import { toast } from "sonner";

type PageView = "overview" | "tasks" | "agents" | "skills" | "settings";

type AppRoute =
  | {
      kind: "page";
      view: PageView;
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

interface Skill {
  id: string;
  name: string;
  description: string;
  source: "managed" | "extra" | string;
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

interface SkillsResponse {
  scope: "agent" | "global";
  skills: Skill[];
  agentId?: string;
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
  taskCheckFrequencyMinutes: number;
}

interface UiVersionInfo {
  packageName: string;
  installedVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean | null;
  status: "latest" | "update-available" | "unknown";
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
const DEFAULT_TASK_CHECK_FREQUENCY_MINUTES = 1;
const TASK_STATUS_OPTIONS = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "In progress" },
  { value: "pending", label: "Pending" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
] as const;

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "tasks", label: "Tasks", icon: Boxes },
  { id: "agents", label: "Agents", icon: UsersRound },
  { id: "skills", label: "Skills", icon: Sparkles },
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
  const [taskCheckFrequencyMinutesInput, setTaskCheckFrequencyMinutesInput] =
    useState(String(DEFAULT_TASK_CHECK_FREQUENCY_MINUTES));
  const [taskCronEnabledInput, setTaskCronEnabledInput] = useState(true);
  const [isTaskDetailsDialogOpen, setTaskDetailsDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetailsError, setTaskDetailsError] = useState<string | null>(null);
  const [versionInfo, setVersionInfo] = useState<UiVersionInfo | null>(null);
  const [isVersionLoading, setVersionLoading] = useState(true);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [taskEntryDraft, setTaskEntryDraft] = useState<TaskEntryDraft>({
    kind: "worklog",
    content: "",
  });

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

      navigateToRoute({
        kind: "page",
        view: nextView,
      });
    },
    [navigateToRoute],
  );

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
      const [health, overview, sessions, agentSkills, globalSkills, tasks, settings] =
        await Promise.all([
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
              return {
                taskCronEnabled: true,
                taskCheckFrequencyMinutes: DEFAULT_TASK_CHECK_FREQUENCY_MINUTES,
              } satisfies UiSettings;
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
      setTaskCheckFrequencyMinutesInput(
        String(settings.taskCheckFrequencyMinutes),
      );
      setTaskCronEnabledInput(settings.taskCronEnabled);
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
      return {
        ...current,
        taskWorkspaces: buildTaskWorkspaceResponse(tasks),
      };
    });
  }, []);

  const loadVersionInfo = useCallback(async () => {
    setVersionLoading(true);
    setVersionError(null);
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
      setVersionError(message);
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
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadVersionInfo();
  }, [loadVersionInfo]);

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
        label: "Checking",
        detail: "Checking npm for updates...",
        icon: RefreshCw,
        indicatorClassName: "text-muted-foreground",
        badgeClassName:
          "border-border/70 bg-muted/40 text-muted-foreground",
      } as const;
    }

    if (versionInfo?.status === "update-available") {
      return {
        label: "Update",
        detail: versionInfo.latestVersion
          ? `Version ${versionInfo.latestVersion} is available.`
          : "A newer version is available.",
        icon: Download,
        indicatorClassName: "text-amber-300",
        badgeClassName:
          "border-amber-500/40 bg-amber-500/10 text-amber-300",
      } as const;
    }

    if (versionInfo?.status === "latest") {
      return {
        label: "Latest",
        detail: versionInfo.latestVersion
          ? `You're on the latest version (${versionInfo.latestVersion}).`
          : "You're on the latest version.",
        icon: CircleCheck,
        indicatorClassName: "text-emerald-300",
        badgeClassName:
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
      } as const;
    }

    return {
      label: "Unknown",
      detail:
        versionInfo?.error || versionError || "Unable to verify npm updates.",
      icon: CircleAlert,
      indicatorClassName: "text-muted-foreground",
      badgeClassName:
        "border-border/70 bg-muted/40 text-muted-foreground",
    } as const;
  }, [isVersionLoading, versionError, versionInfo]);

  const installedVersionLabel =
    versionInfo?.installedVersion?.trim() || "Unavailable";
  const versionCheckedLabel = formatVersionCheckedAt(versionInfo?.checkedAt);
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
  }, [
    lastAssistantMessageIndex,
    sessionChatStatus,
    shouldRenderReasoning,
  ]);

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
      selectedTaskWorkspace.tasks.find((task) => task.taskId === selectedTaskId) ?? null
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
    if (route.kind === "taskWorkspace") {
      return;
    }

    setTaskDetailsDialogOpen(false);
    setSelectedTaskId(null);
    setTaskDetailsError(null);
  }, [route]);

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
        const filtered = existing.filter((taskId) => allowedTaskIds.has(taskId));
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
  }, [taskWorkspaces, getAssignableAgents, taskActorId, defaultTaskProjectPath]);

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
    const parsedFrequency = Number.parseInt(taskCheckFrequencyMinutesInput.trim(), 10);
    const isFrequencyValid =
      Number.isFinite(parsedFrequency) && parsedFrequency >= 1 && parsedFrequency <= 1440;
    if (taskCronEnabledInput && !isFrequencyValid) {
      toast.error("Task Check Frequency must be an integer between 1 and 1440.");
      return;
    }
    const fallbackFrequency = state?.settings.taskCheckFrequencyMinutes ?? DEFAULT_TASK_CHECK_FREQUENCY_MINUTES;
    const resolvedFrequency = isFrequencyValid ? parsedFrequency : fallbackFrequency;

    setMutating(true);
    try {
      const response = await fetchJson<{
        settings: UiSettings;
        message?: string;
      }>("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskCronEnabled: taskCronEnabledInput,
          taskCheckFrequencyMinutes: resolvedFrequency,
        }),
      });

      setState((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          settings: response.settings,
        };
      });
      setTaskCheckFrequencyMinutesInput(
        String(response.settings.taskCheckFrequencyMinutes),
      );
      setTaskCronEnabledInput(response.settings.taskCronEnabled);
      toast.success(response.message ?? "Settings updated.");
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
      `Delete ${taskIds.length} task${taskIds.length === 1 ? "" : "s"}? This cannot be undone.`,
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
          `Deleted ${response.deletedCount} task${response.deletedCount === 1 ? "" : "s"}.`,
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
                      {workspace.sessions.map((session) => (
                        <div
                          key={session.sessionId}
                          className="group/session relative"
                        >
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
                            className="flex w-full items-center rounded-md py-1.5 pl-9 pr-8 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                          >
                            <span
                              className="mr-2 inline-block size-2 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="truncate">{session.title}</span>
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
                                current === session.sessionId
                                  ? null
                                  : session.sessionId,
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
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="border-t border-border p-3">
            {!isSidebarCollapsed ? (
              <div className="mb-2 rounded-lg border border-border/70 bg-gradient-to-br from-card to-accent/30 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      OpenGoat
                    </p>
                    <p className="truncate text-sm font-semibold">
                      v{installedVersionLabel}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-wide",
                      versionStatus.badgeClassName,
                    )}
                    title={versionStatus.detail}
                  >
                    <versionStatus.icon
                      className={cn(
                        "size-3",
                        versionStatus.indicatorClassName,
                        isVersionLoading && !versionInfo ? "animate-spin" : "",
                      )}
                    />
                    {versionStatus.label}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {versionStatus.detail}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    {versionCheckedLabel}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      void loadVersionInfo();
                    }}
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Refresh version status"
                    title="Refresh version status"
                    disabled={isVersionLoading}
                  >
                    <RefreshCw
                      className={cn(
                        "size-3.5",
                        isVersionLoading ? "animate-spin" : "",
                      )}
                    />
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    void loadVersionInfo();
                  }}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-md border transition-colors",
                    "border-border/70 bg-accent/40 text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                  )}
                  aria-label="Refresh version status"
                  title={versionSummaryLabel}
                  disabled={isVersionLoading}
                >
                  <versionStatus.icon
                    className={cn(
                      "size-4",
                      versionStatus.indicatorClassName,
                      isVersionLoading && !versionInfo ? "animate-spin" : "",
                    )}
                  />
                </button>
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
              ) : (
                <div>
                  <h1
                    className={cn(
                      "font-semibold tracking-tight text-xl sm:text-2xl",
                    )}
                  >
                    {viewTitle(route, selectedSession, selectedTaskWorkspace)}
                  </h1>
                </div>
              )}

              {route.kind === "page" && route.view === "agents" ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setCreateAgentDialogError(null);
                    setCreateAgentDialogOpen(true);
                  }}
                  disabled={isLoading || isMutating}
                >
                  Create Agent
                </Button>
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
                  const draft = taskDraftByWorkspaceId[selectedTaskWorkspace.taskWorkspaceId] ?? {
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
                              updateTaskDraft(selectedTaskWorkspace.taskWorkspaceId, {
                                title: event.target.value,
                              })
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
                              updateTaskDraft(selectedTaskWorkspace.taskWorkspaceId, {
                                description: event.target.value,
                              })
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
                              updateTaskDraft(selectedTaskWorkspace.taskWorkspaceId, {
                                project: event.target.value,
                              })
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
                              updateTaskDraft(selectedTaskWorkspace.taskWorkspaceId, {
                                assignedTo: event.target.value,
                              })
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
                              updateTaskDraft(selectedTaskWorkspace.taskWorkspaceId, {
                                status: event.target
                                  .value as TaskCreateDraft["status"],
                              })
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
                      void handleCreateTask(selectedTaskWorkspace.taskWorkspaceId, {
                        fromDialog: true,
                      });
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
                      <MessageResponse>{selectedTaskDescription}</MessageResponse>
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
                      <OrganizationChartPanel agents={agents} />
                    ) : null}
                  </>
                ) : null}

                {route.kind === "page" && route.view === "agents" ? (
                  <section className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Current organization members.
                    </p>
                    {agents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No agents found.
                      </p>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-border/80">
                        {agents.map((agent, index) => (
                          <div
                            key={agent.id}
                            className={cn(
                              "flex cursor-pointer items-center justify-between gap-3 bg-background/30 px-4 py-3 transition-colors hover:bg-accent/30",
                              index !== agents.length - 1 &&
                                "border-b border-border/70",
                            )}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              navigateToRoute({
                                kind: "agent",
                                agentId: agent.id,
                              });
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                navigateToRoute({
                                  kind: "agent",
                                  agentId: agent.id,
                                });
                              }
                            }}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <AgentAvatar
                                agentId={agent.id}
                                displayName={agent.displayName}
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {agent.displayName}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {agent.id}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={agent.id === "ceo" || isMutating}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void handleDeleteAgent(agent.id);
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ) : null}

                {route.kind === "taskWorkspace" ? (
                  selectedTaskWorkspace ? (
                    <div className="space-y-4">
                      <section className="rounded-lg border border-border/80 bg-card/40 px-4 py-4 sm:px-5">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <h2 className="truncate text-2xl font-semibold tracking-tight">
                              {selectedTaskWorkspace.title}
                            </h2>
                          </div>

                          <div className="flex flex-wrap items-end gap-2">
                            <div className="space-y-1">
                              <label
                                className="text-[11px] uppercase tracking-wide text-muted-foreground"
                                htmlFor="taskWorkspaceTaskActor"
                              >
                                Act As
                              </label>
                              <select
                                id="taskWorkspaceTaskActor"
                                className="h-9 min-w-[220px] rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                navigateToRoute({
                                  kind: "taskWorkspace",
                                  taskWorkspaceId: "tasks",
                                });
                              }}
                            >
                              Back to Tasks
                            </Button>
                          </div>
                        </div>
                      </section>

                      <section className="overflow-hidden rounded-lg border border-border/80 bg-card/25">
                        <div className="border-b border-border/70 px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">Tasks</p>
                              <p className="text-xs text-muted-foreground">
                                Select tasks to delete in bulk or open one for full details.
                              </p>
                            </div>

                            {hasSelectedTasks ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 px-3"
                                disabled={isMutating || isLoading}
                                onClick={() => {
                                  void handleDeleteSelectedTasks(
                                    selectedTaskWorkspace.taskWorkspaceId,
                                    selectedTaskIds,
                                  );
                                }}
                              >
                                {`Delete ${selectedTaskIds.length}`}
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        {selectedTaskWorkspace.tasks.length === 0 ? (
                          <div className="px-4 py-8">
                            <p className="text-sm text-muted-foreground">
                              No tasks yet. Use Create Task in the top right.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full">
                              <thead>
                                <tr className="border-b border-border/70 bg-accent/25 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                                  <th className="w-12 px-3 py-2 font-medium">
                                    <Checkbox
                                      checked={selectAllCheckboxState}
                                      onCheckedChange={(checked) => {
                                        handleToggleSelectAllTasks(
                                          selectedTaskWorkspace.taskWorkspaceId,
                                          allTaskIdsInWorkspace,
                                          checked === true,
                                        );
                                      }}
                                      aria-label="Select all tasks"
                                    />
                                  </th>
                                  <th className="px-4 py-2 font-medium">
                                    Task
                                  </th>
                                  <th className="px-4 py-2 font-medium">
                                    Project
                                  </th>
                                  <th className="px-4 py-2 font-medium">
                                    Assignee
                                  </th>
                                  <th className="px-4 py-2 font-medium">
                                    Status
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                {selectedTaskWorkspace.tasks.map((task) => (
                                  <tr
                                    key={task.taskId}
                                    className={cn(
                                      "transition-colors hover:bg-accent/20",
                                      selectedTaskIdSet.has(task.taskId) &&
                                        "bg-accent/10",
                                    )}
                                  >
                                    <td className="px-3 py-3">
                                      <Checkbox
                                        checked={selectedTaskIdSet.has(task.taskId)}
                                        onCheckedChange={(checked) => {
                                          handleToggleTaskSelection(
                                            selectedTaskWorkspace.taskWorkspaceId,
                                            task.taskId,
                                            checked === true,
                                          );
                                        }}
                                        aria-label={`Select task ${task.title}`}
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <button
                                        type="button"
                                        className="group text-left"
                                        onClick={() => {
                                          handleOpenTaskDetails(task.taskId);
                                        }}
                                      >
                                        <span className="block font-medium text-foreground group-hover:underline">
                                          {task.title}
                                        </span>
                                      </button>
                                    </td>
                                    <td className="px-4 py-3">
                                      <p
                                        className="max-w-[240px] truncate text-sm text-muted-foreground"
                                        title={resolveTaskProjectLabel(task.project)}
                                      >
                                        {resolveTaskProjectLabel(task.project)}
                                      </p>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">{`@${task.assignedTo}`}</td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={cn(
                                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                                          taskStatusPillClasses(task.status),
                                        )}
                                      >
                                        {taskStatusLabel(task.status)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{`No task workspace was found for id ${route.taskWorkspaceId}.`}</p>
                  )
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
                                          defaultOpen
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
                                      defaultOpen
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
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Assigned Skills</CardTitle>
                        <CardDescription>
                          Skills currently assigned to ceo.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {state.agentSkills.skills.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No assigned skills.
                          </p>
                        ) : (
                          state.agentSkills.skills.map((skill) => (
                            <div
                              key={skill.id}
                              className="rounded-md border border-border/80 bg-background/30 p-3"
                            >
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <p className="font-medium">{skill.name}</p>
                                <Badge variant="secondary">
                                  {skill.source}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {skill.description || "No description"}
                              </p>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Global Skills</CardTitle>
                        <CardDescription>
                          Centralized reusable skill catalog.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {state.globalSkills.skills.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No global skills.
                          </p>
                        ) : (
                          state.globalSkills.skills.map((skill) => (
                            <div
                              key={skill.id}
                              className="rounded-md border border-border/80 bg-background/30 p-3"
                            >
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <p className="font-medium">{skill.name}</p>
                                <Badge variant="secondary">
                                  {skill.source}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {skill.description || "No description"}
                              </p>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : null}

                {route.kind === "page" && route.view === "settings" ? (
                  <Card className="max-w-3xl border-border/80 bg-card/60">
                    <CardHeader>
                      <CardTitle>Settings</CardTitle>
                      <CardDescription>
                        Configure runtime behavior for the OpenGoat UI server.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <section className="rounded-lg border border-border/70 bg-background/40 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Cron</p>
                            <p className="text-xs text-muted-foreground">
                              Enable or disable background task cron execution.
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={taskCronEnabledInput}
                            onClick={() => {
                              setTaskCronEnabledInput((current) => !current);
                            }}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium transition-colors",
                              taskCronEnabledInput
                                ? "border-success/60 bg-success/20 text-success"
                                : "border-border bg-background text-muted-foreground",
                            )}
                          >
                            {taskCronEnabledInput ? "Enabled" : "Disabled"}
                          </button>
                        </div>
                      </section>

                      <section
                        className={cn(
                          "rounded-lg border border-border/70 p-4",
                          taskCronEnabledInput ? "bg-background/40" : "bg-muted/20",
                        )}
                      >
                        <div className="space-y-2">
                          <label
                            className={cn(
                              "text-sm font-medium",
                              taskCronEnabledInput
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                            htmlFor="taskCheckFrequencyMinutes"
                          >
                            Task Check Frequency (minutes)
                          </label>
                          <Input
                            id="taskCheckFrequencyMinutes"
                            type="number"
                            min={1}
                            max={1440}
                            step={1}
                            value={taskCheckFrequencyMinutesInput}
                            disabled={!taskCronEnabledInput}
                            onChange={(event) => {
                              setTaskCheckFrequencyMinutesInput(
                                event.target.value,
                              );
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            {taskCronEnabledInput
                              ? "How often cron runs while the UI server is active (1-1440 minutes)."
                              : "Enable Cron to edit frequency."}
                          </p>
                        </div>
                      </section>

                      <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/30 px-4 py-3">
                        <p className="text-xs text-muted-foreground">
                          Current status:{" "}
                          <span className="font-medium text-foreground">
                            {taskCronEnabledInput ? "Cron enabled" : "Cron disabled"}
                          </span>
                        </p>
                        <Button
                          onClick={() => {
                            void handleSaveSettings();
                          }}
                          disabled={isMutating || isLoading}
                        >
                          Save Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}

function OrganizationChartPanel({ agents }: { agents: Agent[] }): ReactElement {
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

  const collapseAll = useCallback(() => {
    const collapsible = new Set<string>();
    for (const [id, children] of hierarchy.childrenById.entries()) {
      if (children.length > 0) {
        collapsible.add(id);
      }
    }

    for (const rootId of hierarchy.roots) {
      collapsible.delete(rootId);
    }

    setCollapsedNodeIds(collapsible);
  }, [hierarchy]);

  const expandAll = useCallback(() => {
    setCollapsedNodeIds(new Set());
  }, []);

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
            variant="secondary"
            className="h-9 px-3 text-[14px]"
            onClick={expandAll}
          >
            Expand All
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-9 px-3 text-[14px]"
            onClick={collapseAll}
          >
            Collapse Branches
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

function formatVersionCheckedAt(checkedAt: string | undefined): string {
  const timestamp = checkedAt?.trim();
  if (!timestamp) {
    return "Version check pending";
  }

  const checkedAtMs = Date.parse(timestamp);
  if (Number.isNaN(checkedAtMs)) {
    return "Version check completed";
  }

  const ageMs = Math.max(0, Date.now() - checkedAtMs);
  if (ageMs < 60_000) {
    return "Checked just now";
  }

  const ageMinutes = Math.floor(ageMs / 60_000);
  if (ageMinutes < 60) {
    return `Checked ${ageMinutes}m ago`;
  }

  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) {
    return `Checked ${ageHours}h ago`;
  }

  const ageDays = Math.floor(ageHours / 24);
  return `Checked ${ageDays}d ago`;
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
    throw new Error(message);
  }

  return payload as T;
}

async function readResponseError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => {
    return null;
  });

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

function buildTaskWorkspaceResponse(response: TasksResponse): TaskWorkspacesResponse {
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

  if (normalized === "/" || normalized === "/overview") {
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

  if (route.view === "overview") {
    return "/overview";
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

function taskStatusPillClasses(status: string): string {
  switch (status.trim().toLowerCase()) {
    case "done":
      return "bg-success/20 text-success";
    case "doing":
      return "bg-sky-500/20 text-sky-300";
    case "blocked":
      return "bg-amber-500/20 text-amber-300";
    default:
      return "bg-accent text-foreground";
  }
}

function taskStatusLabel(status: string): string {
  switch (status.trim().toLowerCase()) {
    case "todo":
      return "To do";
    case "doing":
      return "In progress";
    case "pending":
      return "Pending";
    case "blocked":
      return "Blocked";
    case "done":
      return "Done";
    default:
      return status;
  }
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
