import { ArrowRightIcon } from "lucide-react";
import type { ArtifactRecord } from "@opengoat/contracts";
import { getArtifactTypeConfig, getArtifactStatusConfig } from "@/features/dashboard/lib/artifact-type-config";
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";
import { stripMarkdown } from "@/features/dashboard/lib/strip-markdown";

export interface ArtifactCardProps {
  artifact: ArtifactRecord;
  specialistName?: string | undefined;
  onPreview?: ((artifactId: string) => void) | undefined;
  onNavigate?: ((artifact: ArtifactRecord) => void) | undefined;
  compact?: boolean | undefined;
}

export function ArtifactCard({ artifact, specialistName, onPreview, onNavigate, compact }: ArtifactCardProps) {
  const typeConfig = getArtifactTypeConfig(artifact.type);
  const statusConfig = getArtifactStatusConfig(artifact.status);

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
      className={`group/artifact relative rounded-lg border transition-all duration-100 hover:-translate-y-px hover:border-primary/30 hover:shadow-sm ${onNavigate ? "cursor-pointer" : ""} ${compact ? "p-2" : "p-3"}`}
    >
      {/* Left accent bar */}
      <div
        className={`absolute inset-y-0 left-0 w-[3px] rounded-l-[inherit] ${typeConfig.accentColor} opacity-60 transition-opacity group-hover/artifact:opacity-100`}
      />

      <div className="pl-3">
        {/* Top row: type badge + status badge + specialist attribution */}
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${typeConfig.badgeClassName}`}
          >
            {typeConfig.label}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${statusConfig.className}`}
          >
            <span
              className={`inline-block size-1.5 rounded-full ${statusConfig.dotClassName}`}
            />
            {statusConfig.label}
          </span>
          {specialistName ? (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 font-mono text-[10px] font-medium text-primary">
              {specialistName}
            </span>
          ) : null}
        </div>

        {/* Title */}
        <h3 className="truncate text-sm font-medium text-foreground">
          {stripMarkdown(artifact.title)}
        </h3>

        {/* Summary (optional) */}
        {artifact.summary ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {stripMarkdown(artifact.summary)}
          </p>
        ) : null}

        {/* Bottom row: timestamp + preview action */}
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
            {formatRelativeTime(artifact.createdAt)}
          </span>

          {onPreview ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPreview(artifact.artifactId); }}
              className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary opacity-0 transition-all hover:text-primary/80 group-hover/artifact:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              View output
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
