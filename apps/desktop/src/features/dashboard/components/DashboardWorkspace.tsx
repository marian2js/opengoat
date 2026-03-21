import { LayoutDashboardIcon } from "lucide-react";
import type { SidecarClient } from "@/lib/sidecar/client";
import { resolveDomain, buildFaviconSources } from "@/lib/utils/favicon";
import { ActionCardGrid } from "@/features/dashboard/components/ActionCardGrid";
import { CompanySummary } from "@/features/dashboard/components/CompanySummary";
import { OpportunitySection } from "@/features/dashboard/components/OpportunitySection";
import { SuggestedActionGrid } from "@/features/dashboard/components/SuggestedActionGrid";
import { useWorkspaceSummary } from "@/features/dashboard/hooks/useWorkspaceSummary";
import { useSuggestedActions } from "@/features/dashboard/hooks/useSuggestedActions";

export interface DashboardWorkspaceProps {
  agent?: { id: string; name: string; description?: string | undefined } | undefined;
  agentId?: string | undefined;
  client: SidecarClient | null;
  completedActions?: Set<string> | undefined;
  isActionLoading?: boolean | undefined;
  onActionClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
  onViewResults?: ((actionId: string) => void) | undefined;
}

export function DashboardWorkspace({
  agent,
  agentId,
  client,
  completedActions,
  isActionLoading,
  onActionClick,
  onViewResults,
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

  const domain = agent ? resolveDomain(agent) : undefined;
  const faviconSources = domain ? buildFaviconSources(domain) : undefined;

  return (
    <DashboardContent
      agentId={agentId}
      client={client}
      completedActions={completedActions}
      domain={domain}
      faviconSources={faviconSources}
      isActionLoading={isActionLoading}
      onActionClick={onActionClick}
      onViewResults={onViewResults}
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
  completedActions,
  domain,
  faviconSources,
  isActionLoading,
  onActionClick,
  onViewResults,
}: {
  agentId: string;
  client: SidecarClient;
  completedActions?: Set<string> | undefined;
  domain?: string | undefined;
  faviconSources?: string[] | undefined;
  isActionLoading?: boolean | undefined;
  onActionClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
  onViewResults?: ((actionId: string) => void) | undefined;
}) {
  const { data, files, isLoading, error } = useWorkspaceSummary(agentId, client);
  const workspaceReady = !isLoading && files !== null;
  const { suggestedActions, isLoading: isSuggestedLoading } = useSuggestedActions(agentId, client, workspaceReady);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-5 lg:p-6">
      {/* Section 1: Company context */}
      <div className="pb-5">
        <CompanySummary
          data={data}
          domain={domain}
          faviconSources={faviconSources}
          isLoading={isLoading}
          error={error}
        />
      </div>

      {/* Divider: summary → actions */}
      <div className="border-b border-border/30" />

      {/* Section 2: Action cards (starter + suggested) — dominant area */}
      <div className="flex flex-col gap-8 py-6">
        <ActionCardGrid
          completedActions={completedActions}
          isLoading={isActionLoading}
          onActionClick={onActionClick}
          onViewResults={onViewResults}
        />
        <SuggestedActionGrid
          actions={suggestedActions}
          completedActions={completedActions}
          isGenerating={isSuggestedLoading}
          isActionLoading={isActionLoading}
          onActionClick={onActionClick}
          onViewResults={onViewResults}
        />
      </div>

      {/* Divider: actions → insights */}
      <div className="border-b border-border/30" />

      {/* Section 3: Insights — supporting info */}
      <div className="pt-6">
        <OpportunitySection
          completedActions={completedActions}
          files={files}
          isLoading={isLoading}
          onActionClick={onActionClick}
          onViewResults={onViewResults}
        />
      </div>
    </div>
  );
}
