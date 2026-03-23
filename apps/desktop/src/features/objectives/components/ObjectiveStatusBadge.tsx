import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { dotClassName: string; badgeClassName: string }> = {
  active: {
    dotClassName: "bg-primary",
    badgeClassName: "bg-primary/10 text-primary border-transparent",
  },
  paused: {
    dotClassName: "bg-warning dark:bg-yellow-400",
    badgeClassName: "bg-warning/10 text-warning border-transparent dark:bg-yellow-900/20 dark:text-yellow-400",
  },
  completed: {
    dotClassName: "bg-success dark:bg-green-400",
    badgeClassName: "bg-success/10 text-success border-transparent dark:bg-green-900/20 dark:text-green-400",
  },
  abandoned: {
    dotClassName: "bg-destructive dark:bg-red-400",
    badgeClassName: "bg-destructive/10 text-destructive border-transparent dark:bg-red-900/20 dark:text-red-400",
  },
  draft: {
    dotClassName: "bg-muted-foreground/40",
    badgeClassName: "bg-muted/50 text-muted-foreground border-transparent",
  },
};

const DEFAULT_CONFIG = {
  dotClassName: "bg-muted-foreground/40",
  badgeClassName: "bg-muted text-muted-foreground border-transparent",
};

export function ObjectiveStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? DEFAULT_CONFIG;
  return (
    <Badge
      variant="outline"
      className={`font-mono text-[10px] uppercase tracking-wider ${config.badgeClassName}`}
    >
      <span className={`mr-1.5 inline-block size-1.5 rounded-full ${config.dotClassName}`} />
      {status}
    </Badge>
  );
}
