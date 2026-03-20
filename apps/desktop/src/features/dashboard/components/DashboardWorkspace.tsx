import { LayoutDashboardIcon } from "lucide-react";
import type { SidecarClient } from "@/lib/sidecar/client";
import { ActionCardGrid } from "@/features/dashboard/components/ActionCardGrid";
import { CompanySummary } from "@/features/dashboard/components/CompanySummary";
import { OpportunitySection } from "@/features/dashboard/components/OpportunitySection";
import { useWorkspaceSummary } from "@/features/dashboard/hooks/useWorkspaceSummary";

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
    <DashboardContent
      agentId={agentId}
      client={client}
      onActionClick={onActionClick}
    />
  );
}

/**
 * Inner component that renders when agentId and client are available.
 * Separated so hooks can be called unconditionally.
 */
function DashboardContent({
  agentId,
  client,
  onActionClick,
}: {
  agentId: string;
  client: SidecarClient;
  onActionClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
}) {
  const { data, files, isLoading, error } = useWorkspaceSummary(agentId, client);

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5 lg:p-6">
      <CompanySummary data={data} isLoading={isLoading} error={error} />
      <ActionCardGrid onActionClick={onActionClick} />
      <OpportunitySection
        files={files}
        isLoading={isLoading}
        onActionClick={onActionClick}
      />
    </div>
  );
}
