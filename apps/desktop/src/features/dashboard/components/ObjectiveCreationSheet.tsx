import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  LoaderCircleIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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

type SheetPhase = "form" | "brief";

export function ObjectiveCreationSheet({
  open,
  onOpenChange,
  agentId,
  client,
  prefillTitle,
  onObjectiveCreated,
}: ObjectiveCreationSheetProps) {
  const [phase, setPhase] = useState<SheetPhase>("form");
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col sm:max-w-md"
      >
        {phase === "form" ? (
          <>
            <SheetHeader>
              <SheetTitle className="font-display text-lg font-bold tracking-tight">
                Create objective
              </SheetTitle>
              <SheetDescription>
                Define what you want to achieve. Start with a title — you can
                add details now or let the AI infer them.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
              {/* Title — always shown */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="obj-title"
                  className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  What do you want help with? *
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
                  className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  What does success look like?
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
                className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                onClick={() => setShowAllFields(!showAllFields)}
              >
                {showAllFields ? (
                  <>
                    <ChevronUpIcon className="size-3.5" />
                    Hide extra fields
                  </>
                ) : (
                  <>
                    <ChevronDownIcon className="size-3.5" />
                    Show all fields
                  </>
                )}
              </button>

              {/* Full form fields — toggled */}
              {showAllFields ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="obj-tried"
                      className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
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
                      className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
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
                      className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      Timeframe / urgency
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
                      className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
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
                      className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
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
                <p className="text-sm text-destructive">{formError}</p>
              ) : null}
            </div>

            {/* Submit */}
            <div className="mt-auto border-t border-border/30 p-4">
              <Button
                variant="default"
                className="w-full gap-2"
                disabled={!formState.title.trim() || isSubmitting}
                onClick={() => void handleCreateDraft()}
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircleIcon className="size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create draft objective"
                )}
              </Button>
            </div>
          </>
        ) : (
          /* Brief phase */
          <>
            <SheetHeader>
              <SheetTitle className="font-display text-lg font-bold tracking-tight">
                Objective brief
              </SheetTitle>
              <SheetDescription>
                {createdObjective?.title
                  ? `Brief for "${createdObjective.title}"`
                  : "AI-generated brief based on your objective and project context."}
              </SheetDescription>
            </SheetHeader>

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
      </SheetContent>
    </Sheet>
  );
}
