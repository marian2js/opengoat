import { AlertTriangleIcon, LoaderCircleIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface DeleteProjectDialogProps {
  domain: string;
  open: boolean;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export function DeleteProjectDialog({
  domain,
  open,
  onConfirm,
  onOpenChange,
}: DeleteProjectDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmText.trim().toLowerCase() === domain.toLowerCase();

  function reset(): void {
    setConfirmText("");
    setIsDeleting(false);
    setError(null);
  }

  async function handleDelete(): Promise<void> {
    if (!isConfirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm();
      reset();
    } catch (err) {
      console.error("Failed to delete project", err);
      setError("Failed to delete project. Please try again.");
      setIsDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangleIcon className="size-5" />
            Delete {domain}?
          </DialogTitle>
          <DialogDescription className="pt-1 text-[13px] leading-relaxed">
            This will permanently delete the agent, all chat sessions, and
            workspace files.{" "}
            <span className="font-medium text-foreground">
              This action cannot be undone.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <p className="text-[13px] text-muted-foreground">
            Type{" "}
            <span className="font-mono font-medium text-foreground">
              {domain}
            </span>{" "}
            to confirm.
          </p>
          <Input
            autoFocus
            className="h-9 text-[13px]"
            disabled={isDeleting}
            placeholder={domain}
            value={confirmText}
            onChange={(e) => {
              setConfirmText(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isConfirmed && !isDeleting) {
                void handleDelete();
              }
            }}
          />
          {error ? (
            <p className="text-[12px] text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-[13px]"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-9 text-[13px]"
            disabled={!isConfirmed || isDeleting}
            onClick={() => void handleDelete()}
          >
            {isDeleting ? (
              <>
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <TrashIcon className="size-3.5" />
                Delete project
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
