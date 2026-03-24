import { useCallback, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ClipboardCopyIcon,
  ExternalLinkIcon,
  SendIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SidecarClient } from "@/lib/sidecar/client";

interface TelegramSetupFlowProps {
  client: SidecarClient;
  sidecarBaseUrl: string;
  onComplete: () => void;
  onCancel: () => void;
}

type Step = "token" | "webhook" | "confirm";

function generateSecretToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function TelegramSetupFlow({
  client,
  sidecarBaseUrl,
  onComplete,
  onCancel,
}: TelegramSetupFlowProps) {
  const [step, setStep] = useState<Step>("token");
  const [botToken, setBotToken] = useState("");
  const [botName, setBotName] = useState("");
  const [secretToken] = useState(generateSecretToken);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const webhookUrl = connectionId
    ? `${sidecarBaseUrl}/messaging/telegram/webhook/${connectionId}`
    : "";

  const copyToClipboard = useCallback(
    async (text: string, field: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
      } catch {
        // Clipboard not available
      }
    },
    [],
  );

  const handleTokenNext = useCallback(async () => {
    if (!botToken.trim() || !botToken.includes(":")) {
      setError("Please enter a valid bot token (format: 123456:ABC-DEF...)");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const displayName = botName.trim() || "Telegram Bot";
      const connection = await client.createMessagingConnection({
        workspaceId: "default",
        type: "telegram",
        displayName,
        defaultProjectId: "default",
        configRef: JSON.stringify({
          botToken: botToken.trim(),
          secretToken,
        }),
      });
      setConnectionId(connection.connectionId);
      setStep("webhook");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [botToken, botName, secretToken, client]);

  const handleConfirm = useCallback(async () => {
    if (!connectionId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await client.updateMessagingConnection(connectionId, {
        status: "connected",
        configRef: JSON.stringify({
          botToken: botToken.trim(),
          secretToken,
          webhookUrl,
        }),
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [connectionId, botToken, secretToken, webhookUrl, client, onComplete]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10">
          <SendIcon className="size-4 text-blue-400" />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">
            Connect Telegram Bot
          </h3>
          <p className="text-[11px] text-muted-foreground/70">
            {step === "token" && "Step 1 of 3 — Enter bot token"}
            {step === "webhook" && "Step 2 of 3 — Configure webhook"}
            {step === "confirm" && "Step 3 of 3 — Confirm connection"}
          </p>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {(["token", "webhook", "confirm"] as const).map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              s === step
                ? "bg-primary"
                : i < ["token", "webhook", "confirm"].indexOf(step)
                  ? "bg-primary/40"
                  : "bg-muted/30",
            )}
          />
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/8 px-3.5 py-2.5 text-[12px] text-destructive">
          {error}
        </div>
      )}

      {/* Step 1: Bot Token */}
      {step === "token" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3.5 py-3">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Create a new bot with{" "}
              <span className="font-medium text-foreground">@BotFather</span> on
              Telegram, then paste the bot token here.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground">
              Bot Name (optional)
            </label>
            <Input
              type="text"
              placeholder="My CMO Bot"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              className="h-8 text-[12px]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground">
              Bot Token
            </label>
            <Input
              type="password"
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              className="h-8 font-mono text-[12px]"
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-[11px]"
              disabled={!botToken.trim() || isSubmitting}
              onClick={() => void handleTokenNext()}
            >
              {isSubmitting ? "Creating…" : "Next"}
              <ArrowRightIcon className="ml-1 size-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Webhook URL */}
      {step === "webhook" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3.5 py-3">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Set the webhook URL in Telegram&apos;s Bot API or use a tunnel
              like <span className="font-medium text-foreground">ngrok</span>{" "}
              for local development.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground">
              Webhook URL
            </label>
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                readOnly
                value={webhookUrl}
                className="h-8 font-mono text-[11px] text-muted-foreground"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 px-2"
                onClick={() => void copyToClipboard(webhookUrl, "webhook")}
              >
                {copiedField === "webhook" ? (
                  <CheckIcon className="size-3 text-primary" />
                ) : (
                  <ClipboardCopyIcon className="size-3" />
                )}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground">
              Secret Token
            </label>
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                readOnly
                value={secretToken}
                className="h-8 font-mono text-[11px] text-muted-foreground"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 px-2"
                onClick={() => void copyToClipboard(secretToken, "secret")}
              >
                {copiedField === "secret" ? (
                  <CheckIcon className="size-3 text-primary" />
                ) : (
                  <ClipboardCopyIcon className="size-3" />
                )}
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-blue-500/10 bg-blue-500/5 px-3.5 py-2.5">
            <p className="text-[11px] leading-relaxed text-blue-400/80">
              <ExternalLinkIcon className="mr-1 inline-block size-3" />
              Use the Telegram Bot API{" "}
              <code className="rounded bg-blue-500/10 px-1 font-mono text-[10px]">
                setWebhook
              </code>{" "}
              method with the URL and secret token above.
            </p>
          </div>
          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setStep("token")}
            >
              <ArrowLeftIcon className="mr-1 size-3" />
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setStep("confirm")}
            >
              Next
              <ArrowRightIcon className="ml-1 size-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === "confirm" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3.5 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Bot</span>
              <span className="text-[12px] font-medium text-foreground">
                {botName.trim() || "Telegram Bot"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                <span className="inline-block size-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-foreground">Ready</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Project
              </span>
              <span className="text-[12px] text-foreground">Default</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setStep("webhook")}
            >
              <ArrowLeftIcon className="mr-1 size-3" />
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-[11px]"
              disabled={isSubmitting}
              onClick={() => void handleConfirm()}
            >
              {isSubmitting ? "Connecting…" : "Confirm Connection"}
              <CheckIcon className="ml-1 size-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
