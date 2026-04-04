import { cn } from "@/lib/utils";
import { resolveSpecialistIcon } from "@/features/agents/specialist-icons";
import { getSpecialistColors } from "@/features/agents/specialist-meta";

interface SpecialistChatHeaderProps {
  specialistId: string;
  specialistName: string;
  specialistRole?: string;
  specialistIcon?: string;
}

export function SpecialistChatHeader({
  specialistId,
  specialistName,
  specialistRole,
  specialistIcon,
}: SpecialistChatHeaderProps) {
  const Icon = resolveSpecialistIcon(specialistIcon ?? "");
  const colors = getSpecialistColors(specialistId);

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]", colors.iconBg)}>
        <Icon className={cn("size-3.5", colors.iconText)} />
      </div>
      <div className="flex min-w-0 flex-col gap-0">
        <span className="text-[13px] font-semibold leading-tight text-foreground">
          {specialistName}
        </span>
        {specialistRole ? (
          <span className="truncate text-[11px] leading-tight text-muted-foreground/60">
            {specialistRole}
          </span>
        ) : null}
      </div>
    </div>
  );
}
