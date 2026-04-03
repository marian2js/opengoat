import { useState } from "react";
import { RadioIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SidecarClient } from "@/lib/sidecar/client";
import { useSignals, type UseSignalsFilters } from "@/features/signals/hooks/useSignals";
import { useSignalActions } from "@/features/signals/hooks/useSignalActions";
import { SignalCard } from "./SignalCard";
import { SOURCE_TYPE_LABELS } from "@/features/signals/lib/signal-icons";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "seen", label: "Seen" },
  { value: "saved", label: "Saved" },
  { value: "promoted", label: "Promoted" },
  { value: "dismissed", label: "Dismissed" },
];

const SOURCE_TYPE_OPTIONS = [
  { value: "all", label: "All sources" },
  ...Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

export interface SignalFeedProps {
  client: SidecarClient;
  filters?: UseSignalsFilters;
  showFilters?: boolean;
  emptyMessage?: string;
}

export function SignalFeed({
  client,
  filters: externalFilters,
  showFilters = false,
  emptyMessage = "No signals yet",
}: SignalFeedProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>("all");

  const mergedFilters: UseSignalsFilters = {
    ...externalFilters,
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(sourceTypeFilter !== "all" ? { sourceType: sourceTypeFilter } : {}),
  };

  const { signals, isLoading, error, refresh } = useSignals(
    client,
    mergedFilters,
  );
  const { saveSignal, dismissSignal, promoteSignal, actionLoading, actionError, clearError } =
    useSignalActions(client, refresh);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          className="text-xs text-muted-foreground underline hover:text-foreground"
          onClick={refresh}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter controls */}
      {showFilters ? (
        <div className="flex items-center gap-2">
          <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Action error banner */}
      {actionError && (
        <div className="flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span>{actionError}</span>
          <button type="button" onClick={clearError} className="ml-2 font-medium underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border border-border/50 bg-card/80 p-4"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : signals.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rounded-full bg-muted/50 p-3">
            <RadioIcon className="size-6 text-muted-foreground/40" />
          </div>
          <h3 className="font-display text-sm font-semibold text-foreground/80">
            Signals
          </h3>
          <p className="max-w-xs text-xs text-muted-foreground">
            {emptyMessage}
          </p>
        </div>
      ) : (
        /* Signal list */
        <div className="grid gap-3">
          {signals.map((signal) => (
            <SignalCard
              key={signal.signalId}
              signal={signal}
              onSave={saveSignal}
              onDismiss={dismissSignal}
              onPromote={promoteSignal}
              isActionLoading={actionLoading[signal.signalId] ?? false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
