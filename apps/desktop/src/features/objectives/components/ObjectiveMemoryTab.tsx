import { useCallback, useState } from "react";
import type { MemoryRecord } from "@opengoat/contracts";
import { DatabaseIcon, PlusIcon } from "lucide-react";
import type { SidecarClient } from "@/lib/sidecar/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useObjectiveMemories } from "@/features/objectives/hooks/useObjectiveMemories";
import {
  OBJECTIVE_MEMORY_CATEGORIES,
  OBJECTIVE_CATEGORY_DISPLAY_NAMES,
  OBJECTIVE_CATEGORY_EMPTY_PROMPTS,
} from "@/features/objectives/lib/objective-memory-categories";
import { MemoryCategoryGroup } from "@/features/brain/components/MemoryCategoryGroup";
import { MemoryConflictDialog } from "@/features/brain/components/MemoryConflictDialog";
import { MemoryEntryForm, type MemoryEntryFormValues } from "@/features/brain/components/MemoryEntryForm";

export interface ObjectiveMemoryTabProps {
  agentId: string;
  objectiveId: string;
  client: SidecarClient;
}

interface ConflictState {
  existingEntry: MemoryRecord;
  newValues: MemoryEntryFormValues;
  category: string;
}

export function ObjectiveMemoryTab({ agentId, objectiveId, client }: ObjectiveMemoryTabProps) {
  const { groupedEntries, isLoading, isEmpty, refresh } = useObjectiveMemories(
    agentId,
    objectiveId,
    client,
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const handleCreate = useCallback(
    async (category: string, values: MemoryEntryFormValues) => {
      setIsSubmitting(true);
      try {
        // Check for conflicts by listing existing entries in same category
        const existing = await client.listMemories({
          projectId: agentId,
          objectiveId,
          scope: "objective",
          category,
          activeOnly: true,
        });

        if (existing.length > 0) {
          setConflictState({
            existingEntry: existing[0]!,
            newValues: values,
            category,
          });
          setIsSubmitting(false);
          return;
        }

        await client.createMemory({
          projectId: agentId,
          objectiveId,
          category: category as MemoryRecord["category"],
          scope: "objective",
          content: values.content,
          source: values.source,
          confidence: values.confidence,
          createdBy: "user",
          userConfirmed: true,
        });
        setCreatingCategory(null);
        refresh();
      } catch (err) {
        console.error("Failed to create memory:", err);
        setOperationError("Failed to create memory. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [agentId, objectiveId, client, refresh],
  );

  const handleUpdate = useCallback(
    async (memoryId: string, values: MemoryEntryFormValues) => {
      setIsSubmitting(true);
      try {
        await client.updateMemory(memoryId, {
          content: values.content,
          confidence: values.confidence,
        });
        setEditingId(null);
        refresh();
      } catch (err) {
        console.error("Failed to update memory:", err);
        setOperationError("Failed to update memory. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [client, refresh],
  );

  const handleDelete = useCallback(async () => {
    if (!deletingId) return;
    setIsSubmitting(true);
    try {
      await client.deleteMemory(deletingId);
      setDeletingId(null);
      refresh();
    } catch (err) {
      console.error("Failed to delete memory:", err);
      setOperationError("Failed to delete memory. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [client, deletingId, refresh]);

  const handleKeepExisting = useCallback(() => {
    setConflictState(null);
    setCreatingCategory(null);
  }, []);

  const handleReplace = useCallback(async () => {
    if (!conflictState) return;
    setIsResolving(true);
    try {
      const newEntry = await client.createMemory({
        projectId: agentId,
        objectiveId,
        category: conflictState.category as MemoryRecord["category"],
        scope: "objective",
        content: conflictState.newValues.content,
        source: conflictState.newValues.source,
        confidence: conflictState.newValues.confidence,
        createdBy: "user",
        userConfirmed: true,
        supersedes: conflictState.existingEntry.memoryId,
      });
      await client.resolveMemoryConflict({
        keepMemoryId: newEntry.memoryId,
        replaceMemoryId: conflictState.existingEntry.memoryId,
      });
      setConflictState(null);
      setCreatingCategory(null);
      refresh();
    } catch (err) {
      console.error("Failed to resolve conflict:", err);
      setOperationError("Failed to resolve conflict. Please try again.");
    } finally {
      setIsResolving(false);
    }
  }, [agentId, objectiveId, client, conflictState, refresh]);

  const handleKeepBoth = useCallback(async () => {
    if (!conflictState) return;
    setIsResolving(true);
    try {
      await client.createMemory({
        projectId: agentId,
        objectiveId,
        category: conflictState.category as MemoryRecord["category"],
        scope: "objective",
        content: conflictState.newValues.content,
        source: conflictState.newValues.source,
        confidence: conflictState.newValues.confidence,
        createdBy: "user",
        userConfirmed: true,
      });
      setConflictState(null);
      setCreatingCategory(null);
      refresh();
    } catch (err) {
      console.error("Failed to create memory:", err);
      setOperationError("Failed to create memory. Please try again.");
    } finally {
      setIsResolving(false);
    }
  }, [agentId, objectiveId, client, conflictState, refresh]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-3 w-24 animate-pulse rounded bg-muted-foreground/10" />
            <div className="h-16 animate-pulse rounded-lg bg-muted-foreground/5" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state — all categories empty, no create form open
  if (isEmpty && !creatingCategory) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted/80">
          <DatabaseIcon className="size-7 text-muted-foreground/50" />
        </div>
        <h3 className="mt-4 font-display text-sm font-bold tracking-tight text-foreground/80">
          No objective context yet
        </h3>
        <p className="mt-1.5 max-w-xs text-center text-xs leading-relaxed text-muted-foreground/60">
          Context entries capture decisions and constraints specific to this objective.
          Add entries so the system stays aligned with your goal.
        </p>
        <button
          type="button"
          onClick={() => setCreatingCategory(OBJECTIVE_MEMORY_CATEGORIES[0])}
          className="mt-5 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <PlusIcon className="size-3.5" />
          Add your first entry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-5">
      {operationError && (
        <div className="mb-3 flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span>{operationError}</span>
          <button type="button" onClick={() => setOperationError(null)} className="ml-2 font-medium underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}
      {/* All 8 categories rendered — populated ones with entries, empty ones with guidance */}
      {groupedEntries.map((group) => {
        const emptyMessage = OBJECTIVE_CATEGORY_EMPTY_PROMPTS[group.category];

        if (group.entries.length === 0 && creatingCategory !== group.category) {
          // Empty category — show compact add prompt
          return (
            <div key={group.category} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/40">
                  {group.displayName}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/30">0</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreatingCategory(group.category);
                  setEditingId(null);
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
                title={emptyMessage}
              >
                <PlusIcon className="size-3" />
                {emptyMessage}
              </button>
            </div>
          );
        }

        if (group.entries.length === 0 && creatingCategory === group.category) {
          // Empty category with create form open
          return (
            <div key={group.category} className="py-2">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                  {group.displayName}
                </span>
              </div>
              <MemoryEntryForm
                mode="create"
                category={group.category}
                onSubmit={(values) => handleCreate(group.category, values)}
                onCancel={() => setCreatingCategory(null)}
                isSubmitting={isSubmitting}
              />
            </div>
          );
        }

        // Populated category — use MemoryCategoryGroup
        return (
          <MemoryCategoryGroup
            key={group.category}
            category={group.category}
            displayName={group.displayName}
            entries={group.entries}
            isCreating={creatingCategory === group.category}
            editingId={editingId}
            onStartCreate={() => {
              setCreatingCategory(group.category);
              setEditingId(null);
            }}
            onCancelCreate={() => setCreatingCategory(null)}
            onCreate={(values) => handleCreate(group.category, values)}
            onEdit={(entry) => {
              setEditingId(entry.memoryId);
              setCreatingCategory(null);
            }}
            onCancelEdit={() => setEditingId(null)}
            onUpdate={handleUpdate}
            onDelete={(memoryId) => setDeletingId(memoryId)}
            isSubmitting={isSubmitting}
          />
        );
      })}

      {/* Conflict resolution dialog */}
      {conflictState && (
        <MemoryConflictDialog
          open={!!conflictState}
          onOpenChange={(open) => {
            if (!open) setConflictState(null);
          }}
          existingEntry={conflictState.existingEntry}
          newContent={conflictState.newValues}
          onKeepExisting={handleKeepExisting}
          onReplace={handleReplace}
          onKeepBoth={handleKeepBoth}
          isResolving={isResolving}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <DialogContent className="sm:max-w-xs" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete entry</DialogTitle>
            <DialogDescription>
              This entry will be permanently removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingId(null)}
              className="rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
