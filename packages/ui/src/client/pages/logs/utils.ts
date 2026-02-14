export type UiLogLevel = "info" | "warn" | "error";
export type LogsConnectionState = "connecting" | "live" | "offline";

export function formatUiLogTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Date(parsed).toISOString().slice(11, 19);
}

export function uiLogLevelClassName(level: UiLogLevel): string {
  switch (level) {
    case "error":
      return "text-rose-300";
    case "warn":
      return "text-amber-200";
    default:
      return "text-emerald-300";
  }
}

export function uiLogMessageClassName(level: UiLogLevel): string {
  switch (level) {
    case "error":
      return "text-rose-100";
    case "warn":
      return "text-amber-50";
    default:
      return "text-emerald-100";
  }
}

export function logsConnectionStateBadgeClassName(
  state: LogsConnectionState,
): string {
  switch (state) {
    case "live":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "connecting":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    default:
      return "border-rose-500/40 bg-rose-500/10 text-rose-200";
  }
}
