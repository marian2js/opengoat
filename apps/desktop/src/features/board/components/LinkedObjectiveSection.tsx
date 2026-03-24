import type { Objective } from "@opengoat/contracts";
import { TargetIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LinkedObjectiveSectionProps {
  objective: Objective | null;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  paused: "bg-warning/10 text-warning dark:bg-yellow-900/20 dark:text-yellow-400",
  completed: "bg-success/10 text-success dark:bg-green-900/20 dark:text-green-400",
  abandoned: "bg-destructive/10 text-destructive dark:bg-red-900/20 dark:text-red-400",
};

export function LinkedObjectiveSection({ objective }: LinkedObjectiveSectionProps) {
  if (!objective) return null;

  return (
    <div className="border-t border-border/40 py-3">
      <h4 className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
        Objective
      </h4>
      <div className="flex items-center gap-2">
        <TargetIcon className="size-3.5 shrink-0 text-primary/60" />
        <a
          href={`#objectives/${objective.objectiveId}`}
          className="truncate text-[13px] font-medium text-foreground transition-colors hover:text-primary"
        >
          {objective.title}
        </a>
        <Badge
          variant="outline"
          className={`shrink-0 border-transparent font-mono text-[10px] uppercase tracking-wider ${STATUS_STYLES[objective.status] ?? ""}`}
        >
          {objective.status}
        </Badge>
      </div>
    </div>
  );
}
