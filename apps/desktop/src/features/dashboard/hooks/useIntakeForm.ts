import { useCallback, useState } from "react";
import type { ActionCard } from "@/features/dashboard/data/actions";
import { starterActions } from "@/features/dashboard/data/actions";
import { getIntakeFields, type IntakeFieldSet } from "@/features/dashboard/data/intake-fields";
import { buildActionPromptWithIntake } from "@/features/dashboard/data/prompt-builder";

export interface UseIntakeFormOptions {
  suggestedActions: ActionCard[];
  onSubmitAction: (actionId: string, prompt: string, label: string) => Promise<void>;
}

export interface UseIntakeFormResult {
  intakeFormOpen: boolean;
  pendingIntakeAction: ActionCard | null;
  pendingIntakeFields: IntakeFieldSet | null;
  handleJobCardClick: (actionId: string, prompt: string, label: string) => void;
  handleIntakeFormSubmit: (values: Record<string, string>) => void;
  closeIntakeForm: () => void;
}

export function useIntakeForm({
  suggestedActions,
  onSubmitAction,
}: UseIntakeFormOptions): UseIntakeFormResult {
  const [intakeFormOpen, setIntakeFormOpen] = useState(false);
  const [pendingIntakeAction, setPendingIntakeAction] = useState<ActionCard | null>(null);
  const [pendingIntakeFields, setPendingIntakeFields] = useState<IntakeFieldSet | null>(null);

  const closeIntakeForm = useCallback(() => {
    setIntakeFormOpen(false);
    setPendingIntakeAction(null);
    setPendingIntakeFields(null);
  }, []);

  const handleIntakeFormSubmit = useCallback(
    (values: Record<string, string>) => {
      if (!pendingIntakeAction) return;
      const enrichedPrompt = buildActionPromptWithIntake(pendingIntakeAction, values);
      closeIntakeForm();
      void onSubmitAction(pendingIntakeAction.id, enrichedPrompt, pendingIntakeAction.title);
    },
    [pendingIntakeAction, onSubmitAction, closeIntakeForm],
  );

  const handleJobCardClick = useCallback(
    (actionId: string, prompt: string, label: string) => {
      const allActions = [...starterActions, ...suggestedActions];
      const card = allActions.find((a) => a.id === actionId);
      const intakeKey = card?.intakeFields;

      if (intakeKey) {
        const fields = getIntakeFields(intakeKey);
        if (fields && card) {
          setPendingIntakeAction(card);
          setPendingIntakeFields(fields);
          setIntakeFormOpen(true);
          return;
        }
      }

      void onSubmitAction(actionId, prompt, label);
    },
    [suggestedActions, onSubmitAction],
  );

  return {
    intakeFormOpen,
    pendingIntakeAction,
    pendingIntakeFields,
    handleJobCardClick,
    handleIntakeFormSubmit,
    closeIntakeForm,
  };
}
