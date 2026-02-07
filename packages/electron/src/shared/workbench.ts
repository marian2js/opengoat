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

export const providerOnboardingFieldSchema = z.object({
  key: z.string(),
  description: z.string(),
  required: z.boolean().optional(),
  secret: z.boolean().optional()
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
  providers: z.array(workbenchOnboardingProviderSchema)
});

export const workbenchBootstrapSchema = z.object({
  homeDir: z.string(),
  projects: z.array(workbenchProjectSchema),
  onboarding: workbenchOnboardingSchema
});

export const workbenchStateSchema = z.object({
  schemaVersion: z.literal(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  projects: z.array(workbenchProjectSchema)
});

export type WorkbenchMessage = z.infer<typeof workbenchMessageSchema>;
export type WorkbenchSession = z.infer<typeof workbenchSessionSchema>;
export type WorkbenchProject = z.infer<typeof workbenchProjectSchema>;
export type WorkbenchState = z.infer<typeof workbenchStateSchema>;
export type WorkbenchOnboarding = z.infer<typeof workbenchOnboardingSchema>;
export type WorkbenchBootstrap = z.infer<typeof workbenchBootstrapSchema>;

export const addProjectInputSchema = z.object({
  rootPath: z.string().min(1)
});

export const createSessionInputSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().max(120).optional()
});

export const sessionLookupInputSchema = z.object({
  projectId: z.string().min(1),
  sessionId: z.string().min(1)
});

export const sendMessageInputSchema = sessionLookupInputSchema.extend({
  message: z.string().trim().min(1)
});

export const submitOnboardingInputSchema = z.object({
  providerId: z.string().trim().min(1),
  env: z.record(z.string(), z.string()).default({})
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
