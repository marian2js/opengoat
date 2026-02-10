import type { ComponentType, FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Boxes,
  LayoutDashboard,
  Link2,
  Network,
  RefreshCw,
  Rocket,
  UserRoundPlus
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type ViewKey = "overview" | "agents" | "sessions" | "skills" | "providers" | "gateway";

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
  source: "managed" | "extra";
}

interface Gateway {
  mode: string;
  gatewayUrl?: string;
  gatewayToken?: string;
}

interface OverviewResponse {
  agents: Agent[];
  providers: Provider[];
  gateway: Gateway;
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
  description: string;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Status and quick metrics"
  },
  {
    id: "agents",
    label: "Agents",
    icon: UserRoundPlus,
    description: "Create and manage agents"
  },
  {
    id: "sessions",
    label: "Sessions",
    icon: Link2,
    description: "Inspect continuity and context"
  },
  {
    id: "skills",
    label: "Skills",
    icon: Boxes,
    description: "Review assigned and global skills"
  },
  {
    id: "providers",
    label: "Providers",
    icon: Bot,
    description: "OpenClaw provider capabilities"
  },
  {
    id: "gateway",
    label: "Gateway",
    icon: Network,
    description: "Runtime gateway configuration"
  }
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
      {
        label: "Agents",
        value: state.overview.totals.agents,
        hint: "Organization members"
      },
      {
        label: "Providers",
        value: state.overview.totals.providers,
        hint: "Runtime adapters"
      },
      {
        label: "Goat Sessions",
        value: state.sessions.sessions.length,
        hint: "Saved conversation contexts"
      },
      {
        label: "Global Skills",
        value: state.globalSkills.skills.length,
        hint: "Reusable capabilities"
      }
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
    <div className="min-h-screen p-3 md:p-6">
      <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-4 md:flex-row">
        <aside className="md:w-80">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                    <Rocket className="size-4" />
                  </span>
                  <div>
                    <CardTitle className="text-base">OpenGoat UI</CardTitle>
                    <CardDescription>OpenClaw management extension</CardDescription>
                  </div>
                </div>
                {state?.health.ok ? <Badge variant="success">Connected</Badge> : <Badge variant="secondary">Loading</Badge>}
              </div>
              <Separator />
            </CardHeader>

            <CardContent className="space-y-2">
              {SIDEBAR_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveView(item.id)}
                    className={cn(
                      "w-full rounded-lg border border-transparent px-3 py-3 text-left transition",
                      "hover:border-border/80 hover:bg-accent/60",
                      isActive && "border-primary/40 bg-primary/10"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-primary" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </aside>

        <main className="flex-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">{viewTitle(activeView)}</CardTitle>
                <CardDescription>{viewDescription(activeView)}</CardDescription>
              </div>
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
            </CardHeader>
            <CardContent>
              {error ? (
                <Card className="border-danger/50">
                  <CardContent className="pt-5">
                    <p className="text-sm text-danger">{error}</p>
                  </CardContent>
                </Card>
              ) : null}

              {!state && isLoading ? <p className="text-sm text-muted-foreground">Loading runtime data...</p> : null}

              {state ? (
                <div className="space-y-5">
                  {activeView === "overview" ? (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {metrics.map((item) => (
                        <Card key={item.label}>
                          <CardHeader>
                            <CardDescription>{item.label}</CardDescription>
                            <CardTitle className="text-3xl">{item.value}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xs text-muted-foreground">{item.hint}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : null}

                  {activeView === "agents" ? (
                    <div className="grid gap-4 lg:grid-cols-[1.1fr_1.6fr]">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Create Agent</CardTitle>
                          <CardDescription>Bootstrap a new OpenClaw-backed org member.</CardDescription>
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
                                className="h-9 w-full rounded-md border border-border bg-background/60 px-3 text-sm"
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
                                Skills
                              </label>
                              <Input
                                id="skills"
                                value={createForm.skills}
                                onChange={(event) => setCreateForm((value) => ({ ...value, skills: event.target.value }))}
                                placeholder="manager, testing"
                              />
                            </div>

                            <Button type="submit" className="w-full" disabled={isMutating}>
                              Create Agent
                            </Button>
                          </form>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Existing Agents</CardTitle>
                          <CardDescription>Current organization hierarchy members.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {state.overview.agents.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No agents found.</p>
                          ) : (
                            state.overview.agents.map((agent) => (
                              <div
                                key={agent.id}
                                className="rounded-lg border border-border/80 bg-background/40 p-3 sm:flex sm:items-center sm:justify-between"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">{agent.displayName}</p>
                                    {agent.id === "goat" ? <Badge variant="secondary">Default</Badge> : null}
                                  </div>
                                  <p className="text-xs text-muted-foreground">ID: {agent.id}</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={agent.id === "goat" || isMutating}
                                  onClick={() => {
                                    void handleDeleteAgent(agent.id);
                                  }}
                                >
                                  Delete
                                </Button>
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
                        <CardTitle className="text-base">Goat Sessions</CardTitle>
                        <CardDescription>Session continuity for the default manager.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {state.sessions.sessions.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No active sessions.</p>
                        ) : (
                          state.sessions.sessions.map((session) => (
                            <div key={session.sessionId} className="rounded-lg border border-border/80 bg-background/40 p-3">
                              <p className="font-medium">{session.title}</p>
                              <p className="text-xs text-muted-foreground">Session ID: {session.sessionId}</p>
                              <p className="text-xs text-muted-foreground">
                                Updated: {new Date(session.updatedAt).toLocaleString()}
                              </p>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  ) : null}

                  {activeView === "skills" ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Goat Skills</CardTitle>
                          <CardDescription>Assigned to default manager.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {state.agentSkills.skills.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No skills assigned.</p>
                          ) : (
                            state.agentSkills.skills.map((skill) => (
                              <div key={skill.id} className="rounded-lg border border-border/80 bg-background/40 p-3">
                                <div className="flex items-center justify-between gap-2">
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
                          <CardTitle className="text-base">Global Skills</CardTitle>
                          <CardDescription>Centralized reusable catalog.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {state.globalSkills.skills.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No global skills installed.</p>
                          ) : (
                            state.globalSkills.skills.map((skill) => (
                              <div key={skill.id} className="rounded-lg border border-border/80 bg-background/40 p-3">
                                <div className="flex items-center justify-between gap-2">
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
                        <CardTitle className="text-base">Providers</CardTitle>
                        <CardDescription>OpenClaw runtime adapters and capabilities.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {state.overview.providers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No providers found.</p>
                        ) : (
                          state.overview.providers.map((provider) => (
                            <div key={provider.id} className="rounded-lg border border-border/80 bg-background/40 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="font-medium">{provider.displayName}</p>
                                  <p className="text-xs text-muted-foreground">{provider.id}</p>
                                </div>
                                <Badge>{provider.kind}</Badge>
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">
                                agent:{String(provider.capabilities.agent)} auth:{String(provider.capabilities.auth)} passthrough:
                                {String(provider.capabilities.passthrough)}
                              </p>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  ) : null}

                  {activeView === "gateway" ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Gateway</CardTitle>
                        <CardDescription>Current OpenClaw gateway connectivity mode.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 rounded-lg border border-border/80 bg-background/40 p-3">
                          <p className="text-sm">
                            Mode: <span className="font-medium">{state.overview.gateway.mode}</span>
                          </p>
                          {state.overview.gateway.gatewayUrl ? (
                            <p className="text-xs text-muted-foreground">URL: {state.overview.gateway.gatewayUrl}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Using local OpenClaw gateway runtime.</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  {actionMessage ? (
                    <Card className="border-primary/40 bg-primary/5">
                      <CardContent className="pt-5">
                        <p className="text-sm">{actionMessage}</p>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </main>
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
      return "Organization Overview";
    case "agents":
      return "Agents";
    case "sessions":
      return "Sessions";
    case "skills":
      return "Skills";
    case "providers":
      return "Providers";
    case "gateway":
      return "Gateway";
    default:
      return "Overview";
  }
}

function viewDescription(view: ViewKey): string {
  switch (view) {
    case "overview":
      return "Operational state for OpenClaw-backed organization runtime.";
    case "agents":
      return "Create, inspect, and delete organization agents.";
    case "sessions":
      return "Session continuity and transcript metadata.";
    case "skills":
      return "Assigned and global skills available to runtime agents.";
    case "providers":
      return "Configured provider inventory and capabilities.";
    case "gateway":
      return "OpenClaw local/external gateway mode.";
    default:
      return "";
  }
}
