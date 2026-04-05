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
  const exampleJobs = specialist.outputTypes?.slice(0, 2) ?? [];

  return (
    <button
      type="button"
      className={cn(
        "group/chip relative flex w-full flex-col gap-2.5 overflow-hidden rounded-xl border p-4 text-left transition-all duration-100",
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

      {/* Header: icon + name + badge */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg",
            isManager
              ? "size-10 bg-primary/12 ring-1 ring-primary/15 shadow-sm"
              : cn("size-8 ring-1 ring-black/[0.03] dark:ring-white/[0.06]", colors.iconBg),
          )}
        >
          <Icon
            className={cn(
              isManager ? "size-4.5 text-primary" : cn("size-3.5", colors.iconText),
            )}
          />
        </div>
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
          </div>
          <p className={cn(
            "mt-0.5 leading-snug text-muted-foreground/70 line-clamp-1",
            isManager ? "text-[12px]" : "text-[11px]",
          )}>
            {specialist.role}
          </p>
        </div>
      </div>

      {/* Best at — outcome-focused description */}
      {meta?.bestAt ? (
        <p className={cn(
          "leading-relaxed text-muted-foreground",
          isManager ? "text-[13px]" : "text-[12px]",
        )}>
          {meta.bestAt}
        </p>
      ) : null}

      {/* Example jobs from outputTypes */}
      {exampleJobs.length > 0 ? (
        <div className={cn(
          "flex gap-x-4 gap-y-1",
          isManager ? "flex-wrap" : "flex-col",
        )}>
          {exampleJobs.map((job) => (
            <div key={job} className="flex items-center gap-2">
              <span className={cn("size-1.5 shrink-0 rounded-full", colors.dotColor)} />
              <span className="text-[11px] leading-tight text-muted-foreground/80">
                {job}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Chat CTA — always visible, more prominent on hover */}
      <div className="mt-auto flex justify-end pt-1">
        <span className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-100",
          isManager
            ? "bg-primary/[0.06] text-primary/70 group-hover/chip:bg-primary/[0.12] group-hover/chip:text-primary"
            : cn("bg-muted/30 text-muted-foreground/50 dark:bg-white/[0.03]", colors.hoverIconBg, colors.hoverIconText),
        )}>
          <MessageSquareIcon className="size-3" />
          Chat
        </span>
      </div>
    </button>
  );
}
