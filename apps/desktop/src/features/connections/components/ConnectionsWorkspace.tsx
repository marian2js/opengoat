import { useEffect, useMemo, useState } from "react";
import { CheckIcon, Link2Icon, PlusIcon, RefreshCcwIcon, Trash2Icon } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SidecarClient } from "@/lib/sidecar/client";
import { cleanProviderName } from "@/features/agents/display-helpers";
import { MessagingConnectionsPanel } from "./MessagingConnectionsPanel";
import { resolveModelDisplayLabel } from "./model-display-helpers";

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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4">
      {errorMessage ? (
        <MessageBanner tone="error">{errorMessage}</MessageBanner>
      ) : null}

      {feedback ? (
        <MessageBanner tone="success">{feedback}</MessageBanner>
      ) : null}

      <section className="min-w-0 rounded-lg border border-border/40 bg-card/80 transition-colors hover:border-border/60 dark:border-white/[0.06] dark:hover:border-white/[0.10]">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 lg:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8">
              <Link2Icon className="size-3.5 text-primary" />
            </div>
            <h2 className="section-label">Connections</h2>
            <span className="rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
              {storedConnections.length}
            </span>
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
              disabled={!client || isBusy || isRefreshing}
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
          <div className="border-t border-border/60 px-4 py-8 lg:px-5">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/8 ring-1 ring-primary/10">
                <Link2Icon className="size-6 text-primary/50" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">
                  No connections yet
                </h3>
                <p className="max-w-[300px] text-[12px] leading-relaxed text-muted-foreground/70">
                  Connect an AI provider to start using agents and chat.
                </p>
              </div>
              {onAddConnection ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 h-8 rounded-md text-[12px]"
                  onClick={onAddConnection}
                >
                  <PlusIcon className="size-3" />
                  Add connection
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden border-t border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Provider</TableHead>
                  <TableHead className="py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Connection</TableHead>
                  <TableHead className="py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Model</TableHead>
                  <TableHead className="py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Updated</TableHead>
                  <TableHead className="py-2.5 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storedConnections.map((connection) => (
                  <ConnectionRow
                    key={connection.profileId}
                    connection={connection}
                    isBusy={isBusy}
                    modelCatalog={modelCatalogs[connection.providerId]}
                    onDelete={handleDelete}
                    onSelectDefault={handleSelectDefault}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {storedConnections.length > 0 && onAddConnection ? (
          <div
            className="group/cta flex cursor-pointer items-center gap-4 border-t border-dashed border-border/40 px-4 py-3.5 transition-all hover:bg-primary/[0.03] lg:px-5"
            role="button"
            tabIndex={0}
            onClick={onAddConnection}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAddConnection(); } }}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 text-muted-foreground/40 transition-all group-hover/cta:border-primary/30 group-hover/cta:bg-primary/[0.04] group-hover/cta:text-primary">
              <PlusIcon className="size-3.5" />
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-medium text-foreground/80 transition-colors group-hover/cta:text-foreground">
                Add another connection
              </p>
              <p className="text-[11px] text-muted-foreground/50">
                Access different AI providers and models.
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <MessagingConnectionsPanel client={client} />
    </div>
  );
}

function ConnectionRow({
  connection,
  isBusy,
  modelCatalog,
  onDelete,
  onSelectDefault,
}: {
  connection: SavedConnection;
  isBusy: boolean;
  modelCatalog: ProviderModelCatalog | undefined;
  onDelete: (profileId: string) => Promise<void>;
  onSelectDefault: (profileId: string) => Promise<void>;
}) {
  const modelLabel = resolveModelDisplayLabel(modelCatalog, connection.activeModelId);

  return (
    <TableRow className="border-border/60 transition-all hover:bg-muted/30 dark:hover:bg-muted/20">
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
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[12px] text-foreground">{modelLabel}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="px-2 py-1 text-xs">
            Change model in Settings or Agents
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="font-mono text-[11px] text-muted-foreground/60 tabular-nums">
        {formatDate(connection.updatedAt)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 rounded-md px-2 text-[11px]"
                disabled={isBusy || connection.isDefault}
                onClick={() => {
                  void onSelectDefault(connection.profileId);
                }}
              >
                <CheckIcon className="size-3" />
                Default
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="px-2 py-1 text-xs">
              {connection.isDefault ? "Already default" : "Set as default"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Remove connection"
                title="Remove connection"
                className="h-7 rounded-md px-2 text-[11px] text-destructive hover:bg-destructive/8 hover:text-destructive"
                disabled={isBusy}
                onClick={() => {
                  void onDelete(connection.profileId);
                }}
              >
                <Trash2Icon className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="px-2 py-1 text-xs">
              Remove connection
            </TooltipContent>
          </Tooltip>
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
        "flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px]",
        tone === "error"
          ? "border-warning/20 bg-warning/8 text-warning-foreground"
          : "border-success/20 bg-success/8 text-success",
      )}
    >
      {tone === "success" ? (
        <CheckIcon className="size-3.5 shrink-0" />
      ) : null}
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
