import { useRef, useState } from "react";
import { ArrowRightIcon, BrainIcon } from "lucide-react";

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
    <div className="relative rounded-xl border border-border/40 bg-card shadow-sm transition-all duration-150 focus-within:border-primary/30 focus-within:shadow-md focus-within:shadow-primary/5 dark:border-white/[0.08] dark:bg-[#18181B] dark:shadow-md">
      {/* CMO routing indicator */}
      <div className="flex items-center gap-1.5 px-5 pt-3 pb-0">
        <div className="flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5">
          <BrainIcon className="size-3 text-primary" />
          <span className="text-[11px] font-medium text-primary">CMO</span>
        </div>
      </div>
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
        placeholder="Ask CMO — What do you want help with right now?"
        rows={1}
        className="w-full resize-none rounded-xl border-0 bg-transparent px-5 pt-2 pb-4 pr-14 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!value.trim()}
        className="absolute right-3 bottom-3 flex size-8 items-center justify-center rounded-lg bg-primary/0 text-muted-foreground/50 transition-all duration-100 hover:bg-primary/10 hover:text-primary disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <ArrowRightIcon className="size-4" />
      </button>
    </div>
  );
}
