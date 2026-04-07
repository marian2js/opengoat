import { useState } from "react";
import { AlertCircleIcon, CheckCircleIcon, ClipboardListIcon, LoaderCircleIcon } from "lucide-react";
import type { OutputBlock } from "../types";
import type { SidecarClient } from "@/lib/sidecar/client";
import { sanitizeTaskTitle } from "@/features/board/lib/sanitize-task-title";

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
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
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
    setError(null);

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
          title: sanitizeTaskTitle(output.title),
          description: output.content.slice(0, 500),
        }, agentId);
      }

      onSaved();
    } catch (err) {
      console.error("Failed to save to board", err);
      setError(err instanceof Error ? err.message : "Failed to save to board. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-5 rounded-xl border border-primary/15 bg-primary/[0.03] p-5 dark:border-primary/10 dark:bg-primary/[0.02]">
      <div className="mb-1.5 flex items-center gap-2.5">
        <div className="flex size-6 items-center justify-center rounded-full bg-primary/15">
          <CheckCircleIcon className="size-3.5 text-primary" />
        </div>
        <p className="text-[13px] font-medium text-foreground">
          Any concrete follow-up work? Save action items to Board.
        </p>
      </div>
      <p className="mb-4 ml-8.5 text-[11px] leading-relaxed text-muted-foreground/60">
        Board is for human follow-up tasks — implementation steps, external blockers, things to revisit.
      </p>

      {/* Output checklist — unchecked by default, opt-in */}
      <div className="mb-4 space-y-1.5 rounded-lg border border-border/20 bg-background/50 p-2 dark:border-white/[0.03] dark:bg-white/[0.01]">
        {outputs.map((output) => (
          <label
            key={output.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-100 hover:bg-primary/[0.04]"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(output.id)}
              onChange={() => toggleOutput(output.id)}
              className="size-3.5 rounded border-border accent-primary"
            />
            <span className="truncate text-[13px] text-foreground/80">
              {output.title}
            </span>
          </label>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-[11px] text-destructive">
          <AlertCircleIcon className="mt-0.5 size-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || selectedIds.size === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[11px] font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-100 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
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
          className="rounded-lg px-3 py-2 text-[11px] font-medium text-muted-foreground/70 transition-colors duration-100 hover:bg-muted/20 hover:text-foreground"
        >
          Skip — I'm done
        </button>
      </div>
    </div>
  );
}
