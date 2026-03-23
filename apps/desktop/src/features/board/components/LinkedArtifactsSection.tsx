import type { ArtifactRecord } from "@opengoat/contracts";
import { PackageIcon, EyeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LinkedArtifactsSectionProps {
  artifacts: ArtifactRecord[];
}

const ARTIFACT_STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  ready_for_review: "bg-warning/10 text-warning dark:bg-yellow-900/20 dark:text-yellow-400",
  approved: "bg-success/10 text-success dark:bg-green-900/20 dark:text-green-400",
  needs_changes: "bg-destructive/10 text-destructive dark:bg-red-900/20 dark:text-red-400",
  archived: "bg-muted text-muted-foreground/60",
};

export function LinkedArtifactsSection({ artifacts }: LinkedArtifactsSectionProps) {
  return (
    <div className="border-t border-border/40 pt-4">
      <h4 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        Linked Artifacts
      </h4>
      {artifacts.length === 0 ? (
        <p className="text-xs text-muted-foreground/60">No linked artifacts</p>
      ) : (
        <ul className="space-y-2">
          {artifacts.map((artifact) => (
            <li key={artifact.artifactId} className="flex items-center gap-2 text-sm">
              <PackageIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="inline-flex items-center rounded bg-primary/8 px-1.5 py-0.5 font-mono text-[10px] text-primary/70 dark:bg-primary/12 dark:text-primary/80">
                {artifact.type.replace(/_/g, " ")}
              </span>
              <span className="truncate flex-1 text-foreground">{artifact.title}</span>
              <Badge
                variant="outline"
                className={`shrink-0 border-transparent font-mono text-[10px] uppercase tracking-wider ${ARTIFACT_STATUS_STYLES[artifact.status] ?? ""}`}
              >
                {artifact.status.replace(/_/g, " ")}
              </Badge>
              <a
                href={`#artifacts/${artifact.artifactId}`}
                className="shrink-0 text-muted-foreground/60 hover:text-primary transition-colors"
                title="Preview"
              >
                <EyeIcon className="size-3.5" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
