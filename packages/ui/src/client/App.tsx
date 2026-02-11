import type { ChatStatus, FileUIPart } from "ai";
import type { ComponentType, FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  type NodeTypes
} from "@xyflow/react";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Folder,
  FolderOpen,
  FolderPlus,
  Home,
  MoreHorizontal,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
  UsersRound,
  X
} from "lucide-react";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputFooter, type PromptInputMessage, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type PageView = "overview" | "agents" | "skills";

type AppRoute =
  | {
      kind: "page";
      view: PageView;
    }
  | {
      kind: "session";
      sessionId: string;
    };

interface HealthResponse {
  ok: boolean;
  mode: "development" | "production";
  timestamp: string;
}

interface Agent {
  id: string;
  displayName: string;
  workspaceDir: string;
  internalConfigDir: string;
  reportsTo: string | null;
  type: "manager" | "individual" | "unknown";
}

interface Session {
  sessionKey: string;
  sessionId: string;
  title: string;
  updatedAt: number;
  transcriptPath: string;
  workspacePath: string;
  workingPath?: string;
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

interface DashboardState {
  health: HealthResponse;
  overview: OverviewResponse;
  sessions: SessionsResponse;
  agentSkills: SkillsResponse;
  globalSkills: SkillsResponse;
}

interface Project {
  sessionKey: string;
  sessionId: string;
  name: string;
  workingPath: string;
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
  projectSessionKey: string;
  workingPath: string;
  sessions: WorkspaceSessionItem[];
  updatedAt: number;
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

interface OrgHierarchy {
  agentsById: Map<string, Agent>;
  childrenById: Map<string, string[]>;
  roots: string[];
}

interface OrgNodeData {
  [key: string]: unknown;
  agentId: string;
  displayName: string;
  type: Agent["type"];
  directReports: number;
  collapsed: boolean;
  onToggle: (agentId: string) => void;
}

const NODE_WIDTH = 260;
const NODE_HEIGHT = 108;

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "agents", label: "Agents", icon: UsersRound },
  { id: "skills", label: "Skills", icon: Boxes }
];

const DEFAULT_FORM: CreateAgentForm = {
  name: "",
  reportsTo: "goat"
};

type OrgChartNode = Node<OrgNodeData, "orgNode">;

const orgChartNodeTypes = {
  orgNode: OrganizationChartNode
} satisfies NodeTypes;

