import type { ArtifactRecord, SpecialistAgent } from "@opengoat/contracts";
import { useEffect, useState } from "react";
import { AlertCircleIcon, LoaderCircleIcon, UsersIcon } from "lucide-react";
import type { SidecarClient } from "@/lib/sidecar/client";
import { getActionMapping } from "@/lib/utils/action-map";
import { deduplicateSpecialistOutputs } from "../lib/deduplicate-specialist-outputs";
import { SpecialistCard } from "./SpecialistCard";
import type { SpecialistBundleGroup } from "./SpecialistCard";

/** Max recent outputs shown per specialist card */
const MAX_OUTPUTS_PER_SPECIALIST = 3;

interface SpecialistTeamBrowserProps {
  client: SidecarClient | null;
  agentId?: string | undefined;
  onSpecialistChat?: ((specialistId: string) => void) | undefined;
}

function deriveBundleTitleFromArtifacts(artifacts: ArtifactRecord[]): string {
  if (artifacts.length === 0) return "Bundle";
  const types = new Set(artifacts.map((a) => a.type));
  if (types.size === 1) {
    const type = artifacts[0]!.type;
    return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " Bundle";
  }
  return artifacts[0]!.title.split(" — ")[0] ?? "Bundle";
}

export function SpecialistTeamBrowser({ client, agentId, onSpecialistChat }: SpecialistTeamBrowserProps) {
  const [specialists, setSpecialists] = useState<SpecialistAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentOutputsMap, setRecentOutputsMap] = useState<Record<string, ArtifactRecord[]>>({});
  const [recentBundlesMap, setRecentBundlesMap] = useState<Record<string, SpecialistBundleGroup[]>>({});

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      if (!client) {
        if (!cancelled) {
          setSpecialists([]);
          setIsLoading(false);
          setError("Specialists are temporarily unavailable.");
        }
        return;
      }

      if (!cancelled) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const roster = await client.specialists();
        if (!cancelled) {
          setSpecialists(roster.specialists);
        }
      } catch {
        if (!cancelled) {
          setSpecialists([]);
          setError("Could not load specialists. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [client]);

  // Fetch recent artifacts and build per-specialist arrays
  useEffect(() => {
    if (!client || !agentId) return;
    let cancelled = false;

    client
      .listArtifacts({ projectId: agentId, limit: 30 })
      .then((page) => {
        if (cancelled) return;
        // Group all artifacts by specialist
        const raw: Record<string, ArtifactRecord[]> = {};
        for (const artifact of page.items) {
          const sid = artifact.createdBy;
          if (!raw[sid]) {
            raw[sid] = [];
          }
          raw[sid].push(artifact);
        }

        // For each specialist, separate bundled from standalone artifacts
        const standaloneMap: Record<string, ArtifactRecord[]> = {};
        const bundlesMap: Record<string, SpecialistBundleGroup[]> = {};

        for (const [sid, artifacts] of Object.entries(raw)) {
          const bundleArtifacts = new Map<string, ArtifactRecord[]>();
          const standalone: ArtifactRecord[] = [];

          for (const artifact of artifacts) {
            if (artifact.bundleId) {
              const existing = bundleArtifacts.get(artifact.bundleId) ?? [];
              existing.push(artifact);
              bundleArtifacts.set(artifact.bundleId, existing);
            } else {
              standalone.push(artifact);
            }
          }

          // Build bundle groups
          const groups: SpecialistBundleGroup[] = Array.from(bundleArtifacts.entries()).map(
            ([bundleId, arts]) => {
              const sorted = arts.sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              );
              return {
                bundleId,
                title: deriveBundleTitleFromArtifacts(sorted),
                artifacts: sorted,
                createdAt: sorted[0]!.createdAt,
              };
            },
          );

          // Deduplicate standalone, then combine and limit total to MAX_OUTPUTS_PER_SPECIALIST
          const dedupedStandalone = deduplicateSpecialistOutputs(standalone).slice(0, MAX_OUTPUTS_PER_SPECIALIST);

          // Merge bundles + standalone sorted by time, then limit
          type Entry =
            | { kind: "bundle"; group: SpecialistBundleGroup; ts: number }
            | { kind: "standalone"; artifact: ArtifactRecord; ts: number };

          const entries: Entry[] = [
            ...groups.map((g) => ({ kind: "bundle" as const, group: g, ts: new Date(g.createdAt).getTime() })),
            ...dedupedStandalone.map((a) => ({ kind: "standalone" as const, artifact: a, ts: new Date(a.createdAt).getTime() })),
          ];
          entries.sort((a, b) => b.ts - a.ts);

          const limitedStandalone: ArtifactRecord[] = [];
          const limitedBundles: SpecialistBundleGroup[] = [];
          let count = 0;
          for (const entry of entries) {
            if (count >= MAX_OUTPUTS_PER_SPECIALIST) break;
            if (entry.kind === "bundle") {
              limitedBundles.push(entry.group);
            } else {
              limitedStandalone.push(entry.artifact);
            }
            count++;
          }

          standaloneMap[sid] = limitedStandalone;
          bundlesMap[sid] = limitedBundles;
        }

        setRecentOutputsMap(standaloneMap);
        setRecentBundlesMap(bundlesMap);
      })
      .catch(() => {
        // Silently ignore — recent outputs are non-critical
      });

    return () => { cancelled = true; };
  }, [client, agentId]);

  function handleChat(specialistId: string): void {
    if (onSpecialistChat) {
      // Directly create session and navigate — avoids the fragile
      // hash-based effect chain that could fail under StrictMode.
      void onSpecialistChat(specialistId);
      return;
    }
    // Fallback to hash-based navigation (used when rendered without callback)
    window.location.hash = `#chat?specialist=${encodeURIComponent(specialistId)}`;
  }

  function handleOutputNavigate(artifact: ArtifactRecord): void {
    // Try to find the session via the run ID mapping
    if (artifact.runId) {
      const sessionId = getActionMapping(artifact.runId);
      if (sessionId) {
        window.location.hash = "#chat";
        return;
      }
    }

    // Fallback: navigate to specialist chat if createdBy matches
    if (artifact.createdBy) {
      window.location.hash = `#chat?specialist=${encodeURIComponent(artifact.createdBy)}`;
      return;
    }

    // Last resort: go to general chat
    window.location.hash = "#chat";
  }

  // Separate manager (CMO) from specialists for layout
  const manager = specialists.find((s) => s.category === "manager");
  const operationalSpecialists = specialists.filter(
    (s) => s.category !== "manager",
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      {/* Page header */}
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 shadow-sm ring-1 ring-primary/15">
          <UsersIcon className="size-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.02em] text-foreground">
            Your AI Marketing Team
          </h1>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
            Each specialist owns a distinct area of marketing. Start a conversation with the right expert.
          </p>
        </div>
      </div>

      {/* Error state */}
      {error ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-warning/20 bg-warning/8 px-4 py-3 text-[13px] text-warning-foreground">
          <AlertCircleIcon className="size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            Loading specialists...
          </div>
        </div>
      ) : specialists.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <UsersIcon className="size-8 text-muted-foreground/40" />
          <p className="text-[13px] text-muted-foreground">
            No specialists available.
          </p>
        </div>
      ) : (
        <>
          {/* CMO / Manager card — full width hero */}
          {manager ? (
            <div>
              <SpecialistCard
                specialist={manager}
                onChat={handleChat}
                recentOutputs={recentOutputsMap[manager.id]}
                recentBundles={recentBundlesMap[manager.id]}
                onOutputNavigate={handleOutputNavigate}
              />
            </div>
          ) : null}

          {/* Section label for specialists */}
          {operationalSpecialists.length > 0 ? (
            <div>
              <div className="mb-5 flex items-center gap-2.5 border-t border-border/20 pt-6 dark:border-white/[0.04]">
                <h2 className="section-label">Specialists</h2>
                <span className="rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {operationalSpecialists.length}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {operationalSpecialists.map((specialist) => (
                  <SpecialistCard
                    key={specialist.id}
                    specialist={specialist}
                    onChat={handleChat}
                    recentOutputs={recentOutputsMap[specialist.id]}
                    recentBundles={recentBundlesMap[specialist.id]}
                    onOutputNavigate={handleOutputNavigate}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
