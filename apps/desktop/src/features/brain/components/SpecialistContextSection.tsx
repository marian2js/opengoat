import { useCallback, useEffect, useState } from "react";
import type { MemoryRecord, SpecialistAgent } from "@opengoat/contracts";
import {
  ChevronDownIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";
import type { SidecarClient } from "@/lib/sidecar/client";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSpecialistContext } from "@/features/brain/hooks/useSpecialistContext";
import { MemoryEntryCard } from "./MemoryEntryCard";
import { MemoryEntryForm, type MemoryEntryFormValues } from "./MemoryEntryForm";

export interface SpecialistContextSectionProps {
  agentId: string;
  client: SidecarClient;
}

export function SpecialistContextSection({ agentId, client }: SpecialistContextSectionProps) {
  const { groupedBySpecialist, isLoading, isEmpty, refresh } = useSpecialistContext(agentId, client);
  const [specialists, setSpecialists] = useState<SpecialistAgent[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingForSpecialist, setCreatingForSpecialist] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  useEffect(() => {
    client
      .specialists()
      .then((roster) => setSpecialists(roster.specialists))
      .catch(() => setSpecialists([]));
  }, [client]);

  const getSpecialistName = useCallback(
    (id: string) => {
      return specialists.find((s) => s.id === id)?.name ?? id;
    },
    [specialists],
  );

  const handleCreate = useCallback(
    async (specialistId: string, values: MemoryEntryFormValues) => {
      setIsSubmitting(true);
      try {
        await client.createMemory({
          projectId: agentId,
          category: "specialist_context",
          scope: "project",
          content: values.content,
          source: values.source,
          confidence: values.confidence,
          createdBy: "user",
          userConfirmed: true,
          specialistId,
        });
        setCreatingForSpecialist(null);
        refresh();
      } catch (err) {
        console.error("Failed to create specialist context:", err);
        setOperationError(err instanceof Error ? err.message : "Failed to create entry.");
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
        console.error("Failed to update specialist context:", err);
        setOperationError(err instanceof Error ? err.message : "Failed to update entry.");
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
      console.error("Failed to delete specialist context:", err);
      setOperationError(err instanceof Error ? err.message : "Failed to delete entry.");
    } finally {
      setIsSubmitting(false);
    }
  }, [client, deletingId, refresh]);

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

  // Specialists with entries
  const populatedSpecialistIds = groupedBySpecialist.map((g) => g.specialistId);
  // Specialists without entries (exclude CMO — it's the coordinator)
  const emptySpecialists = specialists.filter(
    (s) => s.category !== "manager" && !populatedSpecialistIds.includes(s.id),
  );

  // Empty state
  if (isEmpty && !creatingForSpecialist) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted/60">
          <UsersIcon className="size-5 text-muted-foreground/40" />
        </div>
        <h3 className="mt-3 font-display text-sm font-bold tracking-tight text-foreground/80">
          No agent guidelines yet
        </h3>
        <p className="mt-1 max-w-[300px] text-center text-xs leading-relaxed text-muted-foreground/50">
          Shape how each specialist thinks, what it should prioritize, and what to avoid.
        </p>
        {specialists.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {specialists
              .filter((s) => s.category !== "manager")
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCreatingForSpecialist(s.id)}
                  className="flex items-center gap-1 rounded-md border border-dashed border-border/30 px-2.5 py-1.5 text-[11px] text-muted-foreground/50 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                >
                  <PlusIcon className="size-3" />
                  {s.name}
                </button>
              ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col px-5 pb-5 lg:px-6 lg:pb-6">
      {/* Operation error banner */}
      {operationError && (
        <div className="mb-3 flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span>{operationError}</span>
          <button type="button" onClick={() => setOperationError(null)} className="ml-2 font-medium underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Populated specialist groups */}
      {groupedBySpecialist.map((group) => (
        <SpecialistGroup
          key={group.specialistId}
          specialistId={group.specialistId}
          specialistName={getSpecialistName(group.specialistId)}
          entries={group.entries}
          isCreating={creatingForSpecialist === group.specialistId}
          editingId={editingId}
          isSubmitting={isSubmitting}
          onStartCreate={() => {
            setCreatingForSpecialist(group.specialistId);
            setEditingId(null);
          }}
          onCancelCreate={() => setCreatingForSpecialist(null)}
          onCreate={(values) => handleCreate(group.specialistId, values)}
          onEdit={(entry) => {
            setEditingId(entry.memoryId);
            setCreatingForSpecialist(null);
          }}
          onCancelEdit={() => setEditingId(null)}
          onUpdate={handleUpdate}
          onDelete={(memoryId) => setDeletingId(memoryId)}
        />
      ))}

      {/* Creating for a specialist that has no entries yet */}
      {creatingForSpecialist && !populatedSpecialistIds.includes(creatingForSpecialist) && (
        <SpecialistGroup
          specialistId={creatingForSpecialist}
          specialistName={getSpecialistName(creatingForSpecialist)}
          entries={[]}
          isCreating={true}
          editingId={null}
          isSubmitting={isSubmitting}
          onStartCreate={() => {}}
          onCancelCreate={() => setCreatingForSpecialist(null)}
          onCreate={(values) => handleCreate(creatingForSpecialist, values)}
          onEdit={() => {}}
          onCancelEdit={() => {}}
          onUpdate={handleUpdate}
          onDelete={() => {}}
        />
      )}

      {/* Add guidelines for other specialists */}
      {emptySpecialists.length > 0 && (
        <div className="mt-4 border-t border-border/10 pt-4">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/40">
            Add guidelines for
          </div>
          <div className="flex flex-wrap gap-2">
            {emptySpecialists.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setCreatingForSpecialist(s.id);
                  setEditingId(null);
                }}
                className="flex items-center gap-1 rounded-md border border-dashed border-border/30 px-2.5 py-1.5 text-[11px] text-muted-foreground/50 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
              >
                <PlusIcon className="size-3" />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <DialogContent className="sm:max-w-xs" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete guideline</DialogTitle>
            <DialogDescription>
              This guideline will be permanently removed. This action cannot be undone.
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
// Collapsible group for a single specialist
// ---------------------------------------------------------------------------

function SpecialistGroup({
  specialistName,
  entries,
  isCreating,
  editingId,
  isSubmitting,
  onStartCreate,
  onCancelCreate,
  onCreate,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
}: {
  specialistId: string;
  specialistName: string;
  entries: MemoryRecord[];
  isCreating: boolean;
  editingId: string | null;
  isSubmitting: boolean;
  onStartCreate: () => void;
  onCancelCreate: () => void;
  onCreate: (values: MemoryEntryFormValues) => Promise<void>;
  onEdit: (entry: MemoryRecord) => void;
  onCancelEdit: () => void;
  onUpdate: (memoryId: string, values: MemoryEntryFormValues) => Promise<void>;
  onDelete: (memoryId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center justify-between py-2">
        <CollapsibleTrigger className="flex items-center gap-2">
          <ChevronDownIcon
            className={`size-3.5 text-muted-foreground/50 transition-transform ${
              isOpen ? "" : "-rotate-90"
            }`}
          />
          <span className="font-display text-xs font-bold tracking-tight text-foreground/80">
            How {specialistName} Should Work
          </span>
          <span className="text-[10px] text-muted-foreground/40">
            {entries.length} {entries.length === 1 ? "guideline" : "guidelines"}
          </span>
        </CollapsibleTrigger>
        <button
          type="button"
          onClick={onStartCreate}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
        >
          <PlusIcon className="size-3" />
          Add
        </button>
      </div>

      <CollapsibleContent>
        <div className="flex flex-col gap-2 pb-2">
          {entries.map((entry) =>
            editingId === entry.memoryId ? (
              <MemoryEntryForm
                key={entry.memoryId}
                mode="edit"
                category="specialist_context"
                initialValues={{
                  content: entry.content,
                  source: entry.source,
                  confidence: entry.confidence,
                }}
                onSubmit={(values) => onUpdate(entry.memoryId, values)}
                onCancel={onCancelEdit}
                isSubmitting={isSubmitting}
              />
            ) : (
              <MemoryEntryCard
                key={entry.memoryId}
                entry={entry}
                onEdit={() => onEdit(entry)}
                onDelete={() => onDelete(entry.memoryId)}
              />
            ),
          )}

          {isCreating && (
            <MemoryEntryForm
              mode="create"
              category="specialist_context"
              onSubmit={onCreate}
              onCancel={onCancelCreate}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
