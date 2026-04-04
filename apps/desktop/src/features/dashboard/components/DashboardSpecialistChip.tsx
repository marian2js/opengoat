import type { SpecialistAgent } from "@opengoat/contracts";
import { MessageSquareIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveSpecialistIcon } from "@/features/agents/specialist-icons";
import { getSpecialistColors } from "@/features/agents/specialist-meta";

interface DashboardSpecialistChipProps {
  specialist: SpecialistAgent;
  onChat: (specialistId: string) => void;
}

export function DashboardSpecialistChip({ specialist, onChat }: DashboardSpecialistChipProps) {
  const Icon = resolveSpecialistIcon(specialist.icon);
  const isManager = specialist.category === "manager";
  const colors = getSpecialistColors(specialist.id);

  return (
    <button
      type="button"
      className={cn(
        "group/chip flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-100",
        "hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20",
        isManager
          ? "border-primary/25 bg-primary/[0.03] ring-1 ring-primary/[0.08] hover:border-primary/40 hover:ring-primary/15"
          : cn("bg-card dark:border-white/[0.06]", colors.chipBorder, colors.hoverBorder),
      )}
      onClick={() => onChat(specialist.id)}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg",
          isManager
            ? "size-9 bg-primary/12 ring-1 ring-primary/15"
            : cn("size-8", colors.iconBg),
        )}
      >
        <Icon
          className={cn(
            isManager ? "size-4 text-primary" : cn("size-3.5", colors.iconText),
          )}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "font-semibold leading-tight text-foreground",
            isManager ? "text-[14px]" : "text-[13px]",
          )}>
            {specialist.name}
          </span>
          {isManager ? (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-primary">
              Lead
            </span>
          ) : null}
        </div>
        <p className={cn(
          "mt-0.5 leading-snug text-muted-foreground/70 line-clamp-2",
          isManager ? "text-[12px]" : "text-[11px]",
        )}>
          {specialist.role}
        </p>
      </div>

      {/* Chat arrow — revealed on hover */}
      <div className={cn(
        "flex shrink-0 items-center self-center rounded-md p-1.5 text-muted-foreground/20 transition-all duration-100",
        isManager
          ? "group-hover/chip:bg-primary/[0.06] group-hover/chip:text-primary"
          : cn(colors.hoverIconBg, colors.hoverIconText),
      )}>
        <MessageSquareIcon className="size-3.5" />
      </div>
    </button>
  );
}
