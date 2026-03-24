import type { Signal } from "@opengoat/contracts";
import { RadioIcon } from "lucide-react";

interface RelatedSignalsSectionProps {
  signals: Signal[];
  objectiveId?: string;
}

const IMPORTANCE_DOT: Record<string, string> = {
  critical: "bg-destructive dark:bg-red-400",
  high: "bg-warning dark:bg-yellow-400",
  medium: "bg-primary",
  low: "bg-muted-foreground/40",
};

const MAX_VISIBLE = 3;

export function RelatedSignalsSection({ signals, objectiveId }: RelatedSignalsSectionProps) {
  if (signals.length === 0) return null;

  const visible = signals.slice(0, MAX_VISIBLE);
  const remaining = signals.length - MAX_VISIBLE;

  return (
    <div className="border-t border-border/40 py-3">
      <h4 className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
        Signals
      </h4>
      {signals.length > 0 && (
        <div className="space-y-1.5">
          {visible.map((signal) => (
            <div
              key={signal.signalId}
              className="flex items-center gap-2 rounded-md bg-muted/30 px-2.5 py-1.5"
            >
              <span
                className={`inline-block size-1.5 shrink-0 rounded-full ${IMPORTANCE_DOT[signal.importance] ?? IMPORTANCE_DOT.low}`}
              />
              <span className="truncate text-sm text-foreground">{signal.title}</span>
              <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/60 uppercase">
                {signal.sourceType}
              </span>
            </div>
          ))}
          {remaining > 0 && objectiveId && (
            <a
              href={`#objectives/${objectiveId}?tab=signals`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <RadioIcon className="size-3" />
              View all {signals.length} signals
            </a>
          )}
        </div>
      )}
    </div>
  );
}
