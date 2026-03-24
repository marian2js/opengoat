import type { ArtifactRecord } from "@opengoat/contracts";
import { PackageIcon, EyeIcon } from "lucide-react";

interface LinkedArtifactsSectionProps {
  artifacts: ArtifactRecord[];
}

export function LinkedArtifactsSection({ artifacts }: LinkedArtifactsSectionProps) {
  if (artifacts.length === 0) return null;

  return (
    <div className="border-t border-border/40 py-3">
      <h4 className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
        Outputs
      </h4>
      {artifacts.length > 0 && (
        <ul className="space-y-2">
          {artifacts.map((artifact) => (
            <li key={artifact.artifactId} className="flex items-center gap-2 text-sm">
              <PackageIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="inline-flex items-center rounded bg-primary/8 px-1.5 py-0.5 font-mono text-[10px] text-primary/70 dark:bg-primary/12 dark:text-primary/80">
                {artifact.type.replace(/_/g, " ")}
              </span>
              <span className="truncate flex-1 text-foreground">{artifact.title}</span>
              <a
                href={`#artifacts/${artifact.artifactId}`}
                className="shrink-0 text-muted-foreground/60 hover:text-primary transition-colors"
                title="View"
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
