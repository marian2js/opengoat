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
import { Spinner } from "@/components/ui/spinner";
import type {
  CreateAgentFormValue,
  CreateAgentManagerOption,
} from "@/pages/agents/useCreateAgentDialog";
import type { ReactElement } from "react";

interface CreateAgentDialogProps {
  open: boolean;
  form: CreateAgentFormValue;
  managerOptions: CreateAgentManagerOption[];
  error: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onReportsToChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function CreateAgentDialog({
  open,
  form,
  managerOptions,
  error,
  isLoading,
  isSubmitting,
  onOpenChange,
  onNameChange,
  onRoleChange,
  onReportsToChange,
  onSubmit,
  onCancel,
}: CreateAgentDialogProps): ReactElement {
  const canSubmit = !isLoading && !isSubmitting && form.name.trim().length > 0;
  const isBusy = isSubmitting;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isBusy) {
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Agent</DialogTitle>
          <DialogDescription>
            Create an agent and assign a reporting manager.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              className="text-xs uppercase tracking-wide text-muted-foreground"
              htmlFor="createAgentName"
            >
              Name
            </label>
            <Input
              id="createAgentName"
              value={form.name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Developer"
              disabled={isBusy}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSubmit) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label
              className="text-xs uppercase tracking-wide text-muted-foreground"
              htmlFor="createAgentRole"
            >
              Role (Optional)
            </label>
            <Input
              id="createAgentRole"
              value={form.role}
              onChange={(event) => onRoleChange(event.target.value)}
              placeholder="Software Engineer"
              disabled={isBusy}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSubmit) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label
              className="text-xs uppercase tracking-wide text-muted-foreground"
              htmlFor="createAgentReportsTo"
            >
              Reports To
            </label>
            <select
              id="createAgentReportsTo"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={form.reportsTo}
              onChange={(event) => onReportsToChange(event.target.value)}
              disabled={isBusy}
            >
              {managerOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              You can only assign existing agents as manager.
            </p>
          </div>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <DialogFooter>
          <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit} aria-busy={isBusy}>
            {isBusy ? (
              <>
                <Spinner className="size-4" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
