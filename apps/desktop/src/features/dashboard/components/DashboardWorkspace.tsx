import { LayoutDashboardIcon } from "lucide-react";
import type { SidecarClient } from "@/lib/sidecar/client";
import { ActionCardGrid } from "@/features/dashboard/components/ActionCardGrid";

export interface DashboardWorkspaceProps {
  agentId?: string | undefined;
  client: SidecarClient | null;
  onActionClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
}

export function DashboardWorkspace({
  agentId,
  client,
  onActionClick,
}: DashboardWorkspaceProps) {
  if (!agentId || !client) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <LayoutDashboardIcon className="size-8 text-muted-foreground/30" />
          <p className="text-sm">No project selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5 lg:p-6">
      <ActionCardGrid onActionClick={onActionClick} />
    </div>
  );
}
