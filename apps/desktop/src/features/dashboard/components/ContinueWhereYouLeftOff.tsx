import { CornerDownLeftIcon, ArrowRightIcon } from "lucide-react";
import type { MeaningfulWorkItem } from "@/features/dashboard/hooks/useMeaningfulWork";
import type { ProjectMaturity } from "@/features/dashboard/hooks/useProjectMaturity";

export interface ContinueWhereYouLeftOffProps {
  items: MeaningfulWorkItem[];
  maturity: ProjectMaturity;
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
  maturity,
  onContinue,
  onViewResults,
}: ContinueWhereYouLeftOffProps) {
  // Hide entirely when no items — empty state adds no value for any maturity tier
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mb-5 rounded-xl border border-border/20 bg-card/30 px-4 py-3 dark:border-white/[0.04] dark:bg-white/[0.015]">
      {/* Section label */}
      <div className="mb-2.5 flex items-center gap-2">
        <CornerDownLeftIcon className="size-3 text-muted-foreground/50" />
        <h2 className="section-label">Continue where you left off</h2>
      </div>

      {/* Compact item rows */}
      <div className="space-y-0.5">
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
              className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all duration-100 hover:bg-muted/40 dark:hover:bg-white/[0.03]"
            >
              {/* Status dot */}
              <span
                className={`size-2 shrink-0 rounded-full ring-2 ${
                  item.needsInput
                    ? "bg-amber-500 ring-amber-500/20"
                    : "bg-muted-foreground/40 ring-muted-foreground/10"
                }`}
              />

              {/* Title */}
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground/90 group-hover:text-foreground">
                {item.title}
              </span>

              {/* Status badge */}
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${
                  item.needsInput
                    ? "bg-amber-500/10 text-amber-500"
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
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground/40 transition-colors group-hover:text-foreground/70">
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
