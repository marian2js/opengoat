import type { SpecialistAgent } from "@opengoat/contracts";
import { MessageSquareIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveSpecialistIcon } from "@/features/agents/specialist-icons";

interface DashboardSpecialistChipProps {
  specialist: SpecialistAgent;
  onChat: (specialistId: string) => void;
}

export function DashboardSpecialistChip({ specialist, onChat }: DashboardSpecialistChipProps) {
  const Icon = resolveSpecialistIcon(specialist.icon);
  const isManager = specialist.category === "manager";

  return (
    <button
      type="button"
      className={cn(
        "group/chip flex w-full items-start gap-3 rounded-lg border p-3.5 text-left transition-all duration-100",
        "hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20",
        isManager
          ? "border-primary/20 bg-primary/[0.03] hover:border-primary/35"
          : "border-border/30 bg-card hover:border-primary/20",
      )}
      onClick={() => onChat(specialist.id)}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          isManager ? "bg-primary/12" : "bg-primary/[0.08] dark:bg-primary/[0.08]",
        )}
      >
        <Icon
          className="size-3.5 text-primary"
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold leading-tight text-foreground">
            {specialist.name}
          </span>
          {isManager ? (
            <span className="rounded bg-primary/10 px-1 py-px font-mono text-[9px] font-semibold uppercase tracking-wide text-primary">
              Lead
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/70 line-clamp-2">
          {specialist.role}
        </p>
      </div>

      {/* Chat arrow — revealed on hover */}
      <div className="flex shrink-0 items-center self-center text-muted-foreground/30 transition-all duration-100 group-hover/chip:text-primary">
        <MessageSquareIcon className="size-3.5" />
      </div>
    </button>
  );
}
