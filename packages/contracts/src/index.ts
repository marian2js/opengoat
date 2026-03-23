import appManifestJson from "../../../config/app-manifest.json" with { type: "json" };
import { z } from "zod";

export const workspaceAreaSchema = z.object({
  path: z.string().min(1),
  responsibility: z.string().min(1),
});

export const appManifestSchema = z.object({
  productName: z.string().min(1),
  workspaceLayout: z.array(workspaceAreaSchema).min(1),
});

export const sidecarConnectionSchema = z.object({
  url: z.url(),
  username: z.string().min(1),
  password: z.string().min(1),
  isSidecar: z.boolean(),
});

export const sidecarHealthSchema = z.object({
  healthy: z.literal(true),
  productName: z.string().min(1),
  version: z.string().min(1),
});

export const sidecarBootstrapSchema = z.object({
  manifest: appManifestSchema,
  runtime: z.object({
    auth: z.literal("basic"),
    mode: z.literal("sidecar"),
    streams: z.object({
      sse: z.boolean(),
      websocket: z.boolean(),
    }),
  }),
  version: z.string().min(1).optional(),
});

export const providerConnectionInputSchema = z.enum([
  "api_key",
  "oauth",
  "token",
  "device_code",
  "custom",
]);

export const providerMethodSchema = z.object({
  hint: z.string().min(1).optional(),
  id: z.string().min(1),
  input: providerConnectionInputSchema,
  label: z.string().min(1),
  providerId: z.string().min(1),
});

export const providerDefinitionSchema = z.object({
  description: z.string().min(1).optional(),
  id: z.string().min(1),
  methods: z.array(providerMethodSchema).min(1),
  name: z.string().min(1),
});

export const savedConnectionSchema = z.object({
  activeModelId: z.string().min(1).optional(),
  isDefault: z.boolean(),
  label: z.string().min(1),
  profileId: z.string().min(1),
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  type: z.enum(["api_key", "oauth", "token"]),
  updatedAt: z.string().min(1),
});

export const authOverviewSchema = z.object({
  configPath: z.string().min(1),
  connections: z.array(savedConnectionSchema),
  storePath: z.string().min(1),
  selectedModelId: z.string().min(1).optional(),
  selectedProviderId: z.string().min(1).optional(),
  selectedProfileId: z.string().min(1).optional(),
  providers: z.array(providerDefinitionSchema),
});

export const providerModelOptionSchema = z.object({
  contextWindow: z.number().positive().optional(),
  isSelected: z.boolean(),
  label: z.string().min(1),
  modelId: z.string().min(1),
  modelRef: z.string().min(1),
  providerId: z.string().min(1),
  reasoning: z.boolean().optional(),
});

export const providerModelCatalogSchema = z.object({
  currentModelId: z.string().min(1).optional(),
  currentModelRef: z.string().min(1).optional(),
  models: z.array(providerModelOptionSchema),
  providerId: z.string().min(1),
});

export const connectProviderSecretRequestSchema = z.object({
  authChoice: z.string().min(1),
  secret: z.string().min(1),
});

export const selectConnectionRequestSchema = z.object({
  profileId: z.string().min(1),
});

export const startAuthSessionRequestSchema = z.object({
  authChoice: z.string().min(1),
});

export const respondAuthSessionRequestSchema = z.object({
  value: z.union([z.string(), z.boolean(), z.array(z.string())]),
});

export const setProviderModelRequestSchema = z.object({
  modelRef: z.string().min(1),
});

export const agentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  instructions: z.string().min(1),
  providerId: z.string().min(1).optional(),
  modelId: z.string().min(1).optional(),
  workspaceDir: z.string().min(1),
  agentDir: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  isDefault: z.boolean(),
});

export const agentCatalogSchema = z.object({
  storePath: z.string().min(1),
  defaultAgentId: z.string().min(1).optional(),
  agents: z.array(agentSchema),
});

export const createAgentRequestSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  instructions: z.string().min(1).optional(),
  providerId: z.string().min(1).optional(),
  modelId: z.string().min(1).optional(),
  workspaceDir: z.string().min(1).optional(),
  setAsDefault: z.boolean().optional(),
});

export const updateAgentRequestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  providerId: z.string().optional(),
  modelId: z.string().optional(),
  workspaceDir: z.string().optional(),
  setAsDefault: z.boolean().optional(),
});

