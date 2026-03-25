import { useRef, useState } from "react";
import { ArrowRightIcon } from "lucide-react";

export interface FreeTextInputProps {
  onSubmit: (text: string) => void;
}

export function FreeTextInput({ onSubmit }: FreeTextInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    // Auto-resize textarea to fit content
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  return (
    <div className="relative rounded-xl border border-border/40 bg-card/60 shadow-sm transition-all focus-within:border-primary/40 focus-within:shadow-md focus-within:shadow-primary/5">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="What do you want help with right now?"
        rows={1}
        className="w-full resize-none rounded-xl border-0 bg-transparent px-4 py-3.5 pr-12 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!value.trim()}
        className="absolute right-2.5 bottom-2.5 rounded-lg p-2 text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <ArrowRightIcon className="size-4" />
      </button>
    </div>
  );
}
