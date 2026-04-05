import { useState } from "react";
import { GlobeIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanySummaryData } from "@/features/dashboard/lib/parse-workspace-summary";
import type { Opportunity } from "@/features/dashboard/data/opportunities";
import type { HeroRecommendation } from "@/features/dashboard/lib/hero-recommendation";
import { HeroOpportunityBullets } from "@/features/dashboard/components/HeroOpportunityBullets";
import { HeroRecommendedMove } from "@/features/dashboard/components/HeroRecommendedMove";
import { FreeTextInput } from "@/features/dashboard/components/FreeTextInput";

export interface CompanyUnderstandingHeroProps {
  domain?: string | undefined;
  faviconSources?: string[] | undefined;
  data: CompanySummaryData | null;
  opportunities: Opportunity[];
  recommendation: HeroRecommendation | null;
  isLoading: boolean;
  error?: string | null;
  onFreeTextSubmit: (text: string) => void;
  onActionClick?: (actionId: string) => void;
}

function FaviconIcon({
  domain,
  faviconSources,
  className,
}: {
  domain: string;
  faviconSources: string[];
  className?: string;
}) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const allFailed = sourceIndex >= faviconSources.length;

  if (allFailed || faviconSources.length === 0) {
    return <GlobeIcon className={className ?? "size-4"} />;
  }

  return (
    <img
      alt={domain}
      className={className ?? "size-4 rounded-sm"}
      src={faviconSources[sourceIndex]}
      onError={() => setSourceIndex((prev) => prev + 1)}
    />
  );
}

function HeroSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Skeleton className="size-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}

export function CompanyUnderstandingHero({
  domain,
  faviconSources,
  data,
  opportunities,
  recommendation,
  isLoading,
  error,
  onFreeTextSubmit,
  onActionClick,
}: CompanyUnderstandingHeroProps) {
  if (isLoading) {
    return (
      <div className="mb-8 rounded-2xl border border-border/40 bg-gradient-to-b from-card to-background/60 p-6 shadow-sm dark:border-white/[0.06] dark:from-white/[0.03] dark:to-transparent dark:shadow-none">
        <HeroSkeleton />
      </div>
    );
  }

  const hasAnyData = data ? Object.values(data).some(Boolean) : false;
  const hasFavicon = domain && faviconSources && faviconSources.length > 0;

  return (
    <div className="mb-8 rounded-2xl border border-border/40 bg-gradient-to-b from-card to-background/60 p-6 shadow-sm dark:border-white/[0.06] dark:from-white/[0.03] dark:to-transparent dark:shadow-none">
      {/* ── Company identity ── */}
      <div className="flex items-center gap-4">
        {hasFavicon ? (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-card shadow-sm ring-1 ring-border/30 dark:bg-white/[0.06] dark:ring-white/[0.08]">
            <FaviconIcon
              domain={domain}
              faviconSources={faviconSources}
              className="size-6 rounded-sm"
            />
          </div>
        ) : (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <GlobeIcon className="size-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.01em] text-foreground">
            {domain ?? "Project"}
          </h2>
          {hasAnyData && data?.productSummary ? (
            <p className="mt-0.5 line-clamp-3 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {data.productSummary}
            </p>
          ) : error ? (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Unable to load project context
            </p>
          ) : (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              No project context yet
            </p>
          )}
        </div>
      </div>

      {/* ── Opportunity bullets + Recommended move ── */}
      {hasAnyData && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <HeroOpportunityBullets
            opportunities={opportunities}
            mainRisk={data?.mainRisk ?? null}
            topOpportunity={data?.topOpportunity ?? null}
          />
          <HeroRecommendedMove
            recommendation={recommendation}
            onActionClick={onActionClick}
          />
        </div>
      )}

      {/* ── CMO input embedded in hero ── */}
      <div className="mt-5">
        <FreeTextInput onSubmit={onFreeTextSubmit} />
      </div>
    </div>
  );
}
