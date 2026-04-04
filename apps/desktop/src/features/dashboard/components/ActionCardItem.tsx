import { ArrowRightIcon, CheckCircleIcon, ClipboardListIcon, ClockIcon, LoaderCircleIcon, RotateCwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ActionCard } from "@/features/dashboard/data/actions";
import { categoryConfig } from "@/features/dashboard/data/actions";
import { buildActionPrompt } from "@/features/dashboard/data/prompt-builder";

export interface ActionCardItemProps {
  card: ActionCard;
  isCompleted?: boolean | undefined;
  isHero?: boolean | undefined;
  isLoading?: boolean | undefined;
  specialistName?: string | undefined;
  onClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
  onViewResults?: ((actionId: string) => void) | undefined;
}

export function ActionCardItem({ card, isCompleted, isHero, isLoading, specialistName, onClick, onViewResults }: ActionCardItemProps) {
  const Icon = card.icon;
  const config = categoryConfig[card.category];

  return (
    <Card
      className={`group/action relative flex flex-col overflow-hidden transition-all duration-100 ease-out ${
        isHero ? "py-5" : ""
      } ${
        isLoading
          ? "pointer-events-none border-border/30 bg-card/50 opacity-60"
          : isCompleted
            ? "cursor-pointer border-primary/15 bg-card hover:border-primary/25 hover:shadow-sm"
            : "cursor-pointer border-border/20 bg-card hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20"
      }`}
      onClick={() => {
        if (!isLoading) {
          if (isCompleted) {
            onViewResults?.(card.id);
          } else {
            onClick?.(card.id, buildActionPrompt(card), card.title);
          }
        }
      }}
    >
      <CardHeader className="flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] ${config.className}`}>
            {config.label}
          </Badge>
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircleIcon className="size-3" />
              Done
            </span>
          ) : null}
        </div>
        <CardTitle className={`leading-snug transition-colors group-hover/action:text-primary ${isHero ? "text-base font-bold" : "text-sm"}`}>
          {card.title}
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed line-clamp-2">
          {card.promise}
        </CardDescription>
        <CardAction>
          <div className={`rounded-lg p-2 transition-all duration-100 ${
            isCompleted
              ? "bg-emerald-500/10 text-emerald-600 group-hover/action:bg-emerald-500 group-hover/action:text-white dark:text-emerald-400"
              : `${config.iconBg} ${config.iconText} ${config.iconHoverBg} ${config.iconHoverText}`
          }`}>
            {isLoading ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : isCompleted ? (
              <CheckCircleIcon className="size-4" />
            ) : (
              <Icon className="size-4" />
            )}
          </div>
        </CardAction>
      </CardHeader>
      <div className="flex items-center gap-3 border-t border-border/20 py-2.5 px-4">
        {isLoading ? (
          <span className="animate-pulse font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Starting...</span>
        ) : isCompleted ? (
          <>
            <span className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary/80 transition-colors group-hover/action:text-primary">
              View results
              <ArrowRightIcon className="size-3 transition-transform group-hover/action:translate-x-0.5" />
            </span>
            <button
              type="button"
              className="flex items-center gap-1 font-mono text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40 transition-colors hover:text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onClick?.(card.id, buildActionPrompt(card), card.title);
              }}
            >
              <RotateCwIcon className="size-2.5" />
              Run again
            </button>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 transition-colors group-hover/action:text-primary">
              Run
              <ArrowRightIcon className="size-3 transition-transform duration-150 group-hover/action:translate-x-0.5" />
            </span>
            <div className="flex items-center gap-2.5">
              {specialistName ? (
                <span className="inline-flex items-center gap-1 rounded bg-primary/[0.06] px-1.5 py-px font-mono text-[9px] text-primary/60 dark:bg-primary/[0.06]">
                  {specialistName}
                </span>
              ) : null}
              {card.timeToFirstOutput && (
                <span className="inline-flex items-center gap-1 font-mono text-[9px] text-muted-foreground/40">
                  <ClockIcon className="size-2.5" />
                  {card.timeToFirstOutput}
                </span>
              )}
              {card.createsTrackedWork && (
                <span className="inline-flex items-center gap-1 font-mono text-[9px] text-muted-foreground/40">
                  <ClipboardListIcon className="size-2.5" />
                  Board
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
