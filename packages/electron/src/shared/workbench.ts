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
