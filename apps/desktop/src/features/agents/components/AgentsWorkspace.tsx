import { startTransition, useEffect, useMemo, useState } from "react";
import { BotIcon, LoaderCircleIcon, PlusIcon, RefreshCcwIcon, SparklesIcon } from "lucide-react";
import type { Agent, AuthOverview, ProviderModelCatalog } from "@/app/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cleanProviderName, formatAgentCount } from "@/features/agents/display-helpers";
import { buildAgentModelUpdatePayload } from "@/features/agents/model-selection";
import { cn } from "@/lib/utils";
import { SidecarClient } from "@/lib/sidecar/client";

interface AgentsWorkspaceProps {
  authOverview: AuthOverview | null;
  client: SidecarClient | null;
  createRequestToken: number;
}

interface CreateAgentDraft {
  modelId: string;
  name: string;
  providerId: string;
}

interface ConnectedProviderOption {
  providerId: string;
  providerName: string;
}

const EMPTY_DRAFT: CreateAgentDraft = {
  modelId: "",
  name: "",
  providerId: "",
};

export function AgentsWorkspace({
  authOverview,
  client,
  createRequestToken,
}: AgentsWorkspaceProps) {
  const connectedProviders = useMemo(
    () =>
      [...new Map(
        (authOverview?.connections ?? []).map((connection) => [
          connection.providerId,
          {
            providerId: connection.providerId,
            providerName: connection.providerName,
          },
        ]),
      ).values()],
    [authOverview],
  );
  const [agents, setAgents] = useState<Agent[]>([]);
  const [modelCatalogs, setModelCatalogs] = useState<Record<string, ProviderModelCatalog>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CreateAgentDraft>(EMPTY_DRAFT);

  useEffect(() => {
    const nextProviderId =
      authOverview?.selectedProviderId ?? connectedProviders[0]?.providerId ?? "";

    setDraft((current) =>
      current.providerId
        ? current
        : {
            ...current,
            providerId: nextProviderId,
          },
    );
  }, [authOverview?.selectedProviderId, connectedProviders]);

  useEffect(() => {
    if (!client || connectedProviders.length === 0) {
      setModelCatalogs({});
      return;
    }

    let cancelled = false;
    const runtimeClient = client;

    async function loadModelCatalogs(): Promise<void> {
      const entries = await Promise.all(
        connectedProviders.map(async (provider) => [
          provider.providerId,
          await runtimeClient.providerModels(provider.providerId),
        ] as const),
      );

      if (!cancelled) {
        setModelCatalogs(Object.fromEntries(entries));
      }
    }

    void loadModelCatalogs().catch((error: unknown) => {
      if (!cancelled) {
        setErrorMessage(getErrorMessage(error));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [client, connectedProviders]);

  useEffect(() => {
    let cancelled = false;

    async function loadAgents(): Promise<void> {
      if (!client) {
        if (!cancelled) {
          setAgents([]);
          setIsLoading(false);
          setErrorMessage("Agents are temporarily unavailable.");
        }
        return;
      }

      if (!cancelled) {
        setIsLoading(true);
        setErrorMessage(null);
      }

      try {
        const catalog = await client.agents();
        if (!cancelled) {
          setAgents(catalog.agents);
        }
      } catch (error) {
        if (!cancelled) {
          setAgents([]);
          setErrorMessage("Agents are temporarily unavailable.");
        }
        console.error("Failed to load agents", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAgents();

    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (createRequestToken === 0) {
      return;
    }

    setFeedback(null);
    setErrorMessage(null);
    setIsCreateOpen(true);
  }, [createRequestToken]);

  const selectedProviderName =
    connectedProviders.find((provider) => provider.providerId === draft.providerId)
      ?.providerName ?? "selected provider";
  const selectedProviderCatalog = draft.providerId ? modelCatalogs[draft.providerId] : undefined;
  const canCreate =
    Boolean(client) &&
    Boolean(draft.name.trim()) &&
    Boolean(draft.providerId.trim());

  async function refreshAgents(): Promise<void> {
    if (!client) {
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const catalog = await client.agents();
      setAgents(catalog.agents);
    } catch (error) {
      setErrorMessage("Agents are temporarily unavailable.");
      console.error("Failed to refresh agents", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateAgent(): Promise<void> {
    if (!client || !canCreate) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setFeedback(null);

    try {
      const createdAgent = await client.createAgent({
        name: draft.name.trim(),
        providerId: draft.providerId.trim(),
        ...(draft.modelId.trim() ? { modelId: draft.modelId.trim() } : {}),
      });

      startTransition(() => {
        setAgents((current) => [...current, createdAgent]);
        setDraft({
          ...EMPTY_DRAFT,
          providerId: draft.providerId,
        });
        setIsCreateOpen(false);
      });
      setFeedback(`Created ${createdAgent.name}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not create agent.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateAgentModel(
    agent: Agent,
    effectiveProviderId: string,
    nextModelId: string,
  ): Promise<void> {
    if (!client) {
      return;
    }

    setBusyAgentId(agent.id);
    setErrorMessage(null);
    setFeedback(null);

    try {
      const updatedAgent = await updateAgentWithFallback(
        client,
        agent.id,
        buildAgentModelUpdatePayload({
          agent,
          effectiveProviderId,
          nextModelId,
          selectedProviderId: authOverview?.selectedProviderId,
        }),
      );

      setAgents((current) =>
        current.map((currentAgent) => (currentAgent.id === agent.id ? updatedAgent : currentAgent)),
      );
      setFeedback(`Updated ${updatedAgent.name}.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAgentId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      {errorMessage ? (
        <div className="rounded-lg border border-warning/20 bg-warning/8 px-3.5 py-2.5 text-[13px] text-warning-foreground">
          {errorMessage}
        </div>
      ) : null}

      {feedback ? (
        <div className="rounded-lg border border-success/20 bg-success/8 px-3.5 py-2.5 text-[13px] text-success">
          {feedback}
        </div>
      ) : null}

      {isCreateOpen ? (
        <Card className="overflow-hidden rounded-xl border-border/40 shadow-sm shadow-black/[0.02] dark:border-white/[0.06] dark:shadow-black/10">
          <CardHeader className="gap-0.5 pb-4">
            <CardTitle className="text-[14px]">Create agent</CardTitle>
            <CardDescription className="text-[12px]">
              OpenGoat will generate the initial instructions for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <label className="grid gap-1.5 text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Agent name</span>
              <Input
                className="h-9 rounded-md text-[13px]"
                placeholder="Research"
                value={draft.name}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDraft((current) => ({ ...current, name: nextValue }));
                }}
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Provider</span>
              <select
                className="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none transition-colors focus:border-primary"
                value={draft.providerId}
                onChange={(event) => {
                  const nextProviderId = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    modelId: "",
                    providerId: nextProviderId,
                  }));
                }}
              >
                <option value="">Select provider</option>
                {connectedProviders.map((provider) => (
                  <option key={provider.providerId} value={provider.providerId}>
                    {provider.providerName}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Model</span>
              <select
                className="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!draft.providerId}
                value={draft.modelId}
                onChange={(event) => {
                  const nextModelId = event.target.value;
                  setDraft((current) => ({ ...current, modelId: nextModelId }));
                }}
              >
                <option value="">Provider default</option>
                {selectedProviderCatalog?.models.map((model) => (
                  <option key={model.modelRef} value={model.modelId}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
          </CardContent>
          <CardFooter className="flex flex-col items-stretch gap-2.5 border-t border-border/30 bg-muted/15 dark:border-white/[0.04] dark:bg-white/[0.01] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-muted-foreground">
              Uses {selectedProviderName}.
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-md text-[12px]"
                onClick={() => {
                  setIsCreateOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-md px-3 text-[12px]"
                disabled={!canCreate || isSubmitting}
                onClick={() => {
                  void handleCreateAgent();
                }}
              >
                {isSubmitting ? (
                  <>
                    <SparklesIcon className="size-3 animate-pulse" />
                    Creating
                  </>
                ) : (
                  <>
                    <PlusIcon className="size-3" />
                    Create agent
                  </>
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border/40 bg-card/80 shadow-sm shadow-black/[0.02] transition-colors hover:border-border/60 dark:border-white/[0.06] dark:shadow-black/10 dark:hover:border-white/[0.10]">
        <div className="flex items-center justify-between gap-3 px-4 py-4 lg:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 shadow-sm ring-1 ring-primary/10">
              <BotIcon className="size-3.5 text-primary" />
            </div>
            <h2 className="section-label">Agent Library</h2>
            <span className="rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
              {agents.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-lg text-[11px]"
              onClick={() => {
                setFeedback(null);
                setErrorMessage(null);
                setIsCreateOpen(true);
              }}
            >
              <PlusIcon className="size-3" />
              Add agent
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-lg text-[11px] text-muted-foreground"
              onClick={() => {
                void refreshAgents();
              }}
            >
              <RefreshCcwIcon className="size-3" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex flex-col">
          {isLoading ? (
            <div className="border-t border-border/60 px-4 py-5 lg:px-5">
              <div className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                Loading agents...
              </div>
            </div>
          ) : agents.length === 0 ? (
            <div className="border-t border-border/40 px-4 py-10 dark:border-white/[0.04] lg:px-5">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/8 shadow-sm ring-1 ring-primary/10">
                  <BotIcon className="size-7 text-primary/60" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                    No agents yet
                  </h3>
                  <p className="max-w-[320px] text-[12px] leading-relaxed text-muted-foreground/60">
                    Create your first agent with its own provider, model, and instructions.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 h-8 rounded-lg text-[12px] shadow-sm"
                  onClick={() => {
                    setFeedback(null);
                    setErrorMessage(null);
                    setIsCreateOpen(true);
                  }}
                >
                  <PlusIcon className="size-3" />
                  Create agent
                </Button>
              </div>
            </div>
          ) : agents.length === 1 ? (
            (() => {
              const agent = agents[0];
              const effectiveProviderId = resolveAgentProviderId(agent, authOverview);
              const effectiveModelCatalog = effectiveProviderId
                ? modelCatalogs[effectiveProviderId]
                : undefined;

              return (
                <div className="border-t border-border/40 px-4 py-5 dark:border-white/[0.04] lg:px-5">
                  <article className="group/agent relative overflow-hidden rounded-xl border border-border/50 bg-card p-6 shadow-sm shadow-black/[0.02] transition-all duration-150 hover:border-primary/20 hover:shadow-md hover:shadow-black/[0.04] dark:border-white/[0.06] dark:shadow-black/10 dark:hover:border-primary/15 dark:hover:shadow-black/15">
                    <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-[inherit] bg-primary/20 transition-colors group-hover/agent:bg-primary" />
                    <div className="flex items-start gap-4 pl-1">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <BotIcon className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-[16px] font-bold tracking-tight text-foreground">
                              {agent.name}
                            </h3>
                            {agent.isDefault ? (
                              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                Default
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                            {(() => {
                              const desc = agent.description ?? "";
                              // Show a friendlier description instead of raw URL
                              try {
                                const url = new URL(desc.startsWith("http") ? desc : `https://${desc}`);
                                return `AI CMO for ${url.hostname.replace(/^www\./, "")} — marketing strategy, growth, and content execution.`;
                              } catch {
                                return desc || "Marketing strategy, growth, and content execution.";
                              }
                            })()}
                          </p>
                        </div>

                        <div className="grid gap-4 rounded-lg border border-border/30 bg-muted/20 p-4 sm:grid-cols-3">
                          <div className="grid gap-1">
                            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                              Provider
                            </span>
                            <span className="text-[13px] font-medium text-foreground">
                              {providerLabel(effectiveProviderId, connectedProviders)}
                            </span>
                          </div>

                          <label className="grid gap-1">
                            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                              Model
                            </span>
                            <div className="flex items-center gap-1.5">
                              <select
                                className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-[12px] text-foreground outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={
                                  busyAgentId === agent.id ||
                                  !effectiveProviderId ||
                                  !effectiveModelCatalog
                                }
                                value={agent.modelId ?? ""}
                                onChange={(event) => {
                                  if (!effectiveProviderId) {
                                    return;
                                  }

                                  void handleUpdateAgentModel(
                                    agent,
                                    effectiveProviderId,
                                    event.target.value,
                                  );
                                }}
                              >
                                <option value="">Provider default</option>
                                {effectiveModelCatalog?.models.map((model) => (
                                  <option key={model.modelRef} value={model.modelId}>
                                    {model.label}
                                  </option>
                                ))}
                              </select>
                              {busyAgentId === agent.id ? (
                                <LoaderCircleIcon className="size-3.5 animate-spin text-muted-foreground" />
                              ) : null}
                            </div>
                          </label>

                          <div className="grid gap-1">
                            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                              Updated
                            </span>
                            <span className="text-[13px] text-muted-foreground">
                              {formatTimestamp(agent.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>

                  <div className="group/cta mt-4 flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-border/30 px-5 py-4 transition-all duration-150 hover:border-primary/25 hover:bg-primary/[0.03] dark:border-white/[0.04] dark:hover:border-primary/20"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setFeedback(null);
                      setErrorMessage(null);
                      setIsCreateOpen(true);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFeedback(null); setErrorMessage(null); setIsCreateOpen(true); } }}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 text-muted-foreground/40 transition-colors group-hover/cta:border-primary/30 group-hover/cta:text-primary">
                      <PlusIcon className="size-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-medium text-foreground/80 transition-colors group-hover/cta:text-foreground">
                        Add another agent
                      </p>
                      <p className="text-[11px] text-muted-foreground/50">
                        Each agent gets its own provider, model, and instructions.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            agents.map((agent) => {
              const effectiveProviderId = resolveAgentProviderId(agent, authOverview);
              const effectiveModelCatalog = effectiveProviderId
                ? modelCatalogs[effectiveProviderId]
                : undefined;

              return (
                <article
                  key={agent.id}
                  className={cn(
                    "grid gap-3 border-t border-border/40 px-4 py-3.5 transition-colors duration-100 hover:bg-muted/20 dark:border-white/[0.04] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.8fr)_auto] lg:items-center lg:px-5",
                  )}
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-[13px] font-medium text-foreground">
                        {agent.name}
                      </h3>
                      {agent.isDefault ? (
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Default
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[12px] leading-relaxed text-muted-foreground">
                      {agent.description ??
                        "Marketing strategy, growth, and content execution."}
                    </p>
                  </div>

                  <div className="grid gap-2.5 text-[12px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-1">
                    <div className="grid gap-1">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                        Provider
                      </span>
                      <span className="text-[12px] text-foreground">
                        {providerLabel(effectiveProviderId, connectedProviders)}
                      </span>
                    </div>

                    <label className="grid gap-1">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                        Model
                      </span>
                      <div className="flex items-center gap-1.5">
                        <select
                          className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-[12px] text-foreground outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={
                            busyAgentId === agent.id ||
                            !effectiveProviderId ||
                            !effectiveModelCatalog
                          }
                          value={agent.modelId ?? ""}
                          onChange={(event) => {
                            if (!effectiveProviderId) {
                              return;
                            }

                            void handleUpdateAgentModel(
                              agent,
                              effectiveProviderId,
                              event.target.value,
                            );
                          }}
                        >
                          <option value="">Provider default</option>
                          {effectiveModelCatalog?.models.map((model) => (
                            <option key={model.modelRef} value={model.modelId}>
                              {model.label}
                            </option>
                          ))}
                        </select>
                        {busyAgentId === agent.id ? (
                          <LoaderCircleIcon className="size-3.5 animate-spin text-muted-foreground" />
                        ) : null}
                      </div>
                    </label>
                  </div>

                  <div className="text-[11px] text-muted-foreground/60">
                    {formatTimestamp(agent.updatedAt)}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {!isLoading && agents.length > 1 ? (
          <div className="border-t border-dashed border-border/30 px-4 py-4 dark:border-white/[0.04] lg:px-5">
            <p className="text-[11px] leading-relaxed text-muted-foreground/60">
              Add another agent to expand your library. Connect to different
              providers or configure specialized models for each workflow.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function resolveAgentProviderId(
  agent: Agent,
  authOverview: AuthOverview | null,
): string | undefined {
  return agent.providerId ?? authOverview?.selectedProviderId;
}

function providerLabel(providerId: string | undefined, connectedProviders: ConnectedProviderOption[]): string {
  if (!providerId) {
    return "No provider connected";
  }

  const rawName =
    connectedProviders.find((provider) => provider.providerId === providerId)?.providerName ??
    providerId;

  return cleanProviderName(rawName);
}

async function updateAgentWithFallback(
  client: SidecarClient,
  agentId: string,
  payload: {
    modelId?: string;
    providerId?: string;
  },
): Promise<Agent> {
  if (typeof client.updateAgent === "function") {
    return client.updateAgent(agentId, payload);
  }

  const response = await fetch(client.createApiUrl(`/agents/${encodeURIComponent(agentId)}`), {
    body: JSON.stringify(payload),
    headers: (() => {
      const headers = client.createAuthHeaders();
      headers.set("Content-Type", "application/json");
      return headers;
    })(),
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(`Sidecar request failed with status ${String(response.status)}.`);
  }

  return response.json() as Promise<Agent>;
}
