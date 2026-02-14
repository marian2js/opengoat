import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ReactElement, RefObject } from "react";
import {
  formatUiLogTimestamp,
  logsConnectionStateBadgeClassName,
  uiLogLevelClassName,
  uiLogMessageClassName,
  type LogsConnectionState,
  type UiLogLevel,
} from "./utils";

type UiLogSource = "opengoat" | "openclaw";

interface UiLogEntry {
  id: number;
  timestamp: string;
  level: UiLogLevel;
  source: UiLogSource;
  message: string;
}

interface LogsPageProps {
  logSourceFilters: Record<UiLogSource, boolean>;
  onLogSourceFilterChange: (source: UiLogSource, checked: boolean) => void;
  logsConnectionState: LogsConnectionState;
  onClear: () => void;
  logsAutoScrollEnabled: boolean;
  onJumpToLatest: () => void;
  logsViewportRef: RefObject<HTMLDivElement | null>;
  onViewportScroll: () => void;
  logsError: string | null;
  uiLogs: UiLogEntry[];
  filteredUiLogs: UiLogEntry[];
}

export function LogsPage({
  logSourceFilters,
  onLogSourceFilterChange,
  logsConnectionState,
  onClear,
  logsAutoScrollEnabled,
  onJumpToLatest,
  logsViewportRef,
  onViewportScroll,
  logsError,
  uiLogs,
  filteredUiLogs,
}: LogsPageProps): ReactElement {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Real-time runtime activity from OpenGoat and OpenClaw.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-[#041004] px-2 py-1 text-[11px]">
            <span className="uppercase tracking-wide text-emerald-300/80">
              Sources
            </span>
            <label className="inline-flex items-center gap-1.5 text-emerald-100">
              <Checkbox
                checked={logSourceFilters.opengoat}
                onCheckedChange={(checked) => {
                  onLogSourceFilterChange("opengoat", checked === true);
                }}
                aria-label="Show OpenGoat logs"
              />
              <span>OpenGoat</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-emerald-100">
              <Checkbox
                checked={logSourceFilters.openclaw}
                onCheckedChange={(checked) => {
                  onLogSourceFilterChange("openclaw", checked === true);
                }}
                aria-label="Show OpenClaw logs"
              />
              <span>OpenClaw</span>
            </label>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
              logsConnectionStateBadgeClassName(logsConnectionState),
            )}
          >
            {logsConnectionState}
          </span>
          <Button size="sm" variant="secondary" onClick={onClear}>
            Clear
          </Button>
          {!logsAutoScrollEnabled ? (
            <Button size="sm" variant="secondary" onClick={onJumpToLatest}>
              Jump to Latest
            </Button>
          ) : null}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-emerald-500/20 bg-[#030a03] shadow-[0_0_0_1px_rgba(16,185,129,0.08)]">
        <div className="flex items-center justify-between border-b border-emerald-500/15 bg-[#041004] px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-emerald-300/90">
          <span>OpenGoat Terminal</span>
          <span>{`${filteredUiLogs.length} visible / ${uiLogs.length} total`}</span>
        </div>
        <div
          ref={logsViewportRef}
          onScroll={onViewportScroll}
          className="max-h-[68vh] min-h-[340px] overflow-y-auto px-3 py-2 font-mono text-[12px] leading-5"
        >
          {logsError ? (
            <div className="mb-2 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-rose-200">
              {logsError}
            </div>
          ) : null}
          {uiLogs.length === 0 ? (
            <p className="text-emerald-200/70">Waiting for runtime activity...</p>
          ) : filteredUiLogs.length === 0 ? (
            <p className="text-emerald-200/70">
              No entries match the selected source filters.
            </p>
          ) : (
            filteredUiLogs.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[76px_124px_minmax(0,1fr)] items-start gap-x-3 py-0.5"
              >
                <span className="text-emerald-200/60">
                  {formatUiLogTimestamp(entry.timestamp)}
                </span>
                <span
                  className={cn(
                    "font-semibold uppercase whitespace-nowrap",
                    uiLogLevelClassName(entry.level),
                  )}
                >
                  {`${entry.source}:${entry.level}`}
                </span>
                <span
                  className={cn(
                    "whitespace-pre-wrap break-words",
                    uiLogMessageClassName(entry.level),
                  )}
                >
                  {entry.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
