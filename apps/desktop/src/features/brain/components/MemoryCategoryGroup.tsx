import { useState } from "react";
import type { MemoryRecord } from "@opengoat/contracts";
import { ChevronDownIcon, PlusIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MemoryEntryCard } from "./MemoryEntryCard";
import { MemoryEntryForm, type MemoryEntryFormValues } from "./MemoryEntryForm";

export interface MemoryCategoryGroupProps {
  category: string;
  displayName: string;
  entries: MemoryRecord[];
  isCreating: boolean;
  editingId: string | null;
  onStartCreate: () => void;
  onCancelCreate: () => void;
  onCreate: (values: MemoryEntryFormValues) => Promise<void>;
  onEdit: (entry: MemoryRecord) => void;
  onCancelEdit: () => void;
  onUpdate: (memoryId: string, values: MemoryEntryFormValues) => Promise<void>;
  onDelete: (memoryId: string) => void;
  isSubmitting: boolean;
}

export function MemoryCategoryGroup({
  category,
  displayName,
  entries,
  isCreating,
  editingId,
  onStartCreate,
  onCancelCreate,
  onCreate,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  isSubmitting,
}: MemoryCategoryGroupProps) {
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
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
            {displayName}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/40">
            {entries.length}
          </span>
        </CollapsibleTrigger>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStartCreate();
          }}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
        >
          <PlusIcon className="size-3" />
          Add memory
        </button>
      </div>

      <CollapsibleContent>
        <div className="flex flex-col gap-2 pb-4">
          {isCreating && (
            <MemoryEntryForm
              mode="create"
              category={category}
              onSubmit={onCreate}
              onCancel={onCancelCreate}
              isSubmitting={isSubmitting}
            />
          )}

          {entries.map((entry) =>
            editingId === entry.memoryId ? (
              <MemoryEntryForm
                key={entry.memoryId}
                mode="edit"
                category={category}
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
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ),
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
