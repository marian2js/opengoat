import { useState, useCallback, useEffect } from "react";
import { ArrowRightIcon, LoaderCircleIcon, ClipboardListIcon } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IntakeFieldSet } from "@/features/dashboard/data/intake-fields";
import type { CompanySummaryData } from "@/features/dashboard/lib/parse-workspace-summary";

export interface IntakeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionTitle: string;
  outputType?: string;
  specialistName?: string;
  fields: IntakeFieldSet;
  companyData: CompanySummaryData | null;
  isSubmitting?: boolean;
  onSubmit: (values: Record<string, string>) => void;
}

export function IntakeFormDialog({
  open,
  onOpenChange,
  actionTitle,
  outputType,
  specialistName,
  fields,
  companyData,
  isSubmitting = false,
  onSubmit,
}: IntakeFormDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  // Pre-populate from company data when dialog opens
  useEffect(() => {
    if (!open) return;
    const prefilled: Record<string, string> = {};
    const allFields = [...fields.required, ...fields.optional];
    for (const field of allFields) {
      if (field.prefillFrom && companyData) {
        const value = companyData[field.prefillFrom];
        if (value) prefilled[field.key] = value;
      }
    }
    setValues(prefilled);
  }, [open, fields, companyData]);

  const allRequiredFilled = fields.required.every(
    (f) => (values[f.key] ?? "").trim().length > 0,
  );

  const handleChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!allRequiredFilled || isSubmitting) return;
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
              <ClipboardListIcon className="size-4 text-primary" />
              {actionTitle}
            </DialogTitle>
            <DialogDescription>
              {outputType && (
                <span className="mr-1.5 inline-flex items-center rounded-md border border-primary/15 bg-primary/[0.06] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary dark:border-primary/10 dark:bg-primary/[0.08]">
                  {outputType}
                </span>
              )}
              {specialistName ? (
                <>A few details to tailor the work by {specialistName}.</>
              ) : (
                <>A few details so the output matches your needs.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-4">
            {fields.required.map((field, i) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={values[field.key] ?? ""}
                onChange={handleChange}
                disabled={isSubmitting}
                autoFocus={i === 0}
                showRequired
              />
            ))}

            {fields.optional.length > 0 && (
              <>
                <div className="mt-1 border-t border-border/30 pt-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    Optional
                  </span>
                </div>
                {fields.optional.map((field) => (
                  <FieldRenderer
                    key={field.key}
                    field={field}
                    value={values[field.key] ?? ""}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
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
                  <ArrowRightIcon className="size-3.5" />
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

// ---------------------------------------------------------------------------
// Field renderer — renders the appropriate input type based on field schema
// ---------------------------------------------------------------------------

function FieldRenderer({
  field,
  value,
  onChange,
  disabled,
  autoFocus,
  showRequired,
}: {
  field: { key: string; label: string; type: "text" | "textarea" | "select"; placeholder: string; options?: string[] };
  value: string;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  showRequired?: boolean;
}) {
  const labelEl = (
    <span className={`text-[13px] font-medium ${showRequired ? "text-foreground" : "text-muted-foreground"}`}>
      {field.label}
      {showRequired && <span className="ml-0.5 text-destructive">*</span>}
    </span>
  );

  if (field.type === "select" && field.options) {
    return (
      <label className="flex flex-col gap-1.5">
        {labelEl}
        <Select
          value={value || undefined}
          onValueChange={(v) => onChange(field.key, v)}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={field.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="flex flex-col gap-1.5">
        {labelEl}
        <Textarea
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          className="min-h-[60px]"
        />
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-1.5">
      {labelEl}
      <Input
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    </label>
  );
}
