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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>
            Create
          </Button>
        </DialogFooter>
        {isSubmitting ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="size-3.5" />
              Creating agent...
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/5 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-primary/80" />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
