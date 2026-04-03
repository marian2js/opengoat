import { resolveSpecialistIcon } from "@/features/agents/specialist-icons";

interface SpecialistChatHeaderProps {
  specialistId: string;
  specialistName: string;
  specialistRole?: string;
  specialistIcon?: string;
}

export function SpecialistChatHeader({
  specialistName,
  specialistRole,
  specialistIcon,
}: SpecialistChatHeaderProps) {
  const Icon = resolveSpecialistIcon(specialistIcon ?? "");

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-3.5" />
      </div>
      <div className="flex min-w-0 flex-col gap-0">
        <span className="text-[12px] font-semibold leading-tight text-foreground">
          {specialistName}
        </span>
        {specialistRole ? (
          <span className="truncate text-[10px] leading-tight text-muted-foreground/60">
            {specialistRole}
          </span>
        ) : null}
      </div>
    </div>
  );
}
