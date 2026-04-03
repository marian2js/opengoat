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
    <div className="relative rounded-xl border border-white/[0.08] bg-[#18181B] shadow-md transition-all duration-150 focus-within:border-primary/40 focus-within:shadow-lg focus-within:shadow-primary/5">
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
        className="w-full resize-none rounded-xl border-0 bg-transparent px-5 py-4 pr-14 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!value.trim()}
        className="absolute right-3 bottom-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground/60 transition-all duration-100 hover:bg-primary/10 hover:text-primary disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <ArrowRightIcon className="size-4" />
      </button>
    </div>
  );
}
