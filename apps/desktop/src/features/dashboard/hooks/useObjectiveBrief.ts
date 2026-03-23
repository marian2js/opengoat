import { useCallback, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { ObjectiveBrief } from "@/features/dashboard/types/objective";
import { collectStreamText } from "@/features/dashboard/lib/stream-utils";

export interface UseObjectiveBriefResult {
  brief: ObjectiveBrief | null;
  isGenerating: boolean;
  error: string | null;
  generate: (title: string, successDefinition?: string) => Promise<void>;
}

const BRIEF_PROMPT_TEMPLATE = `You are a marketing strategist helping a founder plan their next objective.

Given the following objective, generate a concise brief that will help guide execution.

**Objective title:** {{title}}
{{successDefinition}}

Analyze the project context files (PRODUCT.md, MARKET.md, GROWTH.md) in this workspace to understand the business and market context.

Return ONLY a JSON object (no markdown fences, no explanation) with this exact structure:
{
  "summary": "A 2-3 sentence summary of what this objective aims to achieve and why it matters",
  "constraints": ["constraint 1", "constraint 2", "..."],
  "suggestedPlaybooks": ["playbook name 1", "playbook name 2", "..."],
  "missingInfo": ["question 1", "question 2", "..."],
  "likelyDeliverables": ["deliverable 1", "deliverable 2", "..."]
}

Guidelines:
- Summary should be specific to the project, not generic
- Constraints should be inferred from project context (budget, team size, market position)
- Suggested playbooks: choose from Launch Pack, Homepage Conversion Sprint, Outbound Starter, SEO Wedge Sprint, Content Sprint, Comparison Page Sprint, Lead Magnet Sprint, Onboarding Activation Pass
- Missing info: what does the founder need to clarify before execution?
- Likely deliverables: concrete outputs this objective should produce
`;

/**
 * Generates an AI-powered brief for a newly created objective.
 *
 * Creates an internal session, sends a brief generation prompt with the
 * objective title and success definition, then parses the JSON response.
 */
export function useObjectiveBrief(
  agentId: string,
  client: SidecarClient,
): UseObjectiveBriefResult {
  const [brief, setBrief] = useState<ObjectiveBrief | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (title: string, successDefinition?: string): Promise<void> => {
      setIsGenerating(true);
      setError(null);
      setBrief(null);

      try {
        // Build prompt
        let prompt = BRIEF_PROMPT_TEMPLATE.replace("{{title}}", title);
        prompt = prompt.replace(
          "{{successDefinition}}",
          successDefinition
            ? `**Success definition:** ${successDefinition}`
            : "",
        );

        // Create internal session for AI generation
        const session = await client.createSession({
          agentId,
          internal: true,
        });

        // Send chat message and collect stream
        const response = await client.sendChatMessage({
          agentId,
          message: prompt,
          sessionId: session.id,
        });

        const fullText = await collectStreamText(response);

        // Extract JSON from response (handle markdown fences if present)
        const jsonMatch = fullText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON found in AI response");
        }

        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

        const result: ObjectiveBrief = {
          summary: typeof parsed.summary === "string" ? parsed.summary : "",
          constraints: Array.isArray(parsed.constraints)
            ? (parsed.constraints as string[])
            : [],
          suggestedPlaybooks: Array.isArray(parsed.suggestedPlaybooks)
            ? (parsed.suggestedPlaybooks as string[])
            : [],
          missingInfo: Array.isArray(parsed.missingInfo)
            ? (parsed.missingInfo as string[])
            : [],
          likelyDeliverables: Array.isArray(parsed.likelyDeliverables)
            ? (parsed.likelyDeliverables as string[])
            : [],
        };

        setBrief(result);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to generate brief";
        setError(message);
      } finally {
        setIsGenerating(false);
      }
    },
    [agentId, client],
  );

  return { brief, isGenerating, error, generate };
}
