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
  Home,
  Folder,
  FolderPlus,
  Circle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Sparkles,
  UserRoundPlus,
  UsersRound,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type ViewKey = "overview" | "agents" | "sessions" | "skills";

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

interface CreateAgentForm {
  name: string;
  reportsTo: string;
}

interface SidebarItem {
  id: ViewKey;
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
  { id: "sessions", label: "Sessions", icon: UserRoundPlus },
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
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [state, setState] = useState<DashboardState | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setMutating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAgentForm>(DEFAULT_FORM);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [openWorkspaceMenuId, setOpenWorkspaceMenuId] = useState<string | null>(null);

  const handleViewChange = useCallback((nextView: ViewKey) => {
    setActiveView(nextView);
    setActionMessage(null);
    setOpenWorkspaceMenuId(null);
  }, []);

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
      setActiveView("sessions");
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
      setActiveView("sessions");
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
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

          <nav className="flex-1 p-2">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeView;

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

            {workspaceNodes.map((workspace) => (
              <div key={workspace.id} className="group relative mb-1">
                <button
                  type="button"
                  title={`${workspace.name} (${workspace.workingPath})`}
                  onClick={() => {
                    setActiveView("sessions");
                  }}
                  className={cn(
                    "flex w-full items-center rounded-md px-3 py-2 pr-16 text-sm text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground",
                    isSidebarCollapsed && "justify-center px-2 pr-2"
                  )}
                >
                  <Folder className="size-4 shrink-0" />
                  {!isSidebarCollapsed ? <span className="ml-2 truncate">{workspace.name}</span> : null}
                </button>

                {!isSidebarCollapsed ? (
                  <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label={`New session in ${workspace.name}`}
                      title="New Session"
                      disabled={isMutating}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
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

                {!isSidebarCollapsed ? (
                  <div className="mt-0.5 space-y-0.5">
                    {workspace.sessions.map((session) => (
                      <button
                        key={session.sessionId}
                        type="button"
                        title={`${session.title} (${session.sessionKey})`}
                        onClick={() => {
                          setActiveView("sessions");
                        }}
                        className="flex w-full items-center rounded-md py-1.5 pl-9 pr-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                      >
                        <Circle className="mr-2 size-2 shrink-0 fill-current text-info" />
                        <span className="truncate">{session.title}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
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

        <div className="flex-1">
          <header className="border-b border-border bg-background/95 px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{viewTitle(activeView)}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{viewDescription(activeView)}</p>
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
                const active = item.id === activeView;

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

          <main className="space-y-4 p-4 sm:p-6">
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
              <div className="space-y-4">
                {activeView === "overview" ? (
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

                {activeView === "agents" ? (
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

                {activeView === "sessions" ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Goat Sessions</CardTitle>
                      <CardDescription>Saved sessions for the default manager.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {sessions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No sessions available.</p>
                      ) : (
                        <div className="space-y-2">
                          {sessions.map((session) => (
                            <div key={session.sessionId} className="rounded-md border border-border/80 bg-background/30 p-3">
                              <div className="mb-1 flex items-start justify-between gap-3">
                                <p className="font-medium">{session.title}</p>
                                <Badge variant="secondary">{session.compactionCount} compact</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{session.sessionId}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {new Date(session.updatedAt).toLocaleString()} | {session.totalChars.toLocaleString()} chars
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null}

                {activeView === "skills" ? (
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

function viewTitle(view: ViewKey): string {
  switch (view) {
    case "overview":
      return "Dashboard";
    case "agents":
      return "Agents";
    case "sessions":
      return "Sessions";
    case "skills":
      return "Skills";
    default:
      return "Dashboard";
  }
}

function viewDescription(view: ViewKey): string {
  switch (view) {
    case "overview":
      return "Operational summary for your OpenGoat runtime.";
    case "agents":
      return "Create and maintain your organization hierarchy.";
    case "sessions":
      return "Inspect saved session continuity for the default manager.";
    case "skills":
      return "Review assigned and global skill coverage.";
    default:
      return "";
  }
}
