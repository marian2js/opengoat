export interface ArtifactTypeConfig {
  label: string;
  accentColor: string;
  badgeClassName: string;
}

export interface ArtifactStatusConfig {
  label: string;
  className: string;
  dotClassName: string;
}

const ARTIFACT_TYPE_MAP: Record<string, ArtifactTypeConfig> = {
  copy_draft: {
    label: "Copy Draft",
    accentColor: "bg-teal-500",
    badgeClassName: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  content_calendar: {
    label: "Content Calendar",
    accentColor: "bg-cyan-500",
    badgeClassName: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  checklist: {
    label: "Checklist",
    accentColor: "bg-emerald-500",
    badgeClassName: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  backlog: {
    label: "Backlog",
    accentColor: "bg-sky-500",
    badgeClassName: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  matrix: {
    label: "Matrix",
    accentColor: "bg-violet-500",
    badgeClassName: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  research_brief: {
    label: "Research Brief",
    accentColor: "bg-indigo-500",
    badgeClassName: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  page_outline: {
    label: "Page Outline",
    accentColor: "bg-blue-500",
    badgeClassName: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  launch_pack: {
    label: "Launch Pack",
    accentColor: "bg-amber-500",
    badgeClassName: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  email_sequence: {
    label: "Email Sequence",
    accentColor: "bg-rose-500",
    badgeClassName: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  strategy_note: {
    label: "Strategy Note",
    accentColor: "bg-fuchsia-500",
    badgeClassName: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  },
  report: {
    label: "Report",
    accentColor: "bg-slate-500",
    badgeClassName: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  dataset_list: {
    label: "Dataset",
    accentColor: "bg-orange-500",
    badgeClassName: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
};

const DEFAULT_TYPE_CONFIG: ArtifactTypeConfig = {
  label: "Artifact",
  accentColor: "bg-muted-foreground",
  badgeClassName: "bg-muted text-muted-foreground",
};

export const ARTIFACT_TYPE_CONFIG = ARTIFACT_TYPE_MAP;

export function getArtifactTypeConfig(type: string): ArtifactTypeConfig {
  return ARTIFACT_TYPE_MAP[type] ?? DEFAULT_TYPE_CONFIG;
}

const ARTIFACT_STATUS_MAP: Record<string, ArtifactStatusConfig> = {
  draft: {
    label: "DRAFT",
    className:
      "bg-muted/50 text-muted-foreground border-transparent font-mono text-[10px] uppercase tracking-wider",
    dotClassName: "bg-muted-foreground/40",
  },
  ready_for_review: {
    label: "REVIEW",
    className:
      "bg-amber-500/10 text-amber-600 border-transparent font-mono text-[10px] uppercase tracking-wider dark:bg-amber-900/20 dark:text-amber-400",
    dotClassName: "bg-amber-500 dark:bg-amber-400",
  },
  approved: {
    label: "APPROVED",
    className:
      "bg-green-500/10 text-green-600 border-transparent font-mono text-[10px] uppercase tracking-wider dark:bg-green-900/20 dark:text-green-400",
    dotClassName: "bg-green-500 dark:bg-green-400",
  },
  needs_changes: {
    label: "CHANGES",
    className:
      "bg-destructive/10 text-destructive border-transparent font-mono text-[10px] uppercase tracking-wider dark:bg-red-900/20 dark:text-red-400",
    dotClassName: "bg-destructive dark:bg-red-400",
  },
  archived: {
    label: "ARCHIVED",
    className:
      "bg-muted/30 text-muted-foreground/60 border-transparent font-mono text-[10px] uppercase tracking-wider",
    dotClassName: "bg-muted-foreground/30",
  },
};

export const ARTIFACT_STATUS_CONFIG = ARTIFACT_STATUS_MAP;

export function getArtifactStatusConfig(status: string): ArtifactStatusConfig {
  return ARTIFACT_STATUS_MAP[status] ?? {
    label: status.toUpperCase(),
    className: "font-mono text-[10px] uppercase tracking-wider",
    dotClassName: "bg-muted-foreground/40",
  };
}
