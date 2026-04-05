import { ZapIcon } from "lucide-react";
import type { RecommendedJob } from "@/features/dashboard/hooks/useRecommendedJobs";
import { RecommendedJobCard } from "@/features/dashboard/components/RecommendedJobCard";

export interface RecommendedJobsProps {
  jobs: RecommendedJob[];
  isLoading?: boolean;
  onActionClick?: (actionId: string, prompt: string, label: string) => void;
}

function RecommendedJobsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`animate-pulse rounded-xl border border-border/20 bg-card/50 dark:border-white/[0.04] ${
            i === 1 ? "sm:col-span-2 h-[120px]" : "h-[140px]"
          }`}
        />
      ))}
    </div>
  );
}

export function RecommendedJobs({ jobs, isLoading, onActionClick }: RecommendedJobsProps) {
  if (!isLoading && jobs.length === 0) return null;

  const heroJob = jobs[0];
  const secondaryJobs = jobs.slice(1);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/8">
          <ZapIcon className="size-3 text-primary" />
        </div>
        <h2 className="section-label">Best first moves</h2>
      </div>

      {isLoading ? (
        <RecommendedJobsSkeleton />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Hero job — full width */}
          {heroJob && (
            <div className="sm:col-span-2">
              <RecommendedJobCard
                job={heroJob}
                isHero
                onClick={onActionClick}
              />
            </div>
          )}

          {/* Secondary jobs — 2-col grid */}
          {secondaryJobs.map((job) => (
            <RecommendedJobCard
              key={job.id}
              job={job}
              onClick={onActionClick}
            />
          ))}
        </div>
      )}
    </section>
  );
}
