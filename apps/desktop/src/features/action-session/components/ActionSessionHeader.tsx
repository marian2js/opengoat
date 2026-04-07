import { ClockIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionSessionState } from "../types";

interface ActionSessionHeaderProps {
  actionTitle: string;
  state: ActionSessionState;
  startedAt: number;
}

const stateLabels: Record<ActionSessionState, string> = {
  starting: "Starting",
  working: "Working",
  "needs-input": "Needs input",
  "ready-to-review": "Ready to review",
  "saved-to-board": "Saved to Board",
  done: "Done",
};

const stateColors: Record<ActionSessionState, string> = {
  starting: "bg-primary/10 text-primary",
  working: "bg-primary/10 text-primary",
  "needs-input": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "ready-to-review": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "saved-to-board": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  done: "bg-muted text-muted-foreground",
};

function useElapsed(startedAt: number): string {
  const now = Date.now();
  const seconds = Math.floor((now - startedAt) / 1000);
  if (seconds < 60) return `${String(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes)}m ${String(remainingSeconds)}s`;
}

export function ActionSessionHeader({
  actionTitle,
  state,
  startedAt,
}: ActionSessionHeaderProps) {
  const elapsed = useElapsed(startedAt);
  const isActive = state === "starting" || state === "working";

  return (
    <div className="flex items-center justify-between border-b border-border/30 bg-card/30 px-5 py-3.5 dark:border-white/[0.04] dark:bg-white/[0.01]">
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex size-8 items-center justify-center rounded-lg shadow-sm ring-1",
          isActive
            ? "bg-primary/12 ring-primary/15 shadow-primary/10"
            : "bg-primary/8 ring-primary/10",
        )}>
          <ZapIcon className={cn("size-4 text-primary", isActive && "animate-pulse")} />
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-[16px] font-bold tracking-[-0.01em] text-foreground">
              {actionTitle}
            </h1>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
                stateColors[state],
              )}
            >
              {stateLabels[state]}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <ClockIcon className="size-2.5" />
            <span className="font-mono text-[10px] tabular-nums">{elapsed}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
