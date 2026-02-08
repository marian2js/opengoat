import { useEffect, useMemo, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Badge } from "@renderer/components/ai-elements/badge";
import { Spinner } from "@renderer/components/ai-elements/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@renderer/components/ai-elements/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@renderer/components/ai-elements/select";
import type { WorkbenchAgent, WorkbenchAgentProvider } from "@shared/workbench";
import { cn } from "@renderer/lib/utils";
import { Trash2 } from "lucide-react";

interface AgentsPanelProps {
  agents: WorkbenchAgent[];
  providers: WorkbenchAgentProvider[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  onRefresh: () => void;
  onCreate: (input: {
    name: string;
    providerId?: string;
    createExternalAgent?: boolean;
  }) => Promise<void> | void;
  onDelete: (input: {
    agentId: string;
    providerId?: string;
    deleteExternalAgent?: boolean;
  }) => Promise<void> | void;
  onSaveProviderConfig: (input: {
    providerId: string;
    env: Record<string, string>;
  }) => Promise<void> | void;
  providerConfigAvailable: boolean;
  onDismissNotice: () => void;
  onDismissError: () => void;
}

interface DeleteTarget {
  agentId: string;
  displayName: string;
}

export function AgentsPanel(props: AgentsPanelProps) {
  const [name, setName] = useState("");
  const [providerId, setProviderId] = useState("");
  const [providerEnvDrafts, setProviderEnvDrafts] = useState<Record<string, Record<string, string>>>({});
  const [createExternal, setCreateExternal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteProviderId, setDeleteProviderId] = useState("");
  const [deleteExternal, setDeleteExternal] = useState(false);
  const [providerSelectOpen, setProviderSelectOpen] = useState(false);
  const [deleteSelectOpen, setDeleteSelectOpen] = useState(false);

  const providerOptions = useMemo(
    () => props.providers.map((provider) => ({
      id: provider.id,
      label: provider.displayName
    })),
    [props.providers]
  );
  const normalizedProviderId = providerId.trim().toLowerCase();
  const selectedProvider =
    props.providers.find((provider) => provider.id === normalizedProviderId) ?? null;
  const providerEnv =
    (normalizedProviderId && providerEnvDrafts[normalizedProviderId]) ??
    selectedProvider?.configuredEnvValues ??
    {};

  useEffect(() => {
    if (!deleteTarget) {
      setDeleteProviderId("");
      setDeleteExternal(false);
    }
  }, [deleteTarget]);

  useEffect(() => {
    if (!normalizedProviderId) {
      return;
    }
    if (providerEnvDrafts[normalizedProviderId]) {
      return;
    }
    if (selectedProvider) {
      setProviderEnvDrafts((drafts) => ({
        ...drafts,
        [normalizedProviderId]: { ...selectedProvider.configuredEnvValues }
      }));
    }
  }, [normalizedProviderId, providerEnvDrafts, selectedProvider]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedProvider = providerId.trim();

    if (!trimmedName) {
      setFormError("Agent name is required.");
      return;
    }
    if (createExternal && !trimmedProvider) {
      setFormError("External agent creation requires an agent provider.");
      return;
    }

    setFormError(null);
    await props.onCreate({
      name: trimmedName,
      providerId: trimmedProvider || undefined,
      createExternalAgent: createExternal
    });
    setName("");
    setProviderId("");
    setCreateExternal(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    await props.onDelete({
      agentId: deleteTarget.agentId,
      providerId: deleteProviderId.trim() || undefined,
      deleteExternalAgent: deleteExternal
    });
    setDeleteTarget(null);
  };

  const handleProviderFieldChange = (key: string, value: string) => {
    if (!normalizedProviderId) {
      return;
    }
    setProviderEnvDrafts((drafts) => ({
      ...drafts,
      [normalizedProviderId]: {
        ...(drafts[normalizedProviderId] ?? {}),
        [key]: value
      }
    }));
  };

  const handleSaveProviderConfig = async () => {
    if (!normalizedProviderId) {
      setFormError("Select an agent provider to configure settings.");
      return;
    }

    setFormError(null);
    await props.onSaveProviderConfig({
      providerId: normalizedProviderId,
      env: providerEnv
    });
  };

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-col bg-transparent">
      <header className="titlebar-drag-region sticky top-0 z-30 border-0 bg-[#1F1F1F] px-4 shadow-[0_10px_24px_rgba(0,0,0,0.42)] md:px-5">
        <div className="flex h-12 items-center justify-between gap-3">
          <div className="min-w-0 truncate text-base leading-none tracking-tight">
            <span className="truncate font-heading font-semibold text-foreground">
              Agents
            </span>
            <span className="ml-2 text-sm font-medium text-muted-foreground">
              {props.agents.length} installed
            </span>
          </div>
          <div className="titlebar-no-drag flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 rounded-lg border border-[#2E2F31] bg-[#161617] px-3 text-foreground/95 hover:bg-[#1D1D1F]"
              onClick={props.onRefresh}
              disabled={props.busy || props.loading}
            >
              {props.loading ? <Spinner className="size-3.5" /> : null}
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
        <div className="mx-auto w-full max-w-4xl space-y-6 pb-6">
          {props.notice ? (
            <div className="flex items-center justify-between rounded-lg border border-[#2E2F31] bg-[#141416] px-3 py-2 text-sm text-foreground/90">
              <span>{props.notice}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={props.onDismissNotice}
              >
                Dismiss
              </Button>
            </div>
          ) : null}

          {props.error ? (
            <div className="flex items-center justify-between rounded-lg border border-destructive/35 bg-destructive/12 px-3 py-2 text-sm text-red-200">
              <span>{props.error}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-red-200"
                onClick={props.onDismissError}
              >
                Dismiss
              </Button>
            </div>
          ) : null}

          <section className="rounded-xl border border-[#2E2F31] bg-[#141416] px-4 py-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Create agent</h2>
                <p className="text-xs text-muted-foreground">
                  Create a new agent workspace with an external provider binding.
                </p>
              </div>
            </div>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">Agent name</p>
                  <Input
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (formError) {
                        setFormError(null);
                      }
                    }}
                    placeholder="Writer"
                    disabled={props.busy}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">Agent Provider</p>
                  <Select
                    value={normalizedProviderId || undefined}
                    onValueChange={(value) => {
                      setProviderId(value);
                      if (formError) {
                        setFormError(null);
                      }
                    }}
                    open={providerSelectOpen}
                    onOpenChange={setProviderSelectOpen}
                    disabled={props.busy}
                  >
                    <SelectTrigger
                      className="h-11 w-full rounded-xl border border-[#2E2F31] bg-[#0E1117] text-foreground hover:bg-[#151922]"
                    >
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent
                      align="start"
                      className="border-[#2E2F31] bg-[#0E1117]"
                    >
                      {providerOptions.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <label className="flex items-center gap-2 rounded-lg border border-[#2E2F31] bg-[#101113] px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={createExternal}
                  onChange={(event) => setCreateExternal(event.currentTarget.checked)}
                  disabled={props.busy}
                />
                <span>Create external agent</span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  Requires agent provider
                </span>
              </label>

              {formError ? (
                <p className="text-xs text-red-200">{formError}</p>
              ) : null}

              <div className="flex justify-end">
                <Button type="submit" variant="outline" disabled={props.busy}>
                  Create agent
                </Button>
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-[#2E2F31] bg-[#141416] px-4 py-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Agent Provider setup</h2>
                <p className="text-xs text-muted-foreground">
                  Configure external provider settings (OpenClaw, Cursor, Claude Code, Codex, Gemini CLI, OpenCode).
                </p>
              </div>
            </div>
            {!props.providerConfigAvailable ? (
              <div className="rounded-lg border border-[#2E2F31] bg-[#101113] px-3 py-3 text-sm text-muted-foreground">
                Agent provider setup requires a newer desktop runtime.
              </div>
            ) : !selectedProvider ? (
              <div className="rounded-lg border border-[#2E2F31] bg-[#101113] px-3 py-3 text-sm text-muted-foreground">
                Select an external agent provider to configure its settings.
              </div>
            ) : selectedProvider.envFields.length === 0 ? (
              <div className="rounded-lg border border-[#2E2F31] bg-[#101113] px-3 py-3 text-sm text-muted-foreground">
                {selectedProvider.displayName} does not expose additional settings.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{selectedProvider.displayName}</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedProvider.envFields.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <p className="text-xs font-medium text-foreground">{field.key}</p>
                      <p className="text-[11px] text-muted-foreground">{field.description}</p>
                      <Input
                        type={field.secret ? "password" : "text"}
                        value={providerEnv[field.key] ?? ""}
                        onChange={(event) => handleProviderFieldChange(field.key, event.target.value)}
                        placeholder={field.secret ? "Enter secret" : "Enter value"}
                        disabled={props.busy}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleSaveProviderConfig()}
                    disabled={props.busy}
                  >
                    Save provider settings
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Installed agents</h2>
              {props.loading ? (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner className="size-3.5" /> Loading
                </span>
              ) : null}
            </div>
            {props.agents.length === 0 ? (
              <div className="rounded-xl border border-[#2E2F31] bg-[#141416] px-4 py-6 text-sm text-muted-foreground">
                No agents found. Create one to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {props.agents.map((agent) => {
                  const isOrchestrator = agent.id === "orchestrator";
                  return (
                    <div
                      key={agent.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#2E2F31] bg-[#141416] px-4 py-3"
                    >
                      <div className="min-w-[220px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {agent.displayName}
                          </p>
                          {isOrchestrator ? (
                            <Badge variant="secondary">Default</Badge>
                          ) : null}
                          {agent.providerId ? (
                            <Badge variant="outline">{agent.providerId}</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">{agent.id}</p>
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          <div className="truncate">Workspace: {agent.workspaceDir}</div>
                          <div className="truncate">Config: {agent.internalConfigDir}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-8 gap-2",
                            isOrchestrator
                              ? "text-muted-foreground"
                              : "text-red-200 hover:text-red-100"
                          )}
                          onClick={() =>
                            setDeleteTarget({
                              agentId: agent.id,
                              displayName: agent.displayName
                            })
                          }
                          disabled={props.busy || isOrchestrator}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </section>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-lg border border-[var(--border)]/80 bg-[color-mix(in_oklab,var(--surface)_92%,black)]">
          <DialogHeader>
            <DialogTitle>Delete agent</DialogTitle>
            <DialogDescription>
              Remove an agent and optionally delete its external provider entry.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-[#2E2F31] bg-[#141416] px-3 py-2 text-sm">
              <p className="text-foreground">
                Delete <span className="font-semibold">{deleteTarget?.displayName}</span>?
              </p>
              <p className="text-xs text-muted-foreground">Agent id: {deleteTarget?.agentId}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Agent Provider</p>
                  <Select
                value={deleteProviderId || undefined}
                onValueChange={setDeleteProviderId}
                open={deleteSelectOpen}
                onOpenChange={setDeleteSelectOpen}
                disabled={props.busy}
              >
                <SelectTrigger className="h-10 w-full rounded-lg border border-[#2E2F31] bg-[#0E1117] text-foreground hover:bg-[#151922]">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent align="start" className="border-[#2E2F31] bg-[#0E1117]">
                  {providerOptions.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-[#2E2F31] bg-[#101113] px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={deleteExternal}
                onChange={(event) => setDeleteExternal(event.currentTarget.checked)}
                disabled={props.busy}
              />
              <span>Delete external agent</span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={props.busy}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="border-red-500/40 text-red-200 hover:text-red-100"
              onClick={() => void handleDelete()}
              disabled={props.busy}
            >
              Delete agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
