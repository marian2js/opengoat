import { ArrowRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";
import type { FeedItem } from "@/features/dashboard/lib/feed-item-types";

const TYPE_LABELS: Record<string, string> = {
  signal: "Signal",
  "blocked-task": "Blocked",
  "pending-task": "Review",
};

const TYPE_BADGE_CLASSES: Record<string, string> = {
  signal: "bg-primary/10 text-primary border-primary/20",
  "blocked-task": "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  "pending-task": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

export interface FeedItemCardProps {
  item: FeedItem;
}

export function FeedItemCard({ item }: FeedItemCardProps) {
  const Icon = item.icon;

  return (
    <div className="group/feed relative flex flex-col overflow-hidden rounded-lg border border-border/50 bg-card/80 transition-all duration-100 ease-out hover:-translate-y-px hover:border-primary/25 hover:shadow-md">
      <div
        className={`absolute inset-y-0 left-0 w-[3px] rounded-l-[inherit] ${item.accentColor} opacity-50 transition-opacity group-hover/feed:opacity-100`}
      />
      <div className="flex flex-1 flex-col gap-1.5 py-3 pl-5 pr-4">
        {/* Header: icon + title + timestamp */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <h3 className="text-[13px] font-semibold leading-snug text-foreground transition-colors group-hover/feed:text-primary truncate">
              {item.title}
            </h3>
          </div>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground/60">
            {formatRelativeTime(item.timestamp)}
          </span>
        </div>

        {/* Summary */}
        <p className="pl-6 text-[12px] leading-relaxed text-muted-foreground/70 line-clamp-2">
          {item.summary}
        </p>
      </div>

      {/* Footer: type badge + action */}
      <div className="flex items-center justify-between border-t border-border/30 px-5 py-2">
        <Badge
          variant="outline"
          className={`text-[10px] font-mono uppercase tracking-wider ${TYPE_BADGE_CLASSES[item.type] ?? ""}`}
        >
          {TYPE_LABELS[item.type] ?? item.type}
        </Badge>
        {item.action ? (
          <button
            type="button"
            className="group/link inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 transition-colors hover:text-primary"
          >
            <span>{item.action.label}</span>
            <ArrowRightIcon className="size-3 transition-transform group-hover/link:translate-x-0.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
