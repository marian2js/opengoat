import { useCallback, useEffect, useState } from "react";
import {
  MessageSquareIcon,
  PlusIcon,
  Trash2Icon,
  SmartphoneIcon,
  SendIcon,
} from "lucide-react";
import type { MessagingConnection } from "@/app/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SidecarClient } from "@/lib/sidecar/client";

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
    try {
      const meta = TYPE_META[type];
      await client.createMessagingConnection({
        workspaceId: "default",
        type,
        displayName: `${meta?.label ?? type} Connection`,
        defaultProjectId: "default",
      });
      await loadConnections();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
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
        <div className="flex items-center gap-2">
          <MessageSquareIcon className="size-3.5 text-primary" />
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

      {showTypeSelector ? (
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
            {connections.map((connection) => (
              <MessagingConnectionRow
                key={connection.connectionId}
                connection={connection}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MessagingConnectionRow({
  connection,
  onDelete,
}: {
  connection: MessagingConnection;
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

  return (
    <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20 lg:px-5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background">
        <Icon className={cn("size-4", meta.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-foreground truncate">
            {connection.displayName}
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
          <span className="text-[11px] text-muted-foreground/70">
            {statusLabel}
          </span>
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-md px-2 text-[11px] text-destructive hover:bg-destructive/8 hover:text-destructive"
            onClick={() => {
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
  );
}
