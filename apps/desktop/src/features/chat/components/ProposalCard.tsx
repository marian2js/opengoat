import { useState } from "react";
import {
  LinkIcon,
  PlayIcon,
  TargetIcon,
  XIcon,
} from "lucide-react";
import type { ChatScope } from "@/features/chat/lib/chat-scope";
import type { SidecarClient } from "@/lib/sidecar/client";
import { ObjectiveCreationSheet } from "@/features/dashboard/components/ObjectiveCreationSheet";
import { ObjectivePicker } from "@/features/chat/components/ObjectivePicker";
import { PlaybookPicker } from "@/features/chat/components/PlaybookPicker";

interface ProposalCardProps {
  goalPhrase: string;
  sessionId: string;
  scope: ChatScope;
  setScope: (scope: ChatScope) => void;
  client: SidecarClient;
  agentId: string;
  onDismiss: () => void;
}

export function ProposalCard({
  goalPhrase,
  sessionId,
  scope,
  setScope,
  client,
  agentId,
  onDismiss,
}: ProposalCardProps) {
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showObjectivePicker, setShowObjectivePicker] = useState(false);
  const [showPlaybookPicker, setShowPlaybookPicker] = useState(false);

  const isObjectiveScoped = scope.type === "objective" || scope.type === "run";

  const handleObjectiveSelect = (objectiveId: string) => {
    setScope({ type: "objective", objectiveId });
    setShowObjectivePicker(false);
  };

  return (
    <>
      <div className="relative mt-3 rounded-lg border border-primary/20 bg-primary/[0.04] px-3.5 py-3">
        {/* Dismiss button */}
        <button
          type="button"
          className="absolute right-2 top-2 inline-flex size-5 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-muted/50 hover:text-muted-foreground"
          onClick={onDismiss}
        >
          <XIcon className="size-3" />
        </button>

        {/* Header */}
        <p className="pr-6 text-[12px] font-medium text-foreground/80">
          This sounds like a goal. Want to track it?
        </p>

        {/* Actions */}
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/8 px-2.5 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
            onClick={() => setShowCreateSheet(true)}
          >
            <TargetIcon className="size-3" />
            Create Objective
          </button>

          {!isObjectiveScoped ? (
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                onClick={() => setShowObjectivePicker(!showObjectivePicker)}
              >
                <LinkIcon className="size-3" />
                Attach to Objective
              </button>
              {showObjectivePicker ? (
                <ObjectivePicker
                  agentId={agentId}
                  client={client}
                  onSelect={handleObjectiveSelect}
                  onClear={() => setShowObjectivePicker(false)}
                  onClose={() => setShowObjectivePicker(false)}
                />
              ) : null}
            </div>
          ) : null}

          <div className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              onClick={() => setShowPlaybookPicker(!showPlaybookPicker)}
            >
              <PlayIcon className="size-3" />
              Start Playbook
            </button>
            {showPlaybookPicker ? (
              <PlaybookPicker
                client={client}
                agentId={agentId}
                scope={scope}
                setScope={setScope}
                sessionId={sessionId}
                onClose={() => setShowPlaybookPicker(false)}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Objective creation sheet */}
      <ObjectiveCreationSheet
        open={showCreateSheet}
        onOpenChange={setShowCreateSheet}
        agentId={agentId}
        client={client}
        prefillTitle={goalPhrase}
      />
    </>
  );
}
