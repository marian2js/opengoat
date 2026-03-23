import { EyeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { ArtifactRecord } from "@opengoat/contracts";
import { useObjectiveArtifacts } from "@/features/objectives/hooks/useObjectiveArtifacts";
import { getArtifactTypeConfig, getArtifactStatusConfig } from "@/features/dashboard/lib/artifact-type-config";

export interface ArtifactsTabProps {
  objectiveId: string;
  client: SidecarClient;
  onPreview?: (artifactId: string) => void;
}

export function ArtifactsTab({
  objectiveId,
  client,
  onPreview,
}: ArtifactsTabProps) {
  const { groups, isLoading, error, refresh } = useObjectiveArtifacts(objectiveId, client);

  if (isLoading) {
    return (
      <div className="space-y-3 py-5">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          Retry
        </Button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <p className="text-sm text-muted-foreground">
          No artifacts yet — artifacts will appear here as runs produce output
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {groups.map((group) => {
        const statusConfig = getArtifactStatusConfig(group.status);
        return (
          <div key={group.status}>
            {/* Group header */}
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`inline-block size-1.5 rounded-full ${statusConfig.dotClassName}`}
              />
              <h4 className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h4>
              <span className="rounded-full bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                {group.artifacts.length}
              </span>
            </div>

            {/* Artifact cards */}
            <div className="space-y-2">
              {group.artifacts.map((artifact: ArtifactRecord) => {
                const typeConfig = getArtifactTypeConfig(artifact.type);
                return (
                  <div
                    key={artifact.artifactId}
                    className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5 transition-colors hover:bg-muted/30"
                  >
                    {/* Accent bar */}
                    <div className={`h-8 w-0.5 rounded-full ${typeConfig.accentColor}`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[13px] font-medium text-foreground/90">
                        {artifact.title}
                      </p>
                      {artifact.summary ? (
                        <p className="truncate text-xs text-muted-foreground/70">
                          {artifact.summary}
                        </p>
                      ) : null}
                    </div>

                    {/* Type badge */}
                    <Badge
                      variant="outline"
                      className={`shrink-0 border-transparent font-mono text-[10px] uppercase tracking-wider ${typeConfig.badgeClassName}`}
                    >
                      {typeConfig.label}
                    </Badge>

                    {/* Format badge */}
                    <Badge
                      variant="outline"
                      className="shrink-0 border-transparent bg-muted/50 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                    >
                      {artifact.format}
                    </Badge>

                    {/* Preview action */}
                    {onPreview ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-primary"
                        onClick={() => onPreview(artifact.artifactId)}
                      >
                        <EyeIcon className="size-3" />
                        Preview
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
