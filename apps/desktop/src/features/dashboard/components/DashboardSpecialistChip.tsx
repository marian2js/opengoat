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
        "group/chip flex w-full flex-col gap-2.5 rounded-xl border p-4 text-left transition-all duration-100",
        "hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20",
        isManager
          ? "border-primary/25 bg-primary/[0.03] ring-1 ring-primary/[0.08] hover:border-primary/40 hover:ring-primary/15"
          : cn("bg-card dark:border-white/[0.06]", colors.chipBorder, colors.hoverBorder),
      )}
      onClick={() => onChat(specialist.id)}
    >
      {/* Header: icon + name + badge */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg shadow-sm",
            isManager
              ? "size-10 bg-primary/12 ring-1 ring-primary/15"
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
      <div className="flex justify-end pt-0.5">
        <span className={cn(
          "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors duration-100",
          isManager
            ? "text-primary/60 group-hover/chip:bg-primary/[0.08] group-hover/chip:text-primary"
            : cn("text-muted-foreground/40", colors.hoverIconBg, colors.hoverIconText),
        )}>
          Chat
          <MessageSquareIcon className="size-3" />
        </span>
      </div>
    </button>
  );
}
