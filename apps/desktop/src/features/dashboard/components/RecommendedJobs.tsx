import { useState } from "react";
import { ZapIcon, ChevronDownIcon, SparklesIcon, LayersIcon } from "lucide-react";
import type { RecommendedJob } from "@/features/dashboard/hooks/useRecommendedJobs";
import { RecommendedJobCard } from "@/features/dashboard/components/RecommendedJobCard";

export interface RecommendedJobsProps {
  hero: RecommendedJob | null;
  primary: RecommendedJob[];
  secondary: RecommendedJob[];
  isLoading?: boolean;
  onActionClick?: (actionId: string, prompt: string, label: string) => void;
}

const SECONDARY_COLLAPSE_THRESHOLD = 3;

function RecommendedJobsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Hero skeleton */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/20 bg-card/50 p-6 dark:border-white/[0.04]">
        <div className="h-5 w-24 animate-pulse rounded-md bg-muted/40" />
        <div className="h-6 w-3/5 animate-pulse rounded bg-muted/50" />
        <div className="h-7 w-40 animate-pulse rounded-md bg-muted/30" />
        <div className="flex flex-col gap-1.5">
          <div className="h-3.5 w-full animate-pulse rounded bg-muted/25" />
          <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted/25" />
        </div>
        <div className="mt-auto h-4 w-20 animate-pulse rounded bg-muted/20" />
      </div>

      {/* Primary skeletons */}
      <div className="grid gap-3 sm:grid-cols-2">
        {(["primary-a", "primary-b"] as const).map((slot) => (
          <div
            key={slot}
            className="flex flex-col gap-2.5 rounded-xl border border-border/20 bg-card/50 p-4 dark:border-white/[0.04]"
          >
            <div className="h-5 w-24 animate-pulse rounded-md bg-muted/40" />
            <div className="h-5 w-4/5 animate-pulse rounded bg-muted/50" />
            <div className="h-5 w-32 animate-pulse rounded-md bg-muted/30" />
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-full animate-pulse rounded bg-muted/25" />
              <div className="h-3.5 w-1/2 animate-pulse rounded bg-muted/25" />
            </div>
            <div className="mt-auto h-4 w-20 animate-pulse rounded bg-muted/20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecommendedJobs({ hero, primary, secondary, isLoading, onActionClick }: RecommendedJobsProps) {
  const hasJobs = hero || primary.length > 0 || secondary.length > 0;
  const [showAllSecondary, setShowAllSecondary] = useState(false);

  if (!isLoading && !hasJobs) return null;

  const shouldCollapse = secondary.length > SECONDARY_COLLAPSE_THRESHOLD;
  const visibleSecondary = shouldCollapse && !showAllSecondary
    ? secondary.slice(0, SECONDARY_COLLAPSE_THRESHOLD)
    : secondary;

  return (
    <section className="flex flex-col gap-6">
      {isLoading ? (
        <RecommendedJobsSkeleton />
      ) : (
        <>
          {/* ── Hero section ── */}
          {hero && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/10">
                  <ZapIcon className="size-3 text-primary" />
                </div>
                <h2 className="section-label">Best first move</h2>
              </div>
              <RecommendedJobCard
                job={hero}
                tier="hero"
                onClick={onActionClick}
              />
            </div>
          )}

          {/* ── Primary section ── */}
          {primary.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/[0.06] ring-1 ring-primary/[0.06]">
                  <SparklesIcon className="size-3 text-primary/70" />
                </div>
                <h3 className="text-xs font-medium text-muted-foreground/70">More high-value jobs</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {primary.map((job) => (
                  <RecommendedJobCard
                    key={job.id}
                    job={job}
                    tier="primary"
                    onClick={onActionClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Secondary section ── */}
          {secondary.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/40 ring-1 ring-border/10 dark:bg-white/[0.03] dark:ring-white/[0.04]">
                  <LayersIcon className="size-3 text-muted-foreground/50" />
                </div>
                <h3 className="text-xs font-medium text-muted-foreground/50">Additional jobs</h3>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {visibleSecondary.map((job) => (
                  <RecommendedJobCard
                    key={job.id}
                    job={job}
                    tier="secondary"
                    onClick={onActionClick}
                  />
                ))}
              </div>

              {/* Collapse/expand toggle */}
              {shouldCollapse && (
                <button
                  type="button"
                  className="mx-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40 transition-colors hover:text-muted-foreground/70"
                  onClick={() => setShowAllSecondary(!showAllSecondary)}
                >
                  {showAllSecondary ? "Show less" : `Show ${secondary.length - SECONDARY_COLLAPSE_THRESHOLD} more`}
                  <ChevronDownIcon className={`size-3 transition-transform duration-200 ${showAllSecondary ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
