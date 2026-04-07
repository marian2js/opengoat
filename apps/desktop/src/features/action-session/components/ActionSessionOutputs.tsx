import { memo, useRef, useState, useEffect } from "react";
import { CheckIcon, CopyIcon, ChevronDownIcon, ChevronUpIcon, FileTextIcon } from "lucide-react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { cjk } from "@streamdown/cjk";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import type { OutputBlock } from "../types";

const streamdownPlugins = { cjk, code, math, mermaid };

/** Max collapsed height in pixels before "Show more" appears. */
const COLLAPSED_MAX_HEIGHT = 320;

interface ActionSessionOutputsProps {
  outputs: OutputBlock[];
}

export function ActionSessionOutputs({ outputs }: ActionSessionOutputsProps) {
  if (outputs.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 shadow-sm ring-1 ring-primary/10">
          <FileTextIcon className="size-3.5 text-primary" />
        </div>
        <h2 className="section-label">Outputs</h2>
        <span className="rounded-full bg-primary/8 px-2.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-primary ring-1 ring-primary/10">
          {outputs.length}
        </span>
      </div>
      <div className="relative">
        {outputs.map((output, index) => (
          <div key={output.id} className="relative flex gap-4">
            {/* Timeline spine */}
            <div className="flex flex-col items-center pt-5">
              <div className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-primary/25 bg-card shadow-sm text-primary dark:border-primary/20 dark:bg-card/80">
                <span className="font-mono text-[10px] font-bold">{index + 1}</span>
              </div>
              {index < outputs.length - 1 && (
                <div className="w-px flex-1 bg-gradient-to-b from-primary/20 via-border/30 to-border/10 dark:from-primary/15 dark:via-white/[0.04] dark:to-transparent" />
              )}
            </div>
            {/* Output card */}
            <div className="min-w-0 flex-1 pb-4">
              <OutputCard output={output} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const RenderedMarkdown = memo(
  ({ content }: { content: string }) => (
    <Streamdown
      className="size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      plugins={streamdownPlugins}
    >
      {content}
    </Streamdown>
  ),
  (prev, next) => prev.content === next.content,
);
RenderedMarkdown.displayName = "RenderedMarkdown";

function OutputCard({ output }: { output: OutputBlock }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Measure whether the rendered content exceeds the collapsed height.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > COLLAPSED_MAX_HEIGHT);
  }, [output.content]);

  function handleCopy() {
    void navigator.clipboard.writeText(output.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group relative rounded-xl border border-border/40 bg-card/60 p-5 shadow-sm shadow-black/[0.02] transition-all duration-150 hover:border-border/60 hover:shadow-md hover:shadow-black/[0.04] dark:border-white/[0.06] dark:shadow-black/10 dark:hover:border-white/[0.10] dark:hover:shadow-black/15">
      <div className="mb-3 flex items-start justify-between">
        <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">{output.title}</h3>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground/40 opacity-0 transition-all duration-100 hover:bg-primary/8 hover:text-primary group-hover:opacity-100"
          aria-label={copied ? "Copied" : "Copy output"}
        >
          {copied ? (
            <CheckIcon className="size-3.5 text-primary" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </button>
      </div>

      {/* Always render full markdown; clip visually when collapsed */}
      <div className="relative">
        <div
          ref={contentRef}
          className="prose prose-sm max-w-none overflow-hidden text-[13px] leading-relaxed text-foreground/80 dark:prose-invert"
          style={
            !expanded && isOverflowing
              ? { maxHeight: COLLAPSED_MAX_HEIGHT }
              : undefined
          }
        >
          <RenderedMarkdown content={output.content} />
        </div>

        {/* Fade-out gradient when collapsed */}
        {!expanded && isOverflowing && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card/60 to-transparent" />
        )}
      </div>

      {isOverflowing && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 inline-flex items-center gap-1 rounded-lg border border-primary/15 bg-primary/[0.04] px-3 py-1.5 text-[11px] font-medium text-primary transition-all duration-100 hover:border-primary/25 hover:bg-primary/[0.08]"
        >
          {expanded ? (
            <>
              Show less <ChevronUpIcon className="size-3" />
            </>
          ) : (
            <>
              Show more <ChevronDownIcon className="size-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
