import { randomUUID } from "node:crypto";
import { chatBootstrapSchema } from "@opengoat/contracts";
import { validateUIMessages } from "ai";
import { Hono } from "hono";
import { z } from "zod";
import { extractArtifacts } from "../../artifact-extractor/index.ts";
import { accumulateMemories } from "../../memory-accumulator/index.ts";
import type { SidecarRuntime } from "../context.ts";
import {
  fetchObjectiveContext,
  composeObjectiveContext,
  composeSpecialistContext,
  composePlaybookPhaseContext,
  type FetchableScope,
} from "../../context-composer/index.ts";
import { getSpecialistById } from "@opengoat/core";

const textPartSchema = z.object({
  text: z.string(),
  type: z.literal("text"),
});

const filePartSchema = z.object({
  mediaType: z.string(),
  type: z.literal("file"),
  url: z.string(),
  filename: z.string().optional(),
});

const scopeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("objective"),
    objectiveId: z.string().min(1),
  }),
  z.object({
    type: z.literal("run"),
    objectiveId: z.string().min(1),
    runId: z.string().min(1),
  }),
]);

const chatRequestSchema = z.object({
  agentId: z.string().min(1).optional(),
  message: z.union([
    z.string().min(1),
    z.object({
      id: z.string().min(1),
      parts: z.array(z.union([textPartSchema, filePartSchema])).min(1),
      role: z.literal("user"),
    }),
  ]),
  scope: scopeSchema.optional(),
  specialistId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
});

interface ChatRouteOptions {
  createChatService?: () => Pick<
    SidecarRuntime["embeddedGateway"],
    "bootstrapConversation" | "streamConversation"
  >;
}

