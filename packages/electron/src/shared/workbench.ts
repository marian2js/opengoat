import { z } from "zod";

export const messageRoleSchema = z.enum(["user", "assistant"]);

export const workbenchMessageSchema = z.object({
  id: z.string(),
  role: messageRoleSchema,
  content: z.string(),
  createdAt: z.string(),
  tracePath: z.string().optional(),
  providerId: z.string().optional()
});

export const workbenchSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  agentId: z.literal("orchestrator"),
  sessionKey: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messages: z.array(workbenchMessageSchema)
});

export const workbenchProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  rootPath: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sessions: z.array(workbenchSessionSchema)
});

export const providerKindSchema = z.enum(["cli", "http"]);

export const workbenchGatewayModeSchema = z.enum(["local", "remote"]);

export const WORKBENCH_GATEWAY_DEFAULT_TIMEOUT_MS = 10_000;

const WORKBENCH_GATEWAY_DEFAULT_SETTINGS = {
  mode: "local" as const,
  timeoutMs: WORKBENCH_GATEWAY_DEFAULT_TIMEOUT_MS
};

export const workbenchGatewaySettingsSchema = z.object({
  mode: workbenchGatewayModeSchema.default(WORKBENCH_GATEWAY_DEFAULT_SETTINGS.mode),
  remoteUrl: z.string().trim().max(1024).optional(),
  timeoutMs: z
    .number()
    .int()
    .min(1000)
    .max(120_000)
    .default(WORKBENCH_GATEWAY_DEFAULT_SETTINGS.timeoutMs)
});

export const workbenchGatewayStatusSchema = workbenchGatewaySettingsSchema.extend({
  hasAuthToken: z.boolean().default(false)
});

export const workbenchProviderSummarySchema = z.object({
  id: z.string(),
  displayName: z.string(),
  kind: providerKindSchema
});

export const providerOnboardingFieldSchema = z.object({
  key: z.string(),
  description: z.string(),
  required: z.boolean().optional(),
  secret: z.boolean().optional()
});

export const workbenchAgentProviderSchema = workbenchProviderSummarySchema.extend({
  envFields: z.array(providerOnboardingFieldSchema),
  configuredEnvKeys: z.array(z.string()),
  configuredEnvValues: z.record(z.string(), z.string()),
  hasConfig: z.boolean(),
  supportsExternalAgentCreation: z.boolean().optional()
});

export const workbenchAgentSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  workspaceDir: z.string(),
  internalConfigDir: z.string(),
  providerId: z.string().optional()
});

export const workbenchOnboardingProviderSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  kind: providerKindSchema,
  guidedAuth: z
    .object({
      title: z.string(),
      description: z.string()
    })
    .optional(),
  envFields: z.array(providerOnboardingFieldSchema),
  configuredEnvKeys: z.array(z.string()),
  configuredEnvValues: z.record(z.string(), z.string()),
  missingRequiredEnv: z.array(z.string()),
  hasConfig: z.boolean()
});

export const workbenchOnboardingFamilySchema = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string().optional(),
  providerIds: z.array(z.string())
});

export const workbenchOnboardingSchema = z.object({
  activeProviderId: z.string(),
  needsOnboarding: z.boolean(),
  families: z.array(workbenchOnboardingFamilySchema),
  providers: z.array(workbenchOnboardingProviderSchema),
  gateway: workbenchGatewayStatusSchema
});

export const workbenchBootstrapSchema = z.object({
  homeDir: z.string(),
  projects: z.array(workbenchProjectSchema),
  onboarding: workbenchOnboardingSchema,
  providerSetupCompleted: z.boolean().default(false)
});

