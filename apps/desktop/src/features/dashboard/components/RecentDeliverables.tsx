import { PackageIcon } from "lucide-react";
import type { SidecarClient } from "@/lib/sidecar/client";
import { useRecentArtifacts } from "@/features/dashboard/hooks/useRecentArtifacts";
import { ArtifactCard } from "@/features/dashboard/components/ArtifactCard";
import { BundleCard } from "@/features/dashboard/components/BundleCard";

export interface RecentDeliverablesProps {
  agentId: string;
  client: SidecarClient;
  onPreview?: (artifactId: string) => void;
}

export function RecentDeliverables({ agentId, client, onPreview }: RecentDeliverablesProps) {
  const { standaloneArtifacts, bundleGroups, isLoading, isEmpty } = useRecentArtifacts(agentId, client);

  // Avoid layout flash — return null while loading
  if (isLoading) return null;

  const totalCount = standaloneArtifacts.length + bundleGroups.length;

  if (isEmpty) {
    return (
      <div className="py-5">
        {/* Section header */}
        <div className="mb-3 flex items-center gap-2">
          <PackageIcon className="size-3.5 text-primary" />
          <h2 className="section-label">Recent Deliverables</h2>
        </div>

        {/* Empty state */}
        <div className="rounded-lg border border-dashed border-border/40 p-4">
          <p className="text-xs italic text-muted-foreground">
            No deliverables yet — artifacts will appear here as runs produce output
          </p>
        </div>
      </div>
    );
  }

  // Merge bundles and standalone into a single sorted list
  type Entry =
    | { kind: "bundle"; bundleGroup: (typeof bundleGroups)[number]; ts: number }
    | { kind: "standalone"; artifact: (typeof standaloneArtifacts)[number]; ts: number };

  const entries: Entry[] = [
    ...bundleGroups.map((g) => ({
      kind: "bundle" as const,
      bundleGroup: g,
      ts: new Date(g.artifacts[0]!.createdAt).getTime(),
    })),
    ...standaloneArtifacts.map((a) => ({
      kind: "standalone" as const,
      artifact: a,
      ts: new Date(a.createdAt).getTime(),
    })),
  ];

  entries.sort((a, b) => b.ts - a.ts);

  return (
    <div className="py-5">
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2">
        <PackageIcon className="size-3.5 text-primary" />
        <h2 className="section-label">Recent Deliverables</h2>
        <span className="rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
          {totalCount}
        </span>
      </div>

      {/* Deliverables list */}
      <div className="space-y-3">
        {entries.map((entry) =>
          entry.kind === "bundle" ? (
            <BundleCard
              key={entry.bundleGroup.bundleId}
              bundle={entry.bundleGroup}
              onPreview={onPreview}
            />
          ) : (
            <ArtifactCard
              key={entry.artifact.artifactId}
              artifact={entry.artifact}
              onPreview={onPreview}
            />
          ),
        )}
      </div>
    </div>
  );
}
