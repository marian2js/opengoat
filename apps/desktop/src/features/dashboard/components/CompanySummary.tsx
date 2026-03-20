import {
  BuildingIcon,
  AlertTriangleIcon,
  LightbulbIcon,
  TargetIcon,
  ZapIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanySummaryData } from "@/features/dashboard/lib/parse-workspace-summary";

export interface CompanySummaryProps {
  data: CompanySummaryData | null;
  isLoading: boolean;
  error?: string | null;
}

interface SummaryItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  iconClassName?: string;
}

function SummaryItem({ icon: Icon, label, value, iconClassName }: SummaryItemProps) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <div className={`mt-0.5 shrink-0 rounded-md bg-primary/8 p-1.5 ${iconClassName ?? "text-primary"}`}>
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
    <Card className="border border-border/70 bg-card/90 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-5 w-40" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="mt-0.5 size-7 shrink-0 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CompanySummary({ data, isLoading, error }: CompanySummaryProps) {
  if (isLoading) {
    return <SummarySkeleton />;
  }

  // Check if we have at least one data point to display
  const hasAnyData = data ? Object.values(data).some(Boolean) : false;

  if (!hasAnyData) {
    // Show a subtle error/empty state instead of rendering nothing
    if (error || !data) {
      return (
        <Card className="border border-border/70 bg-card/90 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/8 p-1.5 text-primary">
                <BuildingIcon className="size-4" />
              </div>
              <CardTitle className="text-sm font-semibold tracking-tight">
                Company overview
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Unable to load company overview. Try refreshing the page.
            </p>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  if (!data) return null;

  return (
    <Card className="border border-border/70 bg-card/90 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/8 p-1.5 text-primary">
            <BuildingIcon className="size-4" />
          </div>
          <CardTitle className="text-sm font-semibold tracking-tight">
            Company overview
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <SummaryItem
            icon={BuildingIcon}
            label="Product"
            value={data.productSummary}
            iconClassName="text-blue-500"
          />
          <SummaryItem
            icon={TargetIcon}
            label="Target audience"
            value={data.targetAudience}
            iconClassName="text-violet-500"
          />
          <SummaryItem
            icon={ZapIcon}
            label="Value proposition"
            value={data.valueProposition}
            iconClassName="text-amber-500"
          />
          <SummaryItem
            icon={AlertTriangleIcon}
            label="Main risk"
            value={data.mainRisk}
            iconClassName="text-rose-500"
          />
          {data.topOpportunity ? (
            <div className="sm:col-span-2">
              <SummaryItem
                icon={LightbulbIcon}
                label="Top opportunity"
                value={data.topOpportunity}
                iconClassName="text-emerald-500"
              />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
