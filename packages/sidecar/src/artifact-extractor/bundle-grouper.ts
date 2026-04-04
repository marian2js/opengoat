import type { ArtifactRecord, ArtifactService, BundleRecord } from "@opengoat/core";
import type { OpenGoatPaths } from "@opengoat/core";
import { extractSessionId } from "./session-id.ts";

export interface BundleGrouperDeps {
  artifactService: Pick<ArtifactService, "listUnbundledArtifacts" | "createBundle" | "assignBundle">;
  opengoatPaths: OpenGoatPaths;
  /** Resolve a specialistId to a display name. */
  specialistLookup: (specialistId: string) => string;
}

export interface BundleGrouperResult {
  bundlesCreated: number;
  artifactsBundled: number;
}

/**
 * Post-hoc bundle grouping: finds unbundled artifacts that share the same
 * session ID (regardless of contentRef format) and groups them into bundles.
 *
 * This fixes the gap where two different extraction mechanisms (the backend
 * `extractArtifacts()` and the frontend `useAutoArtifacts` hook) each create
 * artifacts independently for the same session, preventing the original
 * in-extraction bundling logic from ever reaching the 2-artifact threshold.
 */
export async function bundleUnbundledArtifacts(
  paths: OpenGoatPaths,
  projectId: string,
  deps: BundleGrouperDeps,
): Promise<BundleGrouperResult> {
  const unbundled = await deps.artifactService.listUnbundledArtifacts(paths, projectId);

  if (unbundled.length < 2) {
    return { bundlesCreated: 0, artifactsBundled: 0 };
  }

  // Group by session ID
  const sessionGroups = new Map<string, ArtifactRecord[]>();
  for (const artifact of unbundled) {
    const sessionId = extractSessionId(artifact.contentRef);
    if (!sessionId) continue;

    const group = sessionGroups.get(sessionId) ?? [];
    group.push(artifact);
    sessionGroups.set(sessionId, group);
  }

  let bundlesCreated = 0;
  let artifactsBundled = 0;

  for (const [, artifacts] of sessionGroups) {
    if (artifacts.length < 2) continue;

    const title = deriveBundleTitleFromArtifacts(artifacts, deps.specialistLookup);
    const bundle = await deps.artifactService.createBundle(paths, {
      projectId,
      title,
    });

    const artifactIds = artifacts.map((a) => a.artifactId);
    await deps.artifactService.assignBundle(paths, artifactIds, bundle.bundleId);

    bundlesCreated++;
    artifactsBundled += artifacts.length;
  }

  return { bundlesCreated, artifactsBundled };
}

/**
 * Derives a bundle title from grouped artifacts.
 * Uses the specialist name (from the majority creator) and artifact types.
 */
function deriveBundleTitleFromArtifacts(
  artifacts: ArtifactRecord[],
  specialistLookup: (id: string) => string,
): string {
  // Find the most common creator
  const creatorCounts = new Map<string, number>();
  for (const a of artifacts) {
    creatorCounts.set(a.createdBy, (creatorCounts.get(a.createdBy) ?? 0) + 1);
  }
  let topCreator = artifacts[0]!.createdBy;
  let topCount = 0;
  for (const [id, count] of creatorCounts) {
    if (count > topCount) {
      topCreator = id;
      topCount = count;
    }
  }

  const specialistName = specialistLookup(topCreator);
  const types = new Set(artifacts.map((a) => a.type));

  if (types.size === 1) {
    const typeName = artifacts[0]!.type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `${specialistName}: ${typeName} Bundle`;
  }

  return `${specialistName}: ${artifacts[0]!.title}`;
}