export const deleteAgentResponseSchema = z.object({
  agentId: z.string().min(1),
  deletedSessions: z.number().int().nonnegative(),
  removedPaths: z.array(z.string().min(1)),
});

export const agentSessionSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  agentName: z.string().min(1),
  sessionKey: z.string().min(1),
  label: z.string().min(1).optional(),
  sessionFile: z.string().min(1),
  workspaceDir: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const agentSessionListSchema = z.object({
  agentId: z.string().min(1).optional(),
  sessions: z.array(agentSessionSchema),
});

export const createProjectAgentRequestSchema = z.object({
  projectUrl: z.string().min(1),
});

export type CreateProjectAgentRequest = z.infer<typeof createProjectAgentRequestSchema>;

export const createAgentSessionRequestSchema = z.object({
  agentId: z.string().min(1),
  internal: z.boolean().optional(),
  label: z.string().min(1).optional(),
  initialPrompt: z.string().min(1).optional(),
});

export const updateAgentSessionRequestSchema = z.object({
  label: z.string().min(1),
});

export const deleteAgentSessionResponseSchema = z.object({
  sessionId: z.string().min(1),
});

export const bootstrapPromptSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sessionRef: z.string().min(1),
  expectedFile: z.string().min(1),
  message: z.string().min(1),
});

export const bootstrapPromptListSchema = z.object({
  prompts: z.array(bootstrapPromptSchema),
});

export const workspaceFileCheckSchema = z.object({
  exists: z.boolean(),
});

export const workspaceFileContentSchema = z.object({
  content: z.string(),
  exists: z.boolean(),
});

export const chatTranscriptMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["assistant", "system", "user"]),
  text: z.string(),
  createdAt: z.string().min(1),
});

export const chatBootstrapSchema = z.object({
  agent: agentSchema,
  agents: z.array(agentSchema),
  session: agentSessionSchema,
  messages: z.array(chatTranscriptMessageSchema),
  resolvedModelId: z.string().min(1).optional(),
  resolvedProviderId: z.string().min(1).optional(),
});

export const chatActivityStatusSchema = z.enum([
  "pending",
  "active",
  "complete",
  "error",
]);

export const chatActivitySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["status", "tool", "compaction"]),
  label: z.string().min(1),
  detail: z.string().min(1).optional(),
  status: chatActivityStatusSchema,
  sequence: z.number().int().nonnegative().optional(),
  timestamp: z.string().min(1).optional(),
  toolName: z.string().min(1).optional(),
});

export const authSessionStepSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("working"),
    message: z.string().min(1),
  }),
  z.object({
    type: z.literal("auth_link"),
    label: z.string().min(1).optional(),
    url: z.url(),
    instructions: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("text_prompt"),
    message: z.string().min(1),
    placeholder: z.string().min(1).optional(),
    allowEmpty: z.boolean(),
    secret: z.boolean(),
  }),
  z.object({
    type: z.literal("select_prompt"),
    allowMultiple: z.boolean(),
    message: z.string().min(1),
    options: z.array(
      z.object({
        hint: z.string().min(1).optional(),
        label: z.string().min(1),
        value: z.string().min(1),
      }),
    ).min(1),
  }),
  z.object({
    type: z.literal("confirm_prompt"),
    confirmLabel: z.string().min(1).optional(),
    cancelLabel: z.string().min(1).optional(),
    message: z.string().min(1),
  }),
  z.object({
    type: z.literal("completed"),
    message: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string().min(1),
  }),
]);

export const authSessionSchema = z.object({
  authChoice: z.string().min(1),
  id: z.string().min(1),
  methodLabel: z.string().min(1),
  providerId: z.string().min(1).optional(),
  providerName: z.string().min(1),
  state: z.enum(["pending", "completed", "error"]),
  step: authSessionStepSchema,
  progress: z.array(z.string()),
  connection: savedConnectionSchema.optional(),
  error: z.string().min(1).optional(),
});

