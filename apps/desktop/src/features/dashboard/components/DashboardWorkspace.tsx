import { LayoutDashboardIcon } from "lucide-react";
import type { AgentSession } from "@opengoat/contracts";
import type { SidecarClient } from "@/lib/sidecar/client";
import { resolveDomain, buildFaviconSources } from "@/lib/utils/favicon";
import { ActionCardGrid } from "@/features/dashboard/components/ActionCardGrid";
import { CompanySummary } from "@/features/dashboard/components/CompanySummary";
import { SuggestedActionGrid } from "@/features/dashboard/components/SuggestedActionGrid";
import { FreeTextInput } from "@/features/dashboard/components/FreeTextInput";
import { NowWorkingOn } from "@/features/dashboard/components/NowWorkingOn";
import { RecentOutputs } from "@/features/dashboard/components/RecentOutputs";
import { useWorkspaceSummary } from "@/features/dashboard/hooks/useWorkspaceSummary";
import { useSuggestedActions } from "@/features/dashboard/hooks/useSuggestedActions";
import { useBoardSummary } from "@/features/dashboard/hooks/useBoardSummary";
import { useActiveObjective } from "@/features/dashboard/hooks/useActiveObjective";
import { useRuns } from "@/features/dashboard/hooks/useRuns";
import { useRecentArtifacts } from "@/features/dashboard/hooks/useRecentArtifacts";
import { BoardSummary } from "@/features/dashboard/components/BoardSummary";

export interface DashboardWorkspaceProps {
  agent?: { id: string; name: string; description?: string | undefined } | undefined;
  agentId?: string | undefined;
  client: SidecarClient | null;
  completedActions?: Set<string> | undefined;
  isActionLoading?: boolean | undefined;
  onActionClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
  onViewResults?: ((actionId: string) => void) | undefined;
  onRunSessionCreated?: (session: AgentSession, prompt: string, runId: string, objectiveId?: string) => void;
  onResumeRun?: (sessionId: string) => void;
}

export function DashboardWorkspace({
  agent,
  agentId,
  client,
  completedActions,
  isActionLoading,
  onActionClick,
  onViewResults,
  onResumeRun,
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
      onResumeRun={onResumeRun}
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
  onResumeRun,
}: {
  agentId: string;
  client: SidecarClient;
  completedActions?: Set<string> | undefined;
  domain?: string | undefined;
  faviconSources?: string[] | undefined;
  isActionLoading?: boolean | undefined;
  onActionClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
  onViewResults?: ((actionId: string) => void) | undefined;
  onResumeRun?: ((sessionId: string) => void) | undefined;
}) {
  const { data, files, isLoading, error } = useWorkspaceSummary(agentId, client);
  const workspaceReady = !isLoading && files !== null;
  const { suggestedActions, isLoading: isSuggestedLoading } = useSuggestedActions(agentId, client, workspaceReady);
  const boardSummary = useBoardSummary(agentId, client);
  const activeObjective = useActiveObjective(agentId, client);
  const runsResult = useRuns(agentId, client);
  const recentArtifacts = useRecentArtifacts(agentId, client);

  // Mode detection: Mode B when active work exists
  const hasActiveWork =
    (!activeObjective.isLoading && activeObjective.objective !== null) ||
    (!runsResult.isLoading && runsResult.runs.length > 0);

  // Latest artifact for NowWorkingOn preview
  const latestArtifact =
    recentArtifacts.standaloneArtifacts[0] ??
    recentArtifacts.bundleGroups[0]?.artifacts[0] ??
    null;

  // Free-text submit handler — routes to chat via onActionClick
  function handleFreeTextSubmit(text: string) {
    onActionClick?.("free-text", text, text.slice(0, 50));
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-5 lg:p-6">
      {/* ── Company context — always shown ── */}
      <div className="mb-8 border-b border-border/20 pb-5">
        <CompanySummary
          data={data}
          domain={domain}
          faviconSources={faviconSources}
          isLoading={isLoading}
          error={error}
        />
      </div>

      {hasActiveWork ? (
        /* ═══════════════════════════════════════════════════════
         * Mode B — Active work exists
         * ═══════════════════════════════════════════════════════ */
        <>
          {/* Free-text input — always accessible for ad-hoc asks */}
          <div className="dashboard-section pb-2">
            <FreeTextInput onSubmit={handleFreeTextSubmit} />
          </div>

          {/* Now working on — latest run + output preview + quick actions */}
          <div className="mb-6">
            <NowWorkingOn
              runs={runsResult.runs}
              latestArtifact={latestArtifact}
              onResumeRun={onResumeRun}
            />
          </div>

          {/* Compact recent work list */}
          <div className="dashboard-section">
            <RecentOutputs
              agentId={agentId}
              client={client}
            />
          </div>

          {/* Board summary — compact task counts */}
          <div className="dashboard-section">
            <BoardSummary
              counts={boardSummary.counts}
              isLoading={boardSummary.isLoading}
              isEmpty={boardSummary.isEmpty}
            />
          </div>

          {/* Action cards — secondary in Mode B */}
          <div className="dashboard-section opacity-80">
            <ActionCardGrid
              completedActions={completedActions}
              isLoading={isActionLoading}
              onActionClick={onActionClick}
              onViewResults={onViewResults}
            />
          </div>
        </>
      ) : (
        /* ═══════════════════════════════════════════════════════
         * Mode A — No active work
         * ═══════════════════════════════════════════════════════ */
        <>
          {/* Free-text input — primary entry point, above the fold */}
          <div className="dashboard-section pb-2">
            <FreeTextInput onSubmit={handleFreeTextSubmit} />
          </div>

          {/* Starter actions — secondary launch point */}
          <div className="dashboard-section">
            <ActionCardGrid
              completedActions={completedActions}
              isLoading={isActionLoading}
              onActionClick={onActionClick}
              onViewResults={onViewResults}
            />
          </div>

          {/* AI-suggested actions */}
          <div className="dashboard-section">
            <SuggestedActionGrid
              actions={suggestedActions}
              completedActions={completedActions}
              isGenerating={isSuggestedLoading}
              isActionLoading={isActionLoading}
              onActionClick={onActionClick}
              onViewResults={onViewResults}
            />
          </div>

          {/* Recent outputs — optional, only if outputs exist */}
          <div className="dashboard-section">
            <RecentOutputs
              agentId={agentId}
              client={client}
            />
          </div>
        </>
      )}
    </div>
  );
}
