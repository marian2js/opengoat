import { useState } from "react";
import { AlertTriangleIcon, GlobeIcon, TrendingUpIcon, UsersIcon } from "lucide-react";
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
    <div className="flex items-center gap-3">
      <Skeleton className="size-8 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3.5 w-full max-w-sm" />
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

  const hasAnyData = data ? Object.values(data).some(Boolean) : false;
  const hasFavicon = domain && faviconSources && faviconSources.length > 0;

  // Build inline bullets from available data
  const bullets: { key: string; icon: "opportunity" | "risk"; text: string }[] = [];
  if (data?.topOpportunity) {
    bullets.push({ key: "opportunity", icon: "opportunity", text: data.topOpportunity });
  }
  if (data?.mainRisk) {
    bullets.push({ key: "risk", icon: "risk", text: data.mainRisk });
  }

  return (
    <div className="mb-6 rounded-xl border border-border/40 px-5 py-4 dark:border-white/[0.06]">
      {/* ── Company identity row ── */}
      <div className="flex items-center gap-3">
        {hasFavicon ? (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card ring-1 ring-border/30 dark:bg-white/[0.06] dark:ring-white/[0.08]">
            <FaviconIcon
              domain={domain}
              faviconSources={faviconSources}
              className="size-5 rounded-sm"
            />
          </div>
        ) : (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
            <GlobeIcon className="size-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[18px] font-bold tracking-[-0.01em] text-foreground">
            {domain ?? "Project"}
          </h2>
        </div>
      </div>

      {/* ── Summary + ICP hint ── */}
      {hasAnyData && data?.productSummary ? (
        <div className="mt-2 pl-11">
          <p className="line-clamp-2 text-[14px] leading-snug text-zinc-500 dark:text-zinc-400">
            {data.productSummary}
          </p>
          {data.targetAudience && (
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-zinc-400 dark:text-zinc-500">
              <UsersIcon className="size-3 shrink-0" />
              <span className="line-clamp-1">{data.targetAudience}</span>
            </p>
          )}
        </div>
      ) : error ? (
        <p className="mt-2 pl-11 text-[13px] text-muted-foreground">
          Unable to load project context
        </p>
      ) : (
        <p className="mt-2 pl-11 text-[13px] text-muted-foreground">
          No project context yet
        </p>
      )}

      {/* ── Inline opportunity/risk bullets ── */}
      {bullets.length > 0 && (
        <ul className="mt-2.5 space-y-1 pl-11">
          {bullets.map((b) => (
            <li key={b.key} className="flex items-start gap-2">
              {b.icon === "risk" ? (
                <AlertTriangleIcon className="mt-[3px] size-3 shrink-0 text-amber-500" />
              ) : (
                <TrendingUpIcon className="mt-[3px] size-3 shrink-0 text-primary" />
              )}
              <span className="line-clamp-1 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
                {b.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
