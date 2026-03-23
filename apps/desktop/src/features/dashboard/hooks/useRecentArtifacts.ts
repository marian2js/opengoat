import { useEffect, useState } from "react";
import type { ArtifactRecord } from "@opengoat/contracts";
import type { SidecarClient } from "@/lib/sidecar/client";

export interface BundleGroup {
  bundleId: string;
  title: string;
  artifacts: ArtifactRecord[];
}

export interface UseRecentArtifactsResult {
  standaloneArtifacts: ArtifactRecord[];
  bundleGroups: BundleGroup[];
  isLoading: boolean;
  isEmpty: boolean;
}

const MAX_VISIBLE = 8;

export function useRecentArtifacts(
  agentId: string,
  client: SidecarClient,
): UseRecentArtifactsResult {
  const [standaloneArtifacts, setStandaloneArtifacts] = useState<ArtifactRecord[]>([]);
  const [bundleGroups, setBundleGroups] = useState<BundleGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    client
      .listArtifacts({ projectId: agentId, limit: 20 })
      .then((page) => {
        if (cancelled) return;

        const standalone: ArtifactRecord[] = [];
        const bundleMap = new Map<string, ArtifactRecord[]>();

        for (const artifact of page.items) {
          if (artifact.bundleId) {
            const existing = bundleMap.get(artifact.bundleId) ?? [];
            existing.push(artifact);
            bundleMap.set(artifact.bundleId, existing);
          } else {
            standalone.push(artifact);
          }
        }

        // Build bundle groups sorted by most recent artifact
        const groups: BundleGroup[] = Array.from(bundleMap.entries()).map(
          ([id, artifacts]) => ({
            bundleId: id,
            title: deriveBundleTitle(artifacts),
            artifacts: artifacts.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            ),
          }),
        );

        groups.sort(
          (a, b) =>
            new Date(b.artifacts[0]!.createdAt).getTime() -
            new Date(a.artifacts[0]!.createdAt).getTime(),
        );

        // Trim total visible items (bundles count as 1)
        let visibleCount = 0;
        const trimmedGroups: BundleGroup[] = [];
        const trimmedStandalone: ArtifactRecord[] = [];

        // Interleave by recency: merge bundles and standalone, pick top MAX_VISIBLE
        type Entry =
          | { kind: "bundle"; group: BundleGroup; ts: number }
          | { kind: "standalone"; artifact: ArtifactRecord; ts: number };

        const entries: Entry[] = [
          ...groups.map((g) => ({
            kind: "bundle" as const,
            group: g,
            ts: new Date(g.artifacts[0]!.createdAt).getTime(),
          })),
          ...standalone.map((a) => ({
            kind: "standalone" as const,
            artifact: a,
            ts: new Date(a.createdAt).getTime(),
          })),
        ];

        entries.sort((a, b) => b.ts - a.ts);

        for (const entry of entries) {
          if (visibleCount >= MAX_VISIBLE) break;
          if (entry.kind === "bundle") {
            trimmedGroups.push(entry.group);
          } else {
            trimmedStandalone.push(entry.artifact);
          }
          visibleCount++;
        }

        setStandaloneArtifacts(trimmedStandalone);
        setBundleGroups(trimmedGroups);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("useRecentArtifacts: failed to fetch artifacts:", err);
        setStandaloneArtifacts([]);
        setBundleGroups([]);
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [agentId, client]);

  return {
    standaloneArtifacts,
    bundleGroups,
    isLoading,
    isEmpty: standaloneArtifacts.length === 0 && bundleGroups.length === 0,
  };
}

/** Derive a bundle title from the artifacts — uses common type prefix or first artifact title. */
function deriveBundleTitle(artifacts: ArtifactRecord[]): string {
  if (artifacts.length === 0) return "Bundle";
  // If there's a common type, use it as the bundle title
  const types = new Set(artifacts.map((a) => a.type));
  if (types.size === 1) {
    const type = artifacts[0]!.type;
    return formatTypeName(type) + " Bundle";
  }
  return artifacts[0]!.title.split(" — ")[0] ?? "Bundle";
}

function formatTypeName(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
