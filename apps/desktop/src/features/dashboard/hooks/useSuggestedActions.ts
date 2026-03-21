import { useEffect, useRef, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { ActionCard } from "@/features/dashboard/data/actions";
import {
  parseSuggestedActions,
  toActionCard,
  SUGGESTED_ACTIONS_FILENAME,
  SUGGESTED_ACTIONS_PROMPT,
} from "@/features/dashboard/data/suggested-actions";

export interface UseSuggestedActionsResult {
  suggestedActions: ActionCard[];
  isLoading: boolean;
}

/**
 * Reads the AI SDK data stream and collects the full text response.
 */
async function collectStreamText(response: Response): Promise<string> {
  const body = response.body;
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        // Type 0 = text delta: `0:"escaped text"`
        if (line.startsWith("0:")) {
          try {
            const text = JSON.parse(line.slice(2)) as string;
            result += text;
          } catch {
            // Malformed frame — skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return result;
}

/**
 * Loads or generates AI-suggested action cards for the workspace.
 *
 * - On mount (when workspaceReady is true): tries to load SUGGESTED_ACTIONS.json
 * - If the file exists and is valid: returns those cards
 * - If missing: generates via internal session, persists, and returns
 * - On any failure: returns empty array (Dashboard still works with fixed cards)
 */
export function useSuggestedActions(
  agentId: string,
  client: SidecarClient,
  workspaceReady: boolean,
): UseSuggestedActionsResult {
  const [suggestedActions, setSuggestedActions] = useState<ActionCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const generationAttemptedRef = useRef(false);

  useEffect(() => {
    if (!workspaceReady) return;

    let cancelled = false;
    generationAttemptedRef.current = false;

    async function loadOrGenerate(): Promise<void> {
      setIsLoading(true);

      try {
        // Step 1: Try to load existing suggested actions
        const existing = await client.readWorkspaceFile(agentId, SUGGESTED_ACTIONS_FILENAME).catch(() => null);

        if (cancelled) return;

        if (existing?.exists && existing.content) {
          const parsed = parseSuggestedActions(existing.content);
          if (parsed.length > 0) {
            setSuggestedActions(parsed.map(toActionCard));
            setIsLoading(false);
            return;
          }
        }

        // Step 2: Generate via internal session
        if (generationAttemptedRef.current) {
          setIsLoading(false);
          return;
        }
        generationAttemptedRef.current = true;

        const session = await client.createSession({ agentId, internal: true });
        if (cancelled) return;

        const response = await client.sendChatMessage({
          agentId,
          message: SUGGESTED_ACTIONS_PROMPT,
          sessionId: session.id,
        });
        if (cancelled) return;

        const fullText = await collectStreamText(response);
        if (cancelled) return;

        const parsed = parseSuggestedActions(fullText);
        if (parsed.length > 0) {
          // Persist for future loads
          await client.writeWorkspaceFile(
            agentId,
            SUGGESTED_ACTIONS_FILENAME,
            JSON.stringify(parsed, null, 2),
          ).catch((err: unknown) => {
            console.warn("Failed to persist suggested actions:", err);
          });

          if (!cancelled) {
            setSuggestedActions(parsed.map(toActionCard));
          }
        }
      } catch (err: unknown) {
        console.warn("useSuggestedActions: failed to load/generate:", err);
        // Graceful fallback — Dashboard works with just fixed cards
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    }

    void loadOrGenerate();

    return () => {
      cancelled = true;
    };
  }, [agentId, client, workspaceReady]);

  return { suggestedActions, isLoading };
}
