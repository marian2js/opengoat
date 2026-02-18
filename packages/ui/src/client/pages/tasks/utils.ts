export function taskStatusPillClasses(status: string): string {
  switch (status.trim().toLowerCase()) {
    case "done":
      return "bg-success/20 text-success";
    case "doing":
      return "bg-sky-500/20 text-sky-300";
    case "blocked":
      return "bg-amber-500/20 text-amber-300";
    default:
      return "bg-accent text-foreground";
  }
}

export function taskStatusLabel(status: string): string {
  switch (status.trim().toLowerCase()) {
    case "todo":
      return "To do";
    case "doing":
      return "In progress";
    case "pending":
      return "Pending";
    case "blocked":
      return "Blocked";
    case "done":
      return "Done";
    default:
      return status;
  }
}

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

export function formatRelativeTime(
  timestampIso: string,
  referenceTimestampMs = Date.now(),
): string {
  const parsedTimestamp = Date.parse(timestampIso);
  if (!Number.isFinite(parsedTimestamp)) {
    return "unknown";
  }

  const diffMs = parsedTimestamp - referenceTimestampMs;
  const absoluteMs = Math.abs(diffMs);
  if (absoluteMs < 30_000) {
    return "just now";
  }

  const minutes = diffMs / 60_000;
  if (Math.abs(minutes) < 60) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(minutes), "minute");
  }

  const hours = diffMs / (60 * 60_000);
  if (Math.abs(hours) < 24) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(hours), "hour");
  }

  const days = diffMs / (24 * 60 * 60_000);
  if (Math.abs(days) < 7) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(days), "day");
  }

  const weeks = diffMs / (7 * 24 * 60 * 60_000);
  if (Math.abs(weeks) < 5) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(weeks), "week");
  }

  const months = diffMs / (30 * 24 * 60 * 60_000);
  if (Math.abs(months) < 12) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(months), "month");
  }

  const years = diffMs / (365 * 24 * 60 * 60_000);
  return RELATIVE_TIME_FORMATTER.format(Math.round(years), "year");
}
