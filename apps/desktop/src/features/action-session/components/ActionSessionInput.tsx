import { useState } from "react";
import { SendIcon } from "lucide-react";

interface ActionSessionInputProps {
  question: string;
  onSubmit: (text: string) => void;
}

export function ActionSessionInput({ question, onSubmit }: ActionSessionInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit() {
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setValue("");
    }
  }

  return (
    <div className="mx-5 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4 dark:border-amber-500/10 dark:bg-amber-500/[0.025]">
      <p className="mb-3 text-[13px] leading-relaxed text-foreground">{question}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Type your answer…"
          className="flex-1 rounded-lg border border-border/40 bg-background px-3 py-2 text-[13px] text-foreground shadow-sm placeholder:text-muted-foreground/40 transition-colors duration-100 focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/20 dark:border-white/[0.06] dark:focus:border-primary/25"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[11px] font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-100 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25 disabled:opacity-30 disabled:shadow-none"
        >
          <SendIcon className="size-3" />
          Send
        </button>
      </div>
    </div>
  );
}
