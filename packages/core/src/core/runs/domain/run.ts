export const RUN_STATUSES = [
  "draft",
  "running",
  "waiting_review",
  "blocked",
  "completed",
  "cancelled",
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export const RUN_STARTED_FROM = ["dashboard", "chat", "action"] as const;

export type RunStartedFrom = (typeof RUN_STARTED_FROM)[number];

export interface RunRecord {
  runId: string;
  projectId: string;
  objectiveId: string;
  playbookId?: string;
  title: string;
  status: RunStatus;
  phase: string;
  phaseSummary: string;
  startedFrom: RunStartedFrom;
  agentId: string;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreateRunOptions {
  projectId: string;
  objectiveId: string;
  playbookId?: string;
  title: string;
  startedFrom?: RunStartedFrom;
  agentId?: string;
  phase?: string;
  phaseSummary?: string;
}

export interface ListRunsOptions {
  projectId?: string;
  objectiveId?: string;
  status?: RunStatus;
  limit?: number;
  offset?: number;
}

export interface RunPhaseInfo {
  phase: string;
  phaseSummary?: string;
}

export interface RunListPage {
  runs: RunRecord[];
  total: number;
  limit: number;
  offset: number;
}
