import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getStatusConfig } from "@/features/board/lib/status-config";

const ALL_STATUSES = ["todo", "doing", "pending", "blocked", "done"] as const;
const REASON_STATUSES = new Set(["pending", "blocked"]);

const STATUS_BUTTON_CLASSES: Record<string, string> = {
  todo: "",
  doing: "text-blue-600 dark:text-blue-400",
  pending: "text-yellow-600 dark:text-yellow-400",
  blocked: "text-red-600 dark:text-red-400",
  done: "text-green-600 dark:text-green-400",
};

interface TaskQuickActionsProps {
  currentStatus: string;
  onStatusChange: (status: string, reason?: string) => Promise<void>;
}

export function TaskQuickActions({
  currentStatus,
  onStatusChange,
}: TaskQuickActionsProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const availableTransitions = ALL_STATUSES.filter((s) => s !== currentStatus);

  const handleClick = async (status: string) => {
    if (REASON_STATUSES.has(status)) {
      setPendingAction(status);
      setReason("");
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

  return (
    <div className="space-y-3">
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
    </div>
  );
}
