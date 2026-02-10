import type { ComponentType, FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Boxes, Home, RefreshCw, UserRoundPlus, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type ViewKey = "overview" | "agents" | "sessions" | "skills" | "providers";

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
}

interface Provider {
  id: string;
  displayName: string;
  kind: string;
  capabilities: {
    agent: boolean;
    model: boolean;
    auth: boolean;
    passthrough: boolean;
    agentCreate?: boolean;
    agentDelete?: boolean;
  };
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
  providers: Provider[];
  totals: {
    agents: number;
    providers: number;
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

interface CreateAgentForm {
  name: string;
  type: "manager" | "individual";
  reportsTo: string;
  skills: string;
}

interface SidebarItem {
  id: ViewKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "agents", label: "Agents", icon: UsersRound },
  { id: "sessions", label: "Sessions", icon: UserRoundPlus },
  { id: "skills", label: "Skills", icon: Boxes },
  { id: "providers", label: "Providers", icon: Bot }
];

const DEFAULT_FORM: CreateAgentForm = {
  name: "",
  type: "individual",
  reportsTo: "goat",
  skills: ""
};

export function App(): ReactElement {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [state, setState] = useState<DashboardState | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setMutating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAgentForm>(DEFAULT_FORM);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const metrics = useMemo(() => {
    if (!state) {
      return [];
    }

    return [
      { label: "Agents", value: state.overview.totals.agents, hint: "Organization members" },
      { label: "Providers", value: state.overview.totals.providers, hint: "Runtime adapters" },
      { label: "Goat Sessions", value: state.sessions.sessions.length, hint: "Saved conversation contexts" },
      { label: "Global Skills", value: state.globalSkills.skills.length, hint: "Reusable capabilities" }
    ];
  }, [state]);

  async function handleCreateAgent(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!createForm.name.trim()) {
      setActionMessage("Agent name is required.");
      return;
    }

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
          type: createForm.type,
          reportsTo: createForm.reportsTo.trim() || undefined,
          skills: createForm.skills.trim()
        })
      });

      setActionMessage(response.message ?? `Agent \"${createForm.name}\" processed.`);
      setCreateForm(DEFAULT_FORM);
      await loadData();
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
      await loadData();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to delete agent.";
      setActionMessage(message);
    } finally {
      setMutating(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
        <aside className="border-r border-border bg-card/50 px-3 py-4">
          <div className="mb-4 px-2">
            <p className="text-sm font-semibold">OpenGoat UI</p>
            <p className="text-xs text-muted-foreground">OpenClaw management</p>
          </div>
          <Separator className="mb-4" />
          <nav className="space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeView;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="p-4 md:p-6">
          <header className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{viewTitle(activeView)}</h1>
              <p className="text-sm text-muted-foreground">{viewDescription(activeView)}</p>
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
          </header>

          {error ? (
            <Card className="mb-4 border-danger/50">
              <CardContent className="pt-5">
                <p className="text-sm text-danger">{error}</p>
              </CardContent>
            </Card>
          ) : null}

          {!state && isLoading ? <p className="text-sm text-muted-foreground">Loading runtime data...</p> : null}

          {state ? (
            <div className="space-y-4">
              {activeView === "overview" ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {metrics.map((metric) => (
                      <Card key={metric.label}>
                        <CardHeader>
                          <CardDescription>{metric.label}</CardDescription>
                          <CardTitle className="text-2xl">{metric.value}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground">{metric.hint}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Home Directory</CardTitle>
                      <CardDescription>Current OpenGoat runtime root.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <code className="rounded bg-accent px-2 py-1 text-xs">{state.health.homeDir}</code>
                    </CardContent>
                  </Card>
                </>
              ) : null}

              {activeView === "agents" ? (
                <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Create Agent</CardTitle>
                      <CardDescription>Create an OpenClaw-backed agent.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form className="space-y-3" onSubmit={(event) => void handleCreateAgent(event)}>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground" htmlFor="name">
                            Name
                          </label>
                          <Input
                            id="name"
                            value={createForm.name}
                            onChange={(event) => setCreateForm((value) => ({ ...value, name: event.target.value }))}
                            placeholder="Developer"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground" htmlFor="type">
                            Type
                          </label>
                          <select
                            id="type"
                            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                            value={createForm.type}
                            onChange={(event) =>
                              setCreateForm((value) => ({
                                ...value,
                                type: event.target.value as CreateAgentForm["type"]
                              }))
                            }
                          >
                            <option value="individual">Individual</option>
                            <option value="manager">Manager</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground" htmlFor="reportsTo">
                            Reports To
                          </label>
                          <Input
                            id="reportsTo"
                            value={createForm.reportsTo}
                            onChange={(event) => setCreateForm((value) => ({ ...value, reportsTo: event.target.value }))}
                            placeholder="goat"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground" htmlFor="skills">
                            Skills (comma-separated)
                          </label>
                          <Input
                            id="skills"
                            value={createForm.skills}
                            onChange={(event) => setCreateForm((value) => ({ ...value, skills: event.target.value }))}
                            placeholder="manager, testing"
                          />
                        </div>

                        <Button className="w-full" disabled={isMutating} type="submit">
                          Create Agent
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Agent List</CardTitle>
                      <CardDescription>Current organization members.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {state.overview.agents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No agents found.</p>
                      ) : (
                        state.overview.agents.map((agent) => (
                          <div key={agent.id} className="flex items-center justify-between rounded-md border border-border p-3">
                            <div>
                              <p className="font-medium">{agent.displayName}</p>
                              <p className="text-xs text-muted-foreground">{agent.id}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {agent.id === "goat" ? <Badge variant="secondary">Default</Badge> : null}
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
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {activeView === "sessions" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Goat Sessions</CardTitle>
                    <CardDescription>Saved sessions for default manager.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {state.sessions.sessions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No sessions available.</p>
                    ) : (
                      state.sessions.sessions.map((session) => (
                        <div key={session.sessionId} className="rounded-md border border-border p-3">
                          <p className="font-medium">{session.title}</p>
                          <p className="text-xs text-muted-foreground">{session.sessionId}</p>
                          <p className="text-xs text-muted-foreground">
                            Updated {new Date(session.updatedAt).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {activeView === "skills" ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Assigned Skills</CardTitle>
                      <CardDescription>Skills assigned to goat.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {state.agentSkills.skills.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No assigned skills.</p>
                      ) : (
                        state.agentSkills.skills.map((skill) => (
                          <div key={skill.id} className="rounded-md border border-border p-3">
                            <div className="mb-1 flex items-center justify-between">
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
                      <CardDescription>Centralized skill catalog.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {state.globalSkills.skills.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No global skills.</p>
                      ) : (
                        state.globalSkills.skills.map((skill) => (
                          <div key={skill.id} className="rounded-md border border-border p-3">
                            <div className="mb-1 flex items-center justify-between">
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

              {activeView === "providers" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Providers</CardTitle>
                    <CardDescription>Available provider runtimes and capabilities.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {state.overview.providers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No providers configured.</p>
                    ) : (
                      state.overview.providers.map((provider) => (
                        <div key={provider.id} className="rounded-md border border-border p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <div>
                              <p className="font-medium">{provider.displayName}</p>
                              <p className="text-xs text-muted-foreground">{provider.id}</p>
                            </div>
                            <Badge>{provider.kind}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            agent:{String(provider.capabilities.agent)} auth:{String(provider.capabilities.auth)} passthrough:
                            {String(provider.capabilities.passthrough)}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {actionMessage ? (
                <Card className="border-primary/30">
                  <CardContent className="pt-5">
                    <p className="text-sm">{actionMessage}</p>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
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
    case "providers":
      return "Providers";
    default:
      return "Dashboard";
  }
}

function viewDescription(view: ViewKey): string {
  switch (view) {
    case "overview":
      return "Operational summary for your OpenGoat runtime.";
    case "agents":
      return "Create and manage organization agents.";
    case "sessions":
      return "Inspect saved conversation sessions.";
    case "skills":
      return "Review assigned and global skills.";
    case "providers":
      return "Check provider integrations and capabilities.";
    default:
      return "";
  }
}