export type WorkspaceArea = z.infer<typeof workspaceAreaSchema>;
export type AppManifest = z.infer<typeof appManifestSchema>;
export type SidecarConnection = z.infer<typeof sidecarConnectionSchema>;
export type SidecarHealth = z.infer<typeof sidecarHealthSchema>;
export type SidecarBootstrap = z.infer<typeof sidecarBootstrapSchema>;
export type ProviderConnectionInput = z.infer<typeof providerConnectionInputSchema>;
export type ProviderMethod = z.infer<typeof providerMethodSchema>;
export type ProviderDefinition = z.infer<typeof providerDefinitionSchema>;
export type SavedConnection = z.infer<typeof savedConnectionSchema>;
export type AuthOverview = z.infer<typeof authOverviewSchema>;
export type ProviderModelOption = z.infer<typeof providerModelOptionSchema>;
export type ProviderModelCatalog = z.infer<typeof providerModelCatalogSchema>;
export type ConnectProviderSecretRequest = z.infer<
  typeof connectProviderSecretRequestSchema
>;
export type SelectConnectionRequest = z.infer<typeof selectConnectionRequestSchema>;
export type StartAuthSessionRequest = z.infer<
  typeof startAuthSessionRequestSchema
>;
export type RespondAuthSessionRequest = z.infer<
  typeof respondAuthSessionRequestSchema
>;
export type SetProviderModelRequest = z.infer<typeof setProviderModelRequestSchema>;
export type AuthSessionStep = z.infer<typeof authSessionStepSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type Agent = z.infer<typeof agentSchema>;
export type AgentCatalog = z.infer<typeof agentCatalogSchema>;
export type CreateAgentRequest = z.infer<typeof createAgentRequestSchema>;
export type UpdateAgentRequest = z.infer<typeof updateAgentRequestSchema>;
export type DeleteAgentResponse = z.infer<typeof deleteAgentResponseSchema>;
export type AgentSession = z.infer<typeof agentSessionSchema>;
export type AgentSessionList = z.infer<typeof agentSessionListSchema>;
export type CreateAgentSessionRequest = z.infer<
  typeof createAgentSessionRequestSchema
>;
export type DeleteAgentSessionResponse = z.infer<
  typeof deleteAgentSessionResponseSchema
>;
export type ChatTranscriptMessage = z.infer<typeof chatTranscriptMessageSchema>;
export type ChatBootstrap = z.infer<typeof chatBootstrapSchema>;
export type ChatActivityStatus = z.infer<typeof chatActivityStatusSchema>;
export type ChatActivity = z.infer<typeof chatActivitySchema>;
export type BootstrapPrompt = z.infer<typeof bootstrapPromptSchema>;
export type BootstrapPromptList = z.infer<typeof bootstrapPromptListSchema>;
export type WorkspaceFileCheck = z.infer<typeof workspaceFileCheckSchema>;
export type WorkspaceFileContent = z.infer<typeof workspaceFileContentSchema>;

// --- Skills ---

export const resolvedSkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  source: z.enum(["managed", "extra"]),
});

export const skillListSchema = z.object({
  skills: z.array(resolvedSkillSchema),
});

export const installSkillRequestSchema = z.object({
  skillName: z.string().min(1),
  sourceUrl: z.string().min(1).optional(),
});

export const installSkillResultSchema = z.object({
  skillId: z.string().min(1),
  skillName: z.string().min(1),
  source: z.string().min(1),
  installed: z.boolean(),
});

export const removeSkillResultSchema = z.object({
  skillId: z.string().min(1),
  removed: z.boolean(),
});

export type ResolvedSkillContract = z.infer<typeof resolvedSkillSchema>;
export type SkillList = z.infer<typeof skillListSchema>;
export type InstallSkillRequestContract = z.infer<typeof installSkillRequestSchema>;
export type InstallSkillResultContract = z.infer<typeof installSkillResultSchema>;
export type RemoveSkillResultContract = z.infer<typeof removeSkillResultSchema>;

// --- Board / Tasks ---

export const taskEntrySchema = z.object({
  createdAt: z.string().min(1),
  createdBy: z.string().min(1),
  content: z.string().min(1),
});

export const taskRecordSchema = z.object({
  taskId: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  owner: z.string().min(1),
  assignedTo: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  status: z.string().min(1),
  statusReason: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  blockers: z.array(z.string()),
  artifacts: z.array(taskEntrySchema),
  worklog: z.array(taskEntrySchema),
});

