import { useState } from "react";
import { GlobeIcon, TargetIcon, TrendingUpIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanySummaryData } from "@/features/dashboard/lib/parse-workspace-summary";

export interface CompanyUnderstandingHeroProps {
  domain?: string | undefined;
  faviconSources?: string[] | undefined;
  data: CompanySummaryData | null;
  isLoading: boolean;
  error?: string | null;
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
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <Skeleton className="h-5 w-36" />
      </div>
      <div className="space-y-1.5 pl-[54px]">
        <Skeleton className="h-3.5 w-full max-w-sm" />
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-56" />
      </div>
    </div>
  );
}

export function CompanyUnderstandingHero({
  domain,
  faviconSources,
  data,
  isLoading,
  error,
}: CompanyUnderstandingHeroProps) {
  if (isLoading) {
    return (
      <div className="mb-6 rounded-xl border border-border/40 px-5 py-4 dark:border-white/[0.06]">
        <HeroSkeleton />
      </div>
    );
  }

  const hasAnyData = data ? Object.values(data).some((v) => Array.isArray(v) ? v.length > 0 : Boolean(v)) : false;
  const hasFavicon = domain && faviconSources && faviconSources.length > 0;

  // ICP line: prefer data.icp, fall back to data.targetAudience
  const icpLine = data?.icp ?? data?.targetAudience ?? null;

  // Opportunity bullets: prefer data.opportunities array, fall back to legacy fields
  const oppBullets: string[] = data?.opportunities && data.opportunities.length > 0
    ? data.opportunities
    : [data?.topOpportunity, data?.mainRisk].filter((b): b is string => Boolean(b));

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-border/30 bg-gradient-to-br from-card via-card to-primary/[0.02] shadow-sm dark:border-white/[0.06] dark:from-[#18181B] dark:via-[#18181B] dark:to-primary/[0.03]">
      <div className="px-5 py-4">
        {/* ── Company identity row ── */}
        <div className="flex items-center gap-3.5">
          {hasFavicon ? (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card shadow-sm ring-1 ring-border/20 dark:bg-white/[0.08] dark:ring-white/[0.10]">
              <FaviconIcon
                domain={domain}
                faviconSources={faviconSources}
                className="size-6 rounded-sm"
              />
            </div>
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 shadow-sm ring-1 ring-primary/15 text-primary">
              <GlobeIcon className="size-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[20px] font-bold tracking-[-0.02em] text-foreground">
              {domain ?? "Project"}
            </h2>
          </div>
        </div>

        {/* ── Summary + ICP + Opportunities ── */}
        {hasAnyData && data?.productSummary ? (
          <div className="mt-3 pl-[54px]">
            <p className="line-clamp-2 text-[14px] leading-[1.6] text-zinc-500 dark:text-zinc-400">
              {data.productSummary}
            </p>
            {icpLine && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-zinc-400 dark:text-zinc-500">
                <TargetIcon className="size-3 shrink-0" />
                <span className="line-clamp-1">{icpLine}</span>
              </p>
            )}
            {oppBullets.length > 0 && (
              <ul className="mt-2 space-y-1">
                {oppBullets.slice(0, 3).map((text) => (
                  <li key={text} className="flex items-start gap-1.5">
                    <TrendingUpIcon className="mt-[3px] size-3 shrink-0 text-primary/60" />
                    <span className="line-clamp-1 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
                      {text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : error ? (
          <p className="mt-3 pl-[54px] text-[13px] text-muted-foreground">
            Unable to load project context
          </p>
        ) : (
          <p className="mt-3 pl-[54px] text-[13px] text-muted-foreground">
            No project context yet
          </p>
        )}
      </div>
    </div>
  );
}
