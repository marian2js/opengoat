import type { Agent, AuthOverview, ProviderModelOption } from "@opengoat/contracts";
import {
  CpuIcon,
  GlobeIcon,
  LoaderCircleIcon,
  Settings2Icon,
  TrashIcon,
  UserIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cleanProviderName } from "@/features/agents/display-helpers";
import type { SidecarClient } from "@/lib/sidecar/client";
import { toast } from "sonner";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { SkillsSection } from "./SkillsSection";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProjectSettingsProps {
  agent: Agent;
  authOverview: AuthOverview | null;
  client: SidecarClient;
  onAddConnection: () => void;
  onAgentUpdated: (agent: Agent) => void;
  onProjectDeleted: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveDomain(agent: Agent): string {
  const rawUrl = agent.description?.trim();
  if (rawUrl) {
    try {
      const url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
      return url.hostname.replace(/^www\./, "");
    } catch {
      return rawUrl;
    }
  }
  const projectId = agent.id.replace(/-main$/, "");
  return projectId !== agent.id ? `${projectId}.com` : agent.name;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectSettings({
  agent,
  authOverview,
  client,
  onAddConnection,
  onAgentUpdated,
  onProjectDeleted,
}: ProjectSettingsProps) {
  const domain = resolveDomain(agent);

  // ---- General form state ----
  const [name, setName] = useState(agent.name);
  const [isSaving, setIsSaving] = useState(false);

  // Sync form when agent changes (e.g. switching projects)
  useEffect(() => {
    setName(agent.name);
  }, [agent.id, agent.name]);

  const hasGeneralChanges = name !== agent.name;

  const handleSaveGeneral = useCallback(async () => {
    setIsSaving(true);

    try {
      const updated = await client.updateAgent(agent.id, { name });
      onAgentUpdated(updated);
      toast.success("Settings saved.");
    } catch (err) {
      console.error("Failed to save settings", err);
      toast.error("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [agent.id, client, name, onAgentUpdated]);

  // ---- Model state ----
  const selectedProviderId = agent.providerId ?? authOverview?.selectedProviderId;
  const selectedModelId = agent.modelId ?? authOverview?.selectedModelId;
  const [models, setModels] = useState<ProviderModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Build provider list: connected provider IDs with human-readable display names
  const connectionNameMap = new Map(
    (authOverview?.connections ?? []).map((c) => [c.providerId, c.providerName]),
  );
  const providerNameMap = new Map(
    (authOverview?.providers ?? []).map((p) => [p.id, p.name]),
  );
  const connectedProviderIds = authOverview?.connections
    ? [...new Set(authOverview.connections.map((c) => c.providerId))]
    : [];
  const connectedProviders = connectedProviderIds.map((pid) => ({
    providerId: pid,
    displayName: cleanProviderName(connectionNameMap.get(pid) ?? providerNameMap.get(pid) ?? pid),
  }));

  // Load model catalog when provider changes
  useEffect(() => {
    if (!selectedProviderId) {
      setModels([]);
      return;
    }

    let cancelled = false;
    setIsLoadingModels(true);

    void client.providerModels(selectedProviderId).then(
      (catalog) => {
        if (!cancelled) {
          setModels(catalog.models);
          setIsLoadingModels(false);
        }
      },
      () => {
        if (!cancelled) {
          setModels([]);
          setIsLoadingModels(false);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [client, selectedProviderId]);

  const handleProviderChange = useCallback(
    async (providerId: string) => {
      try {
        // When switching providers, reset model to "auto"
        const updated = await client.updateAgent(agent.id, { providerId, modelId: "auto" });
        onAgentUpdated(updated);
      } catch (err) {
        console.error("Failed to update provider", err);
        toast.error("Failed to update provider. Please try again.");
      }
    },
    [agent.id, client, onAgentUpdated],
  );

  const handleModelSelect = useCallback(
    async (modelRef: string) => {
      if (!selectedProviderId) return;
      try {
        // Use the global setProviderModel to update the model selection
        await client.setProviderModel(selectedProviderId, modelRef);
        const updated = await client.updateAgent(agent.id, {
          modelId: modelRef.split("/").pop() ?? modelRef,
        });
        onAgentUpdated(updated);
      } catch (err) {
        console.error("Failed to update model", err);
        toast.error("Failed to update model. Please try again.");
      }
    },
    [agent.id, client, onAgentUpdated, selectedProviderId],
  );

  // ---- Delete state ----
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = useCallback(async () => {
    await client.deleteAgent(agent.id);
    onProjectDeleted();
  }, [agent.id, client, onProjectDeleted]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 shadow-sm ring-1 ring-primary/15">
          <Settings2Icon className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-[-0.01em] text-foreground">
            Project Settings
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {domain}
          </p>
        </div>
      </div>

      {/* ---- Model ---- */}
      <Card className="relative overflow-hidden rounded-xl border-primary/15 bg-primary/[0.015] shadow-sm shadow-black/[0.02] transition-all duration-150 hover:border-primary/25 hover:shadow-md dark:border-primary/[0.08] dark:bg-primary/[0.01] dark:shadow-black/10 dark:hover:border-primary/[0.15]">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/12 ring-1 ring-primary/10">
              <CpuIcon className="size-3.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-[14px] font-semibold">Model</CardTitle>
              <CardDescription className="text-[12px]">Choose the AI provider and model for this project.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="settings-provider" className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Provider
            </label>
            <Select
              value={selectedProviderId ?? ""}
              onValueChange={(value) => {
                if (value === "__add__") {
                  onAddConnection();
                } else if (value) {
                  void handleProviderChange(value);
                }
              }}
            >
              <SelectTrigger className="h-9 w-full text-[13px]">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {connectedProviders.map((p) => (
                  <SelectItem key={p.providerId} value={p.providerId} className="text-[13px]">
                    {p.displayName}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value="__add__" className="text-[13px] text-primary">
                  + Connect new provider
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="settings-model" className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Model
            </label>
            {isLoadingModels ? (
              <div className="flex h-9 items-center gap-2 text-[13px] text-muted-foreground">
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                Loading models...
              </div>
            ) : (
              <Select
                value={selectedModelId ?? ""}
                onValueChange={(value) => {
                  const model = models.find((m) => m.modelId === value);
                  if (model) {
                    void handleModelSelect(model.modelRef);
                  }
                }}
              >
                <SelectTrigger className="h-9 w-full text-[13px]">
                  <SelectValue
                    placeholder={
                      selectedProviderId ? "No models available" : "Select a provider first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.modelId} value={model.modelId} className="text-[13px]">
                      {model.label}
                      {model.reasoning ? " (reasoning)" : ""}
                      {model.contextWindow
                        ? ` \u00B7 ${Math.round(model.contextWindow / 1000)}k ctx`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---- General ---- */}
      <Card className="overflow-hidden rounded-xl border-border/40 shadow-sm shadow-black/[0.02] transition-all duration-150 hover:border-border/60 hover:shadow-md dark:border-white/[0.06] dark:shadow-black/10 dark:hover:border-white/[0.10]">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/8">
              <UserIcon className="size-3.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-[14px] font-semibold">General</CardTitle>
              <CardDescription className="text-[12px]">Basic project information.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60" htmlFor="settings-name">
                Name
              </label>
              <Input
                id="settings-name"
                className="h-9 text-[13px]"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settings-website-url" className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Website URL
              </label>
              <div className="relative">
                <GlobeIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
                <Input
                  id="settings-website-url"
                  className="h-9 cursor-default pl-9 text-[13px] text-muted-foreground bg-muted/30 dark:bg-white/[0.02] border-border/30 dark:border-white/[0.04]"
                  readOnly
                  tabIndex={-1}
                  value={agent.description ?? domain}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-8 text-[13px]"
              disabled={!hasGeneralChanges || isSaving}
              onClick={() => void handleSaveGeneral()}
            >
              {isSaving ? (
                <>
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---- Skills ---- */}
      <SkillsSection agent={agent} client={client} />

      {/* ---- Danger zone ---- */}
      <Card className="overflow-hidden rounded-xl border-destructive/15 bg-destructive/[0.02] shadow-sm shadow-black/[0.02] dark:border-destructive/10 dark:bg-destructive/[0.015] dark:shadow-black/10">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-destructive/10 ring-1 ring-destructive/10">
              <TrashIcon className="size-3.5 text-destructive/80" />
            </div>
            <div>
              <CardTitle className="text-[14px] font-semibold text-destructive">Danger zone</CardTitle>
              <CardDescription className="text-[12px]">Irreversible actions for this project.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4 rounded-md border border-destructive/10 bg-destructive/[0.03] px-3.5 py-3 dark:border-destructive/[0.06] dark:bg-destructive/[0.02]">
            <div className="space-y-1">
              <p className="text-[13px] font-medium text-foreground">Delete this project</p>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Permanently removes the agent, all chat sessions, and workspace files
                (PRODUCT.md, MARKET.md, GROWTH.md).
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 shrink-0 text-[13px]"
              onClick={() => setShowDeleteDialog(true)}
            >
              <TrashIcon className="size-3.5" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeleteProjectDialog
        domain={domain}
        open={showDeleteDialog}
        onConfirm={handleDelete}
        onOpenChange={setShowDeleteDialog}
      />
    </div>
  );
}
