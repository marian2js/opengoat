import type { RunRecord } from "@opengoat/contracts";
import { PlayIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LinkedRunSectionProps {
  run: RunRecord | null;
}

const RUN_STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-primary/10 text-primary",
  waiting_review: "bg-warning/10 text-warning dark:bg-yellow-900/20 dark:text-yellow-400",
  blocked: "bg-destructive/10 text-destructive dark:bg-red-900/20 dark:text-red-400",
  completed: "bg-success/10 text-success dark:bg-green-900/20 dark:text-green-400",
  cancelled: "bg-muted text-muted-foreground",
};

export function LinkedRunSection({ run }: LinkedRunSectionProps) {
  return (
    <div className="border-t border-border/40 pt-4">
      <h4 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        Linked Run
      </h4>
      {!run ? (
        <p className="text-xs text-muted-foreground/60">No linked run</p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <PlayIcon className="size-3.5 shrink-0 text-primary/60" />
            <span className="text-sm font-medium text-foreground truncate">
              {run.title}
            </span>
            <Badge
              variant="outline"
              className={`shrink-0 border-transparent font-mono text-[10px] uppercase tracking-wider ${RUN_STATUS_STYLES[run.status] ?? ""}`}
            >
              {run.status.replace("_", " ")}
            </Badge>
          </div>
          <div className="flex items-center gap-3 pl-5.5 text-[11px] text-muted-foreground/60">
            {run.playbookId && (
              <span className="font-mono">
                {run.playbookId}
              </span>
            )}
            {run.phase && (
              <span className="inline-flex items-center rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">
                {run.phase}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