export const taskListPageSchema = z.object({
  tasks: z.array(taskRecordSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const updateTaskStatusRequestSchema = z.object({
  status: z.string().min(1),
  reason: z.string().optional(),
});

export const addTaskBlockerRequestSchema = z.object({
  content: z.string().min(1),
});

export const addTaskArtifactRequestSchema = z.object({
  content: z.string().min(1),
});

export const addTaskWorklogRequestSchema = z.object({
  content: z.string().min(1),
});

export const deleteTasksRequestSchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1),
});

export const deleteTasksResponseSchema = z.object({
  deletedTaskIds: z.array(z.string().min(1)),
  deletedCount: z.number().int().nonnegative(),
});

export type TaskEntry = z.infer<typeof taskEntrySchema>;
export type TaskRecord = z.infer<typeof taskRecordSchema>;
export type TaskListPage = z.infer<typeof taskListPageSchema>;
export type UpdateTaskStatusRequest = z.infer<typeof updateTaskStatusRequestSchema>;
export type AddTaskBlockerRequest = z.infer<typeof addTaskBlockerRequestSchema>;
export type AddTaskArtifactRequest = z.infer<typeof addTaskArtifactRequestSchema>;
export type AddTaskWorklogRequest = z.infer<typeof addTaskWorklogRequestSchema>;
export const createTaskFromRunRequestSchema = z.object({
  runId: z.string().min(1),
  objectiveId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  assignedTo: z.string().optional(),
  status: z.string().optional(),
});

export type DeleteTasksRequest = z.infer<typeof deleteTasksRequestSchema>;
export type DeleteTasksResponse = z.infer<typeof deleteTasksResponseSchema>;
export type CreateTaskFromRunRequest = z.infer<typeof createTaskFromRunRequestSchema>;

// --- Playbooks ---

export const playbookSourceSchema = z.enum([
  "builtin",
  "installed",
  "generated",
  "organization-template",
]);

export const playbookPhaseSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  expectedArtifacts: z.array(z.string()).optional(),
});

export const playbookManifestSchema = z.object({
  playbookId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  idealFor: z.string().min(1),
  goalTypes: z.array(z.string().min(1)).min(1),
  requiredInputs: z.array(z.string()),
  optionalInputs: z.array(z.string()),
  skillRefs: z.array(z.string()),
  defaultPhases: z.array(playbookPhaseSchema).min(1),
  artifactTypes: z.array(z.string().min(1)).min(1),
  taskPolicy: z.string().min(1),
  approvalPolicy: z.string().min(1),
  evaluationRubric: z.string().min(1),
  version: z.string().min(1),
  source: playbookSourceSchema,
  /** Display-only: typical time to first deliverable */
  timeToFirstValue: z.string().optional(),
  /** Display-only: whether this playbook creates tracked work */
  createsTrackedWork: z.boolean().optional(),
});

export const listPlaybooksResponseSchema = z.object({
  playbooks: z.array(playbookManifestSchema),
});

export const getPlaybookResponseSchema = playbookManifestSchema;

export type PlaybookSource = z.infer<typeof playbookSourceSchema>;
export type PlaybookPhase = z.infer<typeof playbookPhaseSchema>;
export type PlaybookManifest = z.infer<typeof playbookManifestSchema>;
export type ListPlaybooksResponse = z.infer<typeof listPlaybooksResponseSchema>;

// --- Objectives ---

export const objectiveStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
  "abandoned",
]);

export const objectiveCreatedFromSchema = z.enum([
  "dashboard",
  "chat",
  "action",
  "manual",
  "signal",
]);

export const objectiveSchema = z.object({
  objectiveId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  goalType: z.string(),
  status: objectiveStatusSchema,
  summary: z.string(),
  whyNow: z.string().optional(),
  successDefinition: z.string().optional(),
  timeframe: z.string().optional(),
  alreadyTried: z.string().optional(),
  avoid: z.string().optional(),
  constraints: z.string().optional(),
  preferredChannels: z.array(z.string()).optional(),
  createdFrom: objectiveCreatedFromSchema,
  isPrimary: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().optional(),
});

