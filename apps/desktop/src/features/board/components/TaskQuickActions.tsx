import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getStatusConfig } from "@/features/board/lib/status-config";
import { ShieldAlertIcon, FileTextIcon, ClockIcon } from "lucide-react";

const ALL_STATUSES = ["todo", "doing", "pending", "blocked", "done"] as const;
const REASON_STATUSES = new Set(["pending", "blocked"]);

const STATUS_BUTTON_CLASSES: Record<string, string> = {
  todo: "",
  doing: "text-blue-600 dark:text-blue-400",
  pending: "text-yellow-600 dark:text-yellow-400",
  blocked: "text-red-600 dark:text-red-400",
  done: "text-green-600 dark:text-green-400",
};

type EntryKind = "blocker" | "artifact" | "worklog";

const ENTRY_CONFIG: Record<EntryKind, { label: string; icon: typeof ShieldAlertIcon; className: string; placeholder: string }> = {
  blocker: {
    label: "Add Blocker",
    icon: ShieldAlertIcon,
    className: "text-red-600 dark:text-red-400",
    placeholder: "Describe the blocker…",
  },
  artifact: {
    label: "Add Artifact",
    icon: FileTextIcon,
    className: "text-muted-foreground",
    placeholder: "Describe the artifact…",
  },
  worklog: {
    label: "Add Worklog",
    icon: ClockIcon,
    className: "text-muted-foreground",
    placeholder: "What was done…",
  },
};

interface TaskQuickActionsProps {
  currentStatus: string;
  onStatusChange: (status: string, reason?: string) => Promise<void>;
  onAddBlocker: (content: string) => Promise<void>;
  onAddArtifact: (content: string) => Promise<void>;
  onAddWorklog: (content: string) => Promise<void>;
}

export function TaskQuickActions({
  currentStatus,
  onStatusChange,
  onAddBlocker,
  onAddArtifact,
  onAddWorklog,
}: TaskQuickActionsProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeEntry, setActiveEntry] = useState<EntryKind | null>(null);
  const [entryContent, setEntryContent] = useState("");

  const availableTransitions = ALL_STATUSES.filter((s) => s !== currentStatus);

  const entryHandlers: Record<EntryKind, (content: string) => Promise<void>> = {
    blocker: onAddBlocker,
    artifact: onAddArtifact,
    worklog: onAddWorklog,
  };

  const handleClick = async (status: string) => {
    if (REASON_STATUSES.has(status)) {
      setPendingAction(status);
      setReason("");
      setActiveEntry(null);
      return;
    }
    setIsUpdating(true);
    try {
      await onStatusChange(status);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmReason = async () => {
    if (!pendingAction) return;
    setIsUpdating(true);
    try {
      await onStatusChange(pendingAction, reason || undefined);
      setPendingAction(null);
      setReason("");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelReason = () => {
    setPendingAction(null);
    setReason("");
  };

  const handleEntryClick = (kind: EntryKind) => {
    setActiveEntry(kind);
    setEntryContent("");
    setPendingAction(null);
  };

  const handleConfirmEntry = async () => {
    if (!activeEntry || !entryContent.trim()) return;
    setIsUpdating(true);
    try {
      await entryHandlers[activeEntry](entryContent.trim());
      setActiveEntry(null);
      setEntryContent("");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEntry = () => {
    setActiveEntry(null);
    setEntryContent("");
  };

  return (
    <div className="space-y-3">
      {/* Status transitions */}
      <div className="flex flex-wrap gap-2">
        {availableTransitions.map((status) => {
          const config = getStatusConfig(status);
          return (
            <Button
              key={status}
              variant="outline"
              size="sm"
              disabled={isUpdating}
              className={STATUS_BUTTON_CLASSES[status] ?? ""}
              onClick={() => void handleClick(status)}
            >
              {`Mark ${config.label}`}
            </Button>
          );
        })}
      </div>

      {/* Reason input for pending/blocked */}
      {pendingAction && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={`Reason for ${getStatusConfig(pendingAction).label.toLowerCase()} (optional)`}
            className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleConfirmReason();
              if (e.key === "Escape") handleCancelReason();
            }}
            autoFocus
          />
          <Button
            variant="default"
            size="sm"
            disabled={isUpdating}
            onClick={() => void handleConfirmReason()}
          >
            Confirm
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isUpdating}
            onClick={handleCancelReason}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Add blocker / artifact / worklog buttons */}
      <div className="flex flex-wrap gap-2 border-t pt-3">
        {(Object.keys(ENTRY_CONFIG) as EntryKind[]).map((kind) => {
          const cfg = ENTRY_CONFIG[kind];
          const Icon = cfg.icon;
          return (
            <Button
              key={kind}
              variant="ghost"
              size="sm"
              disabled={isUpdating}
              className={cfg.className}
              onClick={() => handleEntryClick(kind)}
            >
              <Icon className="size-3.5" />
              {cfg.label}
            </Button>
          );
        })}
      </div>

      {/* Inline content input for add entry */}
      {activeEntry && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={entryContent}
            onChange={(e) => setEntryContent(e.target.value)}
            placeholder={ENTRY_CONFIG[activeEntry].placeholder}
            className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleConfirmEntry();
              if (e.key === "Escape") handleCancelEntry();
            }}
            autoFocus
          />
          <Button
            variant="default"
            size="sm"
            disabled={isUpdating || !entryContent.trim()}
            onClick={() => void handleConfirmEntry()}
          >
            Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isUpdating}
            onClick={handleCancelEntry}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
