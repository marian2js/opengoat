import {
  ArrowRightIcon,
  BookOpenIcon,
  ClipboardListIcon,
  ClockIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PlaybookManifest } from "@opengoat/contracts";

export interface PlaybookCardProps {
  playbook: PlaybookManifest;
  onClick?: (playbook: PlaybookManifest) => void;
}

const GOAL_TYPE_STYLES: Record<string, { className: string; accentColor: string }> = {
  launch: {
    className: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    accentColor: "bg-blue-500",
  },
  conversion: {
    className: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    accentColor: "bg-rose-500",
  },
  outbound: {
    className: "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-400",
    accentColor: "bg-purple-500",
  },
  seo: {
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    accentColor: "bg-emerald-500",
  },
  content: {
    className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    accentColor: "bg-amber-500",
  },
  competitive: {
    className: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-400",
    accentColor: "bg-orange-500",
  },
  "lead-gen": {
    className: "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
    accentColor: "bg-cyan-500",
  },
  onboarding: {
    className: "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
    accentColor: "bg-indigo-500",
  },
};

const DEFAULT_STYLE = {
  className: "border-primary/20 bg-primary/10 text-primary",
  accentColor: "bg-primary",
};

export function PlaybookCard({ playbook, onClick }: PlaybookCardProps) {
  const primaryGoalType = playbook.goalTypes[0] ?? "";
  const style = GOAL_TYPE_STYLES[primaryGoalType] ?? DEFAULT_STYLE;

  return (
    <Card
      className="group/playbook relative flex flex-col overflow-hidden border border-border/50 bg-card/90 transition-all duration-100 ease-out cursor-pointer hover:-translate-y-px hover:border-primary/25 hover:shadow-md"
      onClick={() => onClick?.(playbook)}
    >
      {/* Goal type accent — thin left border */}
      <div
        className={`absolute inset-y-0 left-0 w-[3px] rounded-l-[inherit] ${style.accentColor} opacity-60 group-hover/playbook:opacity-100 transition-opacity`}
      />

      <CardHeader className="flex-1 pl-5">
        <div className="flex items-center gap-2">
          {playbook.goalTypes.map((goalType) => {
            const goalStyle = GOAL_TYPE_STYLES[goalType] ?? DEFAULT_STYLE;
            return (
              <Badge
                key={goalType}
                variant="outline"
                className={`text-[10px] ${goalStyle.className}`}
              >
                {goalType}
              </Badge>
            );
          })}
        </div>

        <CardTitle className="text-sm leading-snug transition-colors group-hover/playbook:text-primary">
          {playbook.title}
        </CardTitle>

        <CardDescription className="text-xs line-clamp-2">
          {playbook.description}
        </CardDescription>

        {/* Meta row: time to value + tracked work + deliverables count */}
        <div className="mt-1 flex items-center gap-3">
          {playbook.timeToFirstValue ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <ClockIcon className="size-2.5" />
              {playbook.timeToFirstValue}
            </span>
          ) : null}
          {playbook.createsTrackedWork ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <ClipboardListIcon className="size-2.5" />
              Creates tasks
            </span>
          ) : null}
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <BookOpenIcon className="size-2.5" />
            {playbook.artifactTypes.length} deliverables
          </span>
        </div>
      </CardHeader>

      <div className="flex items-center gap-3 border-t border-border/30 py-2.5 pl-5 pr-4">
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 transition-colors group-hover/playbook:text-primary">
          Start playbook
          <ArrowRightIcon className="size-3 transition-transform group-hover/playbook:translate-x-0.5" />
        </span>
      </div>
    </Card>
  );
}
