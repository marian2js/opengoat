import type { Agent, AuthOverview, ProviderModelOption } from "@opengoat/contracts";
import {
  CheckIcon,
  GlobeIcon,
  LoaderCircleIcon,
  TrashIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SidecarClient } from "@/lib/sidecar/client";
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
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync form when agent changes (e.g. switching projects)
  useEffect(() => {
    setName(agent.name);
    setSaveMessage(null);
  }, [agent.id, agent.name]);

  const hasGeneralChanges = name !== agent.name;

  const handleSaveGeneral = useCallback(async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const updated = await client.updateAgent(agent.id, { name });
      onAgentUpdated(updated);
      setSaveMessage({ type: "success", text: "Settings saved." });
    } catch (err) {
      console.error("Failed to save settings", err);
      setSaveMessage({ type: "error", text: "Failed to save. Please try again." });
    } finally {
      setIsSaving(false);
    }
  }, [agent.id, client, name, onAgentUpdated]);

  // ---- Model state ----
  const selectedProviderId = agent.providerId ?? authOverview?.selectedProviderId;
  const selectedModelId = agent.modelId ?? authOverview?.selectedModelId;
  const [models, setModels] = useState<ProviderModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Build provider list: connected provider IDs with display names from the providers catalog
  const providerNameMap = new Map(
    (authOverview?.providers ?? []).map((p) => [p.id, p.name]),
  );
  const connectedProviderIds = authOverview?.connections
    ? [...new Set(authOverview.connections.map((c) => c.providerId))]
    : [];
  const connectedProviders = connectedProviderIds.map((pid) => ({
    providerId: pid,
    displayName: providerNameMap.get(pid) ?? pid,
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
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Project settings</h1>
        <p className="text-sm text-muted-foreground">{domain}</p>
      </div>

      {/* ---- Model ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">Model</CardTitle>
          <CardDescription>Choose the AI provider and model for this project.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="settings-provider" className="block text-[12px] font-medium text-muted-foreground">
              Provider
            </label>
            <select
              id="settings-provider"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={selectedProviderId ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "__add__") {
                  // Reset select to current value so it doesn't show "+ Connect"
                  e.target.value = selectedProviderId ?? "";
                  onAddConnection();
                } else if (value) {
                  void handleProviderChange(value);
                }
              }}
            >
              <option value="" disabled>
                Select provider
              </option>
              {connectedProviders.map((p) => (
                <option key={p.providerId} value={p.providerId}>
                  {p.displayName}
                </option>
              ))}
              <option value="__add__">+ Connect new provider</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="settings-model" className="block text-[12px] font-medium text-muted-foreground">
              Model
            </label>
            {isLoadingModels ? (
              <div className="flex h-9 items-center gap-2 text-[13px] text-muted-foreground">
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                Loading models...
              </div>
            ) : (
              <select
                id="settings-model"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={selectedModelId ?? ""}
                onChange={(e) => {
                  const model = models.find((m) => m.modelId === e.target.value);
                  if (model) {
                    void handleModelSelect(model.modelRef);
                  }
                }}
              >
                {models.length === 0 ? (
                  <option value="" disabled>
                    {selectedProviderId ? "No models available" : "Select a provider first"}
                  </option>
                ) : null}
                {models.map((model) => (
                  <option key={model.modelId} value={model.modelId}>
                    {model.label}
                    {model.reasoning ? " (reasoning)" : ""}
                    {model.contextWindow ? ` · ${Math.round(model.contextWindow / 1000)}k ctx` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---- General ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">General</CardTitle>
          <CardDescription>Basic project information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-muted-foreground" htmlFor="settings-name">
                Name
              </label>
              <Input
                id="settings-name"
                className="h-9 text-[13px]"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (saveMessage) setSaveMessage(null);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settings-website-url" className="block text-[12px] font-medium text-muted-foreground">
                Website URL
              </label>
              <div className="relative">
                <GlobeIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
                <Input
                  id="settings-website-url"
                  className="h-9 pl-9 text-[13px] text-muted-foreground"
                  readOnly
                  value={agent.description ?? domain}
                />
              </div>
            </div>
          </div>

          {saveMessage ? (
            <p
              className={`text-[12px] ${
                saveMessage.type === "success" ? "text-success" : "text-destructive"
              }`}
            >
              {saveMessage.type === "success" ? (
                <CheckIcon className="mr-1 inline-block size-3 align-[-2px]" />
              ) : null}
              {saveMessage.text}
            </p>
          ) : null}

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
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-[15px] text-destructive">Danger zone</CardTitle>
          <CardDescription>Irreversible actions for this project.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
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
