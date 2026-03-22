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
      className="group/insight flex flex-col gap-2 rounded-lg border border-border/50 bg-card/60 px-4 py-3 transition-all duration-150 hover:border-primary/30 hover:bg-card/80 cursor-pointer"
      onClick={handleCardClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCardClick(); } }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug text-foreground group-hover/insight:text-primary transition-colors">
          {opportunity.title}
        </h3>
        <Badge
          variant="outline"
          className={`shrink-0 text-[10px] ${config.className}`}
        >
          {config.label}
        </Badge>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 opacity-80 border-l-2 border-border/30 pl-2">
        {opportunity.explanation}
      </p>
      {relatedAction && isRelatedCompleted && onViewResults ? (
        <button
          type="button"
          className="group/link mt-1 inline-flex w-fit items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 hover:border-emerald-500/30 dark:text-emerald-400 dark:border-emerald-400/20 dark:bg-emerald-400/5 dark:hover:bg-emerald-400/10 dark:hover:border-emerald-400/30"
          onClick={(e) => { e.stopPropagation(); onViewResults(relatedAction.id); }}
        >
          <CheckCircleIcon className="size-3" />
          <span>View results</span>
          <ArrowRightIcon className="size-3.5 transition-transform group-hover/link:translate-x-0.5" />
        </button>
      ) : relatedAction && onActionClick ? (
        <button
          type="button"
          className="group/link mt-1 inline-flex w-fit items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 hover:border-primary/30 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onActionClick(relatedAction.id, buildActionPrompt(relatedAction), relatedAction.title);
          }}
        >
          <span>{relatedAction.title}</span>
          <ArrowRightIcon className="size-3.5 transition-transform group-hover/link:translate-x-0.5" />
        </button>
      ) : null}
    </div>
  );
}
