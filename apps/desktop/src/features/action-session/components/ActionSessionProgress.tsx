import { LoaderCircleIcon, PauseCircleIcon } from "lucide-react";
import type { ActionSessionState } from "../types";

interface ActionSessionProgressProps {
  state: ActionSessionState;
  hasOutputs: boolean;
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
}: ActionSessionProgressProps) {
  if (state === "ready-to-review" || state === "saved-to-board" || state === "done") {
    return null;
  }

  if (state === "starting") {
    return (
      <div className="space-y-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex size-5 items-center justify-center">
            <span className="absolute size-5 animate-ping rounded-full bg-primary/20" />
            <span className="relative size-2.5 rounded-full bg-primary" />
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              Analyzing your company and preparing outputs…
            </p>
            <p className="text-xs text-muted-foreground">
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
      <div className="space-y-2.5 px-5 py-3">
        <div className="flex items-center gap-3">
          <LoaderCircleIcon className="size-4 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {hasOutputs ? "Generating more outputs…" : "Working on your request…"}
          </p>
        </div>
        <ProgressBar />
      </div>
    );
  }

  if (state === "needs-input") {
    return (
      <div className="space-y-2.5 px-5 py-3">
        <div className="flex items-center gap-3">
          <PauseCircleIcon className="size-4 text-amber-500" />
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            Waiting for your input to continue
          </p>
        </div>
        <ProgressBar variant="amber" />
      </div>
    );
  }

  return null;
}
