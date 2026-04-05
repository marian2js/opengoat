import { ArrowRightIcon, CheckCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Opportunity } from "@/features/dashboard/data/opportunities";
import { opportunityCategoryConfig } from "@/features/dashboard/data/opportunities";
import { starterActions } from "@/features/dashboard/data/actions";
import { buildActionPrompt } from "@/features/dashboard/data/prompt-builder";

export interface OpportunityCardProps {
  completedActions?: Set<string> | undefined;
  opportunity: Opportunity;
  onActionClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
  onViewResults?: ((actionId: string) => void) | undefined;
}

export function OpportunityCard({ completedActions, opportunity, onActionClick, onViewResults }: OpportunityCardProps) {
  const config = opportunityCategoryConfig[opportunity.category];
  const relatedAction = opportunity.relatedActionId
    ? starterActions.find((a) => a.id === opportunity.relatedActionId)
    : null;
  const isRelatedCompleted = relatedAction && completedActions?.has(relatedAction.id);

  const handleCardClick = () => {
    if (relatedAction && isRelatedCompleted && onViewResults) {
      onViewResults(relatedAction.id);
    } else if (relatedAction && onActionClick) {
      onActionClick(relatedAction.id, buildActionPrompt(relatedAction), relatedAction.title);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="group/insight relative flex flex-col overflow-hidden rounded-lg border border-border/50 bg-card/80 transition-all duration-100 ease-out hover:-translate-y-px hover:border-primary/25 hover:shadow-md cursor-pointer"
      onClick={handleCardClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCardClick(); } }}
    >
      <div className={`absolute inset-y-0 left-0 w-[3px] rounded-l-[inherit] ${config.accentColor} opacity-50 transition-opacity group-hover/insight:opacity-100`} />
      <div className="flex flex-1 flex-col gap-2 py-3 pl-5 pr-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[13px] font-semibold leading-snug text-foreground transition-colors group-hover/insight:text-primary">
            {opportunity.title}
          </h3>
          <Badge
            variant="outline"
            className={`shrink-0 text-[10px] ${config.className}`}
          >
            {config.label}
          </Badge>
        </div>
        <p className="border-l-2 border-border/30 pl-2 text-[11px] leading-relaxed text-muted-foreground/70 line-clamp-2">
          {opportunity.explanation}
        </p>
      </div>
      {relatedAction ? (
        <div className="border-t border-border/30 py-2 pl-5 pr-4">
          {isRelatedCompleted && onViewResults ? (
            <button
              type="button"
              className="group/link inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400"
              onClick={(e) => { e.stopPropagation(); onViewResults(relatedAction.id); }}
            >
              <CheckCircleIcon className="size-3" />
              <span>View results</span>
              <ArrowRightIcon className="size-3 transition-transform group-hover/link:translate-x-0.5" />
            </button>
          ) : onActionClick ? (
            <button
              type="button"
              className="group/link inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 transition-colors hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onActionClick(relatedAction.id, buildActionPrompt(relatedAction), relatedAction.title);
              }}
            >
              <span>{relatedAction.title}</span>
              <ArrowRightIcon className="size-3 transition-transform group-hover/link:translate-x-0.5" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
