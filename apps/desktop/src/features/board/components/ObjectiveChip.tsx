import { truncateLabel } from "./row-badges-helpers";

interface ObjectiveChipProps {
  label: string;
  maxLen?: number;
}

export function ObjectiveChip({ label, maxLen = 18 }: ObjectiveChipProps) {
  const truncated = truncateLabel(label, maxLen);
  return (
    <span
      className="inline-flex items-center rounded-md bg-primary/8 px-1.5 py-0.5 font-mono text-[10px] text-primary/70 dark:bg-primary/12 dark:text-primary/80"
      title={label}
    >
      {truncated}
    </span>
  );
}
