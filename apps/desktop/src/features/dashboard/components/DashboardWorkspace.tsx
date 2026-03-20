import { LayoutDashboardIcon } from "lucide-react";
import type { SidecarClient } from "@/lib/sidecar/client";

interface DashboardWorkspaceProps {
  agentId?: string;
  client: SidecarClient | null;
  onActionClick?: (actionId: string, prompt: string, label: string) => void;
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
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <LayoutDashboardIcon className="size-6" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Your marketing command center. Company summary, action cards, and opportunities will appear here.
        </p>
      </div>
    </div>
  );
}
