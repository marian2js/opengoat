import { useState } from "react";
import { GlobeIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanySummaryData } from "@/features/dashboard/lib/parse-workspace-summary";

export interface CompanySummaryProps {
  data: CompanySummaryData | null;
  domain?: string | undefined;
  faviconSources?: string[] | undefined;
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

export function CompanySummary({ data, domain, faviconSources, isLoading, error }: CompanySummaryProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-1">
        <Skeleton className="size-5 rounded" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-64" />
      </div>
    );
  }

  const hasAnyData = data ? Object.values(data).some(Boolean) : false;
  const hasFavicon = domain && faviconSources && faviconSources.length > 0;

  if (!hasAnyData || !data) {
    return (
      <div className="flex items-center gap-2.5 py-1">
        <div className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/8 text-primary">
          <GlobeIcon className="size-3" />
        </div>
        <span className="text-[13px] font-medium text-muted-foreground">
          {error ? "Unable to load project context" : "No project context yet"}
        </span>
      </div>
    );
  }

  // Take just the first sentence of the product summary for the strip
  const shortSummary = data.productSummary
    ? data.productSummary.split(/\.\s/)[0] + "."
    : null;

  return (
    <div className="flex items-center gap-3 py-1">
      {/* Favicon + domain */}
      <div className="flex shrink-0 items-center gap-2">
        {hasFavicon ? (
          <div className="flex size-5 shrink-0 items-center justify-center rounded bg-accent">
            <FaviconIcon
              domain={domain}
              faviconSources={faviconSources}
              className="size-3.5 rounded-sm"
            />
          </div>
        ) : (
          <div className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/8 text-primary">
            <GlobeIcon className="size-3" />
          </div>
        )}
        <span className="font-display text-[13px] font-bold tracking-tight text-foreground">
          {domain ?? "Project"}
        </span>
      </div>

      {/* Divider */}
      <div className="h-3 w-px shrink-0 bg-border/60" />

      {/* Short product summary */}
      {shortSummary ? (
        <p className="min-w-0 truncate text-[12px] text-muted-foreground/70">
          {shortSummary}
        </p>
      ) : null}
    </div>
  );
}
