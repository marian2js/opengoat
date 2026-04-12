import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BotIcon,
  ExternalLinkIcon,
  LoaderIcon,
  MessageSquareMoreIcon,
  QrCodeIcon,
  RefreshCcwIcon,
  Settings2Icon,
  SmartphoneIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type {
  OpenClawMessagingChannel,
  SidecarClient,
} from "@/lib/sidecar/client";
import { MESSAGING_CHANNEL_DESCRIPTIONS } from "./messaging-channel-descriptions";

interface MessagingConnectionsPanelProps {
  client: SidecarClient | null;
}

type ChannelId = "telegram" | "whatsapp";
type PanelMode = "unavailable" | "default";

const CHANNEL_META = {
  telegram: {
    icon: BotIcon,
    label: "Telegram",
  },
  whatsapp: {
    icon: SmartphoneIcon,
    label: "WhatsApp",
  },
} satisfies Record<ChannelId, { icon: typeof BotIcon; label: string }>;

export function MessagingConnectionsPanel({
  client,
}: MessagingConnectionsPanelProps) {
  const [channels, setChannels] = useState<OpenClawMessagingChannel[]>([]);
  const [sheetChannelId, setSheetChannelId] = useState<ChannelId | null>(null);
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [whatsAppLog, setWhatsAppLog] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("default");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmittingTelegram, setIsSubmittingTelegram] = useState(false);
  const [isRemovingChannel, setIsRemovingChannel] = useState<ChannelId | null>(null);
  const [isStartingWhatsAppLink, setIsStartingWhatsAppLink] = useState(false);
  const whatsAppAbortRef = useRef<AbortController | null>(null);

  const channelById = useMemo(
    () =>
      Object.fromEntries(
        channels.map((channel) => [channel.channelId, channel]),
      ) as Partial<Record<ChannelId, OpenClawMessagingChannel>>,
    [channels],
  );

  const loadChannels = useCallback(async () => {
    if (!client) {
      setChannels([]);
      return;
    }

    const nextChannels = await client.listOpenClawMessagingChannels();
    setChannels(nextChannels);
    setPanelMode("default");
  }, [client]);

  const refreshChannels = useCallback(async () => {
    if (!client) {
      setChannels([]);
      return;
    }

    setIsRefreshing(true);
    try {
      await loadChannels();
      setErrorMessage(null);
    } catch (error) {
      if (isMissingOpenClawRouteError(error)) {
        setPanelMode("unavailable");
        setChannels([]);
        setErrorMessage(
          "OpenClaw messaging routes are unavailable in the current sidecar. Restart the dev sidecar, then refresh.",
        );
      } else {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [client, loadChannels]);

  useEffect(() => {
    if (!client) {
      setChannels([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void loadChannels()
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (isMissingOpenClawRouteError(error)) {
          setPanelMode("unavailable");
          setChannels([]);
          setErrorMessage(
            "OpenClaw messaging routes are unavailable in the current sidecar. Restart the dev sidecar, then refresh.",
          );
          return;
        }
        setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, loadChannels]);

  useEffect(() => {
    return () => {
      whatsAppAbortRef.current?.abort();
    };
  }, []);

  const handleOpenSheet = useCallback((channelId: ChannelId) => {
    setSheetChannelId(channelId);
    setFeedback(null);
    setErrorMessage((current) =>
      current?.includes("OpenClaw messaging routes are unavailable") ? current : null,
    );
  }, []);

  const handleRemove = useCallback(
    async (channelId: ChannelId) => {
      if (!client) {
        return;
      }

      const label = CHANNEL_META[channelId].label;
      if (!window.confirm(`Remove ${label} from OpenClaw?`)) {
        return;
      }

      setErrorMessage(null);
      setFeedback(null);
      setIsRemovingChannel(channelId);

      try {
        if (channelId === "whatsapp") {
          whatsAppAbortRef.current?.abort();
          setWhatsAppLog("");
        }

        await client.removeOpenClawMessagingChannel(channelId);
        await loadChannels();
        setFeedback(`${label} removed.`);
        setSheetChannelId(null);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsRemovingChannel(null);
      }
    },
    [client, loadChannels],
  );

  const handleTelegramSave = useCallback(async () => {
    if (!client) {
      return;
    }

    const botToken = telegramBotToken.trim();
    if (!botToken) {
      setErrorMessage("Telegram bot token is required.");
      return;
    }

    setErrorMessage(null);
    setFeedback(null);
    setIsSubmittingTelegram(true);

    try {
      const nextChannels = await client.connectOpenClawTelegram({ botToken });
      setChannels(nextChannels);
      setPanelMode("default");
      setFeedback("Telegram configured in OpenClaw.");
      setTelegramBotToken("");
      setSheetChannelId("telegram");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmittingTelegram(false);
    }
  }, [client, telegramBotToken]);

  const handleStartWhatsAppLink = useCallback(async () => {
    if (!client) {
      return;
    }

    whatsAppAbortRef.current?.abort();
    const abortController = new AbortController();
    whatsAppAbortRef.current = abortController;

    setSheetChannelId("whatsapp");
    setErrorMessage(null);
    setFeedback(null);
    setWhatsAppLog("");
    setIsStartingWhatsAppLink(true);

    try {
      const response = await client.startOpenClawWhatsAppLoginStream(
        abortController.signal,
      );
      await readTextStream(response, (chunk) => {
        setWhatsAppLog((current) => current + chunk);
      });
      await loadChannels();
      setFeedback("WhatsApp link flow finished. Refresh if you just scanned the QR.");
    } catch (error) {
      if (!isAbortError(error)) {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      if (whatsAppAbortRef.current === abortController) {
        whatsAppAbortRef.current = null;
      }
      setIsStartingWhatsAppLink(false);
    }
  }, [client, loadChannels]);

  const handleStopWhatsAppLink = useCallback(() => {
    whatsAppAbortRef.current?.abort();
    whatsAppAbortRef.current = null;
    setIsStartingWhatsAppLink(false);
    setFeedback("WhatsApp link flow stopped.");
  }, []);

  const activeChannel = sheetChannelId
    ? channelById[sheetChannelId] ?? createFallbackChannel(sheetChannelId)
    : null;

  return (
    <>
      <section className="min-w-0 overflow-hidden rounded-xl border border-border/40 bg-card/80 shadow-sm shadow-black/[0.02] transition-colors hover:border-border/60 dark:border-white/[0.06] dark:shadow-black/10 dark:hover:border-white/[0.10]">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 lg:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 shadow-sm ring-1 ring-primary/10">
              <MessageSquareMoreIcon className="size-3.5 text-primary" />
            </div>
            <div>
              <h2 className="section-label">Messaging Channels</h2>
              <p className="mt-1 text-[11px] text-muted-foreground/70">
                Telegram and WhatsApp are configured through the embedded OpenClaw runtime.
              </p>
            </div>
            <span className="rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
              {channels.filter((channel) => channel.configured).length}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-md text-[11px] text-muted-foreground"
            disabled={!client || isRefreshing}
            onClick={() => {
              void refreshChannels();
            }}
          >
            <RefreshCcwIcon className={cn("size-3", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {errorMessage ? (
          <Banner tone={panelMode === "unavailable" ? "warning" : "error"}>
            {errorMessage}
          </Banner>
        ) : null}

        {feedback ? <Banner tone="success">{feedback}</Banner> : null}

        <div className="border-t border-border/40 px-4 py-4 dark:border-white/[0.04] lg:px-5">
          {isLoading ? (
            <div className="py-6 text-[12px] text-muted-foreground">
              Loading OpenClaw channels...
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(["telegram", "whatsapp"] as const).map((channelId) => {
                const channel = channelById[channelId] ?? createFallbackChannel(channelId);
                return (
                  <MessagingConnectionRow
                    key={channelId}
                    channel={channel}
                    isUnavailable={panelMode === "unavailable"}
                    isRemoving={isRemovingChannel === channelId}
                    onOpen={() => {
                      handleOpenSheet(channelId);
                    }}
                    onPrimaryAction={() => {
                      handleOpenSheet(channelId);
                    }}
                    onRemove={() => {
                      void handleRemove(channelId);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Sheet
        open={sheetChannelId !== null}
        onOpenChange={(open) => {
          if (!open) {
            whatsAppAbortRef.current?.abort();
            setIsStartingWhatsAppLink(false);
            setSheetChannelId(null);
          }
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {activeChannel ? (
            <>
              <SheetHeader className="border-b border-border/40 px-5 py-4">
                <SheetTitle>{CHANNEL_META[activeChannel.channelId].label}</SheetTitle>
                <SheetDescription>
                  {activeChannel.channelId === "telegram"
                    ? "Save or rotate the Telegram bot token that OpenClaw will use."
                    : "Run the WhatsApp QR link flow owned by OpenClaw."}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-5 py-5">
                <StatusPanel channel={activeChannel} />

                {activeChannel.channelId === "telegram" ? (
                  <TelegramConnectionDetail
                    botToken={telegramBotToken}
                    channel={activeChannel}
                    isSaving={isSubmittingTelegram}
                    onBotTokenChange={setTelegramBotToken}
                    onRefresh={() => {
                      void refreshChannels();
                    }}
                    onSave={() => {
                      void handleTelegramSave();
                    }}
                  />
                ) : (
                  <WhatsAppConnectionDetail
                    channel={activeChannel}
                    isLinking={isStartingWhatsAppLink}
                    logOutput={whatsAppLog}
                    onRefresh={() => {
                      void refreshChannels();
                    }}
                    onStartLink={() => {
                      void handleStartWhatsAppLink();
                    }}
                    onStopLink={handleStopWhatsAppLink}
                  />
                )}

              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function MessagingConnectionRow({
  channel,
  isUnavailable,
  isRemoving,
  onOpen,
  onPrimaryAction,
  onRemove,
}: {
  channel: OpenClawMessagingChannel;
  isUnavailable: boolean;
  isRemoving: boolean;
  onOpen: () => void;
  onPrimaryAction: () => void;
  onRemove: () => void;
}) {
  const meta = CHANNEL_META[channel.channelId];
  const Icon = meta.icon;
  const statusTone = resolveStatusTone(channel);
  const statusLabel = resolveStatusLabel(channel);

  return (
    <div className="rounded-xl border border-border/40 bg-background/55 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/10">
          <Icon className="size-4.5 text-primary" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold text-foreground">{meta.label}</p>
            <Badge
              variant="secondary"
              className={cn(
                "rounded-md px-1.5 text-[9px] font-medium uppercase tracking-wide",
                statusTone === "ready" && "bg-primary/10 text-primary",
                statusTone === "active" &&
                  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                statusTone === "pending" &&
                  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
              )}
            >
              {statusLabel}
            </Badge>
          </div>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {MESSAGING_CHANNEL_DESCRIPTIONS[channel.channelId]}
          </p>
          <p className="text-[11px] text-muted-foreground/70">{channel.summary}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-md text-[12px]"
          disabled={isUnavailable}
          onClick={onPrimaryAction}
        >
          {channel.channelId === "telegram"
            ? channel.configured
              ? "Manage Telegram"
              : "Connect Telegram"
            : channel.linked
              ? "Manage WhatsApp"
              : "Link WhatsApp"}
        </Button>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-md px-2 text-[11px] text-primary"
            aria-label={`Details for ${meta.label}`}
            onClick={onOpen}
          >
            <Settings2Icon className="size-3.5" />
            <span>Details</span>
          </Button>
          {channel.configured ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-md px-2 text-[11px] text-destructive"
              aria-label="Remove connection"
              title="Remove connection"
              disabled={isUnavailable || isRemoving}
              onClick={onRemove}
            >
              {isRemoving ? (
                <LoaderIcon className="size-3 animate-spin" />
              ) : (
                <Trash2Icon className="size-3" />
              )}
              <span>Remove</span>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusPanel({
  channel,
}: {
  channel: OpenClawMessagingChannel;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/[0.18] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
            Current Status
          </p>
          <p className="mt-1 text-[13px] font-medium text-foreground">{channel.summary}</p>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide",
            resolveStatusTone(channel) === "ready" && "bg-primary/10 text-primary",
            resolveStatusTone(channel) === "active" &&
              "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            resolveStatusTone(channel) === "pending" &&
              "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          )}
        >
          {resolveStatusLabel(channel)}
        </Badge>
      </div>
    </div>
  );
}

function WhatsAppConnectionDetail({
  channel,
  isLinking,
  logOutput,
  onRefresh,
  onStartLink,
  onStopLink,
}: {
  channel: OpenClawMessagingChannel;
  isLinking: boolean;
  logOutput: string;
  onRefresh: () => void;
  onStartLink: () => void;
  onStopLink: () => void;
}) {
  const qrPreview = useMemo(() => extractTerminalQr(logOutput), [logOutput]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <QrCodeIcon className="size-4 text-primary" />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">
            WhatsApp Link Flow
          </h3>
          <p className="text-[11px] text-muted-foreground/70">
            OpenClaw prints the QR stream here while it owns the linked-device session.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border/50 bg-background/80 px-3.5 py-3">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Scan the QR from{" "}
          <span className="font-medium text-foreground">
            WhatsApp &gt; Settings &gt; Linked Devices
          </span>
          , then refresh once the phone completes pairing.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-md text-[12px]"
          disabled={isLinking}
          onClick={onRefresh}
        >
          <RefreshCcwIcon className="size-3.5" />
          Refresh
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-md text-[12px]"
          disabled={isLinking}
          onClick={onStartLink}
        >
          {channel.linked ? "Relink WhatsApp" : "Start QR link"}
        </Button>
        {isLinking ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-md text-[12px]"
            onClick={onStopLink}
          >
            Stop link
          </Button>
        ) : null}
      </div>

      {qrPreview ? (
        <div className="space-y-3 overflow-hidden rounded-lg border border-border/50 bg-[#050505]">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] text-zinc-400">
            <span>WhatsApp QR</span>
            {isLinking ? <span className="text-primary">ready to scan</span> : null}
          </div>
          <div className="px-3 pt-3">
            <div className="mx-auto w-full max-w-[340px] rounded-lg bg-white p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
              <div
                className="grid aspect-square w-full overflow-hidden rounded-[4px] bg-black"
                style={{
                  gridTemplateColumns: `repeat(${String(qrPreview.width)}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${String(qrPreview.height)}, minmax(0, 1fr))`,
                }}
              >
                {qrPreview.cells.map((filled, index) => (
                  <div
                    key={index}
                    className={filled ? "bg-black" : "bg-white"}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 px-3 pb-3 pt-2">
            <p className="text-[11px] leading-relaxed text-zinc-400">
              Scan this with WhatsApp on your phone. If it expires, start the link flow again.
            </p>
          </div>
        </div>
      ) : null}

      {!qrPreview ? (
        <div className="overflow-hidden rounded-lg border border-border/50 bg-[#050505]">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] text-zinc-400">
            <span>WhatsApp QR</span>
            {isLinking ? <span className="text-primary">waiting for scan...</span> : null}
          </div>
          <div className="px-3 py-4">
            <p className="text-[11px] leading-relaxed text-zinc-400">
              No QR yet. Start the link flow and wait for OpenClaw to emit a fresh code.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TelegramConnectionDetail({
  botToken,
  channel,
  isSaving,
  onBotTokenChange,
  onRefresh,
  onSave,
}: {
  botToken: string;
  channel: OpenClawMessagingChannel;
  isSaving: boolean;
  onBotTokenChange: (value: string) => void;
  onRefresh: () => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <BotIcon className="size-4 text-primary" />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">
            Telegram Bot Token
          </h3>
          <p className="text-[11px] text-muted-foreground/70">
            Save the BotFather token into OpenClaw, then handle DM approvals through OpenClaw pairing.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border/50 bg-background/80 px-3.5 py-3">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Use <span className="font-medium text-foreground">@BotFather</span> to create or rotate the bot token.
          OpenClaw expects the standard Telegram Bot API token format.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="telegram-bot-token"
          className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70"
        >
          Telegram Bot Token
        </label>
        <Input
          id="telegram-bot-token"
          value={botToken}
          placeholder={channel.configured ? "Paste a replacement token" : "123456789:AA..."}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            onBotTokenChange(event.target.value);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-md text-[12px]"
          onClick={onRefresh}
        >
          <RefreshCcwIcon className="size-3.5" />
          Refresh
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-md text-[12px]"
          disabled={isSaving}
          onClick={onSave}
        >
          {isSaving ? <LoaderIcon className="size-3.5 animate-spin" /> : null}
          {channel.configured ? "Update token" : "Save token"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-md text-[12px] text-muted-foreground"
          onClick={() => {
            window.open("https://t.me/BotFather", "_blank", "noopener,noreferrer");
          }}
        >
          <ExternalLinkIcon className="size-3.5" />
          Open BotFather
        </Button>
      </div>
    </div>
  );
}

function Banner({
  children,
  tone,
}: {
  children: string;
  tone: "error" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "border-t px-4 py-2.5 text-[12px] lg:px-5",
        tone === "error" && "border-destructive/15 bg-destructive/8 text-destructive",
        tone === "success" &&
          "border-emerald-500/15 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400",
        tone === "warning" &&
          "border-amber-500/15 bg-amber-500/8 text-amber-700 dark:text-amber-300",
      )}
    >
      {children}
    </div>
  );
}

function createFallbackChannel(channelId: ChannelId): OpenClawMessagingChannel {
  return {
    accountId: "default",
    channelId,
    configured: false,
    enabled: false,
    label: CHANNEL_META[channelId].label,
    ...(channelId === "whatsapp" ? { linked: false } : {}),
    summary: "Not configured",
  };
}

function resolveStatusTone(channel: OpenClawMessagingChannel): "active" | "pending" | "ready" {
  if (!channel.configured) {
    return "ready";
  }

  if (channel.channelId === "whatsapp" && !channel.linked) {
    return "pending";
  }

  return "active";
}

function resolveStatusLabel(channel: OpenClawMessagingChannel): string {
  if (!channel.configured) {
    return "Not Set";
  }

  if (channel.channelId === "whatsapp" && !channel.linked) {
    return "Needs QR";
  }

  return "Ready";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissingOpenClawRouteError(error: unknown): boolean {
  return /Sidecar request failed with status 404/.test(getErrorMessage(error));
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function extractTerminalQr(logOutput: string): {
  cells: boolean[];
  height: number;
  width: number;
} | null {
  const normalized = stripAnsi(logOutput).replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const startIndex = lines.findIndex((line) => /scan this qr/i.test(line));
  if (startIndex < 0) {
    return null;
  }

  const qrLines: string[] = [];
  for (const line of lines.slice(startIndex + 1)) {
    if (!line.trim()) {
      if (qrLines.length > 0) {
        break;
      }
      continue;
    }

    if (!isQrArtLine(line)) {
      if (qrLines.length > 0) {
        break;
      }
      continue;
    }

    qrLines.push(line.replace(/\s+$/g, ""));
  }

  if (qrLines.length < 8) {
    return null;
  }

  const matrix = qrLines.flatMap((line) => expandQrLine(line));
  if (matrix.length === 0) {
    return null;
  }

  const width = Math.max(...matrix.map((row) => row.length));
  const normalizedRows = matrix.map((row) =>
    row.length < width ? [...row, ...new Array(width - row.length).fill(false)] : row,
  );

  return {
    cells: normalizedRows.flat(),
    height: normalizedRows.length,
    width,
  };
}

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;?]*[ -/]*[@-~]/g, "");
}

function isQrArtLine(line: string): boolean {
  const trimmed = line.trimEnd();
  if (trimmed.length < 8) {
    return false;
  }

  return /^[ \t\u2580-\u259f]+$/.test(trimmed);
}

function expandQrLine(line: string): boolean[][] {
  const top: boolean[] = [];
  const bottom: boolean[] = [];

  for (const character of line) {
    const [upper, lower] = expandQrCharacter(character);
    top.push(upper);
    bottom.push(lower);
  }

  return [top, bottom];
}

function expandQrCharacter(character: string): [boolean, boolean] {
  switch (character) {
    case " ":
    case "\t":
      return [false, false];
    case "▀":
      return [true, false];
    case "▄":
      return [false, true];
    case "█":
    case "▌":
    case "▐":
    case "▉":
    case "▊":
    case "▋":
    case "▍":
    case "▎":
    case "▇":
    case "▆":
    case "▅":
    case "▃":
    case "▂":
    case "▁":
    case "▙":
    case "▛":
    case "▜":
    case "▟":
      return [true, true];
    default:
      return [false, false];
  }
}

async function readTextStream(
  response: Response,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      const trailing = decoder.decode();
      if (trailing) {
        onChunk(trailing);
      }
      return;
    }

    onChunk(decoder.decode(value, { stream: true }));
  }
}
