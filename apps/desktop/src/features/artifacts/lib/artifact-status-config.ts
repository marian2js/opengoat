import type { StatusConfig } from "@/features/board/lib/status-config";

const ARTIFACT_STATUS_MAP: Record<string, StatusConfig> = {
  draft: {
    label: "DRAFT",
    className:
      "bg-muted text-muted-foreground border-transparent font-mono text-[10px] uppercase tracking-wider",
    dotClassName: "bg-muted-foreground/40",
  },
  ready_for_review: {
    label: "READY FOR REVIEW",
    className:
      "bg-primary/10 text-primary border-transparent font-mono text-[10px] uppercase tracking-wider",
    dotClassName: "bg-primary animate-pulse",
  },
  approved: {
    label: "APPROVED",
    className:
      "bg-success/10 text-success border-transparent font-mono text-[10px] uppercase tracking-wider dark:bg-green-900/20 dark:text-green-400",
    dotClassName: "bg-success dark:bg-green-400",
  },
  needs_changes: {
    label: "NEEDS CHANGES",
    className:
      "bg-warning/10 text-warning border-transparent font-mono text-[10px] uppercase tracking-wider dark:bg-yellow-900/20 dark:text-yellow-400",
    dotClassName: "bg-warning dark:bg-yellow-400",
  },
  archived: {
    label: "ARCHIVED",
    className:
      "bg-muted text-muted-foreground border-transparent font-mono text-[10px] uppercase tracking-wider",
    dotClassName: "bg-muted-foreground/40",
  },
};

export function getArtifactStatusConfig(status: string): StatusConfig {
  return (
    ARTIFACT_STATUS_MAP[status] ?? {
      label: status,
      className:
        "font-mono text-[10px] uppercase tracking-wider",
      dotClassName: "bg-muted-foreground/40",
    }
  );
}
