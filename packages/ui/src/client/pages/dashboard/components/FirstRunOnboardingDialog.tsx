import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, RefreshCcw, Wrench } from "lucide-react";
import type { ReactElement } from "react";

export interface OpenClawOnboardingGatewayStatus {
  command: string;
  installCommand: string;
  startCommand: string;
  installed: boolean;
  gatewayRunning: boolean;
  version: string | null;
  diagnostics: string | null;
  checkedAt: string;
}

interface FirstRunOnboardingDialogProps {
  open: boolean;
  status: OpenClawOnboardingGatewayStatus | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onDismiss: () => void;
}

export function FirstRunOnboardingDialog({
  open,
  status,
  isLoading,
  error,
  onRefresh,
  onDismiss,
}: FirstRunOnboardingDialogProps): ReactElement {
  const statusTone = resolveStatusTone(status);
  const statusLabel = resolveStatusLabel(status);
  const statusSummary = resolveStatusSummary(status);
  const checkedAtLabel =
    status?.checkedAt && !Number.isNaN(Date.parse(status.checkedAt))
      ? new Date(status.checkedAt).toLocaleTimeString()
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onDismiss();
        }
      }}
    >
      <DialogContent className="max-w-2xl overflow-hidden border-border/80 p-0">
        <DialogHeader className="relative border-border/70 border-b bg-gradient-to-br from-emerald-500/20 via-background to-background px-6 py-5 text-left sm:text-left">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.2),transparent_55%)]" />
          <div className="relative space-y-2">
            <Badge variant="secondary" className="w-fit">
              First-time setup
            </Badge>
            <DialogTitle className="text-2xl leading-tight tracking-tight">
              Welcome to OpenGoat
            </DialogTitle>
            <DialogDescription className="max-w-xl text-muted-foreground">
              Before you start, let&apos;s quickly verify OpenClaw on this
              machine.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <section
            className={cn(
              "rounded-xl border px-4 py-4",
              statusTone === "success" &&
                "border-success/45 bg-success/10 text-success-foreground",
              statusTone === "warning" &&
                "border-amber-500/45 bg-amber-500/10 text-amber-100",
              statusTone === "danger" &&
                "border-danger/45 bg-danger/10 text-red-100",
              statusTone === "neutral" &&
                "border-border/70 bg-background/40 text-foreground",
            )}
          >
            <div className="flex items-start gap-3">
              {statusTone === "success" ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
              ) : statusTone === "neutral" ? (
                <Wrench className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              ) : (
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              )}
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-base">{statusLabel}</p>
                <p className="text-sm text-inherit/90">{statusSummary}</p>
                {checkedAtLabel ? (
                  <p className="text-xs text-inherit/70">
                    Last checked at {checkedAtLabel}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          {isLoading ? (
            <section className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/30 px-4 py-3 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              <span>Checking local OpenClaw status…</span>
            </section>
          ) : null}

          {error ? (
            <section className="rounded-xl border border-danger/45 bg-danger/10 px-4 py-3 text-sm text-red-100">
              {error}
            </section>
          ) : null}

          {!isLoading && status && !status.installed ? (
            <SetupCommandPanel
              title="OpenClaw is required"
              description="Install OpenClaw CLI first, then click Re-check."
              command={status.installCommand}
            />
          ) : null}

          {!isLoading && status?.installed && !status.gatewayRunning ? (
            <SetupCommandPanel
              title="Start the OpenClaw gateway"
              description="OpenClaw is installed but the gateway is not running."
              command={status.startCommand}
            />
          ) : null}
        </div>

        <DialogFooter className="border-border/70 border-t px-6 py-4 sm:justify-between sm:space-x-0">
          <Button variant="ghost" onClick={onDismiss}>
            Continue later
          </Button>
          <Button variant="secondary" onClick={onRefresh}>
            <RefreshCcw className="size-4" />
            Re-check
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetupCommandPanel({
  title,
  description,
  command,
}: {
  title: string;
  description: string;
  command: string;
}): ReactElement {
  return (
    <section className="rounded-xl border border-border/70 bg-background/35 px-4 py-4">
      <p className="font-medium text-sm text-foreground">{title}</p>
      <p className="mt-1 text-muted-foreground text-xs">{description}</p>
      <pre className="mt-3 overflow-x-auto rounded-md border border-border/70 bg-black/20 px-3 py-2 text-[12px] text-foreground">
        <code>{command}</code>
      </pre>
    </section>
  );
}

function resolveStatusTone(
  status: OpenClawOnboardingGatewayStatus | null,
): "success" | "warning" | "danger" | "neutral" {
  if (!status) {
    return "neutral";
  }
  if (!status.installed) {
    return "danger";
  }
  if (!status.gatewayRunning) {
    return "warning";
  }
  return "success";
}

function resolveStatusLabel(
  status: OpenClawOnboardingGatewayStatus | null,
): string {
  if (!status) {
    return "Checking OpenClaw";
  }
  if (!status.installed) {
    return "OpenClaw CLI not found";
  }
  if (!status.gatewayRunning) {
    return "Gateway is not running";
  }
  return "Gateway ready";
}

function resolveStatusSummary(
  status: OpenClawOnboardingGatewayStatus | null,
): string {
  if (!status) {
    return "Verifying OpenClaw installation and local gateway status.";
  }
  if (status.diagnostics?.trim()) {
    return status.diagnostics.trim();
  }
  if (!status.installed) {
    return "Install OpenClaw to continue with OpenGoat.";
  }
  if (!status.gatewayRunning) {
    return "OpenClaw is installed, but the local gateway is not listening.";
  }
  const versionLabel = status.version ? ` (v${status.version})` : "";
  return `OpenClaw${versionLabel} is installed and the local gateway is running.`;
}