export const createObjectiveRequestSchema = z.object({
  title: z.string().min(1),
  goalType: z.string().optional(),
  summary: z.string().optional(),
  whyNow: z.string().optional(),
  successDefinition: z.string().optional(),
  timeframe: z.string().optional(),
  alreadyTried: z.string().optional(),
  avoid: z.string().optional(),
  constraints: z.string().optional(),
  preferredChannels: z.array(z.string()).optional(),
});

export const updateObjectiveRequestSchema = z.object({
  title: z.string().min(1).optional(),
  goalType: z.string().optional(),
  status: objectiveStatusSchema.optional(),
  summary: z.string().optional(),
  whyNow: z.string().optional(),
  successDefinition: z.string().optional(),
  timeframe: z.string().optional(),
  alreadyTried: z.string().optional(),
  avoid: z.string().optional(),
  constraints: z.string().optional(),
  preferredChannels: z.array(z.string()).optional(),
  isPrimary: z.boolean().optional(),
});

export const listObjectivesQuerySchema = z.object({
  projectId: z.string().min(1),
  status: objectiveStatusSchema.optional(),
});

export const archiveObjectiveRequestSchema = z.object({
  reason: z.string().optional(),
});

export const objectiveListSchema = z.array(objectiveSchema);

export type ObjectiveStatus = z.infer<typeof objectiveStatusSchema>;
export type ObjectiveCreatedFrom = z.infer<typeof objectiveCreatedFromSchema>;
export type Objective = z.infer<typeof objectiveSchema>;
export type CreateObjectiveRequest = z.infer<typeof createObjectiveRequestSchema>;
export type UpdateObjectiveRequest = z.infer<typeof updateObjectiveRequestSchema>;
export type ListObjectivesQuery = z.infer<typeof listObjectivesQuerySchema>;
export type ArchiveObjectiveRequest = z.infer<typeof archiveObjectiveRequestSchema>;

// --- Runs ---

export const runStatusSchema = z.enum([
  "draft",
  "running",
  "waiting_review",
  "blocked",
  "completed",
  "cancelled",
]);

export const runStartedFromSchema = z.enum(["dashboard", "chat", "action"]);

export const runRecordSchema = z.object({
  runId: z.string().min(1),
  projectId: z.string().min(1),
  objectiveId: z.string().min(1),
  playbookId: z.string().optional(),
  title: z.string().min(1),
  status: runStatusSchema,
  phase: z.string(),
  phaseSummary: z.string(),
  startedFrom: runStartedFromSchema,
  agentId: z.string().min(1),
  sessionId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
});

export const createRunRequestSchema = z.object({
  projectId: z.string().min(1),
  objectiveId: z.string().min(1),
  playbookId: z.string().optional(),
  title: z.string().min(1),
  startedFrom: runStartedFromSchema.optional(),
  agentId: z.string().optional(),
  phase: z.string().optional(),
  phaseSummary: z.string().optional(),
  sessionId: z.string().optional(),
});

export const updateRunStatusRequestSchema = z.object({
  status: runStatusSchema,
});

export const advanceRunPhaseRequestSchema = z.object({
  phase: z.string().min(1),
  phaseSummary: z.string().optional(),
});

export const runListPageSchema = z.object({
  runs: z.array(runRecordSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type RunStatus = z.infer<typeof runStatusSchema>;
export type RunStartedFrom = z.infer<typeof runStartedFromSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
export type CreateRunRequest = z.infer<typeof createRunRequestSchema>;
export type UpdateRunStatusRequest = z.infer<typeof updateRunStatusRequestSchema>;
export type AdvanceRunPhaseRequest = z.infer<typeof advanceRunPhaseRequestSchema>;
export type RunListPage = z.infer<typeof runListPageSchema>;

// --- Artifacts ---

export const artifactStatusSchema = z.enum([
  "draft",
  "ready_for_review",
  "approved",
  "needs_changes",
  "archived",
]);

export const artifactTypeSchema = z.enum([
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
]);

export const artifactFormatSchema = z.enum([
  "markdown",
  "json",
  "csv",
  "txt",
  "html",
  "url",
  "file-ref",
]);

export const artifactRecordSchema = z.object({
  artifactId: z.string().min(1),
  projectId: z.string().min(1),
  objectiveId: z.string().optional(),
  runId: z.string().optional(),
  taskId: z.string().optional(),
  bundleId: z.string().optional(),
  type: artifactTypeSchema,
  title: z.string().min(1),
  status: artifactStatusSchema,
  format: artifactFormatSchema,
  contentRef: z.string().min(1),
  content: z.string().optional(),
  summary: z.string().optional(),
  version: z.number().int().positive(),
  createdBy: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  approvedAt: z.string().optional(),
  approvedBy: z.string().optional(),
});

export const artifactVersionSchema = z.object({
  versionId: z.string().min(1),
  artifactId: z.string().min(1),
  version: z.number().int().positive(),
  content: z.string(),
  contentRef: z.string().min(1),
  summary: z.string().optional(),
  createdBy: z.string().min(1),
  createdAt: z.string(),
  note: z.string().optional(),
});

export const createArtifactRequestSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  type: artifactTypeSchema,
  format: artifactFormatSchema,
  contentRef: z.string().min(1),
  createdBy: z.string().min(1),
  objectiveId: z.string().optional(),
  runId: z.string().optional(),
  taskId: z.string().optional(),
  bundleId: z.string().optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
});

export const updateArtifactRequestSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  contentRef: z.string().min(1).optional(),
  summary: z.string().optional(),
});

