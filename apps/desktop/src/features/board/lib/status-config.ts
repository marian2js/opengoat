export interface StatusConfig {
  label: string;
  className: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  todo: {
    label: "TODO",
    className:
      "bg-muted text-muted-foreground border-transparent font-mono text-[10px] uppercase tracking-wider",
  },
  doing: {
    label: "IN PROGRESS",
    className:
      "bg-primary/10 text-primary border-transparent font-mono text-[10px] uppercase tracking-wider",
  },
  pending: {
    label: "PENDING",
    className:
      "bg-warning/10 text-warning border-transparent font-mono text-[10px] uppercase tracking-wider dark:bg-yellow-900/20 dark:text-yellow-400",
  },
  blocked: {
    label: "BLOCKED",
    className:
      "bg-destructive/10 text-destructive border-transparent font-mono text-[10px] uppercase tracking-wider dark:bg-red-900/20 dark:text-red-400",
  },
  done: {
    label: "DONE",
    className:
      "bg-success/10 text-success border-transparent font-mono text-[10px] uppercase tracking-wider dark:bg-green-900/20 dark:text-green-400",
  },
};

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_MAP[status] ?? { label: status, className: "font-mono text-[10px] uppercase tracking-wider" };
}
