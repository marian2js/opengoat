import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleIcon,
  LoaderCircleIcon,
  RocketIcon,
  XCircleIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import {
  useBootstrapOrchestrator,
  type BootstrapStep,
  type BootstrapStepStatus,
} from "../hooks/useBootstrapOrchestrator";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BootstrapProgressProps {
  agentId: string;
  client: SidecarClient;
  projectUrl: string;
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Step icon
// ---------------------------------------------------------------------------

function StepIcon({ status }: { status: BootstrapStepStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle2Icon className="size-5 shrink-0 text-emerald-500" />;
    case "streaming":
    case "verifying":
      return <LoaderCircleIcon className="size-5 shrink-0 animate-spin text-primary" />;
    case "error":
      return <XCircleIcon className="size-5 shrink-0 text-destructive" />;
    case "pending":
    default:
      return <CircleIcon className="size-5 shrink-0 text-muted-foreground/40" />;
  }
}

// ---------------------------------------------------------------------------
// Streaming text panel
// ---------------------------------------------------------------------------

function StreamingPanel({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [text]);

  if (!text) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border/50 bg-muted/30 p-3 font-mono text-xs leading-relaxed text-muted-foreground"
    >
      <pre className="whitespace-pre-wrap break-words">{text}</pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single step row
// ---------------------------------------------------------------------------

function StepRow({
  step,
  isActive,
  isLast,
}: {
  step: BootstrapStep;
  isActive: boolean;
  isLast: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isCompleted = step.status === "completed";
  const hasText = step.streamedText.length > 0;

  // Auto-expand when active, auto-collapse when done
  useEffect(() => {
    if (isActive) {
      setIsExpanded(true);
    }
  }, [isActive]);

  const canToggle = hasText && !isActive;

  return (
    <div className="relative flex gap-3">
      {/* Vertical connector line */}
      {!isLast && (
        <div className="absolute left-[9px] top-7 h-[calc(100%-16px)] w-px bg-border/50" />
      )}

      {/* Icon */}
      <div className="relative z-10 mt-0.5">
        <StepIcon status={step.status} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-6">
        <button
          type="button"
          disabled={!canToggle}
          onClick={() => canToggle && setIsExpanded((prev) => !prev)}
          className={`flex items-center gap-1.5 text-sm font-medium ${
            isActive
              ? "text-foreground"
              : isCompleted
                ? "text-muted-foreground"
                : "text-muted-foreground/50"
          } ${canToggle ? "cursor-pointer hover:text-foreground" : ""}`}
        >
          {step.label}
          {step.status === "verifying" && (
            <span className="text-xs font-normal text-muted-foreground/60">
              — verifying...
            </span>
          )}
          {canToggle && (
            <ChevronDownIcon
              className={`size-3.5 text-muted-foreground/40 transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          )}
        </button>

        {step.error && (
          <p className="mt-1 text-xs text-destructive">{step.error}</p>
        )}

        {isExpanded && hasText && (
          <StreamingPanel text={step.streamedText} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BootstrapProgress({
  agentId,
  client,
  projectUrl,
  onComplete,
}: BootstrapProgressProps) {
  const { state, start, retry } = useBootstrapOrchestrator(client);
  const startedRef = useRef(false);

  // Kick off the bootstrap on mount
  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    void start(agentId, projectUrl);
  }, [agentId, projectUrl, start]);

  const isLoading = state.status === "idle" || state.status === "loading-prompts";
  const isRunning = state.status === "running";
  const isComplete = state.status === "completed";
  const isError = state.status === "error";

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
            {isComplete ? (
              <CheckCircle2Icon className="size-6 text-emerald-500" />
            ) : (
              <RocketIcon className="size-6 text-primary" />
            )}
          </div>

          <h2 className="text-lg font-semibold tracking-tight">
            {isComplete ? "Your project is ready" : "Setting up your project"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isComplete
              ? "Your CMO agent has analyzed your product, market, and growth opportunities."
              : isError
                ? "Something went wrong during setup. You can retry to continue."
                : "Your CMO agent is analyzing your website to build a marketing strategy."}
          </p>
        </div>

        {/* Loading state before steps are available */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2.5 py-8">
            <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Preparing bootstrap prompts...</p>
          </div>
        )}

        {/* Steps */}
        {state.steps.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-card p-5">
            {state.steps.map((step, index) => (
              <StepRow
                key={step.id}
                step={step}
                isActive={isRunning && state.currentStepIndex === index}
                isLast={index === state.steps.length - 1}
              />
            ))}
          </div>
        )}

        {/* Error banner */}
        {isError && state.error && (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
            <p className="text-sm text-destructive">{state.error}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 flex justify-center">
          {isComplete && (
            <button
              type="button"
              onClick={onComplete}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start chatting
            </button>
          )}

          {isError && (
            <button
              type="button"
              onClick={() => void retry()}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
