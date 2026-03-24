export interface StatusConfig {
  label: string;
  className: string;
  dotClassName: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  todo: {
    label: "TODO",
    className:
      "border-transparent bg-transparent text-muted-foreground font-mono text-[10px] uppercase tracking-wider px-0",
    dotClassName: "bg-muted-foreground/40",
  },
  doing: {
    label: "IN PROGRESS",
    className:
      "border-transparent bg-transparent text-primary font-mono text-[10px] uppercase tracking-wider px-0",
    dotClassName: "bg-primary",
  },
  pending: {
    label: "PENDING",
    className:
      "border-transparent bg-transparent text-warning font-mono text-[10px] uppercase tracking-wider px-0 dark:text-yellow-400",
    dotClassName: "bg-warning dark:bg-yellow-400",
  },
  blocked: {
    label: "BLOCKED",
    className:
      "border-transparent bg-transparent text-destructive font-mono text-[10px] uppercase tracking-wider px-0 dark:text-red-400",
    dotClassName: "bg-destructive dark:bg-red-400",
  },
  done: {
    label: "DONE",
    className:
      "border-transparent bg-transparent text-success font-mono text-[10px] uppercase tracking-wider px-0 dark:text-green-400",
    dotClassName: "bg-success dark:bg-green-400",
  },
};

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_MAP[status] ?? { label: status, className: "font-mono text-[10px] uppercase tracking-wider", dotClassName: "bg-muted-foreground/40" };
}
