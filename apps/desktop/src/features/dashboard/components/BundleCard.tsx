import { useState } from "react";
import { ChevronRightIcon, PackageIcon } from "lucide-react";
import type { ArtifactRecord } from "@opengoat/contracts";
import type { BundleGroup } from "@/features/dashboard/hooks/useRecentArtifacts";
import { ArtifactCard } from "@/features/dashboard/components/ArtifactCard";
import { getArtifactStatusConfig } from "@/features/dashboard/lib/artifact-type-config";
import { getSpecialistColors } from "@/features/agents/specialist-meta";

export interface BundleCardProps {
  bundle: BundleGroup;
  specialistId?: string | undefined;
  specialistName?: string | undefined;
  onPreview?: ((artifactId: string) => void) | undefined;
  onNavigate?: ((artifact: ArtifactRecord) => void) | undefined;
}

export function BundleCard({ bundle, specialistId, specialistName, onPreview, onNavigate }: BundleCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Compute status summary counts
  const statusCounts = new Map<string, number>();
  for (const artifact of bundle.artifacts) {
    statusCounts.set(artifact.status, (statusCounts.get(artifact.status) ?? 0) + 1);
  }

  return (
    <div className="relative rounded-lg border transition-all duration-100 hover:border-primary/30">
      {/* Left accent bar — primary emerald for bundles */}
      <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-[inherit] bg-primary opacity-60 transition-opacity hover:opacity-100" />

      {/* Header — clickable to toggle */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-3 px-3 py-3 pl-5 text-left"
      >
        <ChevronRightIcon
          className={`size-4 shrink-0 text-muted-foreground transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        />

        <PackageIcon className="size-3.5 shrink-0 text-primary" />

        {/* Bundle title */}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {bundle.title}
        </span>

        {/* Count badge */}
        <span className="shrink-0 rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
          {bundle.artifacts.length} output{bundle.artifacts.length !== 1 ? "s" : ""}
        </span>

        {/* Specialist attribution */}
        {specialistName ? (
          <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${specialistId ? `${getSpecialistColors(specialistId).iconBg} ${getSpecialistColors(specialistId).iconText}` : "bg-primary/8 text-primary"}`}>
            {specialistName}
          </span>
        ) : null}

        {/* Status summary pills */}
        <div className="hidden items-center gap-1.5 sm:flex">
          {Array.from(statusCounts.entries()).map(([status, count]) => {
            const config = getArtifactStatusConfig(status);
            return (
              <span
                key={status}
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ${config.className}`}
              >
                <span className={`inline-block size-1.5 rounded-full ${config.dotClassName}`} />
                {count}
              </span>
            );
          })}
        </div>
      </button>

      {/* Expanded content */}
      {expanded ? (
        <div className="mx-3 mb-3 space-y-2 border-t border-border/30 pt-2 pl-5">
          {bundle.artifacts.map((artifact) => (
            <ArtifactCard
              key={artifact.artifactId}
              artifact={artifact}
              specialistId={specialistId}
              specialistName={specialistName}
              onPreview={onPreview}
              onNavigate={onNavigate}
              compact
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
