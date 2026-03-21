import { ArrowRightIcon, CheckCircleIcon, LoaderCircleIcon, RotateCwIcon } from "lucide-react";
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

export interface ActionCardItemProps {
  card: ActionCard;
  isCompleted?: boolean | undefined;
  isLoading?: boolean | undefined;
  onClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
  onViewResults?: ((actionId: string) => void) | undefined;
}

export function ActionCardItem({ card, isCompleted, isLoading, onClick, onViewResults }: ActionCardItemProps) {
  const Icon = card.icon;
  const config = categoryConfig[card.category];

  return (
    <Card
      className={`group/action border bg-card/90 transition-all duration-150 ${
        isLoading
          ? "pointer-events-none border-border/70 opacity-60"
          : isCompleted
            ? "cursor-pointer border-primary/20 hover:border-primary/40 hover:bg-accent/40"
            : "cursor-pointer border-border/70 hover:border-primary/40 hover:bg-accent/40"
      }`}
      onClick={() => {
        if (!isLoading) {
          if (isCompleted) {
            onViewResults?.(card.id);
          } else {
            onClick?.(card.id, card.prompt, card.title);
          }
        }
      }}
    >
      <CardHeader>
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
        <CardTitle className="text-sm leading-snug group-hover/action:text-primary transition-colors">
          {card.title}
        </CardTitle>
        <CardDescription className="text-xs line-clamp-2">
          {card.promise}
        </CardDescription>
        <CardAction>
          <div className={`rounded-lg p-2 transition-all ${
            isCompleted
              ? "bg-emerald-500/10 text-emerald-600 group-hover/action:bg-emerald-500 group-hover/action:text-white dark:text-emerald-400"
              : "bg-primary/8 text-primary group-hover/action:bg-primary group-hover/action:text-primary-foreground"
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
      <div className="flex items-center gap-3 px-4 pb-3">
        {isLoading ? (
          <span className="animate-pulse text-xs font-medium text-muted-foreground/70">Starting...</span>
        ) : isCompleted ? (
          <>
            <span className="flex items-center gap-1 text-xs font-medium text-primary/80 transition-colors group-hover/action:text-primary">
              View results
              <ArrowRightIcon className="size-3 transition-transform group-hover/action:translate-x-0.5" />
            </span>
            <button
              type="button"
              className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground/50 transition-colors hover:text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onClick?.(card.id, card.prompt, card.title);
              }}
            >
              <RotateCwIcon className="size-2.5" />
              Run again
            </button>
          </>
        ) : (
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground/70 transition-colors group-hover/action:text-primary">
            Start
            <ArrowRightIcon className="size-3 transition-transform group-hover/action:translate-x-0.5" />
          </span>
        )}
      </div>
    </Card>
  );
}
