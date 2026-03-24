import { LoaderCircleIcon } from "lucide-react";
import type { ActionSessionState } from "../types";

interface ActionSessionProgressProps {
  state: ActionSessionState;
  hasOutputs: boolean;
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
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="relative flex size-5 items-center justify-center">
          <span className="absolute size-5 animate-ping rounded-full bg-primary/20" />
          <span className="relative size-2.5 rounded-full bg-primary" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            Analyzing your company and preparing outputs…
          </p>
          <p className="text-xs text-muted-foreground">
            First output in ~30–90s
          </p>
        </div>
      </div>
    );
  }

  if (state === "working") {
    return (
      <div className="flex items-center gap-3 px-5 py-3">
        <LoaderCircleIcon className="size-4 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {hasOutputs ? "Generating more outputs…" : "Working on your request…"}
        </p>
      </div>
    );
  }

  if (state === "needs-input") {
    return (
      <div className="flex items-center gap-3 px-5 py-3">
        <span className="size-2 rounded-full bg-amber-500" />
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Waiting for your input to continue
        </p>
      </div>
    );
  }

  return null;
}