export function App(): ReactElement {
  const [route, setRoute] = useState<AppRoute>(() => getInitialRoute());
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [state, setState] = useState<DashboardState | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setMutating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAgentForm>(DEFAULT_FORM);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [hoveredWorkspaceId, setHoveredWorkspaceId] = useState<string | null>(null);
  const [openWorkspaceMenuId, setOpenWorkspaceMenuId] = useState<string | null>(null);
  const [openSessionMenuId, setOpenSessionMenuId] = useState<string | null>(null);
  const [collapsedWorkspaceIds, setCollapsedWorkspaceIds] = useState<Set<string>>(() => new Set());
  const [sessionChatStatus, setSessionChatStatus] = useState<ChatStatus>("ready");
  const [sessionMessagesById, setSessionMessagesById] = useState<Record<string, SessionChatMessage[]>>({});

  const navigateToRoute = useCallback((nextRoute: AppRoute) => {
    const nextPath = routeToPath(nextRoute);
    if (typeof window !== "undefined" && window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setRoute(nextRoute);
    setHoveredWorkspaceId(null);
    setOpenWorkspaceMenuId(null);
    setOpenSessionMenuId(null);
  }, []);

  const handleViewChange = useCallback(
    (nextView: PageView) => {
      setActionMessage(null);
      navigateToRoute({
        kind: "page",
        view: nextView
      });
    },
    [navigateToRoute]
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
      const [health, overview, sessions, agentSkills, globalSkills] = await Promise.all([
        fetchJson<HealthResponse>("/api/health"),
        fetchJson<OverviewResponse>("/api/openclaw/overview"),
        fetchJson<SessionsResponse>("/api/sessions?agentId=goat"),
        fetchJson<SkillsResponse>("/api/skills?agentId=goat"),
        fetchJson<SkillsResponse>("/api/skills?global=true")
      ]);

      setState({
        health,
        overview,
        sessions,
        agentSkills,
        globalSkills
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Failed to load data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshOverview = useCallback(async () => {
    const overview = await fetchJson<OverviewResponse>("/api/openclaw/overview");
    setState((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        overview
      };
    });
  }, []);

  const refreshSessions = useCallback(async () => {
    const sessions = await fetchJson<SessionsResponse>("/api/sessions?agentId=goat");
    setState((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        sessions
      };
    });
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
        reportsTo: agentIds[0] ?? "goat"
      };
    });
  }, [state]);

  const agents = state?.overview.agents ?? [];
  const sessions = state?.sessions.sessions ?? [];
  const selectedSession = useMemo(() => {
    if (route.kind !== "session") {
      return null;
    }
    return sessions.find((session) => session.sessionId === route.sessionId) ?? null;
  }, [route, sessions]);
  const sessionMessages = useMemo(() => {
    if (!selectedSession) {
      return [];
    }
    return sessionMessagesById[selectedSession.sessionId] ?? [];
  }, [selectedSession, sessionMessagesById]);
  const projects = useMemo<Project[]>(() => {
    return sessions
      .filter((session) => session.sessionKey.startsWith("project:") && typeof session.workingPath === "string")
      .map((session) => {
        return {
          sessionKey: session.sessionKey,
          sessionId: session.sessionId,
          name: session.title,
          workingPath: session.workingPath ?? "",
          updatedAt: session.updatedAt
        };
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }, [sessions]);
  const workspaceNodes = useMemo<WorkspaceNode[]>(() => {
    const sessionsByPath = new Map<string, WorkspaceSessionItem[]>();
    for (const session of sessions) {
      const workingPath = session.workingPath?.trim();
      if (!workingPath) {
        continue;
      }
      if (session.sessionKey.startsWith("project:")) {
        continue;
      }

      const items = sessionsByPath.get(workingPath) ?? [];
      items.push({
        sessionId: session.sessionId,
        sessionKey: session.sessionKey,
        title: session.title,
        updatedAt: session.updatedAt
      });
      sessionsByPath.set(workingPath, items);
    }

    for (const items of sessionsByPath.values()) {
      items.sort((left, right) => right.updatedAt - left.updatedAt);
    }

    return projects
      .map((project) => {
        return {
          id: project.sessionId,
          name: project.name,
          projectSessionKey: project.sessionKey,
          workingPath: project.workingPath,
          sessions: sessionsByPath.get(project.workingPath) ?? [],
          updatedAt: project.updatedAt
        };
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }, [projects, sessions]);

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

  const healthTimestamp = state ? new Date(state.health.timestamp).toLocaleString() : "Loading...";

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
        icon: UsersRound
      },
      {
        id: "sessions",
        label: "Goat Sessions",
        value: state.sessions.sessions.length,
        hint: "Saved conversation contexts",
        icon: Clock3
      },
      {
        id: "skills",
        label: "Global Skills",
        value: state.globalSkills.skills.length,
        hint: "Reusable capabilities",
        icon: Sparkles
      }
    ];
  }, [state]);

  async function handleCreateAgent(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!createForm.name.trim()) {
      setActionMessage("Agent name is required.");
      return;
    }

    if (!state || agents.length === 0) {
      setActionMessage("No available manager targets found.");
      return;
    }

    const allowedReportsTo = new Set(agents.map((agent) => agent.id));
    const reportsTo = allowedReportsTo.has(createForm.reportsTo) ? createForm.reportsTo : (agents[0]?.id ?? "");
    if (!reportsTo) {
      setActionMessage("Reports To is required.");
      return;
    }

    const submittedName = createForm.name;
    const submittedNameTrimmed = submittedName.trim();

    setMutating(true);
    setActionMessage(null);

    try {
      const response = await fetchJson<{ message?: string }>("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: createForm.name,
          reportsTo
        })
      });

      setActionMessage(response.message ?? `Agent \"${submittedName}\" processed.`);
      setCreateForm((current) => {
        if (current.name.trim() !== submittedNameTrimmed) {
          return current;
        }
        return { ...current, name: "" };
      });
      await refreshOverview();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to create agent.";
      setActionMessage(message);
    } finally {
      setMutating(false);
    }
  }

  async function handleDeleteAgent(agentId: string): Promise<void> {
    if (agentId === "goat") {
      return;
    }

    const shouldDelete = window.confirm(`Delete agent \"${agentId}\"?`);
    if (!shouldDelete) {
      return;
    }

    setMutating(true);
    setActionMessage(null);

    try {
      await fetchJson<{ removed: { existed: boolean } }>(`/api/agents/${encodeURIComponent(agentId)}?force=true`, {
        method: "DELETE"
      });

      setActionMessage(`Agent \"${agentId}\" removed.`);
      await refreshOverview();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to delete agent.";
      setActionMessage(message);
    } finally {
      setMutating(false);
    }
  }

  async function handleAddProject(): Promise<void> {
    setMutating(true);
    setActionMessage(null);

    try {
      const picked = await fetchJson<PickProjectResponse>("/api/projects/pick", {
        method: "POST"
      });

      const response = await fetchJson<CreateProjectResponse>("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agentId: "goat",
          folderName: picked.project.name,
          folderPath: picked.project.path
        })
      });

      setActionMessage(response.message ?? `Project \"${response.project.name}\" added.`);
      await refreshSessions();
      navigateToRoute({
        kind: "session",
        sessionId: response.session.sessionId
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to add project.";
      setActionMessage(message);
    } finally {
      setMutating(false);
    }
  }

  async function handleCreateWorkspaceSession(workspace: WorkspaceNode): Promise<void> {
    setMutating(true);
    setActionMessage(null);
    setOpenWorkspaceMenuId(null);
    setOpenSessionMenuId(null);

    try {
      const response = await fetchJson<WorkspaceSessionResponse>("/api/workspaces/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agentId: "goat",
          workingPath: workspace.workingPath,
          workspaceName: workspace.name
        })
      });

      setActionMessage(response.message ?? `Session created in \"${workspace.name}\".`);
      await refreshSessions();
      navigateToRoute({
        kind: "session",
        sessionId: response.session.sessionId
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to create workspace session.";
      setActionMessage(message);
    } finally {
      setMutating(false);
    }
  }

  async function handleRenameWorkspace(workspace: WorkspaceNode): Promise<void> {
    const nextName = window.prompt(`Rename workspace \"${workspace.name}\"`, workspace.name)?.trim();
    if (!nextName || nextName === workspace.name) {
      return;
    }

    setMutating(true);
    setActionMessage(null);
    setOpenWorkspaceMenuId(null);
    setOpenSessionMenuId(null);

    try {
      const response = await fetchJson<WorkspaceRenameResponse>("/api/workspaces/rename", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agentId: "goat",
          sessionRef: workspace.projectSessionKey,
          name: nextName
        })
      });

      setActionMessage(response.message ?? `Workspace renamed to \"${nextName}\".`);
      await refreshSessions();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to rename workspace.";
      setActionMessage(message);
    } finally {
      setMutating(false);
    }
  }

  async function handleDeleteWorkspace(workspace: WorkspaceNode): Promise<void> {
    const confirmed = window.confirm(`Remove workspace \"${workspace.name}\" from sidebar? Sessions will be kept.`);
    if (!confirmed) {
      return;
    }

    setMutating(true);
    setActionMessage(null);
    setOpenWorkspaceMenuId(null);
    setOpenSessionMenuId(null);

    try {
      const response = await fetchJson<WorkspaceDeleteResponse>("/api/workspaces/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agentId: "goat",
          sessionRef: workspace.projectSessionKey
        })
      });

      setActionMessage(response.message ?? `Workspace \"${workspace.name}\" removed.`);
      await refreshSessions();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to remove workspace.";
      setActionMessage(message);
    } finally {
      setMutating(false);
    }
  }

  async function handleRemoveSession(session: WorkspaceSessionItem): Promise<void> {
    const confirmed = window.confirm(`Remove session \"${session.title}\"?`);
    if (!confirmed) {
      return;
    }

    setMutating(true);
    setActionMessage(null);
    setOpenSessionMenuId(null);
    setOpenWorkspaceMenuId(null);

    try {
      const response = await fetchJson<SessionRemoveResponse>("/api/sessions/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agentId: "goat",
          sessionRef: session.sessionKey
        })
      });

      setActionMessage(response.message ?? `Session \"${session.title}\" removed.`);
      await refreshSessions();
      if (route.kind === "session" && route.sessionId === session.sessionId) {
        navigateToRoute({
          kind: "page",
          view: "overview"
        });
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to remove session.";
      setActionMessage(message);
    } finally {
      setMutating(false);
    }
  }

  async function handleRenameSession(session: WorkspaceSessionItem): Promise<void> {
    const nextName = window.prompt(`Rename session \"${session.title}\"`, session.title)?.trim();
    if (!nextName || nextName === session.title) {
      return;
    }

    setMutating(true);
    setActionMessage(null);
    setOpenSessionMenuId(null);
    setOpenWorkspaceMenuId(null);

    try {
      const response = await fetchJson<SessionRenameResponse>("/api/sessions/rename", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agentId: "goat",
          sessionRef: session.sessionKey,
          name: nextName
        })
      });

      setActionMessage(response.message ?? `Session renamed to \"${nextName}\".`);
      await refreshSessions();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to rename session.";
      setActionMessage(message);
    } finally {
      setMutating(false);
    }
  }

  function appendSessionMessage(sessionId: string, message: SessionChatMessage): void {
    setSessionMessagesById((current) => {
      const next = current[sessionId] ? [...current[sessionId], message] : [message];
      return {
        ...current,
        [sessionId]: next
      };
    });
  }

  async function handleSessionPromptSubmit(promptMessage: PromptInputMessage): Promise<void> {
    if (!selectedSession) {
      return;
    }

    const text = promptMessage.text.trim();
    const images = toSessionMessageImages(promptMessage.files);
    if (promptMessage.files.length > 0 && images.length === 0) {
      setActionMessage("Unable to process attached image files. Please try again.");
      return;
    }

    if (!text && images.length === 0) {
      return;
    }

    const sessionId = selectedSession.sessionId;
    const message =
      text ||
      (images.length === 1
        ? "Please analyze the attached image."
        : "Please analyze the attached images.");
    const userMessage = text
      ? images.length > 0
        ? `${text}\n\n(Attached ${images.length} image${images.length === 1 ? "" : "s"}.)`
        : text
      : `Sent ${images.length} image${images.length === 1 ? "" : "s"}.`;

    appendSessionMessage(sessionId, {
      id: `${sessionId}:user:${Date.now()}`,
      role: "user",
      content: userMessage
    });
    setSessionChatStatus("streaming");
    setActionMessage(null);

    try {
      const payload = {
        agentId: "goat",
        sessionRef: selectedSession.sessionKey,
        workingPath: selectedSession.workingPath,
        message,
        images
      };
      const response = await sendSessionMessage(payload);

      const assistantReply = response.output.trim() || "No output was returned.";
      appendSessionMessage(sessionId, {
        id: `${sessionId}:assistant:${Date.now()}`,
        role: "assistant",
        content: assistantReply
      });
      setSessionChatStatus(response.result.code === 0 ? "ready" : "error");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to send session message.";
      const normalizedError =
        message === "Not Found"
          ? "Session message endpoint is unavailable. Refresh/restart the UI server to load the latest API routes."
          : message;
      appendSessionMessage(sessionId, {
        id: `${sessionId}:assistant-error:${Date.now()}`,
        role: "assistant",
        content: normalizedError
      });
      setSessionChatStatus("error");
    }
  }

  async function sendSessionMessage(payload: {
    agentId: string;
    sessionRef: string;
    workingPath?: string;
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
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        lastError = error;
        if (!(error instanceof Error) || error.message !== "Not Found") {
          throw error;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Unable to send session message.");
  }

  return (
    <div className="h-screen bg-background text-foreground">
      <div className="flex h-full">
        <aside
          className={cn(
            "hidden border-r border-border bg-card/50 transition-[width] duration-200 md:flex md:flex-col",
            isSidebarCollapsed ? "md:w-16" : "md:w-64"
          )}
        >
          <div className="flex h-14 items-center border-b border-border px-3">
            <div className="flex size-8 items-center justify-center rounded-md bg-accent text-muted-foreground">
              <Sparkles className="size-4" />
            </div>
            {!isSidebarCollapsed ? <p className="ml-2 text-sm font-semibold">OpenGoat UI</p> : null}
            <button
              type="button"
              className="ml-auto inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setSidebarCollapsed((value) => !value)}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = route.kind === "page" && item.id === route.view;

              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  onClick={() => handleViewChange(item.id)}
                  className={cn(
                    "mb-1 flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors",
                    active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                    isSidebarCollapsed && "justify-center px-2"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!isSidebarCollapsed ? <span className="ml-2">{item.label}</span> : null}
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
                "mb-1 flex w-full items-center rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground",
                isSidebarCollapsed && "justify-center px-2"
              )}
              disabled={isMutating || isLoading}
            >
              <FolderPlus className="size-4 shrink-0" />
              {!isSidebarCollapsed ? <span className="ml-2">Add Project</span> : null}
            </button>

            {workspaceNodes.map((workspace) => {
              const isWorkspaceCollapsed = collapsedWorkspaceIds.has(workspace.id);
              const FolderIcon = isWorkspaceCollapsed ? Folder : FolderOpen;

              return (
                <div key={workspace.id} className="relative mb-1">
                  <div
                    className="relative"
                    onMouseEnter={() => setHoveredWorkspaceId(workspace.id)}
                    onMouseLeave={() => {
                      setHoveredWorkspaceId((current) => (current === workspace.id ? null : current));
                    }}
                  >
                    <button
                      type="button"
                      title={`${workspace.name} (${workspace.workingPath})`}
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
                        "flex w-full items-center rounded-md px-3 py-2 pr-16 text-sm text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground",
                        isSidebarCollapsed && "justify-center px-2 pr-2"
                      )}
                    >
                      <FolderIcon className="size-4 shrink-0" />
                      {!isSidebarCollapsed ? <span className="ml-2 truncate">{workspace.name}</span> : null}
                    </button>

                    {!isSidebarCollapsed && (hoveredWorkspaceId === workspace.id || openWorkspaceMenuId === workspace.id) ? (
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
                          <Plus className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Workspace menu for ${workspace.name}`}
                          title="More"
                          disabled={isMutating}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setOpenSessionMenuId(null);
                            setOpenWorkspaceMenuId((current) => (current === workspace.id ? null : workspace.id));
                          }}
                          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                        >
                          <MoreHorizontal className="size-3.5" />
                        </button>
                      </div>
                    ) : null}

                    {!isSidebarCollapsed && openWorkspaceMenuId === workspace.id ? (
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
                        <div key={session.sessionId} className="group/session relative">
                          <button
                            type="button"
                            title={`${session.title} (${session.sessionKey})`}
                            onClick={() => {
                              navigateToRoute({
                                kind: "session",
                                sessionId: session.sessionId
                              });
                              setOpenWorkspaceMenuId(null);
                            }}
                            className="flex w-full items-center rounded-md py-1.5 pl-9 pr-8 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                          >
                            <span className="mr-2 inline-block size-2 shrink-0" aria-hidden="true" />
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
                              setOpenSessionMenuId((current) => (current === session.sessionId ? null : session.sessionId));
                            }}
                            className={cn(
                              "absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50",
                              openSessionMenuId === session.sessionId ? "opacity-100" : "opacity-0 group-hover/session:opacity-100"
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
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last Sync</p>
                <p className="mt-1 text-xs text-foreground">{healthTimestamp}</p>
              </div>
            ) : (
              <div className="mx-auto h-2 w-2 rounded-full bg-success" />
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-border bg-background/95 px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{viewTitle(route, selectedSession)}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{viewDescription(route, selectedSession)}</p>
              </div>

              <div className="flex items-center gap-2">
                {state?.health.ok ? <Badge variant="success">Connected</Badge> : <Badge variant="secondary">Loading</Badge>}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void loadData();
                  }}
                  disabled={isLoading || isMutating}
                >
                  <RefreshCw className={cn("mr-2 size-4", isLoading && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </div>
          </header>

          <div className="border-b border-border px-3 py-2 md:hidden">
            <div className="flex gap-1 overflow-x-auto">
              {SIDEBAR_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = route.kind === "page" && item.id === route.view;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleViewChange(item.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm whitespace-nowrap",
                      active
                        ? "border-border bg-accent text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-accent/70 hover:text-foreground"
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
              route.kind === "session" ? "overflow-hidden" : "overflow-y-auto"
            )}
          >
            {error ? (
              <Card className="border-danger/40 bg-danger/5">
                <CardContent className="pt-5">
                  <p className="text-sm text-danger">{error}</p>
                </CardContent>
              </Card>
            ) : null}

            {actionMessage ? (
              <Card className="border-border bg-accent/30">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm">{actionMessage}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="-mr-1 -mt-1 size-8"
                      onClick={() => setActionMessage(null)}
                      aria-label="Dismiss alert"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {!state && isLoading ? <p className="text-sm text-muted-foreground">Loading runtime data...</p> : null}

            {state ? (
              <div className={cn(route.kind === "session" ? "flex min-h-0 flex-1 flex-col" : "space-y-4")}>
                {route.kind === "page" && route.view === "overview" ? (
                  <>
                    <div className="grid gap-4 xl:grid-cols-3">
                      {metrics.map((metric) => {
                        const Icon = metric.icon;
                        return (
                          <Card key={metric.id}>
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardDescription>{metric.label}</CardDescription>
                                <span className="inline-flex size-8 items-center justify-center rounded-md bg-accent text-muted-foreground">
                                  <Icon className="size-4" />
                                </span>
                              </div>
                              <CardTitle className="text-4xl leading-none">{metric.value}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-xs text-muted-foreground">{metric.hint}</p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {agents.length >= 2 ? <OrganizationChartPanel agents={agents} /> : null}
                  </>
                ) : null}

                {route.kind === "page" && route.view === "agents" ? (
                  <div className="grid gap-4 xl:grid-cols-[390px_1fr]">
                    <Card>
                      <CardHeader>
                        <CardTitle>Create Agent</CardTitle>
                        <CardDescription>Only name and reporting manager are required.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <form className="space-y-4" onSubmit={(event) => void handleCreateAgent(event)}>
                          <div className="space-y-1.5">
                            <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="name">
                              Name
                            </label>
                            <Input
                              id="name"
                              value={createForm.name}
                              onChange={(event) => setCreateForm((value) => ({ ...value, name: event.target.value }))}
                              placeholder="Developer"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="reportsTo">
                              Reports To
                            </label>
                            <select
                              id="reportsTo"
                              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              value={createForm.reportsTo}
                              onChange={(event) =>
                                setCreateForm((value) => ({
                                  ...value,
                                  reportsTo: event.target.value
                                }))
                              }
                            >
                              {agents.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                  {agent.displayName} ({agent.id})
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-muted-foreground">You can only assign existing agents as manager.</p>
                          </div>

                          <Button
                            className="w-full"
                            disabled={isMutating || agents.length === 0 || !createForm.name.trim()}
                            type="submit"
                          >
                            Create Agent
                          </Button>
                        </form>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Agent Directory</CardTitle>
                        <CardDescription>Current organization members.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {agents.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No agents found.</p>
                        ) : (
                          <div className="overflow-hidden rounded-xl border border-border/80">
                            {agents.map((agent, index) => (
                              <div
                                key={agent.id}
                                className={cn(
                                  "flex items-center justify-between gap-3 bg-background/30 px-4 py-3",
                                  index !== agents.length - 1 && "border-b border-border/70"
                                )}
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{agent.displayName}</p>
                                  <p className="truncate text-xs text-muted-foreground">{agent.id}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {agent.id === "goat" ? <Badge variant="secondary">Head of Org</Badge> : null}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={agent.id === "goat" || isMutating}
                                    onClick={() => {
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
                      </CardContent>
                    </Card>
                  </div>
                ) : null}

                {route.kind === "session" ? (
                  selectedSession ? (
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
                              {sessionMessages.map((message) => (
                                <Message from={message.role} key={message.id}>
                                  <MessageContent>
                                    <MessageResponse>{message.content}</MessageResponse>
                                  </MessageContent>
                                </Message>
                              ))}
                              {sessionChatStatus === "streaming" ? (
                                <Message from="assistant" key={`${selectedSession.sessionId}:thinking`}>
                                  <MessageContent className="w-full max-w-full bg-transparent px-0 py-0">
                                    <Reasoning isStreaming>
                                      <ReasoningTrigger />
                                      <ReasoningContent>
                                        Working on your request. The response will appear here as soon as the runtime
                                        finishes.
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
                            placeholder="Message this session..."
                            disabled={sessionChatStatus === "streaming" || isLoading || isMutating}
                          />
                        </PromptInputBody>
                        <PromptInputFooter className="justify-end">
                          <PromptInputSubmit
                            status={sessionChatStatus}
                            disabled={sessionChatStatus === "streaming" || isLoading || isMutating}
                          />
                        </PromptInputFooter>
                      </PromptInput>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {`No saved session was found for id ${route.sessionId}.`}
                    </p>
                  )
                ) : null}

                {route.kind === "page" && route.view === "skills" ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Assigned Skills</CardTitle>
                        <CardDescription>Skills currently assigned to goat.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {state.agentSkills.skills.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No assigned skills.</p>
                        ) : (
                          state.agentSkills.skills.map((skill) => (
                            <div key={skill.id} className="rounded-md border border-border/80 bg-background/30 p-3">
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <p className="font-medium">{skill.name}</p>
                                <Badge variant="secondary">{skill.source}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{skill.description || "No description"}</p>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Global Skills</CardTitle>
                        <CardDescription>Centralized reusable skill catalog.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {state.globalSkills.skills.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No global skills.</p>
                        ) : (
                          state.globalSkills.skills.map((skill) => (
                            <div key={skill.id} className="rounded-md border border-border/80 bg-background/30 p-3">
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <p className="font-medium">{skill.name}</p>
                                <Badge variant="secondary">{skill.source}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{skill.description || "No description"}</p>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
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
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());

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
      onToggle: toggleNode
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
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Organization Chart</CardTitle>
          <CardDescription>
            Multi-level hierarchy with zoom, pan, and per-branch expand/collapse controls.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={expandAll}>
            Expand All
          </Button>
          <Button size="sm" variant="secondary" onClick={collapseAll}>
            Collapse Branches
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {flowModel.nodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No organization nodes found.</p>
        ) : (
          <div className="h-[640px] rounded-lg border border-border/80 bg-background/50">
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

function OrganizationChartNode({ id, data }: NodeProps<OrgChartNode>): ReactElement {
  const hasChildren = data.directReports > 0;

  return (
    <div className="relative w-[260px] rounded-lg border border-border bg-card px-3 py-3 shadow-sm">
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border !border-border !bg-background"
        isConnectable={false}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{data.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{data.agentId}</p>
        </div>

        {hasChildren ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              data.onToggle(id);
            }}
            className="inline-flex min-w-10 items-center justify-center rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={data.collapsed ? `Expand ${data.displayName}` : `Collapse ${data.displayName}`}
          >
            {data.collapsed ? "+" : "-"}
            {data.directReports}
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Badge variant="secondary" className="capitalize">
          {data.type}
        </Badge>
        <p className="text-xs text-muted-foreground">
          {hasChildren ? `${data.directReports} direct report${data.directReports > 1 ? "s" : ""}` : "No direct reports"}
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
  const sortedAgents = [...agents].sort((left, right) => left.displayName.localeCompare(right.displayName));
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
      return (leftAgent?.displayName ?? left).localeCompare(rightAgent?.displayName ?? right);
    });
  }

  roots.sort((left, right) => {
    const leftAgent = agentsById.get(left);
    const rightAgent = agentsById.get(right);
    return (leftAgent?.displayName ?? left).localeCompare(rightAgent?.displayName ?? right);
  });

  if (roots.length === 0 && sortedAgents.length > 0) {
    roots.push(sortedAgents[0]?.id ?? "");
  }

  return {
    agentsById,
    childrenById,
    roots: roots.filter(Boolean)
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
      edges: []
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
    marginy: 24
  });

  for (const agentId of visibleNodeIds) {
    graph.setNode(agentId, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT
    });
  }

  for (const edge of visibleEdges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  const nodes = visibleNodeIds.map((agentId) => {
    const agent = hierarchy.agentsById.get(agentId);
    const layout = graph.node(agentId) as { x: number; y: number } | undefined;
    const directReports = hierarchy.childrenById.get(agentId)?.length ?? 0;

    return {
      id: agentId,
      type: "orgNode",
      position: {
        x: (layout?.x ?? 0) - NODE_WIDTH / 2,
        y: (layout?.y ?? 0) - NODE_HEIGHT / 2
      },
      data: {
        agentId,
        displayName: agent?.displayName ?? agentId,
        type: agent?.type ?? "unknown",
        directReports,
        collapsed: collapsedNodeIds.has(agentId),
        onToggle
      }
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
        strokeWidth: 1.4
      }
    } satisfies Edge;
  });

  return {
    nodes,
    edges
  };
}

function normalizeReportsTo(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "null" || normalized === "none") {
    return null;
  }
  return normalized;
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => {
    return null;
  });

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

function viewTitle(route: AppRoute, selectedSession: Session | null): string {
  if (route.kind === "session") {
    return selectedSession?.title ?? "Session";
  }

  switch (route.view) {
    case "overview":
      return "Dashboard";
    case "agents":
      return "Agents";
    case "skills":
      return "Skills";
    default:
      return "Dashboard";
  }
}

function viewDescription(route: AppRoute, selectedSession: Session | null): string {
  if (route.kind === "session") {
    return selectedSession
      ? `Viewing session ${selectedSession.sessionId}.`
      : `Session id ${route.sessionId} was not found.`;
  }

  switch (route.view) {
    case "overview":
      return "Operational summary for your OpenGoat runtime.";
    case "agents":
      return "Create and maintain your organization hierarchy.";
    case "skills":
      return "Review assigned and global skill coverage.";
    default:
      return "";
  }
}

function getInitialRoute(): AppRoute {
  if (typeof window === "undefined") {
    return { kind: "page", view: "overview" };
  }

  return parseRoute(window.location.pathname);
}

function parseRoute(pathname: string): AppRoute {
  const normalized = pathname.trim() || "/";

  if (normalized === "/" || normalized === "/overview") {
    return { kind: "page", view: "overview" };
  }

  if (normalized === "/agents") {
    return { kind: "page", view: "agents" };
  }

  if (normalized === "/skills") {
    return { kind: "page", view: "skills" };
  }

  if (normalized.startsWith("/sessions/")) {
    const sessionId = decodeURIComponent(normalized.slice("/sessions/".length)).trim();
    if (sessionId) {
      return {
        kind: "session",
        sessionId
      };
    }
  }

  return { kind: "page", view: "overview" };
}

function routeToPath(route: AppRoute): string {
  if (route.kind === "session") {
    return `/sessions/${encodeURIComponent(route.sessionId)}`;
  }

  if (route.view === "overview") {
    return "/overview";
  }

  return `/${route.view}`;
}

function toSessionMessageImages(files: FileUIPart[]): SessionMessageImageInput[] {
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
      name: file.filename
    });
  }

  return images;
}
