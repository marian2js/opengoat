import type { MemoryRecord } from "@opengoat/contracts";
import { AlertTriangleIcon, LoaderCircleIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface MemoryConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingEntry: MemoryRecord;
  newContent: { content: string; source: string; confidence: number };
  onKeepExisting: () => void;
  onReplace: () => void;
  onKeepBoth: () => void;
  isResolving: boolean;
}

export function MemoryConflictDialog({
  open,
  onOpenChange,
  existingEntry,
  newContent,
  onKeepExisting,
  onReplace,
  onKeepBoth,
  isResolving,
}: MemoryConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-4 text-warning" />
            Potential conflict detected
          </DialogTitle>
          <DialogDescription>
            An existing memory entry in this category may overlap with your new entry.
            Choose how to proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/40 p-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Existing entry
            </div>
            <p className="text-[13px] leading-relaxed text-foreground/80">
              {existingEntry.content}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                {existingEntry.source}
              </span>
              <span className="text-[10px] text-muted-foreground/40">
                {new Date(existingEntry.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-primary">
              New entry
            </div>
            <p className="text-[13px] leading-relaxed text-foreground/80">
              {newContent.content}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                {newContent.source}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-2">
          <button
            type="button"
            onClick={onKeepExisting}
            disabled={isResolving}
            className="rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Keep existing
          </button>
          <button
            type="button"
            onClick={onKeepBoth}
            disabled={isResolving}
            className="rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Keep both
          </button>
          <button
            type="button"
            onClick={onReplace}
            disabled={isResolving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isResolving && <LoaderCircleIcon className="size-3 animate-spin" />}
            Replace with new
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
