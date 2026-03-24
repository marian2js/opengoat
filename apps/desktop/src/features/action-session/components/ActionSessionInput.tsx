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
    <div className="mx-5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
      <p className="mb-3 text-sm text-foreground">{question}</p>
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
          className="flex-1 rounded-md border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30"
        >
          <SendIcon className="size-3" />
          Send
        </button>
      </div>
    </div>
  );
}
