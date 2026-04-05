import { CornerDownLeftIcon, ArrowRightIcon } from "lucide-react";
import type { MeaningfulWorkItem } from "@/features/dashboard/hooks/useMeaningfulWork";

export interface ContinueWhereYouLeftOffProps {
  items: MeaningfulWorkItem[];
  onContinue?: (sessionId: string) => void;
  onViewResults?: (actionId: string) => void;
}

function formatTimeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export function ContinueWhereYouLeftOff({
  items,
  onContinue,
  onViewResults,
}: ContinueWhereYouLeftOffProps) {
  if (items.length === 0) return null;

  return (
    <section className="mb-5 rounded-lg border border-border/20 bg-card/50 px-4 py-3">
      {/* Section label */}
      <div className="mb-2.5 flex items-center gap-2">
        <CornerDownLeftIcon className="size-3 text-primary/60" />
        <h2 className="section-label">Continue where you left off</h2>
      </div>

      {/* Compact item rows */}
      <div className="space-y-1">
        {items.map((item) => {
          const handleClick = () => {
            if (item.sessionId && onContinue) {
              onContinue(item.sessionId);
            } else if (item.actionId && onViewResults) {
              onViewResults(item.actionId);
            }
          };

          return (
            <button
              key={item.id}
              type="button"
              onClick={handleClick}
              className="group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
            >
              {/* Status dot */}
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  item.needsInput
                    ? "bg-amber-500"
                    : "bg-primary/50"
                }`}
              />

              {/* Title */}
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                {item.title}
              </span>

              {/* Status badge */}
              <span
                className={`shrink-0 font-mono text-[10px] font-medium uppercase tracking-wider ${
                  item.needsInput
                    ? "text-amber-500"
                    : "text-muted-foreground/50"
                }`}
              >
                {item.status}
              </span>

              {/* Timestamp */}
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/30">
                {formatTimeAgo(item.updatedAt)}
              </span>

              {/* Continue CTA */}
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground/40 transition-colors group-hover:text-primary">
                Continue
                <ArrowRightIcon className="size-2.5" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
