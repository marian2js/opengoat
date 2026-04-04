import type { MemoryService } from "@opengoat/core";
import type { OpenGoatPaths } from "@opengoat/core";
import type { EmbeddedGatewayClient } from "../internal-gateway/gateway-client.ts";
import { extractInsights } from "./insight-extractor.ts";
import type { InsightExtractorDeps } from "./insight-extractor.ts";

const MAX_SPECIALIST_MEMORIES = 20;
const MIN_ASSISTANT_MESSAGES = 2;

export interface AccumulationContext {
  agentId: string;
  specialistId: string;
  sessionId: string;
}

export interface AccumulationDeps {
  memoryService: Pick<
    MemoryService,
    "createMemory" | "listMemories" | "updateMemory" | "resolveConflict"
  >;
  embeddedGateway: Pick<EmbeddedGatewayClient, "bootstrapConversation">;
  opengoatPaths: OpenGoatPaths;
  apiKey: string;
  model: string;
  specialistName: string;
}

export interface AccumulationResult {
  created: number;
  updated: number;
  superseded: number;
  skipped: number;
}

const EMPTY_RESULT: AccumulationResult = {
  created: 0,
  updated: 0,
  superseded: 0,
  skipped: 0,
};

export async function accumulateMemories(
  context: AccumulationContext,
  deps: AccumulationDeps,
): Promise<AccumulationResult> {
  // Step 1: Fetch transcript
  const bootstrap = await deps.embeddedGateway.bootstrapConversation(
    context.agentId,
    context.sessionId,
  );

  const messages = bootstrap.messages;
  const assistantMessages = messages.filter((m) => m.role === "assistant");

  // Guard: skip if session is too short
  if (assistantMessages.length < MIN_ASSISTANT_MESSAGES) {
    return { ...EMPTY_RESULT };
  }

  // Step 2: Format transcript
  const transcript = messages
    .map((m) => `[${m.role}]: ${m.text}`)
    .join("\n\n");

  // Step 3: Fetch existing memories
  const existingMemories = await deps.memoryService.listMemories(
    deps.opengoatPaths,
    {
      projectId: context.agentId,
      category: "specialist_context",
      specialistId: context.specialistId,
      scope: "project",
      activeOnly: true,
    },
  );

  // Step 4: Extract insights via LLM
  const extractorDeps: InsightExtractorDeps = {
    apiKey: deps.apiKey,
    model: deps.model,
  };

  const insights = await extractInsights(
    {
      transcript,
      specialistId: context.specialistId,
      specialistName: deps.specialistName,
      existingMemories: existingMemories.map((m) => ({
        memoryId: m.memoryId,
        content: m.content,
      })),
      currentCount: existingMemories.length,
      maxMemories: MAX_SPECIALIST_MEMORIES,
    },
    extractorDeps,
  );

  // Step 5: Process insight actions
  const result: AccumulationResult = { ...EMPTY_RESULT };
  let currentCount = existingMemories.length;

  for (const insight of insights) {
    switch (insight.action) {
      case "create": {
        // Enforce cap
        if (currentCount >= MAX_SPECIALIST_MEMORIES) {
          result.skipped++;
          break;
        }
        await deps.memoryService.createMemory(deps.opengoatPaths, {
          projectId: context.agentId,
          category: "specialist_context",
          scope: "project",
          content: insight.content,
          source: "specialist-chat",
          createdBy: "system",
          specialistId: context.specialistId,
          confidence: 0.8,
          userConfirmed: false,
        });
        currentCount++;
        result.created++;
        break;
      }
      case "update": {
        await deps.memoryService.updateMemory(
          deps.opengoatPaths,
          insight.existingMemoryId,
          { content: insight.content },
        );
        result.updated++;
        break;
      }
      case "supersede": {
        const newMemory = await deps.memoryService.createMemory(
          deps.opengoatPaths,
          {
            projectId: context.agentId,
            category: "specialist_context",
            scope: "project",
            content: insight.content,
            source: "specialist-chat",
            createdBy: "system",
            specialistId: context.specialistId,
            confidence: 0.8,
            userConfirmed: false,
            supersedes: insight.existingMemoryId,
          },
        );
        await deps.memoryService.resolveConflict(
          deps.opengoatPaths,
          newMemory.memoryId,
          insight.existingMemoryId,
        );
        // supersede doesn't increase net count (replaces one)
        result.superseded++;
        break;
      }
    }
  }

  return result;
}
