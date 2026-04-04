import type { ArtifactRecord, SpecialistAgent } from "@opengoat/contracts";
import { MessageSquareIcon, PackageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveSpecialistIcon } from "@/features/agents/specialist-icons";
import { formatRelativeTime } from "@/lib/utils/output-labels";
import { cleanArtifactTitle } from "@/features/dashboard/lib/clean-artifact-title";

interface SpecialistCardProps {
  specialist: SpecialistAgent;
  onChat: (specialistId: string) => void;
  recentOutputs?: ArtifactRecord[] | undefined;
  onOutputNavigate?: ((artifact: ArtifactRecord) => void) | undefined;
}

export function SpecialistCard({ specialist, onChat, recentOutputs, onOutputNavigate }: SpecialistCardProps) {
  const Icon = resolveSpecialistIcon(specialist.icon);
  const isManager = specialist.category === "manager";
  const outputs = recentOutputs?.length ? recentOutputs : [];

  return (
    <article
      className={cn(
        "group/card relative flex flex-col rounded-xl border bg-card transition-all duration-150",
        "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20",
        isManager
          ? "border-primary/20 bg-primary/[0.02] ring-1 ring-primary/[0.06] hover:border-primary/30 hover:ring-primary/10"
          : "border-border/40 hover:border-primary/20 dark:border-white/[0.06]",
      )}
    >
      {/* Card body */}
      <div className="flex flex-1 flex-col p-5">
        {/* Header: icon + name + role */}
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm",
              isManager
                ? "bg-primary/12 ring-1 ring-primary/15"
                : "bg-primary/[0.06] ring-1 ring-primary/[0.06] dark:bg-primary/[0.08] dark:ring-primary/[0.08]",
            )}
          >
            <Icon
              className="size-5 text-primary"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-[16px] font-bold tracking-tight text-foreground">
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
        <p className="mt-3.5 text-[13px] leading-[1.6] text-foreground/75">
          {specialist.reasonToExist}
        </p>

        {/* Output types as deliverable chips */}
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {specialist.outputTypes.slice(0, 4).map((output) => (
            <span
              key={output}
              className="rounded-md border border-border/40 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-zinc-400"
            >
              {output}
            </span>
          ))}
        </div>

        {/* Recent outputs — only shown when outputs exist */}
        {outputs.length > 0 ? (
          <div className="mt-4 rounded-lg border border-border/15 bg-muted/20 px-3 py-2.5 dark:border-white/[0.03] dark:bg-white/[0.02]">
            <div className="mb-1.5 flex items-center gap-1.5">
              <PackageIcon className="size-3 shrink-0 text-muted-foreground/50" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
                Recent outputs
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {outputs.map((artifact) => (
                <div
                  key={artifact.artifactId}
                  role="button"
                  tabIndex={0}
                  className="group/output flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[11px] transition-colors hover:bg-card dark:hover:bg-white/[0.04]"
                  onClick={() => onOutputNavigate?.(artifact)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOutputNavigate?.(artifact);
                    }
                  }}
                >
                  <span className="size-1 shrink-0 rounded-full bg-primary/40" />
                  <span className="min-w-0 flex-1 truncate text-foreground/70 group-hover/output:text-foreground">
                    {cleanArtifactTitle(artifact)}
                  </span>
                  <span className="shrink-0 text-muted-foreground/40">
                    {formatRelativeTime(artifact.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* CTA — separated footer */}
      <div className="border-t border-border/20 px-5 py-3.5 dark:border-white/[0.04]">
        <Button
          size="sm"
          variant={isManager ? "default" : "outline"}
          className={cn(
            "h-9 w-full rounded-lg text-[12px] font-medium",
            !isManager && "border-border/40 hover:border-primary/40 hover:bg-primary/[0.04] hover:text-primary dark:border-white/[0.08]",
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
