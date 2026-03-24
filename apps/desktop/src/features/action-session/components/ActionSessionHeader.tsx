import { ClockIcon } from "lucide-react";
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

  return (
    <div className="flex items-center justify-between border-b border-border/30 px-5 py-3">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-lg font-bold tracking-tight text-foreground">
          {actionTitle}
        </h1>
        <span
          className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${stateColors[state]}`}
        >
          {stateLabels[state]}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground/60">
        <ClockIcon className="size-3" />
        <span className="font-mono text-[10px] tabular-nums">{elapsed}</span>
      </div>
    </div>
  );
}
