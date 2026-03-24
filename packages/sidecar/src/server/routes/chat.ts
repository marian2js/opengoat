import { randomUUID } from "node:crypto";
import { chatBootstrapSchema } from "@opengoat/contracts";
import { validateUIMessages } from "ai";
import { Hono } from "hono";
import { z } from "zod";
import type { SidecarRuntime } from "../context.ts";
import {
  fetchObjectiveContext,
  composeObjectiveContext,
  type FetchableScope,
} from "../../context-composer/index.ts";

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
      } catch {
        // Context injection failed — continue without it
      }
    }

    const messages = await validateUIMessages({
      messages: [normalizedMessage],
    });
    const message = messages[0];
    if (!message) {
      throw new Error("Chat message cannot be empty.");
    }

    return createChatService().streamConversation({
      ...(payload.agentId ? { agentId: payload.agentId } : {}),
      message,
      ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
    });
  });

  return app;
}