export const workbenchStateSchema = z.object({
  schemaVersion: z.literal(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  projects: z.array(workbenchProjectSchema),
  settings: z
    .object({
      gateway: workbenchGatewaySettingsSchema.default(WORKBENCH_GATEWAY_DEFAULT_SETTINGS),
      onboarding: z
        .object({
          providerSetupCompleted: z.boolean().default(false)
        })
        .default({
          providerSetupCompleted: false
        })
    })
    .default({
      gateway: WORKBENCH_GATEWAY_DEFAULT_SETTINGS,
      onboarding: {
        providerSetupCompleted: false
      }
    })
});

export type WorkbenchMessage = z.infer<typeof workbenchMessageSchema>;
export type WorkbenchSession = z.infer<typeof workbenchSessionSchema>;
export type WorkbenchProject = z.infer<typeof workbenchProjectSchema>;
export type WorkbenchState = z.infer<typeof workbenchStateSchema>;
export type WorkbenchOnboarding = z.infer<typeof workbenchOnboardingSchema>;
export type WorkbenchBootstrap = z.infer<typeof workbenchBootstrapSchema>;
export type WorkbenchGatewayMode = z.infer<typeof workbenchGatewayModeSchema>;
export type WorkbenchGatewaySettings = z.infer<typeof workbenchGatewaySettingsSchema>;
export type WorkbenchGatewayStatus = z.infer<typeof workbenchGatewayStatusSchema>;
export type WorkbenchProviderSummary = z.infer<typeof workbenchProviderSummarySchema>;
export type WorkbenchAgentProvider = z.infer<typeof workbenchAgentProviderSchema>;
export type WorkbenchAgent = z.infer<typeof workbenchAgentSchema>;

export const addProjectInputSchema = z.object({
  rootPath: z.string().min(1)
});

export const projectLookupInputSchema = z.object({
  projectId: z.string().min(1)
});

export const renameProjectInputSchema = projectLookupInputSchema.extend({
  name: z.string().trim().min(1).max(120)
});

export const removeProjectInputSchema = projectLookupInputSchema;

export const createSessionInputSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().max(120).optional()
});

export const sessionLookupInputSchema = z.object({
  projectId: z.string().min(1),
  sessionId: z.string().min(1)
});

export const renameSessionInputSchema = sessionLookupInputSchema.extend({
  title: z.string().trim().min(1).max(120)
});

export const sendMessageInputSchema = sessionLookupInputSchema.extend({
  message: z.string().trim().min(1)
});

export const sendMessageResultSchema = z.object({
  session: workbenchSessionSchema,
  reply: workbenchMessageSchema,
  tracePath: z.string().optional(),
  providerId: z.string()
});

export const createAgentInputSchema = z.object({
  name: z.string().trim().min(1),
  providerId: z.string().trim().min(1).optional(),
  createExternalAgent: z.boolean().optional(),
  env: z.record(z.string(), z.string()).optional()
});

export const deleteAgentInputSchema = z.object({
  agentId: z.string().trim().min(1),
  providerId: z.string().trim().min(1).optional(),
  deleteExternalAgent: z.boolean().optional()
});

export const updateAgentProviderConfigInputSchema = z.object({
  providerId: z.string().trim().min(1),
  env: z.record(z.string(), z.string()).default({})
});

export const agentCreationResultSchema = z.object({
  agent: workbenchAgentSchema,
  createdPaths: z.array(z.string()),
  skippedPaths: z.array(z.string()),
  externalAgentCreation: z
    .object({
      providerId: z.string(),
      code: z.number(),
      stdout: z.string(),
      stderr: z.string()
    })
    .optional()
});

export const agentDeletionResultSchema = z.object({
  agentId: z.string(),
  existed: z.boolean(),
  removedPaths: z.array(z.string()),
  skippedPaths: z.array(z.string()),
  externalAgentDeletion: z
    .object({
      providerId: z.string(),
      code: z.number(),
      stdout: z.string(),
      stderr: z.string()
    })
    .optional()
});

export const submitOnboardingInputSchema = z.object({
  providerId: z.string().trim().min(1),
  env: z.record(z.string(), z.string()).default({})
});

export const updateGatewayInputSchema = z.object({
  mode: workbenchGatewayModeSchema,
  remoteUrl: z.string().trim().max(1024).optional(),
  remoteToken: z.string().trim().max(2048).optional(),
  timeoutMs: z.number().int().min(1000).max(120_000).optional()
});

export const runGuidedAuthInputSchema = z.object({
  providerId: z.string().trim().min(1)
});

export const runGuidedAuthResultSchema = z.object({
  providerId: z.string(),
  env: z.record(z.string(), z.string()),
  note: z.string().optional(),
  notes: z.array(z.string())
});

export type WorkbenchGuidedAuthResult = z.infer<typeof runGuidedAuthResultSchema>;
export type WorkbenchSendMessageResult = z.infer<typeof sendMessageResultSchema>;
export type WorkbenchAgentCreationResult = z.infer<typeof agentCreationResultSchema>;
export type WorkbenchAgentDeletionResult = z.infer<typeof agentDeletionResultSchema>;
