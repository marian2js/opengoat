export interface SignalRecord {
  signalId: string;
  projectId: string;
  objectiveId?: string;
  sourceType: "web" | "competitor" | "community" | "seo" | "ai-search" | "workspace";
  signalType: string;
  title: string;
  summary: string;
  evidence?: string;
  importance: "low" | "medium" | "high" | "critical";
  freshness: "fresh" | "recent" | "aging" | "stale";
  status: "new" | "seen" | "saved" | "promoted" | "dismissed";
  createdAt: string;
  updatedAt?: string;
}

export interface CreateSignalOptions {
  projectId: string;
  sourceType: "web" | "competitor" | "community" | "seo" | "ai-search" | "workspace";
  signalType: string;
  title: string;
  summary: string;
  evidence?: string;
  importance: "low" | "medium" | "high" | "critical";
  freshness: "fresh" | "recent" | "aging" | "stale";
  objectiveId?: string;
}

export interface ListSignalsOptions {
  projectId: string;
  objectiveId?: string;
  status?: string;
  sourceType?: string;
  limit?: number;
  offset?: number;
}

export const SIGNAL_TYPES = {
  COMPETITOR_CHANGE: "competitor-change",
  CONTENT_OPPORTUNITY: "content-opportunity",
  COMPARISON_OPPORTUNITY: "comparison-opportunity",
  LAUNCH_SURFACE: "launch-surface",
  CHANNEL_DISCUSSION_SPIKE: "channel-discussion-spike",
  SEO_VISIBILITY_OPPORTUNITY: "seo-visibility-opportunity",
  STALE_RUN_WARNING: "stale-run-warning",
  REVIEW_NEEDED_WARNING: "review-needed-warning",
} as const;

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ["seen", "saved", "promoted", "dismissed"],
  seen: ["saved", "promoted", "dismissed"],
  saved: ["promoted", "dismissed"],
  promoted: [],
  dismissed: [],
};
