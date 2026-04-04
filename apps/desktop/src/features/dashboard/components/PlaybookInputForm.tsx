import { useState, useCallback } from "react";
import { LoaderCircleIcon, PlayIcon } from "lucide-react";
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

export interface PlaybookInputFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playbookTitle: string;
  requiredInputs: string[];
  optionalInputs?: string[];
  isSubmitting?: boolean;
  onSubmit: (inputs: Record<string, string>) => void;
}

export function PlaybookInputForm({
  open,
  onOpenChange,
  playbookTitle,
  requiredInputs,
  optionalInputs = [],
  isSubmitting = false,
  onSubmit,
}: PlaybookInputFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const allRequiredFilled = requiredInputs.every(
    (input) => (values[input] ?? "").trim().length > 0,
  );

  const handleChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!allRequiredFilled || isSubmitting) return;
      // Collect only non-empty values
      const result: Record<string, string> = {};
      for (const [key, val] of Object.entries(values)) {
        if (val.trim()) result[key] = val.trim();
      }
      onSubmit(result);
    },
    [allRequiredFilled, isSubmitting, values, onSubmit],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayIcon className="size-4 text-primary" />
              {playbookTitle}
            </DialogTitle>
            <DialogDescription>
              A few details before we start. The specialist will use these to tailor the work.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-4">
            {requiredInputs.map((input) => (
              <label key={input} className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-foreground">
                  {formatLabel(input)}
                  <span className="ml-0.5 text-destructive">*</span>
                </span>
                <Input
                  value={values[input] ?? ""}
                  onChange={(e) => handleChange(input, e.target.value)}
                  placeholder={input}
                  disabled={isSubmitting}
                  autoFocus={requiredInputs.indexOf(input) === 0}
                />
              </label>
            ))}
            {optionalInputs.length > 0 && (
              <>
                <div className="mt-1 border-t border-border/30 pt-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    Optional
                  </span>
                </div>
                {optionalInputs.map((input) => (
                  <label key={input} className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-muted-foreground">
                      {formatLabel(input)}
                    </span>
                    <Input
                      value={values[input] ?? ""}
                      onChange={(e) => handleChange(input, e.target.value)}
                      placeholder={input}
                      disabled={isSubmitting}
                    />
                  </label>
                ))}
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={!allRequiredFilled || isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <PlayIcon className="size-3.5" />
                  Start
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Capitalize the first letter of a descriptive input label */
function formatLabel(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1);
}
