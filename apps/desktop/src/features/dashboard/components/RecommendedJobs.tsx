import { ZapIcon } from "lucide-react";
import type { RecommendedJob } from "@/features/dashboard/hooks/useRecommendedJobs";
import { RecommendedJobCard } from "@/features/dashboard/components/RecommendedJobCard";

export interface RecommendedJobsProps {
  hero: RecommendedJob | null;
  primary: RecommendedJob[];
  secondary: RecommendedJob[];
  isLoading?: boolean;
  onActionClick?: (actionId: string, prompt: string, label: string) => void;
}

function RecommendedJobsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(["hero", "secondary-a", "secondary-b"] as const).map((slot) => {
        const isHero = slot === "hero";
        return (
          <div
            key={slot}
            className={`flex flex-col gap-3 rounded-xl border border-border/20 bg-card/50 dark:border-white/[0.04] ${
              isHero ? "sm:col-span-2 p-6" : "p-4"
            }`}
          >
            {/* Specialist chip */}
            <div className="h-5 w-24 animate-pulse rounded-md bg-muted/40" />
            {/* Title */}
            <div className={`animate-pulse rounded bg-muted/50 ${isHero ? "h-6 w-3/5" : "h-5 w-4/5"}`} />
            {/* Output-type tag */}
            <div className={`animate-pulse rounded-md bg-muted/30 ${isHero ? "h-7 w-40" : "h-5 w-32"}`} />
            {/* Promise text */}
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-full animate-pulse rounded bg-muted/25" />
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted/25" />
            </div>
            {/* CTA */}
            <div className="mt-auto h-4 w-20 animate-pulse rounded bg-muted/20" />
          </div>
        );
      })}
    </div>
  );
}

export function RecommendedJobs({ hero, primary, secondary, isLoading, onActionClick }: RecommendedJobsProps) {
  const hasJobs = hero || primary.length > 0 || secondary.length > 0;
  if (!isLoading && !hasJobs) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/10">
          <ZapIcon className="size-3 text-primary" />
        </div>
        <h2 className="section-label">Best first moves</h2>
      </div>

      {isLoading ? (
        <RecommendedJobsSkeleton />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Hero job — full width */}
          {hero && (
            <div className="sm:col-span-2">
              <RecommendedJobCard
                job={hero}
                isHero
                onClick={onActionClick}
              />
            </div>
          )}

          {/* Primary jobs — 2-col grid */}
          {primary.map((job) => (
            <RecommendedJobCard
              key={job.id}
              job={job}
              onClick={onActionClick}
            />
          ))}

          {/* Secondary jobs — 2-col grid */}
          {secondary.map((job) => (
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
