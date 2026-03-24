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
import {
  useProjectMemories,
  CATEGORY_ORDER,
  CATEGORY_DISPLAY_NAMES,
} from "@/features/brain/hooks/useProjectMemories";
import { MemoryCategoryGroup } from "./MemoryCategoryGroup";
import { MemoryConflictDialog } from "./MemoryConflictDialog";
import type { MemoryEntryFormValues } from "./MemoryEntryForm";

export interface OperatingMemorySectionProps {
  agentId: string;
  client: SidecarClient;
}

interface ConflictState {
  existingEntry: MemoryRecord;
  newValues: MemoryEntryFormValues;
  category: string;
}

export function OperatingMemorySection({ agentId, client }: OperatingMemorySectionProps) {
  const { groupedEntries, isLoading, isEmpty, refresh } = useProjectMemories(agentId, client);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const handleCreate = useCallback(
    async (category: string, values: MemoryEntryFormValues) => {
      setIsSubmitting(true);
      try {
        // Check for conflicts by listing existing entries in same category
        const existing = await client.listMemories({
          projectId: agentId,
          scope: "project",
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
          category: category as MemoryRecord["category"],
          scope: "project",
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
      } finally {
        setIsSubmitting(false);
      }
    },
    [agentId, client, refresh],
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
        category: conflictState.category as MemoryRecord["category"],
        scope: "project",
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
    } finally {
      setIsResolving(false);
    }
  }, [agentId, client, conflictState, refresh]);

  const handleKeepBoth = useCallback(async () => {
    if (!conflictState) return;
    setIsResolving(true);
    try {
      await client.createMemory({
        projectId: agentId,
        category: conflictState.category as MemoryRecord["category"],
        scope: "project",
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
    } finally {
      setIsResolving(false);
    }
  }, [agentId, client, conflictState, refresh]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-5 py-4 lg:px-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-3 w-24 animate-pulse rounded bg-muted-foreground/10" />
            <div className="h-16 animate-pulse rounded-lg bg-muted-foreground/5" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (isEmpty && !creatingCategory) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-12">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted/80">
          <DatabaseIcon className="size-7 text-muted-foreground/50" />
        </div>
        <h3 className="mt-4 font-display text-sm font-bold tracking-tight text-foreground/80">
          No saved guidance yet
        </h3>
        <p className="mt-1.5 max-w-xs text-center text-xs leading-relaxed text-muted-foreground/60">
          Saved guidance helps the system stay aligned with your brand voice, product facts,
          preferences, and constraints. This is optional — you can start using the app without it.
        </p>
        <button
          type="button"
          onClick={() => setCreatingCategory(CATEGORY_ORDER[0]!)}
          className="mt-5 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <PlusIcon className="size-3.5" />
          Add your first entry
        </button>

        {creatingCategory && (
          <div className="mt-4 w-full max-w-md">
            <MemoryCategoryGroupInline
              category={creatingCategory}
              agentId={agentId}
              client={client}
              isSubmitting={isSubmitting}
              onCreate={handleCreate}
              onCancel={() => setCreatingCategory(null)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col px-5 pb-5 lg:px-6 lg:pb-6">
      {/* Populated category groups */}
      {groupedEntries.map((group) => (
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
      ))}

      {/* Show empty categories with create option when user has some entries */}
      {!isEmpty && (
        <EmptyCategoriesSection
          populatedCategories={groupedEntries.map((g) => g.category)}
          creatingCategory={creatingCategory}
          isSubmitting={isSubmitting}
          onStartCreate={(cat) => {
            setCreatingCategory(cat);
            setEditingId(null);
          }}
          onCancelCreate={() => setCreatingCategory(null)}
          onCreate={handleCreate}
        />
      )}

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

// ---------------------------------------------------------------------------
// Empty categories section — shows remaining categories that have no entries
// ---------------------------------------------------------------------------

function EmptyCategoriesSection({
  populatedCategories,
  creatingCategory,
  isSubmitting,
  onStartCreate,
  onCancelCreate,
  onCreate,
}: {
  populatedCategories: string[];
  creatingCategory: string | null;
  isSubmitting: boolean;
  onStartCreate: (category: string) => void;
  onCancelCreate: () => void;
  onCreate: (category: string, values: MemoryEntryFormValues) => Promise<void>;
}) {
  const emptyCategories = CATEGORY_ORDER.filter(
    (cat) => !populatedCategories.includes(cat),
  );

  if (emptyCategories.length === 0) return null;

  return (
    <div className="mt-4 border-t border-border/10 pt-4">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/40">
        Other categories
      </div>
      <div className="flex flex-wrap gap-2">
        {emptyCategories.map((cat) =>
          creatingCategory === cat ? (
            <div key={cat} className="w-full">
              <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                {CATEGORY_DISPLAY_NAMES[cat]}
              </div>
              <MemoryCategoryGroupInline
                category={cat}
                agentId=""
                client={null as never}
                isSubmitting={isSubmitting}
                onCreate={onCreate}
                onCancel={onCancelCreate}
              />
            </div>
          ) : (
            <button
              key={cat}
              type="button"
              onClick={() => onStartCreate(cat)}
              className="flex items-center gap-1 rounded-md border border-dashed border-border/30 px-2.5 py-1.5 text-[11px] text-muted-foreground/50 transition-colors hover:border-border/50 hover:bg-accent/30 hover:text-foreground"
            >
              <PlusIcon className="size-3" />
              {CATEGORY_DISPLAY_NAMES[cat] ?? cat}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline form wrapper for category creation
// ---------------------------------------------------------------------------

import { MemoryEntryForm } from "./MemoryEntryForm";

function MemoryCategoryGroupInline({
  category,
  isSubmitting,
  onCreate,
  onCancel,
}: {
  category: string;
  agentId: string;
  client: SidecarClient;
  isSubmitting: boolean;
  onCreate: (category: string, values: MemoryEntryFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <MemoryEntryForm
      mode="create"
      category={category}
      onSubmit={(values) => onCreate(category, values)}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
    />
  );
}
