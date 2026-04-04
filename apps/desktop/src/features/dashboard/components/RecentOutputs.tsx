import { PackageIcon } from "lucide-react";
import type { ArtifactRecord } from "@opengoat/contracts";
import type { SidecarClient } from "@/lib/sidecar/client";
import { useRecentArtifacts } from "@/features/dashboard/hooks/useRecentArtifacts";
import { ArtifactCard } from "@/features/dashboard/components/ArtifactCard";
import { BundleCard } from "@/features/dashboard/components/BundleCard";
import { getSpecialistMeta, SPECIALIST_META } from "@/features/agents/specialist-meta";

export interface RecentOutputsProps {
  agentId: string;
  client: SidecarClient;
  onPreview?: (artifactId: string) => void;
  onNavigate?: (artifact: ArtifactRecord) => void;
}

/** Resolve a specialist display name from an artifact's createdBy field. */
function resolveSpecialistName(createdBy: string): string | undefined {
  const meta = getSpecialistMeta(createdBy);
  if (meta) return meta.name;

  // Try matching by name (case-insensitive)
  for (const [, value] of Object.entries(SPECIALIST_META)) {
    if (value.name.toLowerCase() === createdBy.toLowerCase()) {
      return value.name;
    }
  }
  return undefined;
}

export function RecentOutputs({ agentId, client, onPreview, onNavigate }: RecentOutputsProps) {
  const { standaloneArtifacts, bundleGroups, isLoading, isEmpty } = useRecentArtifacts(agentId, client);

  // Avoid layout flash — return null while loading
  if (isLoading) return null;

  const totalCount = standaloneArtifacts.length + bundleGroups.length;

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
    <div className="dashboard-section py-5">
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8">
          <PackageIcon className="size-3.5 text-primary" />
        </div>
        <h2 className="section-label">Recent outputs</h2>
        {totalCount > 0 ? (
          <span className="rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {totalCount}
          </span>
        ) : null}
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <p className="text-xs text-muted-foreground/50 ml-9">
          No outputs yet — run an action above to get started
        </p>
      ) : (
        /* Outputs list */
        <div className="space-y-3">
          {entries.map((entry) => {
            if (entry.kind === "bundle") {
              const specialistName = resolveSpecialistName(
                entry.bundleGroup.artifacts[0]?.createdBy ?? "",
              );
              return (
                <BundleCard
                  key={entry.bundleGroup.bundleId}
                  bundle={entry.bundleGroup}
                  specialistId={entry.bundleGroup.artifacts[0]?.createdBy}
                  specialistName={specialistName}
                  onPreview={onPreview}
                  onNavigate={onNavigate}
                />
              );
            }
            const specialistName = resolveSpecialistName(entry.artifact.createdBy);
            return (
              <ArtifactCard
                key={entry.artifact.artifactId}
                artifact={entry.artifact}
                specialistId={entry.artifact.createdBy}
                specialistName={specialistName}
                onPreview={onPreview}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
