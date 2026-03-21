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
