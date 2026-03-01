import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  RefreshCcw,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import opengoatLogo from "../../../../../../assets/opengoat.png";
import {
  fetchJson,
  loadOnboardingPayload,
  saveOnboardingPayload,
  type OnboardingPayload,
} from "./shared";

interface OpenClawOnboardingGatewayStatus {
  command: string;
  installCommand: string;
  startCommand: string;
  installed: boolean;
  gatewayRunning: boolean;
  version: string | null;
  diagnostics: string | null;
  checkedAt: string;
}

interface OpenClawOnboardingResponse {
  onboarding: {
    gateway: OpenClawOnboardingGatewayStatus;
  };
}

interface ExecutionAgentOption {
  id: string;
  displayName: string;
  commandCandidates: string[];
  installHint: string;
}

interface ExecutionAgentReadiness extends ExecutionAgentOption {
  installed: boolean;
  checkedCommand: string | null;
  diagnostics: string | null;
  checkedAt: string;
}

interface ExecutionAgentOptionsResponse {
  executionAgents: ExecutionAgentOption[];
}

interface ExecutionAgentReadinessResponse {
  readiness: ExecutionAgentReadiness;
}

interface OnboardingExecutionAgentAssignmentResponse {
  agentId: string;
  providerId: string;
  message?: string;
}

