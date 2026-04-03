import type { SpecialistAgent } from "@opengoat/contracts";
import { MessageSquareIcon, PackageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveSpecialistIcon } from "@/features/agents/specialist-icons";
import { humanizeOutputLabel, formatRelativeTime } from "@/lib/utils/output-labels";

export interface SpecialistLastOutput {
  title: string;
  createdAt: string;
}

interface SpecialistCardProps {
  specialist: SpecialistAgent;
  onChat: (specialistId: string) => void;
  lastOutput?: SpecialistLastOutput | null;
}

export function SpecialistCard({ specialist, onChat, lastOutput }: SpecialistCardProps) {
  const Icon = resolveSpecialistIcon(specialist.icon);
  const isManager = specialist.category === "manager";

  return (
    <article
      className={cn(
        "group/card relative flex flex-col rounded-xl border bg-card p-5 transition-all hover:border-primary/25 hover:shadow-sm",
        isManager
          ? "border-primary/20 bg-primary/[0.02]"
          : "border-border/50",
      )}
    >
      {/* Header: icon + name + role */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            isManager ? "bg-primary/12" : "bg-muted/60",
          )}
        >
          <Icon
            className={cn(
              "size-4.5",
              isManager ? "text-primary" : "text-muted-foreground",
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
              {specialist.name}
            </h3>
            {isManager ? (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">
                Lead
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            {specialist.role}
          </p>
        </div>
      </div>

      {/* Reason to exist */}
      <p className="mt-3 text-[13px] leading-relaxed text-foreground/80">
        {specialist.reasonToExist}
      </p>

      {/* Output types as deliverable chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {specialist.outputTypes.slice(0, 4).map((output) => (
          <span
            key={output}
            className="rounded-md bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            {output}
          </span>
        ))}
      </div>

      {/* Last output — only shown when available */}
      {lastOutput ? (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <PackageIcon className="size-3 shrink-0" />
          <span className="truncate">
            {humanizeOutputLabel(lastOutput.title)}
          </span>
          <span className="shrink-0 text-muted-foreground/60">
            — {formatRelativeTime(lastOutput.createdAt)}
          </span>
        </div>
      ) : null}

      {/* CTA */}
      <div className="mt-4 pt-3 border-t border-border/30">
        <Button
          size="sm"
          variant={isManager ? "default" : "outline"}
          className={cn(
            "h-8 w-full rounded-md text-[12px] font-medium",
            !isManager && "hover:border-primary/40 hover:text-primary",
          )}
          onClick={() => onChat(specialist.id)}
        >
          <MessageSquareIcon className="size-3.5" />
          Chat with {specialist.name}
        </Button>
      </div>
    </article>
  );
}
