import { ArrowRightIcon } from "lucide-react";
import type { ArtifactRecord } from "@opengoat/contracts";
import { getArtifactTypeConfig, getArtifactStatusConfig } from "@/features/dashboard/lib/artifact-type-config";
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";

export interface ArtifactCardProps {
  artifact: ArtifactRecord;
  onPreview?: (artifactId: string) => void;
  compact?: boolean;
}

export function ArtifactCard({ artifact, onPreview, compact }: ArtifactCardProps) {
  const typeConfig = getArtifactTypeConfig(artifact.type);
  const statusConfig = getArtifactStatusConfig(artifact.status);

  return (
    <div
      className={`group/artifact relative rounded-lg border transition-all duration-100 hover:-translate-y-px hover:border-primary/30 hover:shadow-sm ${compact ? "p-2" : "p-3"}`}
    >
      {/* Left accent bar */}
      <div
        className={`absolute inset-y-0 left-0 w-[3px] rounded-l-[inherit] ${typeConfig.accentColor} opacity-60 transition-opacity group-hover/artifact:opacity-100`}
      />

      <div className="pl-3">
        {/* Top row: type badge + status badge */}
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
        </div>

        {/* Title */}
        <h3 className="truncate text-sm font-medium text-foreground">
          {artifact.title}
        </h3>

        {/* Summary (optional) */}
        {artifact.summary ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {artifact.summary}
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
              onClick={() => onPreview(artifact.artifactId)}
              className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary opacity-0 transition-all hover:text-primary/80 group-hover/artifact:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              Preview artifact
              <ArrowRightIcon className="size-3 transition-transform group-hover/artifact:translate-x-0.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
