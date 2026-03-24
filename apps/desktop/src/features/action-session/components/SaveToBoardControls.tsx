import { useState } from "react";
import { CheckCircleIcon, ClipboardListIcon, LoaderCircleIcon } from "lucide-react";
import type { OutputBlock } from "../types";
import type { SidecarClient } from "@/lib/sidecar/client";

interface SaveToBoardControlsProps {
  outputs: OutputBlock[];
  client: SidecarClient;
  agentId: string;
  sessionId: string;
  actionTitle: string;
  onSaved: () => void;
  onSkip: () => void;
}

export function SaveToBoardControls({
  outputs,
  client,
  agentId,
  sessionId,
  actionTitle,
  onSaved,
  onSkip,
}: SaveToBoardControlsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(outputs.map((o) => o.id)),
  );

  function toggleOutput(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSave() {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // Create a run for this action session
      const run = await client.createRun({
        projectId: agentId,
        objectiveId: agentId, // Use agentId as fallback objectiveId
        title: actionTitle,
        startedFrom: "action",
        agentId,
        sessionId,
      });

      // Create tasks for each selected output
      const selected = outputs.filter((o) => selectedIds.has(o.id));
      for (const output of selected) {
        await client.createTaskFromRun({
          runId: run.runId,
          objectiveId: run.objectiveId,
          title: output.title,
          description: output.content.slice(0, 500),
        });
      }

      onSaved();
    } catch (error) {
      console.error("Failed to save to board", error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-5 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <CheckCircleIcon className="size-4 text-primary" />
        <p className="text-sm font-medium text-foreground">
          This work is ready. Save to Board?
        </p>
      </div>

      {/* Output checklist */}
      <div className="mb-4 space-y-2">
        {outputs.map((output) => (
          <label
            key={output.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-background/50"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(output.id)}
              onChange={() => toggleOutput(output.id)}
              className="size-3.5 rounded border-border accent-primary"
            />
            <span className="truncate text-sm text-foreground/80">
              {output.title}
            </span>
          </label>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || selectedIds.size === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving ? (
            <LoaderCircleIcon className="size-3 animate-spin" />
          ) : (
            <ClipboardListIcon className="size-3" />
          )}
          Save to Board
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip — I'm done
        </button>
      </div>
    </div>
  );
}
