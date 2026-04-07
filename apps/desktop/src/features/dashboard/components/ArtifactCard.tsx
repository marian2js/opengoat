import { ArrowRightIcon } from "lucide-react";
import type { ArtifactRecord } from "@opengoat/contracts";
import { getArtifactTypeConfig, getArtifactStatusConfig } from "@/features/dashboard/lib/artifact-type-config";
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";
import { cleanArtifactTitle, isConversationalTitle } from "@/features/dashboard/lib/clean-artifact-title";
import { stripTitleFromPreview } from "@/features/dashboard/lib/strip-title-from-preview";
import { getSpecialistColors } from "@/features/agents/specialist-meta";

export interface ArtifactCardProps {
  artifact: ArtifactRecord;
  specialistId?: string | undefined;
  specialistName?: string | undefined;
  onPreview?: ((artifactId: string) => void) | undefined;
  onNavigate?: ((artifact: ArtifactRecord) => void) | undefined;
  compact?: boolean | undefined;
}

export function ArtifactCard({ artifact, specialistId, specialistName, onPreview, onNavigate, compact }: ArtifactCardProps) {
  const typeConfig = getArtifactTypeConfig(artifact.type);
  const statusConfig = getArtifactStatusConfig(artifact.status);
  const specColors = specialistId ? getSpecialistColors(specialistId) : undefined;
  const displayTitle = cleanArtifactTitle(artifact);
  const titleMatchesType = displayTitle.toLowerCase() === typeConfig.label.toLowerCase();

  const handleClick = () => {
    if (onNavigate) {
      onNavigate(artifact);
    }
  };

  return (
    <div
      role={onNavigate ? "button" : undefined}
      tabIndex={onNavigate ? 0 : undefined}
      onClick={onNavigate ? handleClick : undefined}
      onKeyDown={onNavigate ? (e) => { if (e.key === "Enter" || e.key === " ") handleClick(); } : undefined}
      className={`group/artifact relative overflow-hidden rounded-xl border border-border/20 bg-card shadow-sm shadow-black/[0.02] transition-all duration-100 ease-out hover:-translate-y-px hover:border-primary/25 hover:shadow-md dark:border-white/[0.06] dark:shadow-black/15 ${onNavigate ? "cursor-pointer" : ""} ${compact ? "p-2.5" : "p-3.5"}`}
    >
      {/* Left accent bar */}
      <div
        className={`absolute inset-y-0 left-0 w-[3px] rounded-l-xl ${typeConfig.accentColor} opacity-50 transition-opacity group-hover/artifact:opacity-100`}
      />

      <div className="pl-3.5">
        {/* Top row: type badge + status badge + specialist attribution */}
        <div className="mb-2 flex items-center gap-2">
          {!titleMatchesType && (
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${typeConfig.badgeClassName}`}
            >
              {typeConfig.label}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${statusConfig.className}`}
          >
            <span
              className={`inline-block size-1.5 rounded-full ${statusConfig.dotClassName}`}
            />
            {statusConfig.label}
          </span>
          {specialistName ? (
            <span className={`ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-medium ${specColors ? `${specColors.iconBg} ${specColors.iconText}` : "bg-primary/8 text-primary"}`}>
              {specialistName}
            </span>
          ) : null}
        </div>

        {/* Title */}
        <h3 className="truncate text-[14px] font-semibold text-foreground">
          {displayTitle}
        </h3>

        {/* Summary (optional) — hide if conversational AI preamble; strip title echo */}
        {artifact.summary && !isConversationalTitle(artifact.summary) ? (
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {stripTitleFromPreview(displayTitle, artifact.summary)}
          </p>
        ) : null}

        {/* Bottom row: timestamp + preview action */}
        <div className="mt-2.5 flex items-center justify-between">
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/50">
            {formatRelativeTime(artifact.createdAt)}
          </span>

          {onPreview ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPreview(artifact.artifactId); }}
              className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary opacity-0 transition-all hover:text-primary/80 group-hover/artifact:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              Open
              <ArrowRightIcon className="size-3 transition-transform group-hover/artifact:translate-x-0.5" />
            </button>
          ) : onNavigate ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary opacity-0 transition-all group-hover/artifact:opacity-100">
              Open
              <ArrowRightIcon className="size-3 transition-transform group-hover/artifact:translate-x-0.5" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
