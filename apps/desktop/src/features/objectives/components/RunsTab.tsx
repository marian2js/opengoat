import { PlayIcon } from "lucide-react";
import type { RunRecord } from "@opengoat/contracts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SidecarClient } from "@/lib/sidecar/client";
import { useObjectiveRuns } from "@/features/objectives/hooks/useObjectiveRuns";
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";

const RUN_STATUS_STYLES: Record<string, { dot: string; badge: string }> = {
  running: {
    dot: "bg-primary animate-pulse",
    badge: "bg-primary/10 text-primary border-transparent",
  },
  waiting_review: {
    dot: "bg-amber-500 dark:bg-amber-400",
    badge: "bg-amber-500/10 text-amber-600 border-transparent dark:bg-amber-900/20 dark:text-amber-400",
  },
  blocked: {
    dot: "bg-destructive dark:bg-red-400",
    badge: "bg-destructive/10 text-destructive border-transparent dark:bg-red-900/20 dark:text-red-400",
  },
  completed: {
    dot: "bg-success dark:bg-green-400",
    badge: "bg-success/10 text-success border-transparent dark:bg-green-900/20 dark:text-green-400",
  },
  cancelled: {
    dot: "bg-muted-foreground/40",
    badge: "bg-muted/50 text-muted-foreground border-transparent",
  },
  draft: {
    dot: "bg-muted-foreground/40",
    badge: "bg-muted/50 text-muted-foreground border-transparent",
  },
};

const DEFAULT_STYLE = {
  dot: "bg-muted-foreground/40",
  badge: "bg-muted text-muted-foreground border-transparent",
};

function RunStatusBadge({ status }: { status: string }) {
  const style = RUN_STATUS_STYLES[status] ?? DEFAULT_STYLE;
  return (
    <Badge
      variant="outline"
      className={`font-mono text-[10px] uppercase tracking-wider ${style.badge}`}
    >
      <span className={`mr-1.5 inline-block size-1.5 rounded-full ${style.dot}`} />
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export interface RunsTabProps {
  objectiveId: string;
  client: SidecarClient;
  onResumeRun?: (sessionId: string) => void;
}

export function RunsTab({ objectiveId, client, onResumeRun }: RunsTabProps) {
  const { runs, isLoading, error, refresh } = useObjectiveRuns(objectiveId, client);

  if (isLoading) {
    return (
      <div className="space-y-3 py-5">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          Retry
        </Button>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <p className="text-sm text-muted-foreground">
          No runs yet — start a playbook to create one
        </p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="overflow-hidden rounded-lg border border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/50 bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[35%]">Title</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Playbook</TableHead>
              <TableHead className="w-[100px]">Updated</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run: RunRecord) => (
              <TableRow
                key={run.runId}
                className="transition-colors hover:bg-primary/[0.03]"
              >
                <TableCell className="max-w-[280px] truncate text-[13px] font-medium text-foreground/90">
                  {run.title}
                </TableCell>
                <TableCell>
                  <RunStatusBadge status={run.status} />
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {run.phase || "\u2014"}
                </TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground/70">
                  {run.playbookId || "\u2014"}
                </TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground/70 tabular-nums">
                  {formatRelativeTime(run.updatedAt)}
                </TableCell>
                <TableCell>
                  {run.sessionId && onResumeRun ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-primary"
                      onClick={() => onResumeRun(run.sessionId!)}
                    >
                      <PlayIcon className="size-3" />
                      Resume
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
