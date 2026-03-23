import { useState } from "react";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  GlobeIcon,
  LightbulbIcon,
  TargetIcon,
  ZapIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanySummaryData } from "@/features/dashboard/lib/parse-workspace-summary";

export interface CompanySummaryProps {
  data: CompanySummaryData | null;
  domain?: string | undefined;
  faviconSources?: string[] | undefined;
  isLoading: boolean;
  error?: string | null;
}

interface SummaryChipProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  colorClass: string;
}

function SummaryChip({ icon: Icon, label, value, colorClass }: SummaryChipProps) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className={`mt-0.5 size-3 shrink-0 ${colorClass}`} />
      <div className="min-w-0">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          {label}
        </span>
        <p className="text-xs leading-snug text-foreground/70 line-clamp-1">
          {value}
        </p>
      </div>
    </div>
  );
}

function SummaryDetail({
  icon: Icon,
  label,
  value,
  colorClass,
}: SummaryChipProps) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-accent ${colorClass}`}>
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {label}
        </div>
        <div className="mt-0.5 text-sm leading-relaxed text-foreground/90">
          {value}
        </div>
      </div>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <Card className="shrink-0 border border-border/70 bg-card/90">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-4 w-40" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="h-4 w-full" />
      </CardContent>
    </Card>
  );
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
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return <SummarySkeleton />;
  }

  const hasAnyData = data ? Object.values(data).some(Boolean) : false;

  if (!hasAnyData || !data) {
    return (
      <Card className="shrink-0 border border-border/70 bg-card/90">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <GlobeIcon className="size-3.5 text-primary" />
            <CardTitle className="section-label">
              Company overview
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            {error
              ? `Unable to load company overview: ${error}`
              : "Unable to load company overview. Try refreshing the page."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasFavicon = domain && faviconSources && faviconSources.length > 0;

  return (
    <Card
      className="group/summary shrink-0 border border-border/50 bg-card/80 cursor-pointer transition-colors hover:border-border/80"
      onClick={() => setExpanded((v) => !v)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {hasFavicon ? (
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent">
                <FaviconIcon
                  domain={domain}
                  faviconSources={faviconSources}
                  className="size-3.5 rounded-sm"
                />
              </div>
            ) : (
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
                <GlobeIcon className="size-3.5" />
              </div>
            )}
            <CardTitle className="font-display text-sm font-bold tracking-tight">
              {domain ?? "Company overview"}
            </CardTitle>
          </div>
        </div>
      </CardHeader>

      {!expanded ? (
        <CardContent className="pt-0 pb-0">
          {data.productSummary ? (
            <p className="mb-3 text-sm leading-snug text-foreground/80 line-clamp-2">
              {data.productSummary}
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryChip
              icon={TargetIcon}
              label="Audience"
              value={data.targetAudience}
              colorClass="text-violet-500"
            />
            <SummaryChip
              icon={ZapIcon}
              label="Value prop"
              value={data.valueProposition}
              colorClass="text-amber-500"
            />
            <SummaryChip
              icon={AlertTriangleIcon}
              label="Risk"
              value={data.mainRisk}
              colorClass="text-rose-500"
            />
            <SummaryChip
              icon={LightbulbIcon}
              label="Opportunity"
              value={data.topOpportunity}
              colorClass="text-emerald-500"
            />
          </div>
          {/* Expand strip */}
          <div className="mt-3 flex items-center justify-center gap-1.5 border-t border-border/40 pt-2.5 pb-1 text-[11px] font-medium text-muted-foreground/50 transition-colors group-hover/summary:text-muted-foreground">
            <span>Show more</span>
            <ChevronDownIcon className="size-3" />
          </div>
        </CardContent>
      ) : (
        <CardContent className="pt-0 pb-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <SummaryDetail
              icon={GlobeIcon}
              label="Product"
              value={data.productSummary}
              colorClass="text-blue-500"
            />
            <SummaryDetail
              icon={TargetIcon}
              label="Target audience"
              value={data.targetAudience}
              colorClass="text-violet-500"
            />
            <SummaryDetail
              icon={ZapIcon}
              label="Value proposition"
              value={data.valueProposition}
              colorClass="text-amber-500"
            />
            <SummaryDetail
              icon={AlertTriangleIcon}
              label="Main risk"
              value={data.mainRisk}
              colorClass="text-rose-500"
            />
            {data.topOpportunity ? (
              <div className="sm:col-span-2">
                <SummaryDetail
                  icon={LightbulbIcon}
                  label="Top opportunity"
                  value={data.topOpportunity}
                  colorClass="text-emerald-500"
                />
              </div>
            ) : null}
          </div>
          {/* Collapse strip */}
          <div className="mt-3 flex items-center justify-center gap-1.5 border-t border-border/40 pt-2.5 pb-1 text-[11px] font-medium text-muted-foreground/50 transition-colors group-hover/summary:text-muted-foreground">
            <span>Show less</span>
            <ChevronDownIcon className="size-3 rotate-180" />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