export const updateArtifactStatusRequestSchema = z.object({
  status: artifactStatusSchema,
  actor: z.string().optional(),
});

export const artifactListPageSchema = z.object({
  items: z.array(artifactRecordSchema),
  total: z.number().int().nonnegative(),
});

export const bundleRecordSchema = z.object({
  bundleId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createBundleRequestSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
});

export type ArtifactStatus = z.infer<typeof artifactStatusSchema>;
export type ArtifactType = z.infer<typeof artifactTypeSchema>;
export type ArtifactFormat = z.infer<typeof artifactFormatSchema>;
export type ArtifactRecord = z.infer<typeof artifactRecordSchema>;
export type ArtifactVersion = z.infer<typeof artifactVersionSchema>;
export type CreateArtifactRequest = z.infer<typeof createArtifactRequestSchema>;
export type UpdateArtifactRequest = z.infer<typeof updateArtifactRequestSchema>;
export type UpdateArtifactStatusRequest = z.infer<typeof updateArtifactStatusRequestSchema>;
export type ArtifactListPage = z.infer<typeof artifactListPageSchema>;
export type BundleRecord = z.infer<typeof bundleRecordSchema>;
export type CreateBundleRequest = z.infer<typeof createBundleRequestSchema>;

// --- Memory ---

export const projectMemoryCategorySchema = z.enum([
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
]);

export const objectiveMemoryCategorySchema = z.enum([
  "current_goal",
  "success_definition",
  "already_tried",
  "avoid",
  "current_best_hypothesis",
  "review_notes",
  "final_decisions",
  "open_questions",
]);

export const memoryCategorySchema = z.union([
  projectMemoryCategorySchema,
  objectiveMemoryCategorySchema,
]);

export const memoryScopeSchema = z.enum(["project", "objective"]);

export const memoryRecordSchema = z.object({
  memoryId: z.string().min(1),
  projectId: z.string().min(1),
  objectiveId: z.string().nullable(),
  category: memoryCategorySchema,
  scope: memoryScopeSchema,
  content: z.string().min(1),
  source: z.string().min(1),
  confidence: z.number().min(0).max(1),
  createdBy: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  userConfirmed: z.boolean(),
  supersedes: z.string().nullable(),
  replacedBy: z.string().nullable(),
});

export const createMemoryRequestSchema = z.object({
  projectId: z.string().min(1),
  category: memoryCategorySchema,
  scope: memoryScopeSchema,
  content: z.string().min(1),
  source: z.string().min(1),
  createdBy: z.string().min(1),
  objectiveId: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  userConfirmed: z.boolean().optional(),
  supersedes: z.string().min(1).optional(),
});

export const updateMemoryRequestSchema = z.object({
  content: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  userConfirmed: z.boolean().optional(),
});

export const listMemoriesQuerySchema = z.object({
  projectId: z.string().min(1),
  objectiveId: z.string().min(1).optional(),
  category: memoryCategorySchema.optional(),
  scope: memoryScopeSchema.optional(),
  activeOnly: z.boolean().optional(),
});

export const deleteMemoryRequestSchema = z.object({});