export function createChatRoutes(
  runtime: SidecarRuntime,
  options: ChatRouteOptions = {},
): Hono {
  const app = new Hono();
  const createChatService =
    options.createChatService ?? (() => runtime.embeddedGateway);

  app.get("/bootstrap", async (context) => {
    const agentId = context.req.query("agentId")?.trim();
    const sessionId = context.req.query("sessionId")?.trim();
    const bootstrap = await createChatService().bootstrapConversation(
      agentId,
      sessionId || undefined,
    );
    return context.json(chatBootstrapSchema.parse(bootstrap));
  });

  app.post("/", async (context) => {
    const payload = chatRequestSchema.parse(await context.req.json());
    const normalizedMessage =
      typeof payload.message === "string"
        ? {
            id: randomUUID(),
            parts: [
              {
                text: payload.message.trim(),
                type: "text" as const,
              },
            ],
            role: "user" as const,
          }
        : payload.message;

    // Inject objective context when scope is present
    if (payload.scope && payload.agentId) {
      try {
        const contextInput = await fetchObjectiveContext(
          runtime,
          payload.scope as FetchableScope,
          payload.agentId,
        );
        const contextBlock = composeObjectiveContext(contextInput);
        if (contextBlock) {
          // Prepend context block to the first text part
          const textPartIndex = normalizedMessage.parts.findIndex(
            (p) => p.type === "text",
          );
          if (textPartIndex >= 0) {
            const textPart = normalizedMessage.parts[textPartIndex] as { text: string; type: "text" };
            normalizedMessage.parts[textPartIndex] = {
              text: `${contextBlock}\n\n${textPart.text}`,
              type: "text" as const,
            };
          }
        }

        // Inject playbook phase context when run is scoped to a playbook
        if (contextInput.playbook && contextInput.run) {
          const phaseBlock = composePlaybookPhaseContext({
            run: contextInput.run,
            playbook: contextInput.playbook,
            artifacts: contextInput.artifacts,
          });
          if (phaseBlock) {
            const textPartIndex = normalizedMessage.parts.findIndex(
              (p) => p.type === "text",
            );
            if (textPartIndex >= 0) {
              const textPart = normalizedMessage.parts[textPartIndex] as { text: string; type: "text" };
              normalizedMessage.parts[textPartIndex] = {
                text: `${phaseBlock}\n\n${textPart.text}`,
                type: "text" as const,
              };
            }
          }
        }
      } catch {
        // Context injection failed — continue without it
      }
    }

    // Inject specialist context when specialistId is present
    if (payload.specialistId && payload.agentId) {
      try {
        const specialistMemories = await runtime.memoryService.listMemories(
          runtime.opengoatPaths,
          {
            projectId: payload.agentId,
            category: "specialist_context",
            specialistId: payload.specialistId,
            scope: "project",
            activeOnly: true,
          },
        );

        const specialist = getSpecialistById(payload.specialistId);
        const specialistName = specialist?.name ?? payload.specialistId;

        const specialistBlock = composeSpecialistContext({
          instructionTemplate: specialist?.instructionTemplate,
          memories: specialistMemories,
          specialistName,
        });

        if (specialistBlock) {
          const textPartIndex = normalizedMessage.parts.findIndex(
            (p) => p.type === "text",
          );
          if (textPartIndex >= 0) {
            const textPart = normalizedMessage.parts[textPartIndex] as { text: string; type: "text" };
            normalizedMessage.parts[textPartIndex] = {
              text: `${specialistBlock}\n\n${textPart.text}`,
              type: "text" as const,
            };
          }
        }
      } catch {
        // Specialist context injection failed — continue without it
      }
    }

    const messages = await validateUIMessages({
      messages: [normalizedMessage],
    });
    const message = messages[0];
    if (!message) {
      throw new Error("Chat message cannot be empty.");
    }

    // Build onComplete callback for artifact extraction when specialist is active
    let onComplete: ((text: string) => Promise<void>) | undefined;
    if (payload.specialistId && payload.agentId) {
      const specialist = getSpecialistById(payload.specialistId);
      if (specialist) {
        const agentId = payload.agentId;
        const sessionId = payload.sessionId ?? "";
        const scopeObjectiveId = payload.scope?.type === "objective" || payload.scope?.type === "run"
          ? payload.scope.objectiveId
          : undefined;
        const scopeRunId = payload.scope?.type === "run" ? payload.scope.runId : undefined;
        onComplete = async (text: string) => {
          try {
            const result = await extractArtifacts(text, {
              specialistId: specialist.id,
              agentId,
              sessionId,
              objectiveId: scopeObjectiveId,
              runId: scopeRunId,
            }, {
              artifactService: runtime.artifactService,
              opengoatPaths: runtime.opengoatPaths,
              specialist,
            });

            // Check phase progress after extraction when run-scoped (fire-and-forget)
            if (scopeRunId && result.artifacts.length > 0) {
              runtime.playbookExecutionService.checkPhaseProgress(
                runtime.opengoatPaths,
                scopeRunId,
              ).catch(() => {
                // Phase check is best-effort — must not affect chat
              });
            }
          } catch {
            // Fire-and-forget: extraction must not affect the chat response
          }
        };
      }
    }

    return createChatService().streamConversation({
      ...(payload.agentId ? { agentId: payload.agentId } : {}),
      message,
      ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
      ...(onComplete ? { onComplete } : {}),
    });
  });

  const endSessionSchema = z.object({
    agentId: z.string().min(1),
    specialistId: z.string().min(1),
    sessionId: z.string().min(1),
  });

  app.post("/end-session", async (context) => {
    const body = endSessionSchema.safeParse(await context.req.json());
    if (!body.success) {
      return context.json({ error: "agentId, specialistId, and sessionId are required" }, 400);
    }

    const { agentId, specialistId, sessionId } = body.data;
    const specialist = getSpecialistById(specialistId);
    if (!specialist) {
      return context.json({ error: `Unknown specialist: ${specialistId}` }, 400);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL;
    if (!apiKey || !model) {
      return context.json({ created: 0, updated: 0, superseded: 0, skipped: 0 });
    }

    try {
      const result = await accumulateMemories(
        { agentId, specialistId, sessionId },
        {
          memoryService: runtime.memoryService,
          embeddedGateway: runtime.embeddedGateway,
          opengoatPaths: runtime.opengoatPaths,
          apiKey,
          model,
          specialistName: specialist.name,
        },
      );
      return context.json(result);
    } catch (error) {
      console.error("Memory accumulation failed:", error);
      return context.json({ created: 0, updated: 0, superseded: 0, skipped: 0 });
    }
  });

  return app;
}
