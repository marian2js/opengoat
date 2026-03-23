export interface ObjectiveRecord {
  objectiveId: string;
  projectId: string;
  title: string;
  goalType: string;
  status: "draft" | "active" | "paused" | "completed" | "abandoned";
  summary: string;
  whyNow?: string;
  successDefinition?: string;
  timeframe?: string;
  alreadyTried?: string;
  avoid?: string;
  constraints?: string;
  preferredChannels?: string[];
  createdFrom: "dashboard" | "chat" | "action" | "manual" | "signal";
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface CreateObjectiveOptions {
  title: string;
  goalType?: string;
  summary?: string;
  whyNow?: string;
  successDefinition?: string;
  timeframe?: string;
  alreadyTried?: string;
  avoid?: string;
  constraints?: string;
  preferredChannels?: string[];
}

export interface UpdateObjectiveOptions {
  title?: string;
  goalType?: string;
  status?: "draft" | "active" | "paused" | "completed" | "abandoned";
  summary?: string;
  whyNow?: string;
  successDefinition?: string;
  timeframe?: string;
  alreadyTried?: string;
  avoid?: string;
  constraints?: string;
  preferredChannels?: string[];
  isPrimary?: boolean;
}

export interface ListObjectivesOptions {
  projectId: string;
  status?: "draft" | "active" | "paused" | "completed" | "abandoned";
}
