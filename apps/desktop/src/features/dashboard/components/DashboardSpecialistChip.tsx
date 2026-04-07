import type { SpecialistAgent } from "@opengoat/contracts";
import { MessageSquareIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveSpecialistIcon } from "@/features/agents/specialist-icons";
import { getSpecialistColors, getSpecialistMeta } from "@/features/agents/specialist-meta";

interface DashboardSpecialistChipProps {
  specialist: SpecialistAgent;
  onChat: (specialistId: string) => void;
}

export function DashboardSpecialistChip({ specialist, onChat }: DashboardSpecialistChipProps) {
  const Icon = resolveSpecialistIcon(specialist.icon);
  const isManager = specialist.category === "manager";
  const colors = getSpecialistColors(specialist.id);
  const meta = getSpecialistMeta(specialist.id);

  return (
    <button
      type="button"
      className={cn(
        "group/chip relative flex w-full items-start gap-3 overflow-hidden rounded-xl border p-3.5 text-left transition-all duration-100",
        "shadow-sm shadow-black/[0.02] dark:shadow-black/15",
        "hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20",
        isManager
          ? "border-primary/25 bg-primary/[0.03] ring-1 ring-primary/[0.08] hover:border-primary/40 hover:ring-primary/15"
          : cn("bg-card dark:border-white/[0.06]", colors.chipBorder, colors.hoverBorder),
      )}
      onClick={() => onChat(specialist.id)}
    >
      {/* Left color accent bar */}
      {!isManager && (
        <div className={cn("absolute inset-y-0 left-0 w-[2px] opacity-40 transition-opacity group-hover/chip:opacity-80", colors.dotColor.replace("/40", ""))} />
      )}

      {/* Icon */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg",
          isManager
            ? "size-9 bg-primary/12 ring-1 ring-primary/15 shadow-sm"
            : cn("size-8 ring-1 ring-black/[0.03] dark:ring-white/[0.06]", colors.iconBg),
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
            "font-display font-bold leading-tight text-foreground",
            isManager ? "text-[14px]" : "text-[13px]",
          )}>
            {specialist.name}
          </span>
          {isManager ? (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-primary">
              Lead
            </span>
          ) : null}
          {/* Chat CTA — inline, compact */}
          <span className={cn(
            "ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-all duration-100",
            isManager
              ? "bg-primary/[0.06] text-primary/70 group-hover/chip:bg-primary/[0.12] group-hover/chip:text-primary"
              : cn("bg-muted/30 text-muted-foreground/50 dark:bg-white/[0.03]", colors.hoverIconBg, colors.hoverIconText),
          )}>
            <MessageSquareIcon className="size-2.5" />
            Chat
          </span>
        </div>

        {/* Produces — compact inline pills */}
        {meta?.produces && meta.produces.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {meta.produces.map((output) => (
              <span
                key={output}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-medium leading-tight",
                  isManager
                    ? "bg-primary/[0.06] text-primary/70"
                    : cn("bg-muted/20 dark:bg-white/[0.03]", colors.iconText, "opacity-70"),
                )}
              >
                <span className={cn("size-1 shrink-0 rounded-full", colors.dotColor)} />
                {output}
              </span>
            ))}
          </div>
        ) : null}

        {/* Role — demoted to subtle secondary text */}
        <p className={cn(
          "mt-1 leading-snug text-muted-foreground/40 line-clamp-1",
          isManager ? "text-[11px]" : "text-[10px]",
        )}>
          {specialist.role}
        </p>
      </div>
    </button>
  );
}
