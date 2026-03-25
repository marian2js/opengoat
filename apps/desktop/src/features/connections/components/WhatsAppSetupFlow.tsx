import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  LoaderIcon,
  SmartphoneIcon,
  RefreshCwIcon,
  AlertCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SidecarClient } from "@/lib/sidecar/client";

interface WhatsAppSetupFlowProps {
  client: SidecarClient;
  sidecarBaseUrl: string;
  onComplete: () => void;
  onCancel: () => void;
}

type Step = "qr" | "confirm";
type QrStatus = "loading" | "scanning" | "expired" | "error" | "connected";

export function WhatsAppSetupFlow({
  client,
  sidecarBaseUrl,
  onComplete,
  onCancel,
}: WhatsAppSetupFlowProps) {
  const [step, setStep] = useState<Step>("qr");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<QrStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Create connection and start session on mount
  useEffect(() => {
    let cancelled = false;

    async function initSession() {
      try {
        const connection = await client.createMessagingConnection({
          workspaceId: "default",
          type: "whatsapp",
          displayName: "WhatsApp Connection",
          defaultProjectId: "default",
        });

        if (cancelled) return;
        setConnectionId(connection.connectionId);

        // Start the session (triggers Baileys to generate QR codes)
        await client.startWhatsAppSession(connection.connectionId);

        if (cancelled) return;

        // Subscribe to QR code events via SSE
        const sseUrl = client.getWhatsAppQrUrl(connection.connectionId);
        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          if (cancelled) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === "qr") {
              setQrDataUrl(data.data);
              setQrStatus("scanning");
            } else if (data.type === "status") {
              if (data.status === "connected") {
                setQrStatus("connected");
                setStep("confirm");
                es.close();
              } else if (data.status === "error") {
                setQrStatus("error");
                setError(data.message || "Connection failed.");
                es.close();
              } else if (data.status === "disconnected") {
                setQrStatus("expired");
                setError(data.message || "Disconnected.");
                es.close();
              }
            }
          } catch {
            // Ignore parse errors
          }
        };

        es.onerror = () => {
          if (cancelled) return;
          if (qrStatus !== "connected") {
            setQrStatus("error");
            setError("Connection to QR stream lost. Try again.");
          }
          es.close();
        };
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setQrStatus("error");
        }
      }
    }

    void initSession();

    return () => {
      cancelled = true;
      eventSourceRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = useCallback(async () => {
    if (!connectionId) return;
    setError(null);
    setQrStatus("loading");
    setQrDataUrl(null);

    try {
      await client.startWhatsAppSession(connectionId);

      const sseUrl = client.getWhatsAppQrUrl(connectionId);
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "qr") {
            setQrDataUrl(data.data);
            setQrStatus("scanning");
          } else if (data.type === "status") {
            if (data.status === "connected") {
              setQrStatus("connected");
              setStep("confirm");
              es.close();
            } else if (data.status === "error") {
              setQrStatus("error");
              setError(data.message || "Connection failed.");
              es.close();
            }
          }
        } catch {
          // Ignore
        }
      };

      es.onerror = () => {
        setQrStatus("error");
        setError("Connection to QR stream lost. Try again.");
        es.close();
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setQrStatus("error");
    }
  }, [connectionId, client]);

  const handleConfirm = useCallback(async () => {
    if (!connectionId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await client.updateMessagingConnection(connectionId, {
        status: "connected",
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [connectionId, client, onComplete]);

  const handleCancel = useCallback(async () => {
    eventSourceRef.current?.close();
    if (connectionId) {
      try {
        await client.stopWhatsAppSession(connectionId);
        await client.deleteMessagingConnection(connectionId);
      } catch {
        // Best effort cleanup
      }
    }
    onCancel();
  }, [connectionId, client, onCancel]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
          <SmartphoneIcon className="size-4 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">
            Connect WhatsApp
          </h3>
          <p className="text-[11px] text-muted-foreground/70">
            {step === "qr" && "Step 1 of 2 — Scan QR code"}
            {step === "confirm" && "Step 2 of 2 — Confirm connection"}
          </p>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {(["qr", "confirm"] as const).map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              s === step
                ? "bg-primary"
                : i < ["qr", "confirm"].indexOf(step)
                  ? "bg-primary/40"
                  : "bg-muted/30",
            )}
          />
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/8 px-3.5 py-2.5 text-[12px] text-destructive">
          <AlertCircleIcon className="size-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: QR Code Scan */}
      {step === "qr" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3.5 py-3">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Open <span className="font-medium text-foreground">WhatsApp</span>{" "}
              on your phone, go to{" "}
              <span className="font-medium text-foreground">
                Settings → Linked Devices → Link a Device
              </span>
              , and scan the QR code below.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 py-2">
            {qrStatus === "loading" && (
              <div className="flex size-48 items-center justify-center rounded-xl border border-border/50 bg-background">
                <LoaderIcon className="size-6 animate-spin text-muted-foreground/50" />
              </div>
            )}

            {qrStatus === "scanning" && qrDataUrl && (
              <div className="rounded-xl border border-border/50 bg-white p-3">
                <img
                  src={qrDataUrl}
                  alt="WhatsApp QR Code"
                  className="size-48"
                />
              </div>
            )}

            {(qrStatus === "expired" || qrStatus === "error") && (
              <div className="flex size-48 flex-col items-center justify-center gap-2 rounded-xl border border-border/50 bg-background">
                <AlertCircleIcon className="size-6 text-muted-foreground/40" />
                <p className="text-[11px] text-muted-foreground/70">
                  {qrStatus === "expired" ? "QR code expired" : "Connection error"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => void handleRetry()}
                >
                  <RefreshCwIcon className="mr-1 size-3" />
                  Try again
                </Button>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground/60">
              {qrStatus === "loading" && "Generating QR code…"}
              {qrStatus === "scanning" &&
                "Waiting for scan — QR refreshes automatically"}
              {qrStatus === "expired" && "QR expired — click to retry"}
              {qrStatus === "error" && "Something went wrong"}
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => void handleCancel()}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Confirm */}
      {step === "confirm" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3.5 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Channel
              </span>
              <span className="text-[12px] font-medium text-foreground">
                WhatsApp
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                <span className="inline-block size-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-foreground">Connected</span>
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
              onClick={() => setStep("qr")}
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
