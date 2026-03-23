import { useState } from "react";
import {
  TargetIcon,
  RocketIcon,
  TrendingUpIcon,
  SendIcon,
  SearchIcon,
  PenToolIcon,
  BarChart3Icon,
  MailIcon,
  UsersIcon,
  FileTextIcon,
  ArrowRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ObjectiveComposerPromptProps {
  onCreateObjective: (prefillTitle?: string) => void;
}

interface GoalType {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  prefillTitle: string;
}

const GOAL_TYPES: GoalType[] = [
  {
    id: "launch",
    label: "Launch",
    description: "Ship a launch campaign",
    icon: RocketIcon,
    prefillTitle: "Launch on Product Hunt",
  },
  {
    id: "conversion",
    label: "Improve conversion",
    description: "Optimize signup or purchase flow",
    icon: TrendingUpIcon,
    prefillTitle: "Improve homepage conversion",
  },
  {
    id: "outbound",
    label: "Start outbound",
    description: "Reach prospects directly",
    icon: SendIcon,
    prefillTitle: "Start cold outbound",
  },
  {
    id: "seo",
    label: "Build SEO",
    description: "Grow organic search traffic",
    icon: SearchIcon,
    prefillTitle: "Build an SEO wedge",
  },
  {
    id: "content",
    label: "Content sprint",
    description: "Produce a batch of content",
    icon: PenToolIcon,
    prefillTitle: "Ship a 2-week content sprint",
  },
  {
    id: "comparison",
    label: "Comparison pages",
    description: "Win competitor search terms",
    icon: BarChart3Icon,
    prefillTitle: "Create comparison pages against competitors",
  },
  {
    id: "lead-magnet",
    label: "Lead magnet",
    description: "Capture leads with a resource",
    icon: FileTextIcon,
    prefillTitle: "Create a lead magnet",
  },
  {
    id: "onboarding",
    label: "Onboarding",
    description: "Improve activation & retention",
    icon: UsersIcon,
    prefillTitle: "Improve onboarding activation",
  },
];

export function ObjectiveComposerPrompt({
  onCreateObjective,
}: ObjectiveComposerPromptProps) {
  const [freeText, setFreeText] = useState("");

  function handleGoalTypeClick(goalType: GoalType): void {
    onCreateObjective(goalType.prefillTitle);
  }

  function handleFreeTextSubmit(): void {
    if (freeText.trim()) {
      onCreateObjective(freeText.trim());
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "Enter" && freeText.trim()) {
      handleFreeTextSubmit();
    }
  }

  return (
    <section className="flex flex-col gap-6">
      {/* Section label */}
      <div className="flex items-center gap-2">
        <TargetIcon className="size-3.5 text-primary" />
        <h2 className="section-label">Objective</h2>
      </div>

      {/* Hero prompt */}
      <div className="flex flex-col gap-5">
        <h3 className="font-display text-xl font-bold leading-snug tracking-tight text-foreground">
          What are you trying to achieve right now?
        </h3>

        {/* Goal type buttons grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GOAL_TYPES.map((gt) => {
            const Icon = gt.icon;
            return (
              <button
                key={gt.id}
                type="button"
                className="group/goal flex flex-col items-start gap-1.5 rounded-lg border border-border/50 bg-card/60 px-3 py-2.5 text-left transition-all hover:-translate-y-px hover:border-primary/30 hover:bg-card hover:shadow-sm"
                onClick={() => handleGoalTypeClick(gt)}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="size-3.5 text-muted-foreground/60 transition-colors group-hover/goal:text-primary" />
                  <span className="text-[13px] font-medium text-foreground transition-colors group-hover/goal:text-primary">
                    {gt.label}
                  </span>
                </div>
                <span className="text-[11px] leading-tight text-muted-foreground/60">
                  {gt.description}
                </span>
              </button>
            );
          })}
        </div>

        {/* Free-text input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MailIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <Input
              className="pl-9 pr-3"
              placeholder="Or describe your goal..."
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            disabled={!freeText.trim()}
            onClick={handleFreeTextSubmit}
          >
            Create objective
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
