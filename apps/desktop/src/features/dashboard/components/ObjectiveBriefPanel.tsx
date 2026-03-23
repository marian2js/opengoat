import {
  CheckIcon,
  PenLineIcon,
  SkipForwardIcon,
  LoaderCircleIcon,
  AlertCircleIcon,
  HelpCircleIcon,
  PackageIcon,
  ShieldAlertIcon,
  BookOpenIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ObjectiveBrief } from "@/features/dashboard/types/objective";

export interface ObjectiveBriefPanelProps {
  brief: ObjectiveBrief | null;
  isGenerating: boolean;
  error: string | null;
  onAccept: () => void;
  onEdit: () => void;
  onSkip: () => void;
}

function BriefListSection({
  icon: Icon,
  label,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: string[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3 text-muted-foreground/60" />
        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
          {label}
        </span>
      </div>
      <ul className="flex flex-col gap-1 pl-[18px]">
        {items.map((item, i) => (
          <li
            key={i}
            className="text-[13px] leading-relaxed text-muted-foreground before:mr-2 before:text-primary/40 before:content-['•']"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ObjectiveBriefPanel({
  brief,
  isGenerating,
  error,
  onAccept,
  onEdit,
  onSkip,
}: ObjectiveBriefPanelProps) {
  if (isGenerating) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <LoaderCircleIcon className="size-4 animate-spin text-primary" />
          <span className="text-sm font-medium text-foreground">
            Generating brief...
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircleIcon className="size-4" />
          <span className="text-sm font-medium">Brief generation failed</span>
        </div>
        <p className="text-xs text-muted-foreground">{error}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onSkip}>
            <SkipForwardIcon className="mr-1.5 size-3.5" />
            Continue without brief
          </Button>
        </div>
      </div>
    );
  }

  if (!brief) return null;

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      {/* Summary */}
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-primary">
          Brief Summary
        </span>
        <p className="text-sm leading-relaxed text-foreground">{brief.summary}</p>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-4 border-t border-border/30 pt-4">
        <BriefListSection
          icon={ShieldAlertIcon}
          label="Constraints"
          items={brief.constraints}
        />
        <BriefListSection
          icon={BookOpenIcon}
          label="Suggested Playbooks"
          items={brief.suggestedPlaybooks}
        />
        <BriefListSection
          icon={HelpCircleIcon}
          label="Missing Information"
          items={brief.missingInfo}
        />
        <BriefListSection
          icon={PackageIcon}
          label="Likely Deliverables"
          items={brief.likelyDeliverables}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-border/30 pt-4">
        <Button variant="default" size="sm" className="gap-1.5" onClick={onAccept}>
          <CheckIcon className="size-3.5" />
          Accept brief
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
          <PenLineIcon className="size-3.5" />
          Edit
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onSkip}>
          <SkipForwardIcon className="size-3.5" />
          Skip
        </Button>
      </div>
    </div>
  );
}
