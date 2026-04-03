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
        "group/chip flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all duration-100",
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
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          isManager ? "bg-primary/12" : "bg-muted/60",
        )}
      >
        <Icon
          className={cn(
            "size-3.5",
            isManager ? "text-primary" : "text-muted-foreground",
          )}
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
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-1">
          {specialist.role}
        </p>

        {/* Example jobs from outputTypes */}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {specialist.outputTypes.slice(0, 2).map((output) => (
            <span
              key={output}
              className="rounded bg-muted/40 px-1.5 py-px text-[10px] text-muted-foreground/70"
            >
              {output}
            </span>
          ))}
        </div>
      </div>

      {/* Chat shortcut */}
      <div className="flex shrink-0 items-center self-center opacity-0 transition-opacity group-hover/chip:opacity-100">
        <span className="flex items-center gap-1 rounded-md bg-primary/8 px-2 py-1 text-[10px] font-medium text-primary">
          <MessageSquareIcon className="size-3" />
          Chat
        </span>
      </div>
    </button>
  );
}
