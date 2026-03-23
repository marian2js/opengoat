import { truncateLabel } from "./row-badges-helpers";

interface RunChipProps {
  label: string;
  maxLen?: number;
}

export function RunChip({ label, maxLen = 16 }: RunChipProps) {
  const truncated = truncateLabel(label, maxLen);
  return (
    <span
      className="inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground dark:bg-muted/40"
      title={label}
    >
      {truncated}
    </span>
  );
}
