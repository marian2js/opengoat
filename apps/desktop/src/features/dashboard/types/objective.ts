/**
 * Objective types for the dashboard feature.
 *
 * These mirror the planned Objective data model from the spec.
 * Once the backend (task 0001) lands with Zod schemas in @opengoat/contracts,
 * these can be replaced with the canonical contract types.
 */

export type ObjectiveStatus = "draft" | "active" | "paused" | "completed" | "abandoned";

export type ObjectiveCreatedFrom = "dashboard" | "chat" | "action" | "manual" | "signal";

export interface Objective {
  objectiveId: string;
  projectId: string;
  title: string;
  goalType?: string;
  status: ObjectiveStatus;
  summary?: string;
  whyNow?: string;
  successDefinition?: string;
  timeframe?: string;
  alreadyTried?: string;
  avoid?: string;
  constraints?: string;
  preferredChannels?: string;
  createdFrom: ObjectiveCreatedFrom;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface CreateObjectivePayload {
  projectId: string;
  title: string;
  goalType?: string;
  status?: ObjectiveStatus;
  summary?: string;
  whyNow?: string;
  successDefinition?: string;
  timeframe?: string;
  alreadyTried?: string;
  avoid?: string;
  constraints?: string;
  preferredChannels?: string;
  createdFrom?: ObjectiveCreatedFrom;
}

export interface UpdateObjectivePayload {
  title?: string;
  goalType?: string;
  status?: ObjectiveStatus;
  summary?: string;
  whyNow?: string;
  successDefinition?: string;
  timeframe?: string;
  alreadyTried?: string;
  avoid?: string;
  constraints?: string;
  preferredChannels?: string;
}

export interface ObjectiveBrief {
  summary: string;
  constraints: string[];
  suggestedPlaybooks: string[];
  missingInfo: string[];
  likelyDeliverables: string[];
}
