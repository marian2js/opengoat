import { useState } from "react";
import {
  PlayIcon,
  PauseIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  ClipboardListIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { Objective, ObjectiveStatus } from "@/features/dashboard/types/objective";

export interface ObjectiveQuickActionsProps {
  objective: Objective;
  client: SidecarClient;
  onStatusChanged: () => void;
  onStartRun?: () => void;
  onCreateTask?: () => void;
}

const STATUS_ACTIONS: {
  status: ObjectiveStatus;
  label: string;
  icon: typeof PlayIcon;
  variant: "default" | "outline" | "ghost";
}[] = [
  { status: "active", label: "Active", icon: PlayIcon, variant: "default" },
  { status: "paused", label: "Pause", icon: PauseIcon, variant: "outline" },
  { status: "completed", label: "Complete", icon: CheckCircleIcon, variant: "outline" },
  { status: "abandoned", label: "Abandon", icon: XCircleIcon, variant: "ghost" },
];

export function ObjectiveQuickActions({
  objective,
  client,
  onStatusChanged,
  onStartRun,
  onCreateTask,
}: ObjectiveQuickActionsProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleStatusChange(newStatus: ObjectiveStatus): Promise<void> {
    if (newStatus === objective.status || isUpdating) return;
    setIsUpdating(true);
    try {
      await client.updateObjective(objective.objectiveId, { status: newStatus });
      onStatusChanged();
    } catch (err) {
      console.error("Failed to update objective status", err);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status change buttons */}
      {STATUS_ACTIONS.map(({ status, label, icon: Icon, variant }) => (
        <Button
          key={status}
          variant={status === objective.status ? "default" : variant}
          size="sm"
          className="h-7 gap-1.5 text-xs"
          disabled={status === objective.status || isUpdating}
          onClick={() => void handleStatusChange(status)}
        >
          <Icon className="size-3" />
          {label}
        </Button>
      ))}

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Action buttons */}
      {onStartRun ? (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={onStartRun}
        >
          <PlusIcon className="size-3" />
          Start Run
        </Button>
      ) : null}

      {onCreateTask ? (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={onCreateTask}
        >
          <ClipboardListIcon className="size-3" />
          Create Task
        </Button>
      ) : null}
    </div>
  );
}
