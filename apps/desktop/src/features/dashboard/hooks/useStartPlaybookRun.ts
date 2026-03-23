import { useCallback, useState } from "react";
import type { AgentSession, PlaybookManifest } from "@opengoat/contracts";
import type { SidecarClient } from "@/lib/sidecar/client";
import { buildRunPrompt } from "@/features/dashboard/lib/run-prompt-composer";

export interface UseStartPlaybookRunParams {
  client: SidecarClient;
  activeAgentId: string;
  activeObjectiveId: string | undefined;
  projectId: string;
  onSessionCreated: (
    session: AgentSession,
    prompt: string,
    runId: string,
  ) => void;
}

export interface UseStartPlaybookRunResult {
  startRun: (playbook: PlaybookManifest) => Promise<void>;
  isStarting: boolean;
  error: Error | null;
}

/**
 * Orchestrates the full run + session creation flow:
 * 1. Fetch objective details
 * 2. Create agent session
 * 3. Create run with session linked
 * 4. Compose structured prompt
 * 5. Transition run to running
 * 6. Callback to App.tsx for navigation
 */
export function useStartPlaybookRun({
  client,
  activeAgentId,
  activeObjectiveId,
  projectId,
  onSessionCreated,
}: UseStartPlaybookRunParams): UseStartPlaybookRunResult {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const startRun = useCallback(
    async (playbook: PlaybookManifest) => {
      if (isStarting || !activeObjectiveId) {
        return;
      }
      setIsStarting(true);
      setError(null);

      try {
        // 1. Fetch objective
        const objective = await client.getObjective(activeObjectiveId);

        // 2. Generate run title
        const runTitle = `${playbook.title}: ${objective.title}`;

        // 3. Extract first phase
        const firstPhase = playbook.defaultPhases[0];

        // 4. Create agent session
        const session = await client.createSession({
          agentId: activeAgentId,
          label: runTitle,
        });

        // 5. Create run with session linked
        const run = await client.createRun({
          projectId,
          objectiveId: activeObjectiveId,
          playbookId: playbook.playbookId,
          title: runTitle,
          startedFrom: "dashboard",
          phase: firstPhase?.name ?? "",
          phaseSummary: firstPhase?.description ?? "",
          sessionId: session.id,
          agentId: activeAgentId,
        });

        // 6. Compose structured prompt
        const composedPrompt = buildRunPrompt({
          playbook,
          objective,
          phaseName: firstPhase?.name ?? "",
        });

        // 7. Transition run to running
        await client.updateRunStatus(run.runId, "running");

        // 8. Callback — App.tsx handles state + navigation
        onSessionCreated(session, composedPrompt, run.runId);
      } catch (err) {
        const wrapped =
          err instanceof Error ? err : new Error("Failed to start playbook run");
        setError(wrapped);
        console.error("Failed to start playbook run", err);
      } finally {
        setIsStarting(false);
      }
    },
    [
      client,
      activeAgentId,
      activeObjectiveId,
      projectId,
      isStarting,
      onSessionCreated,
    ],
  );

  return { startRun, isStarting, error };
}
