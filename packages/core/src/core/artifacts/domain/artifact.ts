export const ARTIFACT_STATUSES = [
  "draft",
  "ready_for_review",
  "approved",
  "needs_changes",
  "archived",
] as const;

export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];

export const ARTIFACT_TYPES = [
  "copy_draft",
  "content_calendar",
  "checklist",
  "backlog",
  "matrix",
  "research_brief",
  "page_outline",
  "launch_pack",
  "email_sequence",
  "strategy_note",
  "report",
  "dataset_list",
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const ARTIFACT_FORMATS = [
  "markdown",
  "json",
  "csv",
  "txt",
  "html",
  "url",
  "file-ref",
] as const;

export type ArtifactFormat = (typeof ARTIFACT_FORMATS)[number];

export interface ArtifactRecord {
  artifactId: string;
  projectId: string;
  objectiveId?: string;
  runId?: string;
  taskId?: string;
  bundleId?: string;
  type: ArtifactType;
  title: string;
  status: ArtifactStatus;
  format: ArtifactFormat;
  contentRef: string;
  content?: string;
  summary?: string;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface ArtifactVersion {
  versionId: string;
  artifactId: string;
  version: number;
  content: string;
  contentRef: string;
  summary?: string;
  createdBy: string;
  createdAt: string;
  note?: string;
}

export interface BundleRecord {
  bundleId: string;
  projectId: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateArtifactOptions {
  projectId: string;
  title: string;
  type: ArtifactType;
  format: ArtifactFormat;
  contentRef: string;
  createdBy: string;
  objectiveId?: string;
  runId?: string;
  taskId?: string;
  bundleId?: string;
  content?: string;
  summary?: string;
}

export interface UpdateArtifactOptions {
  title?: string;
  content?: string;
  contentRef?: string;
  summary?: string;
}

export interface ListArtifactsOptions {
  projectId?: string;
  objectiveId?: string;
  runId?: string;
  taskId?: string;
  bundleId?: string;
  status?: ArtifactStatus;
}

export interface CreateBundleOptions {
  projectId: string;
  title: string;
  description?: string;
}

export interface ArtifactListPage {
  items: ArtifactRecord[];
  total: number;
}
