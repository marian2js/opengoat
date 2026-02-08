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
import { ChevronDown, Trash2 } from "lucide-react";

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
    env?: Record<string, string>;
  }) => Promise<void> | void;
  onDelete: (input: {
    agentId: string;
    providerId?: string;
    deleteExternalAgent?: boolean;
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
  const [createExternal, setCreateExternal] = useState(true);
  const [showAdvancedProviderSettings, setShowAdvancedProviderSettings] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteProviderId, setDeleteProviderId] = useState("");
  const [deleteExternal, setDeleteExternal] = useState(false);

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
  const providerSettings = useMemo(
    () => partitionProviderSettingsFields(selectedProvider?.envFields ?? []),
    [selectedProvider?.envFields]
  );
  const supportsExternalAgentCreation = Boolean(selectedProvider?.supportsExternalAgentCreation);
  const hasAdvancedOptions = providerSettings.advanced.length > 0 || supportsExternalAgentCreation;

  const resetCreateForm = () => {
    setName("");
    setProviderId("");
    setCreateExternal(true);
    setShowAdvancedProviderSettings(false);
    setFormError(null);
  };

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

  useEffect(() => {
    setShowAdvancedProviderSettings(false);
    setCreateExternal(true);
  }, [normalizedProviderId]);

  useEffect(() => {
    if (!supportsExternalAgentCreation && createExternal) {
      setCreateExternal(false);
    }
  }, [supportsExternalAgentCreation, createExternal]);

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
      createExternalAgent: supportsExternalAgentCreation ? createExternal : undefined,
      env: trimmedProvider ? sanitizeProviderEnv(providerEnv) : undefined
    });
    resetCreateForm();
    setCreateOpen(false);
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
              className="h-8 gap-2 rounded-lg border border-[#2E2F31] bg-[#202124] px-3 text-foreground/95 hover:bg-[#2A2B2F]"
              onClick={() => setCreateOpen(true)}
              disabled={props.busy || props.loading}
            >
              Create agent
            </Button>
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            resetCreateForm();
          }
        }}
      >
        <DialogContent className="max-w-3xl border border-[var(--border)]/80 bg-[color-mix(in_oklab,var(--surface)_92%,black)]">
          <DialogHeader>
            <DialogTitle>Create agent</DialogTitle>
            <DialogDescription>
              Create a new agent workspace with an external provider binding.
            </DialogDescription>
          </DialogHeader>

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

            {selectedProvider && !props.providerConfigAvailable ? (
              <div className="rounded-lg border border-[#2E2F31] bg-[#101113] px-3 py-3 text-sm text-muted-foreground">
                Provider settings require a newer desktop runtime.
              </div>
            ) : null}
            {props.providerConfigAvailable && selectedProvider ? (
              <div className="rounded-lg border border-[#2E2F31] bg-[#101113] px-3 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">{selectedProvider.displayName}</Badge>
                  <span className="text-muted-foreground">Provider settings</span>
                </div>
                {providerSettings.primary.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {providerSettings.primary.map((field) => (
                      <ProviderEnvFieldInput
                        key={field.key}
                        field={field}
                        value={providerEnv[field.key] ?? ""}
                        disabled={props.busy}
                        onChange={handleProviderFieldChange}
                      />
                    ))}
                  </div>
                ) : null}
                {hasAdvancedOptions ? (
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setShowAdvancedProviderSettings((current) => !current)}
                      disabled={props.busy}
                    >
                      {showAdvancedProviderSettings
                        ? "Hide advanced settings"
                        : "Advanced settings"}
                      <ChevronDown
                        className={cn(
                          "ml-1.5 size-3.5 transition-transform",
                          showAdvancedProviderSettings ? "rotate-180" : ""
                        )}
                      />
                    </Button>
                    {showAdvancedProviderSettings ? (
                      <div className="mt-2 space-y-3">
                        {supportsExternalAgentCreation ? (
                          <label className="flex items-center gap-2 rounded-lg border border-[#2E2F31] bg-[#0E1117] px-3 py-2 text-sm">
                            <input
                              type="checkbox"
                              className="size-4"
                              checked={createExternal}
                              onChange={(event) => setCreateExternal(event.currentTarget.checked)}
                              disabled={props.busy}
                            />
                            <span>Create agent if not exists</span>
                          </label>
                        ) : null}
                        {providerSettings.advanced.map((field) => (
                          <ProviderEnvFieldInput
                            key={field.key}
                            field={field}
                            value={providerEnv[field.key] ?? ""}
                            disabled={props.busy}
                            onChange={handleProviderFieldChange}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {formError ? (
              <p className="text-xs text-red-200">{formError}</p>
            ) : null}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
                disabled={props.busy}
              >
                Cancel
              </Button>
              <Button type="submit" variant="outline" disabled={props.busy}>
                Create agent
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

function sanitizeProviderEnv(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value.length > 0)
  );
}

function ProviderEnvFieldInput(props: {
  field: {
    key: string;
    description: string;
    required?: boolean;
    secret?: boolean;
  };
  value: string;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
}) {
  const label = resolveProviderFieldLabel(props.field.key);
  const helperText = resolveProviderFieldHelperText(props.field);
  const placeholder = resolveProviderFieldPlaceholder(props.field);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground">{label}</p>
      {helperText ? (
        <p className="text-[11px] text-muted-foreground">{helperText}</p>
      ) : null}
      <Input
        type={props.field.secret ? "password" : "text"}
        value={props.value}
        onChange={(event) => props.onChange(props.field.key, event.target.value)}
        placeholder={placeholder}
        disabled={props.disabled}
      />
    </div>
  );
}

function partitionProviderSettingsFields(
  fields: Array<{
    key: string;
    description: string;
    required?: boolean;
    secret?: boolean;
  }>
): {
  primary: Array<{
    key: string;
    description: string;
    required?: boolean;
    secret?: boolean;
  }>;
  advanced: Array<{
    key: string;
    description: string;
    required?: boolean;
    secret?: boolean;
  }>;
} {
  const primary: typeof fields = [];
  const advanced: typeof fields = [];

  for (const field of fields) {
    if (field.required || isModelFieldKey(field.key)) {
      primary.push(field);
      continue;
    }
    advanced.push(field);
  }

  primary.sort((left, right) => {
    const leftModel = isModelFieldKey(left.key);
    const rightModel = isModelFieldKey(right.key);
    if (leftModel && !rightModel) {
      return -1;
    }
    if (!leftModel && rightModel) {
      return 1;
    }
    return left.key.localeCompare(right.key);
  });

  return {
    primary,
    advanced,
  };
}

function isModelFieldKey(key: string): boolean {
  return key.trim().toUpperCase().includes("MODEL");
}

function resolveProviderFieldLabel(key: string): string {
  if (isModelFieldKey(key)) {
    return "Model";
  }
  return toHumanLabel(key);
}

function resolveProviderFieldHelperText(field: {
  key: string;
  description: string;
  required?: boolean;
}): string | null {
  if (isModelFieldKey(field.key)) {
    return "Model to use for this provider.";
  }

  const normalizedLabel = toHumanLabel(field.key).trim().toLowerCase();
  const normalizedDescription = field.description.trim().toLowerCase();
  if (!field.description.trim() || normalizedLabel === normalizedDescription) {
    return field.required ? "Required" : null;
  }

  if (field.required && !normalizedDescription.startsWith("required")) {
    return `Required. ${field.description}`;
  }

  return field.description;
}

function resolveProviderFieldPlaceholder(field: {
  key: string;
  secret?: boolean;
}): string {
  const normalizedKey = field.key.trim().toUpperCase();
  if (isModelFieldKey(field.key)) {
    return "e.g. gpt-4.1-mini";
  }
  if (normalizedKey.includes("URL") || normalizedKey.includes("ENDPOINT")) {
    return "https://...";
  }
  if (field.secret) {
    return "Enter secret";
  }
  return "Enter value";
}

function toHumanLabel(key: string): string {
  const replacements: Record<string, string> = {
    api: "API",
    url: "URL",
    id: "ID",
    oauth: "OAuth",
    http: "HTTP",
    https: "HTTPS",
    aws: "AWS",
    gcp: "GCP",
    azure: "Azure",
    openai: "OpenAI",
    openrouter: "OpenRouter",
    qwen: "Qwen",
  };

  return key
    .split("_")
    .filter(Boolean)
    .map((part) => {
      const normalized = part.toLowerCase();
      const replacement = replacements[normalized];
      if (replacement) {
        return replacement;
      }
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(" ");
}
