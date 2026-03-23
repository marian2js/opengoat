import { useCallback, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { Objective } from "@/features/dashboard/types/objective";

export interface ObjectiveFormState {
  title: string;
  successDefinition: string;
  alreadyTried: string;
  avoid: string;
  timeframe: string;
  preferredChannels: string;
  notes: string;
}

const INITIAL_FORM_STATE: ObjectiveFormState = {
  title: "",
  successDefinition: "",
  alreadyTried: "",
  avoid: "",
  timeframe: "",
  preferredChannels: "",
  notes: "",
};

export interface UseObjectiveCreationResult {
  formState: ObjectiveFormState;
  setField: (field: keyof ObjectiveFormState, value: string) => void;
  isSubmitting: boolean;
  error: string | null;
  create: () => Promise<Objective | null>;
  reset: () => void;
}

/**
 * Manages objective creation form state and submission.
 *
 * On submit, calls `client.createObjective(...)` with status "draft",
 * then `client.setPrimaryObjective(...)` to make it the active objective.
 */
export function useObjectiveCreation(
  agentId: string,
  client: SidecarClient,
): UseObjectiveCreationResult {
  const [formState, setFormState] = useState<ObjectiveFormState>(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = useCallback(
    (field: keyof ObjectiveFormState, value: string) => {
      setFormState((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const reset = useCallback(() => {
    setFormState(INITIAL_FORM_STATE);
    setError(null);
  }, []);

  const create = useCallback(async (): Promise<Objective | null> => {
    if (!formState.title.trim()) {
      setError("Title is required");
      return null;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = (await client.createObjective({
        projectId: agentId,
        title: formState.title.trim(),
        successDefinition: formState.successDefinition.trim() || undefined,
        alreadyTried: formState.alreadyTried.trim() || undefined,
        avoid: formState.avoid.trim() || undefined,
        timeframe: formState.timeframe.trim() || undefined,
        preferredChannels: formState.preferredChannels.trim()
          ? formState.preferredChannels.split(",").map((c) => c.trim()).filter(Boolean)
          : undefined,
      })) as Objective;

      // Make it the primary active objective
      if (result?.objectiveId) {
        await client.setPrimaryObjective(agentId, result.objectiveId);
      }

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create objective";
      setError(message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [agentId, client, formState]);

  return { formState, setField, isSubmitting, error, create, reset };
}
