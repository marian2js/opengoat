import { ArrowRightIcon } from "lucide-react";
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
  onClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
}

export function ActionCardItem({ card, onClick }: ActionCardItemProps) {
  const Icon = card.icon;
  const config = categoryConfig[card.category];

  return (
    <Card
      className="group/action cursor-pointer border border-border/70 bg-card/90 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)] transition-all hover:border-primary/30 hover:shadow-[0_20px_60px_-28px_rgba(15,23,42,0.45)]"
      onClick={() => onClick?.(card.id, card.prompt, card.title)}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={config.className}>
            {config.label}
          </Badge>
        </div>
        <CardTitle className="leading-snug group-hover/action:text-primary transition-colors">
          {card.title}
        </CardTitle>
        <CardDescription className="line-clamp-2">
          {card.promise}
        </CardDescription>
        <CardAction>
          <div className="rounded-xl bg-primary/8 p-2.5 text-primary transition-all group-hover/action:bg-primary group-hover/action:text-primary-foreground">
            <Icon className="size-5" />
          </div>
        </CardAction>
      </CardHeader>
      <div className="flex items-center gap-1.5 px-4 pb-1 text-xs font-medium text-muted-foreground/70 transition-colors group-hover/action:text-primary">
        <span>Start</span>
        <ArrowRightIcon className="size-3 transition-transform group-hover/action:translate-x-0.5" />
      </div>
    </Card>
  );
}
