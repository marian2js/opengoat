import { CrosshairIcon, FolderIcon, PlayIcon, XIcon } from "lucide-react";
import type { ChatScope } from "@/features/chat/lib/chat-scope";

interface ScopeIndicatorProps {
  scope: ChatScope;
  objectiveTitle?: string;
  runTitle?: string;
  onClear: () => void;
}

function scopeIcon(type: ChatScope["type"]) {
  switch (type) {
    case "project":
      return <FolderIcon className="size-3" />;
    case "objective":
      return <CrosshairIcon className="size-3" />;
    case "run":
      return <PlayIcon className="size-3" />;
    default:
      return null;
  }
}

function scopeDisplayLabel(
  scope: ChatScope,
  objectiveTitle?: string,
  runTitle?: string,
): string {
  switch (scope.type) {
    case "project":
      return "Project";
    case "objective":
      return objectiveTitle
        ? `Objective: ${objectiveTitle.length > 24 ? `${objectiveTitle.slice(0, 22)}…` : objectiveTitle}`
        : "Objective";
    case "run":
      return runTitle
        ? `Run: ${runTitle.length > 20 ? `${runTitle.slice(0, 18)}…` : runTitle}`
        : "Run";
    default:
      return "";
  }
}

export function ScopeIndicator({
  scope,
  objectiveTitle,
  runTitle,
  onClear,
}: ScopeIndicatorProps) {
  if (scope.type === "unattached") {
    return null;
  }

  const label = scopeDisplayLabel(scope, objectiveTitle, runTitle);

  return (
    <span className="group/scope inline-flex items-center gap-1 rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] font-medium text-primary/80 dark:bg-primary/12 dark:text-primary/70">
      {scopeIcon(scope.type)}
      <span className="max-w-[160px] truncate">{label}</span>
      <button
        type="button"
        className="ml-0.5 inline-flex size-3 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-primary/15 group-hover/scope:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        aria-label="Clear scope"
      >
        <XIcon className="size-2.5" />
      </button>
    </span>
  );
}
