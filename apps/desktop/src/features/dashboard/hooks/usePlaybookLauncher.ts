import { useCallback, useState } from "react";
import type { AgentSession, PlaybookManifest } from "@opengoat/contracts";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { ActionCard } from "@/features/dashboard/data/actions";
import { buildRunPrompt } from "@/features/dashboard/lib/run-prompt-composer";
import { truncateSessionLabel } from "@/lib/utils/session-label";
import { toast } from "sonner";

export interface UsePlaybookLauncherOptions {
  agentId: string;
  client: SidecarClient;
  starterActions: ActionCard[];
  suggestedActions: ActionCard[];
  onActionClick?: (actionId: string, prompt: string, label: string) => void;
  onRunSessionCreated?: (session: AgentSession, prompt: string, runId: string, objectiveId?: string) => void;
}

export interface UsePlaybookLauncherResult {
  playbookFormOpen: boolean;
  pendingPlaybook: PlaybookManifest | null;
  isPlaybookStarting: boolean;
  handleActionOrPlaybookClick: (actionId: string, prompt: string, label: string) => Promise<void>;
  handlePlaybookFormSubmit: (inputs: Record<string, string>) => void;
  closePlaybookForm: () => void;
}

export function usePlaybookLauncher({
  agentId,
  client,
  starterActions,
  suggestedActions,
  onActionClick,
  onRunSessionCreated,
}: UsePlaybookLauncherOptions): UsePlaybookLauncherResult {
  const [playbookFormOpen, setPlaybookFormOpen] = useState(false);
  const [pendingPlaybook, setPendingPlaybook] = useState<PlaybookManifest | null>(null);
  const [pendingActionLabel, setPendingActionLabel] = useState("");
  const [isPlaybookStarting, setIsPlaybookStarting] = useState(false);

  const launchPlaybook = useCallback(
    async (manifest: PlaybookManifest, inputs: Record<string, string>, actionLabel: string) => {
      if (!onRunSessionCreated) return;
      setIsPlaybookStarting(true);
      try {
        const inputSummary = Object.values(inputs).filter(Boolean).join(" — ");
        const objectiveTitle = inputSummary
          ? `${manifest.title}: ${inputSummary.slice(0, 80)}`
          : manifest.title;

        const objective = await client.createObjective({
          projectId: agentId,
          title: objectiveTitle,
          summary: `Auto-created from dashboard action: ${actionLabel}`,
        });
        const objectiveId = (objective as Record<string, unknown>).objectiveId as string;

        const run = await client.startPlaybook(manifest.playbookId, {
          projectId: agentId,
          objectiveId,
        });

        const session = await client.createSession({
          agentId,
          label: truncateSessionLabel(objectiveTitle),
        });

        const composedPrompt = buildRunPrompt({
          playbook: manifest,
          objective: { title: objectiveTitle, summary: inputSummary || undefined },
          phaseName: run.phase,
        });

        let finalPrompt = composedPrompt;
        if (Object.keys(inputs).length > 0) {
          const inputBlock = Object.entries(inputs)
            .filter(([, v]) => v.trim())
            .map(([k, v]) => `- **${k}**: ${v}`)
            .join("\n");
          finalPrompt = `## User Inputs\n${inputBlock}\n\n${composedPrompt}`;
        }

        onRunSessionCreated(session, finalPrompt, run.runId, objectiveId);
        setPlaybookFormOpen(false);
      } catch (err) {
        console.error("Failed to launch playbook", err);
        toast.error("Failed to start playbook. Please try again.");
      } finally {
        setIsPlaybookStarting(false);
      }
    },
    [agentId, client, onRunSessionCreated],
  );

  const handleActionOrPlaybookClick = useCallback(
    async (actionId: string, prompt: string, label: string) => {
      const allActions = [...starterActions, ...suggestedActions];
      const card = allActions.find((a) => a.id === actionId);
      const playbookId = card?.playbookId;

      if (!playbookId || !onRunSessionCreated) {
        onActionClick?.(actionId, prompt, label);
        return;
      }

      try {
        const manifest = await client.getPlaybook(playbookId);
        if (manifest.requiredInputs.length > 0) {
          setPendingPlaybook(manifest);
          setPendingActionLabel(label);
          setPlaybookFormOpen(true);
        } else {
          await launchPlaybook(manifest, {}, label);
        }
      } catch (err) {
        console.error("Failed to fetch playbook manifest", err);
        onActionClick?.(actionId, prompt, label);
      }
    },
    [client, starterActions, suggestedActions, onActionClick, onRunSessionCreated, launchPlaybook],
  );

  const handlePlaybookFormSubmit = useCallback(
    (inputs: Record<string, string>) => {
      if (pendingPlaybook) {
        void launchPlaybook(pendingPlaybook, inputs, pendingActionLabel);
      }
    },
    [pendingPlaybook, pendingActionLabel, launchPlaybook],
  );

  const closePlaybookForm = useCallback(() => {
    setPlaybookFormOpen(false);
    setPendingPlaybook(null);
    setPendingActionLabel("");
  }, []);

  return {
    playbookFormOpen,
    pendingPlaybook,
    isPlaybookStarting,
    handleActionOrPlaybookClick,
    handlePlaybookFormSubmit,
    closePlaybookForm,
  };
}
