export interface StatusConfig {
  label: string;
  className: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  todo: {
    label: "To Do",
    className: "bg-muted text-muted-foreground border-transparent",
  },
  doing: {
    label: "Doing",
    className:
      "bg-blue-100 text-blue-700 border-transparent dark:bg-blue-900/30 dark:text-blue-400",
  },
  pending: {
    label: "Pending",
    className:
      "bg-yellow-100 text-yellow-700 border-transparent dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  blocked: {
    label: "Blocked",
    className:
      "bg-red-100 text-red-700 border-transparent dark:bg-red-900/30 dark:text-red-400",
  },
  done: {
    label: "Done",
    className:
      "bg-green-100 text-green-700 border-transparent dark:bg-green-900/30 dark:text-green-400",
  },
};

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_MAP[status] ?? { label: status, className: "" };
}
