import type { Agent } from "@opengoat/contracts";
import { ArrowRightIcon, GlobeIcon, LoaderCircleIcon } from "lucide-react";
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
import type { SidecarClient } from "@/lib/sidecar/client";
import { validateWebsiteUrl } from "@/lib/validation/url";

interface AddProjectDialogProps {
  client: SidecarClient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: (agent: Agent, projectUrl: string) => void;
}

export function AddProjectDialog({
  client,
  open,
  onOpenChange,
  onProjectCreated,
}: AddProjectDialogProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetState(): void {
    setUrl("");
    setError(null);
    setIsSubmitting(false);
  }

  async function handleSubmit(): Promise<void> {
    const result = validateWebsiteUrl(url);
    if (!result.valid) {
      setError(result.error);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const agent = await client.createProjectAgent(result.normalized);
      resetState();
      onProjectCreated(agent, result.normalized);
    } catch (err) {
      console.error("Failed to create project", err);
      setError("Failed to create project. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetState();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new project</DialogTitle>
          <DialogDescription>
            Enter the website URL for the product you want to market.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <div className="relative">
            <GlobeIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
            <Input
              type="url"
              className="h-10 rounded-md pl-9 text-[13px]"
              value={url}
              placeholder="myproduct.com"
              aria-invalid={Boolean(error)}
              disabled={isSubmitting}
              onChange={(event) => {
                setUrl(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && url.trim() && !isSubmitting) {
                  void handleSubmit();
                }
              }}
              autoFocus
            />
          </div>
          {error ? (
            <p className="text-[12px] text-destructive">{error}</p>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              A bare domain like &ldquo;myapp.com&rdquo; or a full URL both work.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-md px-4 text-[13px]"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-md px-4 text-[13px]"
            disabled={!url.trim() || isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? (
              <>
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Add project
                <ArrowRightIcon className="size-3.5" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
