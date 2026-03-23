import { Bookmark, X, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Signal } from "@opengoat/contracts";
import { IMPORTANCE_COLORS } from "@/features/signals/lib/signal-colors";
import { FRESHNESS_CONFIG } from "@/features/signals/lib/signal-colors";
import { SOURCE_TYPE_ICONS, SOURCE_TYPE_LABELS } from "@/features/signals/lib/signal-icons";

export interface SignalCardProps {
  signal: Signal;
  onSave?: (signalId: string) => void;
  onDismiss?: (signalId: string) => void;
  onPromote?: (signalId: string) => void;
  isActionLoading?: boolean;
}

export function SignalCard({
  signal,
  onSave,
  onDismiss,
  onPromote,
  isActionLoading,
}: SignalCardProps) {
  const importanceColor = IMPORTANCE_COLORS[signal.importance];
  const freshnessConfig = FRESHNESS_CONFIG[signal.freshness];
  const SourceIcon = SOURCE_TYPE_ICONS[signal.sourceType];
  const sourceLabel = SOURCE_TYPE_LABELS[signal.sourceType];
  const FreshnessIcon = freshnessConfig.icon;

  return (
    <div className="group/signal relative flex flex-col overflow-hidden rounded-lg border border-border/50 bg-card/80 transition-all duration-150 hover:-translate-y-px hover:border-primary/30 hover:shadow-sm">
      {/* Left accent bar */}
      <div
        className={`absolute inset-y-0 left-0 w-[3px] rounded-l-[inherit] ${importanceColor.accent} opacity-50 transition-opacity group-hover/signal:opacity-100`}
      />

      <div className="flex flex-1 flex-col gap-2 py-3 pl-5 pr-4">
        {/* Header: source icon + title + importance badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <SourceIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <h3 className="text-[13px] font-semibold leading-snug text-foreground transition-colors group-hover/signal:text-primary truncate">
              {signal.title}
            </h3>
          </div>
          <Badge
            variant="outline"
            className={`shrink-0 text-[10px] ${importanceColor.badge}`}
          >
            {signal.importance}
          </Badge>
        </div>

        {/* Summary */}
        <p className="border-l-2 border-border/30 pl-2 text-[11px] leading-relaxed text-muted-foreground/70 line-clamp-2">
          {signal.summary}
        </p>

        {/* Evidence snippet */}
        {signal.evidence ? (
          <p className="text-[10px] leading-relaxed text-muted-foreground/50 line-clamp-1 italic">
            {signal.evidence}
          </p>
        ) : null}

        {/* Metadata row: freshness + source type + signal type */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
          <span className="inline-flex items-center gap-1">
            <FreshnessIcon className="size-3" />
            {freshnessConfig.label}
          </span>
          <span className="inline-flex items-center gap-1">
            <SourceIcon className="size-3" />
            {sourceLabel}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider">
            {signal.signalType}
          </span>
        </div>
      </div>

      {/* Action buttons footer */}
      <div className="flex items-center gap-1 border-t border-border/30 px-4 py-1.5">
        <TooltipProvider>
          {onSave && signal.status !== "saved" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-primary"
                  onClick={() => onSave(signal.signalId)}
                  disabled={isActionLoading}
                >
                  <Bookmark className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save</TooltipContent>
            </Tooltip>
          ) : null}

          {onDismiss && signal.status !== "dismissed" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-destructive"
                  onClick={() => onDismiss(signal.signalId)}
                  disabled={isActionLoading}
                >
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Dismiss</TooltipContent>
            </Tooltip>
          ) : null}

          {onPromote && signal.status !== "promoted" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-primary"
                  onClick={() => onPromote(signal.signalId)}
                  disabled={isActionLoading}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Promote</TooltipContent>
            </Tooltip>
          ) : null}

          {signal.status === "saved" ? (
            <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-primary/60">
              Saved
            </span>
          ) : signal.status === "promoted" ? (
            <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-primary/60">
              Promoted
            </span>
          ) : null}
        </TooltipProvider>
      </div>
    </div>
  );
}