export const resolveConflictRequestSchema = z.object({
  keepMemoryId: z.string().min(1),
  replaceMemoryId: z.string().min(1),
});

export const memoryListSchema = z.array(memoryRecordSchema);

export type ProjectMemoryCategory = z.infer<typeof projectMemoryCategorySchema>;
export type ObjectiveMemoryCategory = z.infer<typeof objectiveMemoryCategorySchema>;
export type MemoryCategory = z.infer<typeof memoryCategorySchema>;
export type MemoryScope = z.infer<typeof memoryScopeSchema>;
export type MemoryRecord = z.infer<typeof memoryRecordSchema>;
export type CreateMemoryRequest = z.infer<typeof createMemoryRequestSchema>;
export type UpdateMemoryRequest = z.infer<typeof updateMemoryRequestSchema>;
export type ListMemoriesQuery = z.infer<typeof listMemoriesQuerySchema>;
export type DeleteMemoryRequest = z.infer<typeof deleteMemoryRequestSchema>;
export type ResolveConflictRequest = z.infer<typeof resolveConflictRequestSchema>;

// --- Signals ---

export const signalSourceTypeSchema = z.enum([
  "web",
  "competitor",
  "community",
  "seo",
  "ai-search",
  "workspace",
]);

export const signalImportanceSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const signalFreshnessSchema = z.enum([
  "fresh",
  "recent",
  "aging",
  "stale",
]);

export const signalStatusSchema = z.enum([
  "new",
  "seen",
  "saved",
  "promoted",
  "dismissed",
]);

export const signalSchema = z.object({
  signalId: z.string().min(1),
  projectId: z.string().min(1),
  objectiveId: z.string().optional(),
  sourceType: signalSourceTypeSchema,
  signalType: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.string().optional(),
  importance: signalImportanceSchema,
  freshness: signalFreshnessSchema,
  status: signalStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export const createSignalRequestSchema = z.object({
  projectId: z.string().min(1),
  sourceType: signalSourceTypeSchema,
  signalType: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.string().optional(),
  importance: signalImportanceSchema,
  freshness: signalFreshnessSchema,
  objectiveId: z.string().min(1).optional(),
});

export const updateSignalStatusRequestSchema = z.object({
  status: z.string().min(1),
});

export const listSignalsRequestSchema = z.object({
  projectId: z.string().min(1),
  objectiveId: z.string().min(1).optional(),
  status: signalStatusSchema.optional(),
  sourceType: signalSourceTypeSchema.optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export const promoteSignalRequestSchema = z.object({
  targetObjectiveId: z.string().min(1).optional(),
});

export const dismissSignalRequestSchema = z.object({
  reason: z.string().optional(),
});

export const signalListPageSchema = z.object({
  items: z.array(signalSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type SignalSourceType = z.infer<typeof signalSourceTypeSchema>;
export type SignalImportance = z.infer<typeof signalImportanceSchema>;
export type SignalFreshness = z.infer<typeof signalFreshnessSchema>;
export type SignalStatus = z.infer<typeof signalStatusSchema>;
export type Signal = z.infer<typeof signalSchema>;
export type CreateSignalRequest = z.infer<typeof createSignalRequestSchema>;
export type UpdateSignalStatusRequest = z.infer<typeof updateSignalStatusRequestSchema>;
export type ListSignalsRequest = z.infer<typeof listSignalsRequestSchema>;
export type PromoteSignalRequest = z.infer<typeof promoteSignalRequestSchema>;
export type DismissSignalRequest = z.infer<typeof dismissSignalRequestSchema>;
export type SignalListPage = z.infer<typeof signalListPageSchema>;

export const appManifest = appManifestSchema.parse(appManifestJson);

export function createBasicAuthHeader(
  username: string,
  password: string,
): string {
  if (typeof btoa === "function") {
    return `Basic ${btoa(`${username}:${password}`)}`;
  }

  const nodeBuffer = (
    globalThis as {
      Buffer?: {
        from(
          input: string,
          encoding: string,
        ): { toString(encoding: string): string };
      };
    }
  ).Buffer;

  if (nodeBuffer) {
    return `Basic ${nodeBuffer
      .from(`${username}:${password}`, "utf8")
      .toString("base64")}`;
  }

  throw new Error("No base64 encoder is available in the current runtime.");
}
