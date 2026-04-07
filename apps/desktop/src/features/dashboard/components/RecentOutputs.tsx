import { ArrowRightIcon, PackageIcon } from "lucide-react";
import type { ArtifactRecord } from "@opengoat/contracts";
import type { SidecarClient } from "@/lib/sidecar/client";
import { useRecentArtifacts } from "@/features/dashboard/hooks/useRecentArtifacts";
import { ArtifactCard } from "@/features/dashboard/components/ArtifactCard";
import { BundleCard } from "@/features/dashboard/components/BundleCard";
import { getSpecialistMeta, SPECIALIST_META } from "@/features/agents/specialist-meta";
import { getSpecialistColors } from "@/features/agents/specialist-meta";
import { getArtifactTypeConfig } from "@/features/dashboard/lib/artifact-type-config";

const EXAMPLE_OUTPUTS: Array<{
  name: string;
  type: string;
  specialistId: string;
}> = [
  { name: "Hero Rewrite Bundle",         type: "copy_draft",       specialistId: "website-conversion" },
  { name: "SEO Opportunity Map",         type: "research_brief",   specialistId: "seo-aeo" },
  { name: "Competitor Messaging Matrix",  type: "matrix",           specialistId: "market-intel" },
  { name: "Product Hunt Launch Pack",    type: "launch_pack",      specialistId: "distribution" },
  { name: "Launch Surface Shortlist",    type: "dataset_list",     specialistId: "content" },
  { name: "Comparison Page Backlog",     type: "backlog",          specialistId: "outbound" },
];

export interface RecentOutputsProps {
  agentId: string;
  client: SidecarClient;
  onPreview?: (artifactId: string) => void;
  onNavigate?: (artifact: ArtifactRecord) => void;
  onSpecialistChat?: (specialistId: string) => void;
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

export function RecentOutputs({ agentId, client, onPreview, onNavigate, onSpecialistChat }: RecentOutputsProps) {
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
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/10">
          <PackageIcon className="size-3 text-primary" />
        </div>
        <h2 className="section-label">Recent outputs</h2>
        {totalCount > 0 ? (
          <span className="rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {totalCount}
          </span>
        ) : null}
      </div>

      {/* Empty state — proof-of-value gallery */}
      {isEmpty ? (
        <div className="ml-9">
          <p className="mb-3 text-[13px] text-muted-foreground">
            Your team can produce:
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {EXAMPLE_OUTPUTS.map((example, idx) => {
              const typeConfig = getArtifactTypeConfig(example.type);
              const specialist = getSpecialistMeta(example.specialistId);
              const colors = getSpecialistColors(example.specialistId);
              const isStartCard = idx === 0;

              return (
                <button
                  key={example.name}
                  type="button"
                  className="group/example relative flex flex-col items-start gap-2 overflow-hidden rounded-lg border border-border/20 bg-card/50 p-3 pl-4 text-left shadow-sm shadow-black/[0.02] transition-all duration-100 ease-out hover:-translate-y-px hover:border-primary/25 hover:bg-card hover:shadow-md dark:border-white/[0.04] dark:shadow-black/15"
                  onClick={() => onSpecialistChat?.(example.specialistId)}
                >
                  {/* Left specialist color accent bar */}
                  <div className={`absolute inset-y-0 left-0 w-[2px] opacity-50 transition-opacity group-hover/example:opacity-90 ${colors.dotColor.replace("/40", "")}`} />

                  {/* Type badge + Example indicator */}
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${typeConfig.badgeClassName}`}>
                      {typeConfig.label}
                    </span>
                    <span className="inline-block rounded border border-border/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50 dark:border-white/[0.06]">
                      EXAMPLE
                    </span>
                  </div>

                  {/* Output name */}
                  <span className="text-[13px] font-medium leading-tight text-foreground">
                    {example.name}
                  </span>

                  {/* Specialist attribution */}
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block size-1.5 rounded-full ${colors.dotColor}`} />
                    <span className={`text-[11px] ${colors.iconText.split(" ")[0]} opacity-80`}>
                      {specialist?.name}
                    </span>
                  </div>

                  {/* Start CTA — first card only */}
                  {isStartCard && (
                    <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-70 transition-opacity group-hover/example:opacity-100">
                      Start here
                      <ArrowRightIcon className="size-3 transition-transform group-hover/example:translate-x-0.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Outputs list */
        <div className="space-y-2.5">
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
