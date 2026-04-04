import { z } from "zod";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { getKnowledgeHints } from "./specialist-knowledge-map.ts";

const insightActionSchema = z.object({
  insights: z.array(
    z.discriminatedUnion("action", [
      z.object({
        action: z.literal("create"),
        content: z.string().min(1),
      }),
      z.object({
        action: z.literal("update"),
        content: z.string().min(1),
        existingMemoryId: z.string().min(1),
      }),
      z.object({
        action: z.literal("supersede"),
        content: z.string().min(1),
        existingMemoryId: z.string().min(1),
      }),
    ]),
  ),
});

export type InsightAction = z.infer<typeof insightActionSchema>["insights"][number];

export interface ExtractionInput {
  transcript: string;
  specialistId: string;
  specialistName: string;
  existingMemories: Array<{ memoryId: string; content: string }>;
  currentCount: number;
  maxMemories: number;
}

export interface InsightExtractorDeps {
  apiKey: string;
  model: string;
}

function buildExtractionPrompt(input: ExtractionInput): string {
  const hints = getKnowledgeHints(input.specialistId);
  const domainLine = hints
    ? `Domain: ${hints.domain}`
    : `Domain: ${input.specialistName} specialist`;
  const hintLines = hints
    ? hints.extractionHints.map((h) => `  - ${h}`).join("\n")
    : "  - Key facts, decisions, and findings";

  const existingBlock =
    input.existingMemories.length > 0
      ? `\n## Existing memories for this specialist (${input.existingMemories.length} of ${input.maxMemories} max):\n${input.existingMemories.map((m) => `- [${m.memoryId}]: ${m.content}`).join("\n")}`
      : "\n## No existing memories for this specialist yet.";

  const capacityNote =
    input.currentCount >= input.maxMemories
      ? `\nIMPORTANT: This specialist is at the memory cap (${input.maxMemories}). Only return "update" or "supersede" actions — do NOT return "create" actions.`
      : input.currentCount >= input.maxMemories - 2
        ? `\nNote: This specialist has ${input.currentCount}/${input.maxMemories} memories. Be selective — only create new memories for truly important insights.`
        : "";

  return `You are analyzing a specialist chat session to extract key insights worth remembering for future sessions.

## Specialist: ${input.specialistName}
${domainLine}

## What to extract:
${hintLines}

## Rules:
- Extract ONLY concrete facts, decisions, and findings — not generic advice or conversational filler
- Each insight should be a single, specific piece of knowledge (1-2 sentences)
- If an insight overlaps with an existing memory, return an "update" action with the existing memory ID and the improved content
- If an insight completely replaces outdated information in an existing memory, return a "supersede" action
- If an insight is genuinely new, return a "create" action
- Skip anything already covered by existing memories
- Maximum 5 new insights per session
${capacityNote}
${existingBlock}

## Chat transcript:
${input.transcript}

Extract the key insights from this conversation.`;
}

export async function extractInsights(
  input: ExtractionInput,
  deps: InsightExtractorDeps,
): Promise<InsightAction[]> {
  const prompt = buildExtractionPrompt(input);

  const result = await generateObject({
    model: google(deps.model, { apiKey: deps.apiKey }),
    schema: insightActionSchema,
    prompt,
  });

  return result.object.insights;
}

// Exported for testing
export { buildExtractionPrompt };
