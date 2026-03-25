import { useCallback, useEffect, useState } from "react";
import {
  MessageSquareIcon,
  PlusIcon,
  Trash2Icon,
  SmartphoneIcon,
  SendIcon,
  SettingsIcon,
  PlayIcon,
} from "lucide-react";
import type { MessagingConnection } from "@/app/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SidecarClient } from "@/lib/sidecar/client";
import { TelegramSetupFlow } from "./TelegramSetupFlow";
import { WhatsAppSetupFlow } from "./WhatsAppSetupFlow";

interface MessagingConnectionsPanelProps {
  client: SidecarClient | null;
}

const TYPE_META: Record<
  string,
  { label: string; icon: typeof SendIcon; color: string }
> = {
  telegram: {
    label: "Telegram",
    icon: SendIcon,
    color: "text-blue-400",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: SmartphoneIcon,
    color: "text-emerald-400",
  },
};

const STATUS_DOT: Record<string, string> = {
  connected: "bg-emerald-400",
  pending: "bg-amber-400",
  error: "bg-red-400",
  disconnected: "bg-zinc-400",
};

const STATUS_LABEL: Record<string, string> = {
  connected: "Connected",
  pending: "Pending",
  error: "Error",
  disconnected: "Disconnected",
};

export function MessagingConnectionsPanel({
  client,
}: MessagingConnectionsPanelProps) {
  const [connections, setConnections] = useState<MessagingConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showTelegramSetup, setShowTelegramSetup] = useState(false);
  const [showWhatsAppSetup, setShowWhatsAppSetup] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    if (!client) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await client.listMessagingConnections("default");
      setConnections(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  async function handleCreate(type: "telegram" | "whatsapp"): Promise<void> {
    if (!client) {
      return;
    }
    setShowTypeSelector(false);
    setErrorMessage(null);

    if (type === "telegram") {
      setShowTelegramSetup(true);
      return;
    }

    if (type === "whatsapp") {
      setShowWhatsAppSetup(true);
      return;
    }
  }

  function handleTelegramSetupComplete(): void {
    setShowTelegramSetup(false);
    void loadConnections();
  }

  function handleWhatsAppSetupComplete(): void {
    setShowWhatsAppSetup(false);
    void loadConnections();
  }

  async function handleDelete(connectionId: string): Promise<void> {
    if (!client) {
      return;
    }
    setErrorMessage(null);
    try {
      await client.deleteMessagingConnection(connectionId);
      await loadConnections();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section className="min-w-0 rounded-lg border border-border/50 bg-card/80">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 lg:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8">
            <MessageSquareIcon className="size-3.5 text-primary" />
          </div>
          <h2 className="section-label">Messaging Channels</h2>
          <span className="rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {connections.length}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-md text-[11px]"
          onClick={() => setShowTypeSelector(!showTypeSelector)}
        >
          <PlusIcon className="size-3" />
          Add channel
        </Button>
      </div>

      {errorMessage ? (
        <div className="border-t border-border/60 px-4 py-2 lg:px-5">
          <div className="rounded-lg border border-warning/20 bg-warning/8 px-3.5 py-2.5 text-[13px] text-warning-foreground">
            {errorMessage}
          </div>
        </div>
      ) : null}

      {showTelegramSetup && client ? (
        <div className="border-t border-border/60 px-4 py-3 lg:px-5">
          <TelegramSetupFlow
            client={client}
            sidecarBaseUrl={`http://localhost:${window.location.port || "3001"}`}
            onComplete={handleTelegramSetupComplete}
            onCancel={() => setShowTelegramSetup(false)}
          />
        </div>
      ) : null}

      {showWhatsAppSetup && client ? (
        <div className="border-t border-border/60 px-4 py-3 lg:px-5">
          <WhatsAppSetupFlow
            client={client}
            sidecarBaseUrl={`http://localhost:${window.location.port || "3001"}`}
            onComplete={handleWhatsAppSetupComplete}
            onCancel={() => setShowWhatsAppSetup(false)}
          />
        </div>
      ) : null}

      {showTypeSelector && !showTelegramSetup && !showWhatsAppSetup ? (
        <div className="border-t border-border/60 px-4 py-3 lg:px-5">
          <p className="mb-2 text-[12px] text-muted-foreground">
            Select a messaging platform to connect:
          </p>
          <div className="flex gap-2">
            {(["telegram", "whatsapp"] as const).map((type) => {
              const meta = TYPE_META[type]!;
              const Icon = meta.icon;
              return (
                <button
                  key={type}
                  type="button"
                  className="flex items-center gap-2 rounded-md border border-border/50 bg-background px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/[0.03]"
                  onClick={() => {
                    void handleCreate(type);
                  }}
                >
                  <Icon className={cn("size-4", meta.color)} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!isLoading && connections.length === 0 ? (
        <div className="border-t border-border/60 px-4 py-8 lg:px-5">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/8">
              <MessageSquareIcon className="size-6 text-primary/50" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">
                No messaging channels
              </h3>
              <p className="max-w-[340px] text-[12px] leading-relaxed text-muted-foreground/70">
                Connect Telegram or WhatsApp to chat with your AI CMO from
                messaging apps.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {connections.length > 0 ? (
        <div className="border-t border-border/60">
          <div className="divide-y divide-border/40">
            {connections.map((connection) => {
              // Disambiguate duplicate display names by type
              const sameTypeConns = connections.filter(
                (c) => c.type === connection.type && c.displayName === connection.displayName,
              );
              const disambiguatedName =
                sameTypeConns.length > 1
                  ? `${connection.displayName} #${sameTypeConns.indexOf(connection) + 1}`
                  : connection.displayName;

              return (
              <div key={connection.connectionId}>
                <MessagingConnectionRow
                  connection={connection}
                  resolvedName={disambiguatedName}
                  isSelected={selectedConnection === connection.connectionId}
                  onSelect={() =>
                    setSelectedConnection(
                      selectedConnection === connection.connectionId
                        ? null
                        : connection.connectionId,
                    )
                  }
                  onDelete={handleDelete}
                />
                {selectedConnection === connection.connectionId &&
                connection.type === "telegram" ? (
                  <TelegramConnectionDetail connection={connection} />
                ) : null}
                {selectedConnection === connection.connectionId &&
                connection.type === "whatsapp" ? (
                  <WhatsAppConnectionDetail
                    connection={connection}
                    client={client}
                    onReconnect={() => void loadConnections()}
                  />
                ) : null}
              </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MessagingConnectionRow({
  connection,
  resolvedName,
  isSelected,
  onSelect,
  onDelete,
}: {
  connection: MessagingConnection;
  resolvedName: string;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (connectionId: string) => Promise<void>;
}) {
  const meta = TYPE_META[connection.type] ?? {
    label: connection.type,
    icon: MessageSquareIcon,
    color: "text-muted-foreground",
  };
  const Icon = meta.icon;
  const statusDot = STATUS_DOT[connection.status] ?? "bg-zinc-400";
  const statusLabel = STATUS_LABEL[connection.status] ?? connection.status;
  const isPending = connection.status === "pending";
  const isWhatsApp = connection.type === "whatsapp";

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/20 lg:px-5 cursor-pointer",
        isSelected && "bg-muted/10",
        isPending && "bg-amber-400/[0.03]",
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
    >
      <div className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg border",
        isPending
          ? "border-amber-400/20 bg-amber-400/8"
          : "border-border/50 bg-background",
      )}>
        <Icon className={cn("size-4", isPending ? "text-amber-400" : meta.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-foreground truncate">
            {resolvedName}
          </span>
          <Badge
            variant="secondary"
            className="rounded-md bg-muted/50 px-1.5 text-[9px] font-medium text-muted-foreground"
          >
            {meta.label}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={cn("inline-block size-1.5 rounded-full", statusDot)}
          />
          <span className={cn(
            "font-mono text-[10px] uppercase tracking-wider",
            isPending ? "font-semibold text-amber-400/80" : "text-muted-foreground/60",
          )}>
            {statusLabel}
          </span>
          {isPending && (
            <span className="text-[11px] text-muted-foreground/50">
              {isWhatsApp ? "— scan QR to link" : "— finish setup to activate"}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {(connection.type === "telegram" || connection.type === "whatsapp") ? (
          <Button
            type="button"
            variant={isPending ? "outline" : "ghost"}
            size="sm"
            aria-label={isPending ? "Complete setup" : "Connection details"}
            className={cn(
              "h-7 rounded-md px-2.5 text-[11px]",
              isPending
                ? "border-amber-400/30 text-amber-400 hover:bg-amber-400/8 hover:text-amber-300"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            {isPending ? (
              <>
                <PlayIcon className="size-3" />
                <span>Complete Setup</span>
              </>
            ) : (
              <>
                <SettingsIcon className="size-3" />
                <span>Details</span>
              </>
            )}
          </Button>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Remove connection"
              className="h-7 rounded-md px-2 text-[11px] text-muted-foreground/40 hover:bg-destructive/8 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                void onDelete(connection.connectionId);
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
    </div>
  );
}

function WhatsAppConnectionDetail({
  connection,
  client,
  onReconnect,
}: {
  connection: MessagingConnection;
  client: SidecarClient | null;
  onReconnect: () => void;
}) {
  const [isReconnecting, setIsReconnecting] = useState(false);

  async function handleReconnect() {
    if (!client) return;
    setIsReconnecting(true);
    try {
      await client.startWhatsAppSession(connection.connectionId);
      onReconnect();
    } catch {
      // Reconnect failure
    } finally {
      setIsReconnecting(false);
    }
  }

  async function handleUnlink() {
    if (!client) return;
    try {
      await client.stopWhatsAppSession(connection.connectionId);
      onReconnect();
    } catch {
      // Best effort
    }
  }

  return (
    <div className="border-t border-border/30 bg-muted/10 px-4 py-3 lg:px-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Status</span>
          <span className="text-[11px] font-medium text-foreground">
            {STATUS_LABEL[connection.status] ?? connection.status}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Project</span>
          <span className="text-[11px] text-foreground">
            {connection.defaultProjectId}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Created</span>
          <span className="text-[10px] font-mono text-muted-foreground/70">
            {new Date(connection.createdAt).toLocaleDateString()}
          </span>
        </div>
        {(connection.status === "disconnected" || connection.status === "error") && (
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              disabled={isReconnecting}
              onClick={() => void handleReconnect()}
            >
              {isReconnecting ? "Reconnecting…" : "Reconnect"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] text-destructive hover:text-destructive"
              onClick={() => void handleUnlink()}
            >
              Unlink
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function TelegramConnectionDetail({
  connection,
}: {
  connection: MessagingConnection;
}) {
  let config: { botToken?: string; secretToken?: string; webhookUrl?: string } =
    {};
  try {
    if (connection.configRef) {
      config = JSON.parse(connection.configRef);
    }
  } catch {
    // Invalid config
  }

  return (
    <div className="border-t border-border/30 bg-muted/10 px-4 py-3 lg:px-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Status</span>
          <span className="text-[11px] font-medium text-foreground">
            {STATUS_LABEL[connection.status] ?? connection.status}
          </span>
        </div>
        {config.webhookUrl ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              Webhook URL
            </span>
            <span className="truncate text-[10px] font-mono text-muted-foreground/70">
              {config.webhookUrl}
            </span>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Project</span>
          <span className="text-[11px] text-foreground">
            {connection.defaultProjectId}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Created</span>
          <span className="text-[10px] font-mono text-muted-foreground/70">
            {new Date(connection.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}
