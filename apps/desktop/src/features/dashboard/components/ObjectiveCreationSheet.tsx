import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  LoaderCircleIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { Objective } from "@/features/dashboard/types/objective";
import { useObjectiveCreation } from "@/features/dashboard/hooks/useObjectiveCreation";
import { useObjectiveBrief } from "@/features/dashboard/hooks/useObjectiveBrief";
import { ObjectiveBriefPanel } from "@/features/dashboard/components/ObjectiveBriefPanel";

export interface ObjectiveCreationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  client: SidecarClient;
  prefillTitle?: string | undefined;
  onObjectiveCreated?: (() => void) | undefined;
}

type DialogPhase = "form" | "brief";

export function ObjectiveCreationSheet({
  open,
  onOpenChange,
  agentId,
  client,
  prefillTitle,
  onObjectiveCreated,
}: ObjectiveCreationSheetProps) {
  const [phase, setPhase] = useState<DialogPhase>("form");
  const [showAllFields, setShowAllFields] = useState(false);
  const [createdObjective, setCreatedObjective] = useState<Objective | null>(null);

  const {
    formState,
    setField,
    isSubmitting,
    error: formError,
    create,
    reset,
  } = useObjectiveCreation(agentId, client);

  const {
    brief,
    isGenerating: isBriefGenerating,
    error: briefError,
    generate: generateBrief,
  } = useObjectiveBrief(agentId, client);

  // Pre-fill title when the sheet opens with a prefill value
  if (prefillTitle && formState.title === "" && phase === "form") {
    setField("title", prefillTitle);
  }

  async function handleCreateDraft(): Promise<void> {
    const result = await create();
    if (result) {
      setCreatedObjective(result);
      setPhase("brief");
      void generateBrief(
        formState.title,
        formState.successDefinition || undefined,
      );
    }
  }

  function handleAcceptBrief(): void {
    // Update the objective with brief data if available
    if (createdObjective?.objectiveId && brief) {
      void client.updateObjective(createdObjective.objectiveId, {
        summary: brief.summary,
        constraints: brief.constraints.join("; "),
        status: "active",
      });
    }
    handleClose();
  }

  function handleEditBrief(): void {
    // Go back to form with brief data pre-filled
    setPhase("form");
    setShowAllFields(true);
    if (brief?.summary) {
      setField("notes", brief.summary);
    }
  }

  function handleSkipBrief(): void {
    handleClose();
  }

  function handleClose(): void {
    onOpenChange(false);
    // Reset state after animation completes
    window.setTimeout(() => {
      reset();
      setPhase("form");
      setShowAllFields(false);
      setCreatedObjective(null);
      onObjectiveCreated?.();
    }, 200);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] flex-col sm:max-w-lg"
      >
        {phase === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold tracking-tight">
                Create objective
              </DialogTitle>
              <DialogDescription className="text-[13px]">
                Define what you want to achieve. Start with a title — the AI
                will fill in the rest.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-2">
              {/* Title — always shown */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="obj-title"
                  className="text-[13px] font-medium text-foreground/80"
                >
                  What do you want help with?
                </label>
                <Input
                  id="obj-title"
                  placeholder="e.g. Launch on Product Hunt next week"
                  value={formState.title}
                  onChange={(e) => setField("title", e.target.value)}
                />
              </div>

              {/* Success definition — always shown in fast-start */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="obj-success"
                  className="text-[13px] font-medium text-foreground/80"
                >
                  What does success look like?
                  <span className="ml-1 text-muted-foreground/50">(optional)</span>
                </label>
                <Textarea
                  id="obj-success"
                  placeholder="e.g. 200+ upvotes, top 5 of the day"
                  value={formState.successDefinition}
                  onChange={(e) =>
                    setField("successDefinition", e.target.value)
                  }
                  className="min-h-[3rem]"
                />
              </div>

              {/* Toggle for full form */}
              <button
                type="button"
                className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setShowAllFields(!showAllFields)}
              >
                {showAllFields ? (
                  <>
                    <ChevronUpIcon className="size-3.5" />
                    Fewer fields
                  </>
                ) : (
                  <>
                    <ChevronDownIcon className="size-3.5" />
                    More fields
                  </>
                )}
              </button>

              {/* Full form fields — toggled */}
              {showAllFields ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="obj-tried"
                      className="text-[13px] font-medium text-foreground/80"
                    >
                      What have you already tried?
                    </label>
                    <Textarea
                      id="obj-tried"
                      placeholder="Previous attempts, what worked or didn't..."
                      value={formState.alreadyTried}
                      onChange={(e) =>
                        setField("alreadyTried", e.target.value)
                      }
                      className="min-h-[3rem]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="obj-avoid"
                      className="text-[13px] font-medium text-foreground/80"
                    >
                      Anything to avoid?
                    </label>
                    <Textarea
                      id="obj-avoid"
                      placeholder="Channels, approaches, or messaging to steer clear of..."
                      value={formState.avoid}
                      onChange={(e) => setField("avoid", e.target.value)}
                      className="min-h-[3rem]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="obj-timeframe"
                      className="text-[13px] font-medium text-foreground/80"
                    >
                      Timeframe
                    </label>
                    <Input
                      id="obj-timeframe"
                      placeholder="e.g. This week, Next 2 weeks, No deadline"
                      value={formState.timeframe}
                      onChange={(e) => setField("timeframe", e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="obj-channels"
                      className="text-[13px] font-medium text-foreground/80"
                    >
                      Channel preferences
                    </label>
                    <Input
                      id="obj-channels"
                      placeholder="e.g. SEO, social, email, communities..."
                      value={formState.preferredChannels}
                      onChange={(e) =>
                        setField("preferredChannels", e.target.value)
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="obj-notes"
                      className="text-[13px] font-medium text-foreground/80"
                    >
                      Notes
                    </label>
                    <Textarea
                      id="obj-notes"
                      placeholder="Any other context..."
                      value={formState.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                      className="min-h-[3rem]"
                    />
                  </div>
                </div>
              ) : null}

              {/* Error */}
              {formError ? (
                <div className="rounded-lg border border-red-500/15 bg-red-500/5 px-3 py-2 text-[13px] text-red-400">
                  {formError}
                </div>
              ) : null}
            </div>

            {/* Submit */}
            <div className="mt-auto flex items-center justify-end gap-3 border-t border-border/30 p-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                disabled={!formState.title.trim() || isSubmitting}
                onClick={() => void handleCreateDraft()}
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircleIcon className="size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create objective"
                )}
              </Button>
            </div>
          </>
        ) : (
          /* Brief phase */
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold tracking-tight">
                Objective brief
              </DialogTitle>
              <DialogDescription>
                {createdObjective?.title
                  ? `Brief for "${createdObjective.title}"`
                  : "AI-generated brief based on your objective and project context."}
              </DialogDescription>
            </DialogHeader>

            <ObjectiveBriefPanel
              brief={brief}
              isGenerating={isBriefGenerating}
              error={briefError}
              onAccept={handleAcceptBrief}
              onEdit={handleEditBrief}
              onSkip={handleSkipBrief}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
