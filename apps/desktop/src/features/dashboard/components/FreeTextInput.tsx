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
    <div className="group/input rounded-xl bg-gradient-to-r from-border/40 via-border/40 to-border/40 p-[1px] transition-all duration-200 hover:from-border/60 hover:via-border/60 hover:to-border/60 focus-within:from-primary/40 focus-within:via-primary/20 focus-within:to-primary/40 focus-within:shadow-lg focus-within:shadow-primary/10 dark:from-white/[0.06] dark:via-white/[0.06] dark:to-white/[0.06] dark:hover:from-white/[0.10] dark:hover:via-white/[0.10] dark:hover:to-white/[0.10] dark:focus-within:from-primary/40 dark:focus-within:via-primary/20 dark:focus-within:to-primary/40">
      <div className="relative rounded-[11px] bg-card shadow-sm dark:bg-[#18181B]">
        {/* CMO routing indicator */}
        <div className="flex items-center gap-1.5 px-5 pt-3 pb-0">
          <div className="flex items-center gap-1.5 rounded-md bg-primary/8 px-2 py-0.5 ring-1 ring-primary/10">
            <BrainIcon className="size-3 text-primary" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">CMO</span>
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
          className="w-full resize-none rounded-[11px] border-0 bg-transparent px-5 pt-2.5 pb-4 pr-14 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/35 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="absolute right-3 bottom-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground/40 transition-all duration-100 enabled:bg-primary enabled:text-primary-foreground enabled:shadow-sm hover:enabled:bg-primary/90 disabled:opacity-20"
        >
          <ArrowRightIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
