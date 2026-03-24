import { useCallback, useState } from "react";
import { LoaderCircleIcon } from "lucide-react";

export interface MemoryEntryFormValues {
  content: string;
  source: string;
  confidence: number;
}

export interface MemoryEntryFormProps {
  mode: "create" | "edit";
  initialValues?: MemoryEntryFormValues;
  category: string;
  onSubmit: (values: MemoryEntryFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

const CONFIDENCE_LEVELS = [
  { label: "Low", value: 0.3 },
  { label: "Medium", value: 0.6 },
  { label: "High", value: 1.0 },
] as const;

export function MemoryEntryForm({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
}: MemoryEntryFormProps) {
  const [content, setContent] = useState(initialValues?.content ?? "");
  const [source, setSource] = useState(initialValues?.source ?? "user");
  const [confidence, setConfidence] = useState(initialValues?.confidence ?? 1.0);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!content.trim()) return;
      onSubmit({ content: content.trim(), source: source.trim() || "user", confidence });
    },
    [content, source, confidence, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-primary/20 bg-primary/5 p-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What should the system know?"
        rows={3}
        className="w-full resize-none rounded-md border border-border/40 bg-transparent px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
        autoFocus
      />

      <div className="mt-2 flex items-center gap-3">
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Source (e.g., user, chat, research)"
          className="flex-1 rounded-md border border-border/40 bg-transparent px-2.5 py-1.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
        />

        <div className="flex items-center gap-1">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Confidence
          </span>
          {CONFIDENCE_LEVELS.map((level) => (
            <button
              key={level.label}
              type="button"
              onClick={() => setConfidence(level.value)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                confidence === level.value
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground/60 hover:bg-accent hover:text-foreground"
              }`}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting && <LoaderCircleIcon className="size-3 animate-spin" />}
          Save
        </button>
      </div>
    </form>
  );
}
