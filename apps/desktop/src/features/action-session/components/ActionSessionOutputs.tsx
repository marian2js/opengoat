import { memo, useState } from "react";
import { CheckIcon, CopyIcon, ChevronDownIcon, ChevronUpIcon, FileTextIcon } from "lucide-react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import type { OutputBlock } from "../types";

const streamdownPlugins = { code };

interface ActionSessionOutputsProps {
  outputs: OutputBlock[];
}

export function ActionSessionOutputs({ outputs }: ActionSessionOutputsProps) {
  if (outputs.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 px-5 py-3">
      <div className="flex items-center gap-2">
        <FileTextIcon className="size-3.5 text-primary" />
        <h2 className="section-label">Outputs</h2>
        <span className="rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
          {outputs.length}
        </span>
      </div>
      {outputs.map((output) => (
        <OutputCard key={output.id} output={output} />
      ))}
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

  const isLong = output.content.length > 800;
  const displayContent = isLong && !expanded
    ? output.content.slice(0, 800)
    : output.content;

  function handleCopy() {
    void navigator.clipboard.writeText(output.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group relative rounded-lg border border-border/40 bg-card/60 p-5 transition-colors hover:border-border/60">
      <div className="mb-3 flex items-start justify-between">
        <h3 className="text-[14px] font-semibold text-foreground">{output.title}</h3>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground/50 opacity-0 transition-all hover:bg-muted/50 hover:text-muted-foreground group-hover:opacity-100"
          aria-label={copied ? "Copied" : "Copy output"}
        >
          {copied ? (
            <CheckIcon className="size-3.5 text-primary" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </button>
      </div>
      <div className="prose prose-sm max-w-none text-[13px] leading-relaxed text-foreground/80 dark:prose-invert">
        <RenderedMarkdown content={displayContent} />
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 inline-flex items-center gap-1 rounded-md border border-border/30 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
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
