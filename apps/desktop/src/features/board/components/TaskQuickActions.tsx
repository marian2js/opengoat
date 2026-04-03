import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getStatusConfig } from "@/features/board/lib/status-config";
import {
  ShieldAlertIcon,
  FileTextIcon,
  ClockIcon,
  ChevronDownIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

const ALL_STATUSES = ["todo", "doing", "pending", "blocked", "done"] as const;
const REASON_STATUSES = new Set(["pending", "blocked"]);

const STATUS_DOT_CLASSES: Record<string, string> = {
  todo: "bg-zinc-400",
  doing: "bg-primary",
  pending: "bg-yellow-400",
  blocked: "bg-red-400",
  done: "bg-green-400",
};

type EntryKind = "blocker" | "artifact" | "worklog";

const ENTRY_CONFIG: Record<
  EntryKind,
  {
    label: string;
    icon: typeof ShieldAlertIcon;
    placeholder: string;
  }
> = {
  blocker: {
    label: "Add Blocker",
    icon: ShieldAlertIcon,
    placeholder: "Describe the blocker…",
  },
  artifact: {
    label: "Add Output",
    icon: FileTextIcon,
    placeholder: "Describe the output…",
  },
  worklog: {
    label: "Add Worklog",
    icon: ClockIcon,
    placeholder: "What was done…",
  },
};

interface TaskQuickActionsProps {
  currentStatus: string;
  onStatusChange: (status: string, reason?: string) => Promise<void>;
  onAddBlocker: (content: string) => Promise<void>;
  onAddArtifact: (content: string) => Promise<void>;
  onAddWorklog: (content: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function TaskQuickActions({
  currentStatus,
  onStatusChange,
  onAddBlocker,
  onAddArtifact,
  onAddWorklog,
  onDelete,
}: TaskQuickActionsProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeEntry, setActiveEntry] = useState<EntryKind | null>(null);
  const [entryContent, setEntryContent] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const availableTransitions = ALL_STATUSES.filter(
    (s) => s !== currentStatus,
  );

  const entryHandlers: Record<EntryKind, (content: string) => Promise<void>> = {
    blocker: onAddBlocker,
    artifact: onAddArtifact,
    worklog: onAddWorklog,
  };

  const handleStatusSelect = async (status: string) => {
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

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsUpdating(true);
    try {
      await onDelete();
    } finally {
      setIsUpdating(false);
      setConfirmDelete(false);
    }
  };

  // Inline input for reason or entry
  if (pendingAction) {
    return (
      <div className="flex w-full items-center gap-2">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={`Reason for ${getStatusConfig(pendingAction).label.toLowerCase()} (optional)`}
          className="h-8 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
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
    );
  }

  if (activeEntry) {
    const cfg = ENTRY_CONFIG[activeEntry];
    return (
      <div className="flex w-full items-center gap-2">
        <input
          type="text"
          value={entryContent}
          onChange={(e) => setEntryContent(e.target.value)}
          placeholder={cfg.placeholder}
          className="h-8 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
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
    );
  }

  if (confirmDelete) {
    return (
      <div className="flex w-full items-center gap-2">
        <p className="flex-1 text-xs text-destructive dark:text-red-400">
          Delete this task? This cannot be undone.
        </p>
        <Button
          variant="destructive"
          size="sm"
          disabled={isUpdating}
          onClick={() => void handleDelete()}
        >
          Delete
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={isUpdating}
          onClick={() => setConfirmDelete(false)}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-between">
      {/* Left: Status change dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isUpdating} className="gap-1.5">
            Move to
            <ChevronDownIcon className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {availableTransitions.map((status) => {
            const config = getStatusConfig(status);
            return (
              <DropdownMenuItem
                key={status}
                onClick={() => void handleStatusSelect(status)}
                className="gap-2"
              >
                <span
                  className={`size-2 rounded-full ${STATUS_DOT_CLASSES[status] ?? "bg-muted-foreground"}`}
                />
                <span className="font-mono text-[11px] uppercase tracking-wider">
                  {config.label}
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Right: Add entry + delete */}
      <div className="flex items-center gap-1">
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive dark:hover:text-red-400"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <PlusIcon className="size-3.5" />
              Add
              <ChevronDownIcon className="size-3 text-muted-foreground/50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(ENTRY_CONFIG) as EntryKind[]).map((kind) => {
              const cfg = ENTRY_CONFIG[kind];
              const Icon = cfg.icon;
              return (
                <DropdownMenuItem
                  key={kind}
                  onClick={() => handleEntryClick(kind)}
                  className="gap-2"
                >
                  <Icon className="size-3.5" />
                  {cfg.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
