import { useState } from "react";
import { ArrowRightIcon } from "lucide-react";

export interface FreeTextInputProps {
  onSubmit: (text: string) => void;
}

export function FreeTextInput({ onSubmit }: FreeTextInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit() {
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setValue("");
    }
  }

  return (
    <div className="relative">
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
        placeholder="What do you want help with right now?"
        className="w-full rounded-lg border border-border/50 bg-card/60 px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!value.trim()}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <ArrowRightIcon className="size-4" />
      </button>
    </div>
  );
}
