import type { ArtifactRecord, SpecialistAgent } from "@opengoat/contracts";
import { MessageSquareIcon, PackageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveSpecialistIcon } from "@/features/agents/specialist-icons";
import { getSpecialistColors } from "@/features/agents/specialist-meta";
import { formatRelativeTime } from "@/lib/utils/output-labels";
import { cleanArtifactTitle } from "@/features/dashboard/lib/clean-artifact-title";

export interface SpecialistBundleGroup {
  bundleId: string;
  title: string;
  artifacts: ArtifactRecord[];
  createdAt: string;
}

interface SpecialistCardProps {
  specialist: SpecialistAgent;
  onChat: (specialistId: string) => void;
  recentOutputs?: ArtifactRecord[] | undefined;
  recentBundles?: SpecialistBundleGroup[] | undefined;
  onOutputNavigate?: ((artifact: ArtifactRecord) => void) | undefined;
}

export function SpecialistCard({ specialist, onChat, recentOutputs, recentBundles, onOutputNavigate }: SpecialistCardProps) {
  const Icon = resolveSpecialistIcon(specialist.icon);
  const isManager = specialist.category === "manager";
  const colors = getSpecialistColors(specialist.id);
  const outputs = recentOutputs?.length ? recentOutputs : [];
  const bundles = recentBundles?.length ? recentBundles : [];
  const hasOutputs = outputs.length > 0 || bundles.length > 0;

  return (
    <article
      className={cn(
        "group/card relative flex flex-col rounded-xl border bg-card transition-all duration-100 ease-out",
        "hover:-translate-y-px hover:shadow-md hover:border-primary/25",
        isManager
          ? "border-primary/20 bg-primary/[0.02] ring-1 ring-primary/[0.06] hover:ring-primary/10"
          : cn("dark:border-white/[0.06]", colors.chipBorder),
      )}
    >
      {/* Card body */}
      <div className="flex flex-1 flex-col p-5">
        {/* Header: icon + name + role */}
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl shadow-sm",
              isManager
                ? "size-11 bg-primary/12 ring-1 ring-primary/15"
                : cn("size-10 ring-1 ring-black/[0.04] dark:ring-white/[0.06]", colors.iconBg),
            )}
          >
            <Icon
              className={cn(
                isManager ? "size-5" : "size-4.5",
                isManager ? "text-primary" : colors.iconText,
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className={cn(
                "font-display font-bold tracking-tight text-foreground",
                isManager ? "text-[18px]" : "text-[15px]",
              )}>
                {specialist.name}
              </h3>
              {isManager ? (
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Lead
                </span>
              ) : null}
            </div>
            <p className={cn(
              "mt-0.5 leading-relaxed text-muted-foreground",
              isManager ? "text-[13px]" : "text-[12px]",
            )}>
              {specialist.role}
            </p>
          </div>
        </div>

        {/* Reason to exist */}
        <p className={cn(
          "mt-3.5 leading-[1.6] text-foreground/75",
          isManager ? "text-[14px]" : "text-[13px]",
        )}>
          {specialist.reasonToExist}
        </p>

        {/* Output types as deliverable chips */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {specialist.outputTypes.slice(0, 4).map((output) => (
            <span
              key={output}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium",
                isManager
                  ? "border border-primary/15 bg-primary/[0.05] text-primary/80 dark:border-primary/10 dark:text-primary/70"
                  : cn("border bg-muted/30 dark:bg-white/[0.03]", colors.chipBorder, "text-muted-foreground dark:text-zinc-400"),
              )}
            >
              {output}
            </span>
          ))}
        </div>

        {/* Recent outputs — bundles and standalone artifacts */}
        {hasOutputs ? (
          <div className="mt-4 rounded-lg border border-border/15 bg-muted/20 px-3 py-2.5 dark:border-white/[0.03] dark:bg-white/[0.02]">
            <div className="mb-1.5 flex items-center gap-1.5">
              <PackageIcon className="size-3 shrink-0 text-muted-foreground/50" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
                Recent outputs
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {/* Bundle rows */}
              {bundles.map((bundle) => (
                <div
                  key={bundle.bundleId}
                  role="button"
                  tabIndex={0}
                  className="group/output flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[11px] transition-colors hover:bg-card dark:hover:bg-white/[0.04]"
                  onClick={() => {
                    if (bundle.artifacts[0]) onOutputNavigate?.(bundle.artifacts[0]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (bundle.artifacts[0]) onOutputNavigate?.(bundle.artifacts[0]);
                    }
                  }}
                >
                  <PackageIcon className={cn("size-3 shrink-0", colors.iconText || "text-primary")} />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground/70 group-hover/output:text-foreground">
                    {bundle.title}
                  </span>
                  <span className="shrink-0 rounded-full bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {bundle.artifacts.length}
                  </span>
                  <span className="shrink-0 text-muted-foreground/40">
                    {formatRelativeTime(bundle.createdAt)}
                  </span>
                </div>
              ))}
              {/* Standalone artifact rows */}
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
                  <span className={cn("size-1 shrink-0 rounded-full", colors.dotColor)} />
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
      <div className={cn(
        "border-t px-5 py-3",
        isManager ? "border-primary/10 bg-primary/[0.02] dark:border-primary/[0.06]" : "border-border/20 dark:border-white/[0.04]",
      )}>
        <Button
          size="sm"
          variant={isManager ? "default" : "ghost"}
          className={cn(
            "h-8 w-full rounded-lg text-[12px] font-medium",
            isManager && "shadow-sm shadow-primary/20",
            !isManager && cn(
              "border border-border/30 text-muted-foreground hover:border-primary/25 hover:text-primary hover:bg-primary/[0.05]",
              "dark:border-white/[0.06] dark:text-zinc-400 dark:hover:border-primary/20 dark:hover:text-primary dark:hover:bg-primary/[0.06]",
            ),
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