export function OnboardConnectPage(): ReactElement {
  const [payload, setPayload] = useState<OnboardingPayload | null>(() =>
    loadOnboardingPayload(),
  );
  const [gatewayStatus, setGatewayStatus] =
    useState<OpenClawOnboardingGatewayStatus | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [executionAgents, setExecutionAgents] = useState<ExecutionAgentOption[]>(
    [],
  );
  const [executionAgentsLoading, setExecutionAgentsLoading] = useState(false);
  const [executionAgentsError, setExecutionAgentsError] = useState<string | null>(
    null,
  );
  const [selectedExecutionAgentId, setSelectedExecutionAgentId] = useState(
    payload?.executionProviderId ?? "",
  );
  const [readinessByProviderId, setReadinessByProviderId] = useState<
    Record<string, ExecutionAgentReadiness>
  >({});
  const [readinessLoadingProviderId, setReadinessLoadingProviderId] = useState<
    string | null
  >(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [continueLoading, setContinueLoading] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);

  const refreshGatewayStatus = useCallback(async (): Promise<void> => {
    setGatewayLoading(true);
    setGatewayError(null);
    try {
      const response = await fetchJson<OpenClawOnboardingResponse>(
        "/api/openclaw/onboarding",
      );
      setGatewayStatus(response.onboarding.gateway);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to check OpenClaw setup status.";
      setGatewayError(message);
      setGatewayStatus(null);
    } finally {
      setGatewayLoading(false);
    }
  }, []);

  const loadExecutionAgentOptions = useCallback(async (): Promise<void> => {
    setExecutionAgentsLoading(true);
    setExecutionAgentsError(null);
    try {
      const response = await fetchJson<ExecutionAgentOptionsResponse>(
        "/api/openclaw/execution-agents",
      );
      setExecutionAgents(response.executionAgents);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to load execution agent options.";
      setExecutionAgentsError(message);
      setExecutionAgents([]);
    } finally {
      setExecutionAgentsLoading(false);
    }
  }, []);

  const checkExecutionAgentReadiness = useCallback(
    async (providerId: string): Promise<void> => {
      if (!providerId.trim()) {
        return;
      }
      setReadinessLoadingProviderId(providerId);
      setReadinessError(null);
      try {
        const response = await fetchJson<ExecutionAgentReadinessResponse>(
          `/api/openclaw/execution-agents/${encodeURIComponent(providerId)}/readiness`,
        );
        setReadinessByProviderId((current) => ({
          ...current,
          [providerId]: response.readiness,
        }));
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unable to verify execution agent installation.";
        setReadinessError(message);
      } finally {
        setReadinessLoadingProviderId((current) =>
          current === providerId ? null : current,
        );
      }
    },
    [],
  );

  useEffect(() => {
    if (!payload) {
      window.location.assign("/onboard");
      return;
    }
    void Promise.all([refreshGatewayStatus(), loadExecutionAgentOptions()]);
  }, [loadExecutionAgentOptions, payload, refreshGatewayStatus]);

  useEffect(() => {
    if (!payload) {
      return;
    }

    const normalizedExecutionAgentId = selectedExecutionAgentId.trim().toLowerCase();
    const currentExecutionAgentId = payload.executionProviderId?.trim().toLowerCase() ?? "";
    if (currentExecutionAgentId === normalizedExecutionAgentId) {
      return;
    }

    const nextPayload: OnboardingPayload = {
      ...payload,
      ...(normalizedExecutionAgentId
        ? {
            executionProviderId: normalizedExecutionAgentId,
          }
        : {}),
    };
    if (!normalizedExecutionAgentId) {
      delete nextPayload.executionProviderId;
    }
    saveOnboardingPayload(nextPayload);
    setPayload(nextPayload);
  }, [payload, selectedExecutionAgentId]);

  useEffect(() => {
    if (!selectedExecutionAgentId || readinessByProviderId[selectedExecutionAgentId]) {
      return;
    }
    void checkExecutionAgentReadiness(selectedExecutionAgentId);
  }, [checkExecutionAgentReadiness, readinessByProviderId, selectedExecutionAgentId]);

  const selectedExecutionAgent = useMemo(() => {
    return executionAgents.find((agent) => agent.id === selectedExecutionAgentId);
  }, [executionAgents, selectedExecutionAgentId]);
  const selectedReadiness = selectedExecutionAgentId
    ? readinessByProviderId[selectedExecutionAgentId]
    : null;
  const isGatewayReady =
    gatewayStatus?.installed === true && gatewayStatus.gatewayRunning === true;
  const canContinue =
    isGatewayReady &&
    selectedReadiness?.installed === true &&
    !gatewayLoading &&
    !continueLoading;

  async function handleContinueToChat(): Promise<void> {
    if (!canContinue) {
      return;
    }
    if (!selectedExecutionAgentId.trim()) {
      setContinueError("Select a code execution agent before continuing.");
      return;
    }
    setContinueLoading(true);
    setContinueError(null);
    try {
      await fetchJson<OnboardingExecutionAgentAssignmentResponse>(
        "/api/openclaw/onboarding/execution-agent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            providerId: selectedExecutionAgentId,
          }),
        },
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to save the selected execution agent.";
      setContinueError(message);
      setContinueLoading(false);
      return;
    }
    window.location.assign("/onboard/chat");
  }

  function handleSelectExecutionAgent(providerId: string): void {
    setSelectedExecutionAgentId(providerId);
    setContinueError(null);
  }

  return (
    <main
      className="opengoat-onboard-shell relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_-10%,rgba(83,181,255,0.24),transparent_46%),radial-gradient(circle_at_88%_18%,rgba(34,211,238,0.14),transparent_36%),linear-gradient(155deg,#05070f_0%,#0a1224_48%,#06080f_100%)] text-foreground"
      style={{
        fontFamily: '"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif',
      }}
    >
      <div className="-left-20 absolute top-16 size-80 rounded-full bg-cyan-300/14 blur-3xl" />
      <div className="absolute bottom-8 right-2 size-72 rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(circle_at_center,black_34%,transparent_86%)] opacity-35" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
        <section className="opengoat-onboard-hero-card rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.03)_44%,rgba(255,255,255,0.01)_100%)] p-6 shadow-[0_30px_90px_rgba(2,6,23,0.58)] backdrop-blur-xl sm:p-8">
          <Badge variant="secondary" className="w-fit border-white/15 bg-white/10">
            Onboarding · Step 2 of 3
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Connect your runtime
          </h1>
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.03] px-3 py-2.5 sm:gap-4 sm:px-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-xl bg-sky-300/30 blur-md" />
              <img
                src={opengoatLogo}
                alt="OpenGoat logo"
                className="relative size-12 rounded-full shadow-[0_10px_24px_rgba(30,144,255,0.28)] sm:size-14"
              />
            </div>
            <p className="text-lg font-medium text-slate-100 sm:text-xl">
              Let&apos;s verify OpenClaw and your code execution agent.
            </p>
          </div>
        </section>

        <section className="opengoat-onboard-flow mt-6 grid gap-5 rounded-[28px] border border-white/10 bg-[linear-gradient(175deg,rgba(10,14,27,0.92)_0%,rgba(7,11,22,0.86)_100%)] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.55)] backdrop-blur-xl sm:p-7 lg:grid-cols-[1.15fr_1fr]">
          <article className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-100 text-sm uppercase tracking-[0.22em]">
                  1. OpenClaw gateway
                </p>
                <p className="mt-1 text-slate-200/90 text-sm">
                  Confirm OpenClaw is installed and gateway is listening.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void refreshGatewayStatus();
                }}
                disabled={gatewayLoading}
              >
                <RefreshCcw className="size-4" />
                Re-check
              </Button>
            </div>

            <GatewayStatusPanel
              status={gatewayStatus}
              loading={gatewayLoading}
              error={gatewayError}
            />
          </article>

          <article className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div>
              <p className="font-medium text-slate-100 text-sm uppercase tracking-[0.22em]">
                2. Code execution agent
              </p>
              <p className="mt-1 text-slate-200/90 text-sm">
                Pick the provider you want OpenGoat to use for coding tasks.
              </p>
            </div>

            {executionAgentsLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-white/12 bg-black/20 px-3 py-3 text-muted-foreground text-sm">
                <Spinner className="size-4" />
                <span>Loading execution agent options…</span>
              </div>
            ) : null}

            {executionAgentsError ? (
              <div className="rounded-xl border border-danger/45 bg-danger/10 px-3 py-2.5 text-red-100 text-sm">
                {executionAgentsError}
              </div>
            ) : null}

            {!executionAgentsLoading && executionAgents.length === 0 ? (
              <div className="rounded-xl border border-amber-400/45 bg-amber-400/10 px-3 py-2.5 text-amber-100 text-sm">
                No execution providers are available yet. Configure at least one
                provider to continue.
              </div>
            ) : null}

            <div className="grid gap-2.5 sm:grid-cols-2">
              {executionAgents.map((executionAgent) => (
                <button
                  key={executionAgent.id}
                  type="button"
                  onClick={() => handleSelectExecutionAgent(executionAgent.id)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition-colors",
                    selectedExecutionAgentId === executionAgent.id
                      ? "border-cyan-300/55 bg-cyan-300/12"
                      : "border-white/12 bg-black/20 hover:border-slate-300/35 hover:bg-white/[0.06]",
                  )}
                >
                  <p className="font-medium text-slate-100 text-sm">
                    {executionAgent.displayName}
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    CLI: {executionAgent.commandCandidates.join(" / ")}
                  </p>
                </button>
              ))}
            </div>

            <ExecutionAgentReadinessPanel
              selectedExecutionAgent={selectedExecutionAgent}
              selectedReadiness={selectedReadiness ?? null}
              loadingProviderId={readinessLoadingProviderId}
              readinessError={readinessError}
              onRecheck={() => {
                if (!selectedExecutionAgentId) {
                  return;
                }
                void checkExecutionAgentReadiness(selectedExecutionAgentId);
              }}
            />
          </article>

          <div className="col-span-full mt-2 flex flex-col gap-3 border-white/10 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                window.location.assign("/onboard");
              }}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button
              onClick={() => {
                void handleContinueToChat();
              }}
              disabled={!canContinue}
              className="h-11 rounded-xl border border-sky-300/35 bg-[linear-gradient(90deg,#53b5ff_0%,#4b9eff_45%,#5ecdd5_100%)] font-semibold text-[#021228] hover:brightness-110"
            >
              {continueLoading ? (
                <>
                  <Spinner className="size-4" />
                  Saving setup…
                </>
              ) : (
                "Continue to roadmap chat"
              )}
              <ArrowRight className="size-4" />
            </Button>
          </div>
          {continueError ? (
            <div className="col-span-full rounded-xl border border-danger/45 bg-danger/10 px-3 py-2 text-red-100 text-sm">
              {continueError}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function GatewayStatusPanel({
  status,
  loading,
  error,
}: {
  status: OpenClawOnboardingGatewayStatus | null;
  loading: boolean;
  error: string | null;
}): ReactElement {
  const tone = resolveGatewayStatusTone(status);
  const label = resolveGatewayStatusLabel(status);
  const summary = resolveGatewayStatusSummary(status);
  const checkedAtLabel =
    status?.checkedAt && !Number.isNaN(Date.parse(status.checkedAt))
      ? new Date(status.checkedAt).toLocaleTimeString()
      : null;

  return (
    <div className="space-y-3">
      <section
        className={cn(
          "rounded-xl border px-3 py-3",
          tone === "success" && "border-success/45 bg-success/10 text-success-foreground",
          tone === "warning" && "border-amber-500/45 bg-amber-500/10 text-amber-100",
          tone === "danger" && "border-danger/45 bg-danger/10 text-red-100",
          tone === "neutral" && "border-white/12 bg-black/20 text-foreground",
        )}
      >
        <div className="flex items-start gap-2.5">
          {tone === "success" ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
          ) : tone === "neutral" ? (
            <Wrench className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          ) : (
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          )}
          <div>
            <p className="font-semibold text-sm">{label}</p>
            <p className="mt-1 text-inherit/90 text-xs">{summary}</p>
            {checkedAtLabel ? (
              <p className="mt-1 text-inherit/70 text-xs">
                Last checked at {checkedAtLabel}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {loading ? (
        <section className="flex items-center gap-2 rounded-xl border border-white/12 bg-black/20 px-3 py-3 text-muted-foreground text-sm">
          <Spinner className="size-4" />
          <span>Checking local OpenClaw status…</span>
        </section>
      ) : null}

      {error ? (
        <section className="rounded-xl border border-danger/45 bg-danger/10 px-3 py-3 text-red-100 text-sm">
          {error}
        </section>
      ) : null}

      {!loading && status && !status.installed ? (
        <SetupCommandPanel
          title="Install OpenClaw"
          description="OpenClaw CLI is required before continuing."
          command={status.installCommand}
        />
      ) : null}

      {!loading && status?.installed && !status.gatewayRunning ? (
        <SetupCommandPanel
          title="Start OpenClaw gateway"
          description="OpenClaw is installed but gateway is not running."
          command={status.startCommand}
        />
      ) : null}
    </div>
  );
}

function ExecutionAgentReadinessPanel({
  selectedExecutionAgent,
  selectedReadiness,
  loadingProviderId,
  readinessError,
  onRecheck,
}: {
  selectedExecutionAgent: ExecutionAgentOption | undefined;
  selectedReadiness: ExecutionAgentReadiness | null;
  loadingProviderId: string | null;
  readinessError: string | null;
  onRecheck: () => void;
}): ReactElement {
  if (!selectedExecutionAgent) {
    return (
      <div className="rounded-xl border border-white/12 bg-black/20 px-3 py-3 text-muted-foreground text-sm">
        Select a provider to verify CLI installation.
      </div>
    );
  }

  const isChecking = loadingProviderId === selectedExecutionAgent.id;
  if (isChecking) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/12 bg-black/20 px-3 py-3 text-muted-foreground text-sm">
        <Spinner className="size-4" />
        <span>Checking {selectedExecutionAgent.displayName} CLI…</span>
      </div>
    );
  }

  if (readinessError) {
    return (
      <div className="space-y-2 rounded-xl border border-danger/45 bg-danger/10 px-3 py-3">
        <p className="text-red-100 text-sm">{readinessError}</p>
        <Button variant="secondary" size="sm" onClick={onRecheck}>
          <RefreshCcw className="size-4" />
          Re-check
        </Button>
      </div>
    );
  }

  if (!selectedReadiness) {
    return (
      <div className="rounded-xl border border-white/12 bg-black/20 px-3 py-3 text-muted-foreground text-sm">
        Select this provider to run a CLI check.
      </div>
    );
  }

  if (selectedReadiness.installed) {
    const executionAgentCliLabel = formatExecutionAgentCliLabel(
      selectedExecutionAgent.displayName,
    );
    const checkedAtLabel = !Number.isNaN(Date.parse(selectedReadiness.checkedAt))
      ? new Date(selectedReadiness.checkedAt).toLocaleTimeString()
      : null;
    return (
      <div className="space-y-2 rounded-xl border border-success/45 bg-success/10 px-3 py-3 text-success-foreground">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          <div>
            <p className="font-medium text-sm">
              {executionAgentCliLabel} detected
            </p>
            <p className="text-xs text-success-foreground/85">
              Command: <code>{selectedReadiness.checkedCommand ?? "Detected"}</code>
            </p>
            {checkedAtLabel ? (
              <p className="text-xs text-success-foreground/75">
                Verified at {checkedAtLabel}
              </p>
            ) : null}
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onRecheck}>
          <RefreshCcw className="size-4" />
          Re-check
        </Button>
      </div>
    );
  }

  const executionAgentCliLabel = formatExecutionAgentCliLabel(
    selectedExecutionAgent.displayName,
  );
  return (
    <div className="space-y-2 rounded-xl border border-amber-500/45 bg-amber-500/10 px-3 py-3 text-amber-100">
      <div className="flex items-start gap-2">
        <Cpu className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium text-sm">
            {executionAgentCliLabel} not detected
          </p>
          <p className="text-xs text-amber-100/90">
            {selectedReadiness.diagnostics ||
              "CLI command was not found in your PATH."}
          </p>
        </div>
      </div>
      <p className="text-xs text-amber-100/90">{selectedExecutionAgent.installHint}</p>
      <Button variant="secondary" size="sm" onClick={onRecheck}>
        <RefreshCcw className="size-4" />
        Re-check
      </Button>
    </div>
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
    <section className="rounded-xl border border-white/12 bg-black/20 px-3 py-3">
      <p className="font-medium text-foreground text-sm">{title}</p>
      <p className="mt-1 text-muted-foreground text-xs">{description}</p>
      <pre className="mt-2 overflow-x-auto rounded-md border border-white/12 bg-black/35 px-2.5 py-2 text-[12px] text-slate-100">
        <code>{command}</code>
      </pre>
    </section>
  );
}

function resolveGatewayStatusTone(
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

function resolveGatewayStatusLabel(
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

function resolveGatewayStatusSummary(
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

function formatExecutionAgentCliLabel(displayName: string): string {
  const normalized = displayName.trim();
  if (!normalized) {
    return "CLI";
  }

  if (/\bcli$/iu.test(normalized)) {
    return normalized;
  }

  return `${normalized} CLI`;
}
