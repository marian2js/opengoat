import { useState } from "react";
import { CheckIcon, CopyIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type { OutputBlock } from "../types";

interface ActionSessionOutputsProps {
  outputs: OutputBlock[];
}

export function ActionSessionOutputs({ outputs }: ActionSessionOutputsProps) {
  if (outputs.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 px-5 py-3">
      <h2 className="section-label">Outputs</h2>
      {outputs.map((output) => (
        <OutputCard key={output.id} output={output} />
      ))}
    </div>
  );
}

function OutputCard({ output }: { output: OutputBlock }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isLong = output.content.length > 400;
  const displayContent = isLong && !expanded
    ? `${output.content.slice(0, 400)}…`
    : output.content;

  function handleCopy() {
    void navigator.clipboard.writeText(output.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group relative rounded-lg border border-border/40 bg-card/60 p-4 transition-colors hover:border-border/60">
      <div className="mb-2 flex items-start justify-between">
        <h3 className="text-sm font-semibold text-foreground">{output.title}</h3>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground/50 opacity-0 transition-all hover:bg-muted/50 hover:text-muted-foreground group-hover:opacity-100"
        >
          {copied ? (
            <CheckIcon className="size-3.5 text-primary" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </button>
      </div>
      <div className="prose prose-sm max-w-none text-[13px] leading-relaxed text-foreground/80 dark:prose-invert">
        <pre className="whitespace-pre-wrap font-sans text-[13px]">{displayContent}</pre>
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
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
