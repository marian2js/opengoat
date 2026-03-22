import { useEffect, useMemo, useState } from "react";
import { CheckIcon, LoaderCircleIcon, PlusIcon, RefreshCcwIcon, Trash2Icon } from "lucide-react";
import type { AuthOverview, ProviderModelCatalog, SavedConnection } from "@/app/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { SidecarClient } from "@/lib/sidecar/client";
import { cleanProviderName } from "@/features/agents/display-helpers";

interface ConnectionsWorkspaceProps {
  authOverview: AuthOverview | null;
  client: SidecarClient | null;
  onAddConnection?: () => void;
  onAuthOverviewChange: (nextOverview: AuthOverview) => void;
}

export function ConnectionsWorkspace({
  authOverview,
  client,
  onAddConnection,
  onAuthOverviewChange,
}: ConnectionsWorkspaceProps) {
  const storedConnections = useMemo(
    () => authOverview?.connections ?? [],
    [authOverview],
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [modelCatalogs, setModelCatalogs] = useState<Record<string, ProviderModelCatalog>>({});
  const [modelBusyProviderId, setModelBusyProviderId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refreshOverview(): Promise<void> {
    if (!client) {
      return;
    }

    setIsRefreshing(true);
    try {
      const nextOverview = await client.authOverview();
      onAuthOverviewChange(nextOverview);
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!client || storedConnections.length === 0) {
      setModelCatalogs({});
      return;
    }

    let cancelled = false;
    const runtimeClient = client;

    async function loadModelCatalogs(): Promise<void> {
      const uniqueProviderIds = [...new Set(storedConnections.map((connection) => connection.providerId))];
      const entries = await Promise.all(
        uniqueProviderIds.map(async (providerId) => [
          providerId,
          await runtimeClient.providerModels(providerId),
        ] as const),
      );
      if (cancelled) {
        return;
      }
      setModelCatalogs(Object.fromEntries(entries));
    }

    void loadModelCatalogs().catch((error: unknown) => {
      if (!cancelled) {
        setErrorMessage(getErrorMessage(error));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [client, storedConnections]);

  async function handleSelectDefault(profileId: string): Promise<void> {
    if (!client) {
      return;
    }

    setErrorMessage(null);
    setFeedback(null);
    setIsBusy(true);

    try {
      await client.selectConnection(profileId);
      await refreshOverview();
      setFeedback("Default connection updated.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(profileId: string): Promise<void> {
    if (!client) {
      return;
    }

    setErrorMessage(null);
    setFeedback(null);
    setIsBusy(true);

    try {
      await client.deleteAuthProfile(profileId);
      await refreshOverview();
      setFeedback("Connection removed.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSetModel(providerId: string, modelRef: string): Promise<void> {
    if (!client) {
      return;
    }

    setErrorMessage(null);
    setFeedback(null);
    setModelBusyProviderId(providerId);

    try {
      const nextOverview = await client.setProviderModel(providerId, modelRef);
      onAuthOverviewChange(nextOverview);
      const nextCatalog = await client.providerModels(providerId);
      setModelCatalogs((current) => ({
        ...current,
        [providerId]: nextCatalog,
      }));
      setFeedback("Model updated.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setModelBusyProviderId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4">
      {errorMessage ? (
        <MessageBanner tone="error">{errorMessage}</MessageBanner>
      ) : null}

      {feedback ? (
        <MessageBanner tone="success">{feedback}</MessageBanner>
      ) : null}

      <section className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-semibold text-foreground">
              Current connections
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Manage default connections, models, and credentials.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {onAddConnection ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-md text-[11px]"
                onClick={onAddConnection}
              >
                <PlusIcon className="size-3" />
                Add connection
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-md text-[11px] text-muted-foreground"
              disabled={!client || isBusy || isRefreshing || Boolean(modelBusyProviderId)}
              onClick={() => {
                void refreshOverview();
              }}
            >
              <RefreshCcwIcon className={cn("size-3", isRefreshing && "animate-spin")} />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {storedConnections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-card px-5 py-8 text-center text-[13px] text-muted-foreground">
            No saved connections yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
                    Provider
                  </TableHead>
                  <TableHead className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
                    Connection
                  </TableHead>
                  <TableHead className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
                    Model
                  </TableHead>
                  <TableHead className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
                    Updated
                  </TableHead>
                  <TableHead className="text-right text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storedConnections.map((connection) => (
                  <ConnectionRow
                    key={connection.profileId}
                    connection={connection}
                    isBusy={isBusy}
                    isUpdatingModel={modelBusyProviderId === connection.providerId}
                    modelCatalog={modelCatalogs[connection.providerId]}
                    onDelete={handleDelete}
                    onSelectDefault={handleSelectDefault}
                    onSetModel={handleSetModel}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {storedConnections.length > 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-border/40 bg-muted/10 px-4 py-3.5">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Add more connections to access different AI providers and models.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ConnectionRow({
  connection,
  isBusy,
  isUpdatingModel,
  modelCatalog,
  onDelete,
  onSelectDefault,
  onSetModel,
}: {
  connection: SavedConnection;
  isBusy: boolean;
  isUpdatingModel: boolean;
  modelCatalog: ProviderModelCatalog | undefined;
  onDelete: (profileId: string) => Promise<void>;
  onSelectDefault: (profileId: string) => Promise<void>;
  onSetModel: (providerId: string, modelRef: string) => Promise<void>;
}) {
  const selectedModelRef =
    modelCatalog?.currentModelRef ??
    modelCatalog?.models[0]?.modelRef ??
    (connection.activeModelId ? `${connection.providerId}/${connection.activeModelId}` : "");

  return (
    <TableRow className="border-border/60 transition-colors hover:bg-muted/20">
      <TableCell className="text-[12px] font-medium">{cleanProviderName(connection.providerName)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px]">{connection.label}</span>
          {connection.isDefault ? (
            <Badge
              variant="secondary"
              className="rounded-md bg-primary/10 px-1.5 text-[9px] font-medium text-primary"
            >
              Default
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex min-w-[14rem] items-center gap-1.5">
          <select
            className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-[12px] text-foreground outline-none transition-colors focus:border-primary"
            disabled={isUpdatingModel || !modelCatalog || modelCatalog.models.length === 0}
            value={selectedModelRef}
            onChange={(event) => {
              void onSetModel(connection.providerId, event.target.value);
            }}
          >
            {modelCatalog?.models.map((model) => (
              <option key={model.modelRef} value={model.modelRef}>
                {model.label}
              </option>
            ))}
          </select>
          {isUpdatingModel ? <LoaderCircleIcon className="size-3.5 animate-spin text-muted-foreground" /> : null}
        </div>
      </TableCell>
      <TableCell className="text-[12px] text-muted-foreground/60">
        {formatDate(connection.updatedAt)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-md px-2 text-[11px]"
            disabled={isBusy || isUpdatingModel || connection.isDefault}
            onClick={() => {
              void onSelectDefault(connection.profileId);
            }}
          >
            <CheckIcon className="size-3" />
            Default
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-md px-2 text-[11px] text-destructive hover:bg-destructive/8 hover:text-destructive"
            disabled={isBusy || isUpdatingModel}
            onClick={() => {
              void onDelete(connection.profileId);
            }}
          >
            <Trash2Icon className="size-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function MessageBanner({
  children,
  tone,
}: {
  children: string;
  tone: "error" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3.5 py-2.5 text-[13px]",
        tone === "error"
          ? "border-warning/20 bg-warning/8 text-warning-foreground"
          : "border-success/20 bg-success/8 text-success",
      )}
    >
      {children}
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
