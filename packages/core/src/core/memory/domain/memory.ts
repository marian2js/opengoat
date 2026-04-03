export const PROJECT_MEMORY_CATEGORIES = [
  "brand_voice",
  "product_facts",
  "icp_facts",
  "competitors",
  "channels_tried",
  "channels_to_avoid",
  "founder_preferences",
  "approval_preferences",
  "messaging_constraints",
  "legal_compliance",
  "team_process",
  "specialist_context",
] as const;

export type ProjectMemoryCategory = (typeof PROJECT_MEMORY_CATEGORIES)[number];

export const OBJECTIVE_MEMORY_CATEGORIES = [
  "current_goal",
  "success_definition",
  "already_tried",
  "avoid",
  "current_best_hypothesis",
  "review_notes",
  "final_decisions",
  "open_questions",
] as const;

export type ObjectiveMemoryCategory = (typeof OBJECTIVE_MEMORY_CATEGORIES)[number];

export type MemoryCategory = ProjectMemoryCategory | ObjectiveMemoryCategory;

export type MemoryScope = "project" | "objective";

export interface MemoryRecord {
  memoryId: string;
  projectId: string;
  objectiveId: string | null;
  specialistId: string | null;
  category: MemoryCategory;
  scope: MemoryScope;
  content: string;
  source: string;
  confidence: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  userConfirmed: boolean;
  supersedes: string | null;
  replacedBy: string | null;
}

export interface CreateMemoryOptions {
  projectId: string;
  category: MemoryCategory;
  scope: MemoryScope;
  content: string;
  source: string;
  createdBy: string;
  objectiveId?: string;
  specialistId?: string;
  confidence?: number;
  userConfirmed?: boolean;
  supersedes?: string;
}

export interface UpdateMemoryOptions {
  content?: string;
  confidence?: number;
  userConfirmed?: boolean;
}

export interface ListMemoriesOptions {
  projectId: string;
  objectiveId?: string;
  specialistId?: string;
  category?: MemoryCategory;
  scope?: MemoryScope;
  activeOnly?: boolean;
}
