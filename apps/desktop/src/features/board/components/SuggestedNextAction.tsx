import {
  ShieldAlertIcon,
  FileCheck2Icon,
  ClockIcon,
  CheckCircle2Icon,
  PlayIcon,
  SparklesIcon,
} from "lucide-react";
import type { SuggestedAction } from "@/features/board/lib/suggested-action";

interface SuggestedNextActionProps {
  suggestion: SuggestedAction | null;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "shield-alert": ShieldAlertIcon,
  "file-check": FileCheck2Icon,
  clock: ClockIcon,
  "check-circle": CheckCircle2Icon,
  play: PlayIcon,
};

export function SuggestedNextAction({ suggestion }: SuggestedNextActionProps) {
  if (!suggestion) return null;

  const Icon = ICON_MAP[suggestion.icon] ?? SparklesIcon;

  return (
    <div className="border-t border-border/40 pt-4">
      <div className="flex items-center gap-2.5 rounded-lg bg-primary/8 px-3 py-2.5 dark:bg-primary/10">
        <Icon className="size-4 shrink-0 text-primary" />
        <span className="text-sm font-medium text-primary">
          {suggestion.text}
        </span>
      </div>
    </div>
  );
}
