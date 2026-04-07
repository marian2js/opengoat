import { LoaderCircleIcon, PauseCircleIcon } from "lucide-react";
import type { ActionSessionState } from "../types";

interface ActionSessionProgressProps {
  state: ActionSessionState;
  hasOutputs: boolean;
  outputCount?: number;
  /** Output promise text from the job card, e.g. "Tagline, one-liner, launch post draft, checklist" */
  actionPromise?: string | undefined;
  /** Short deliverable label from the job card, e.g. "Launch copy bundle" */
  actionOutputType?: string | undefined;
}

/** Indeterminate progress bar with shimmer animation */
function ProgressBar({ variant = "primary" }: { variant?: "primary" | "amber" }) {
  const bgClass = variant === "amber"
    ? "bg-amber-500/15 dark:bg-amber-500/10"
    : "bg-primary/10";
  const barClass = variant === "amber"
    ? "bg-amber-500/60"
    : "bg-primary/50";

  return (
    <div className={`h-1 w-full overflow-hidden rounded-full ${bgClass}`}>
      <div
        className={`h-full w-1/3 rounded-full ${barClass}`}
        style={{
          animation: "progress-shimmer 1.5s ease-in-out infinite",
        }}
      />
      <style>{`
        @keyframes progress-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}

export function ActionSessionProgress({
  state,
  hasOutputs,
  outputCount = 0,
  actionPromise,
  actionOutputType,
}: ActionSessionProgressProps) {
  if (state === "ready-to-review" || state === "saved-to-board" || state === "done") {
    return null;
  }

  if (state === "starting") {
    return (
      <div className="mx-5 mt-4 space-y-3 rounded-xl border border-border/30 bg-card/50 p-4 dark:border-white/[0.04] dark:bg-white/[0.015]">
        <div className="flex items-center gap-3">
          <div className="relative flex size-6 items-center justify-center">
            <span className="absolute size-6 animate-ping rounded-full bg-primary/15" />
            <span className="relative size-3 rounded-full bg-primary shadow-sm shadow-primary/30" />
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-[14px] font-medium text-foreground">
              {actionOutputType
                ? `Preparing your ${actionOutputType.toLowerCase()}…`
                : "Analyzing your company and preparing outputs…"}
            </p>
            {actionPromise && (
              <p className="text-[12px] leading-relaxed text-muted-foreground/60">
                {actionPromise}
              </p>
            )}
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50">
              First output in ~30–90s
            </p>
          </div>
        </div>
        <ProgressBar />
      </div>
    );
  }

  if (state === "working") {
    return (
      <div className="mx-5 space-y-2.5 rounded-xl border border-primary/15 bg-primary/[0.03] p-4 dark:border-primary/10 dark:bg-primary/[0.02]">
        <div className="flex items-center gap-3">
          <LoaderCircleIcon className="size-4 animate-spin text-primary" />
          <p className="text-[13px] font-medium text-foreground/80">
            {hasOutputs ? "Generating more outputs…" : "Working on your request…"}
          </p>
          {outputCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-primary ring-1 ring-primary/10">
              {outputCount} generated
            </span>
          )}
        </div>
        <ProgressBar />
      </div>
    );
  }

  if (state === "needs-input") {
    return (
      <div className="mx-5 space-y-2.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4 dark:border-amber-500/10 dark:bg-amber-500/[0.02]">
        <div className="flex items-center gap-3">
          <PauseCircleIcon className="size-4 text-amber-500" />
          <p className="text-[13px] font-medium text-amber-600 dark:text-amber-400">
            Waiting for your input to continue
          </p>
        </div>
        <ProgressBar variant="amber" />
      </div>
    );
  }

  return null;
}
