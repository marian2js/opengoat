import { LayoutDashboardIcon } from "lucide-react";
import type { AgentSession, ArtifactRecord } from "@opengoat/contracts";
import type { SidecarClient } from "@/lib/sidecar/client";
import { resolveDomain, buildFaviconSources } from "@/lib/utils/favicon";
import { getActionMapping } from "@/lib/utils/action-map";
import { ActionCardGrid } from "@/features/dashboard/components/ActionCardGrid";
import { ActiveWorkSection } from "@/features/dashboard/components/ActiveWorkSection";
import { CompanySummary } from "@/features/dashboard/components/CompanySummary";
import { DashboardAgentRoster } from "@/features/dashboard/components/DashboardAgentRoster";
import { SuggestedActionGrid } from "@/features/dashboard/components/SuggestedActionGrid";
import { FreeTextInput } from "@/features/dashboard/components/FreeTextInput";
import { NowWorkingOn, NowWorkingOnSkeleton } from "@/features/dashboard/components/NowWorkingOn";
import { RecentOutputs } from "@/features/dashboard/components/RecentOutputs";
import { BoardSummary } from "@/features/dashboard/components/BoardSummary";
import { useWorkspaceSummary } from "@/features/dashboard/hooks/useWorkspaceSummary";
import { useSuggestedActions } from "@/features/dashboard/hooks/useSuggestedActions";
import { useBoardSummary } from "@/features/dashboard/hooks/useBoardSummary";
import { useActiveObjective } from "@/features/dashboard/hooks/useActiveObjective";
import { useActionSessions } from "@/features/dashboard/hooks/useActionSessions";
import { useRuns } from "@/features/dashboard/hooks/useRuns";
import { useRecentArtifacts } from "@/features/dashboard/hooks/useRecentArtifacts";
import { useSpecialistRoster } from "@/features/dashboard/hooks/useSpecialistRoster";

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
  const actionSessions = useActionSessions();
  const runsResult = useRuns(agentId, client);
  const recentArtifacts = useRecentArtifacts(agentId, client);
  const specialistRoster = useSpecialistRoster(client);

  // Mode detection: Mode B when active work exists (action sessions OR API runs/objectives)
  const hasActiveWork =
    actionSessions.hasActiveWork ||
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

  // Specialist chat handler — navigates to chat with specialist context
  function handleSpecialistChat(specialistId: string) {
    window.location.hash = `#chat?specialist=${specialistId}`;
  }

  // Navigate to the session that produced an artifact output
  function handleOutputNavigate(artifact: ArtifactRecord) {
    // Try to find the session via the run ID mapping
    if (artifact.runId) {
      const sessionId = getActionMapping(artifact.runId);
      if (sessionId) {
        onResumeRun?.(sessionId);
        return;
      }
    }

    // Fallback: navigate to specialist chat if createdBy matches a specialist
    if (artifact.createdBy) {
      window.location.hash = `#chat?specialist=${encodeURIComponent(artifact.createdBy)}`;
      return;
    }

    // Last resort: go to general chat
    window.location.hash = "#chat";
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-5 lg:p-6">
      <div className="mx-auto w-full max-w-[1000px]">
      {/* ── Hero area — company context + free-text input ── */}
      <div className="mb-8 pb-6 border-b border-border/30 dark:border-white/[0.04]">
        <div className="mb-5">
          <CompanySummary
            data={data}
            domain={domain}
            faviconSources={faviconSources}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* Free-text input — always the primary entry point */}
        <FreeTextInput onSubmit={handleFreeTextSubmit} />
      </div>

      {/* Active work — always rendered, component self-manages visibility */}
      <ActiveWorkSection onContinueSession={onResumeRun} onViewResults={onViewResults} />

      {hasActiveWork ? (
        /* ═══════════════════════════════════════════════════════
         * Mode B — Active work exists
         * ═══════════════════════════════════════════════════════ */
        <>
          {/* Now working on — latest run + output preview + quick actions */}
          {runsResult.isLoading ? (
            <div className="dashboard-section pb-4">
              <NowWorkingOnSkeleton />
            </div>
          ) : runsResult.runs.length > 0 ? (
            <div className="dashboard-section pb-4">
              <NowWorkingOn
                runs={runsResult.runs}
                latestArtifact={latestArtifact}
                onResumeRun={onResumeRun}
              />
            </div>
          ) : null}

          {/* Agent Roster — compact in Mode B */}
          {!specialistRoster.isLoading && specialistRoster.specialists.length > 0 && (
            <div className="dashboard-section">
              <DashboardAgentRoster
                specialists={specialistRoster.specialists}
                onChat={handleSpecialistChat}
              />
            </div>
          )}

          {/* Compact recent work list */}
          <RecentOutputs
            agentId={agentId}
            client={client}
            onNavigate={handleOutputNavigate}
          />

          {/* Action cards — secondary in Mode B */}
          <div className="dashboard-section">
            <ActionCardGrid
              completedActions={completedActions}
              isLoading={isActionLoading}
              specialists={specialistRoster.specialists}
              onActionClick={onActionClick}
              onViewResults={onViewResults}
            />
          </div>

          {/* Board summary — bottom, only if tasks exist */}
          {!boardSummary.isLoading && !boardSummary.isEmpty && (
            <div className="dashboard-section">
              <BoardSummary
                counts={boardSummary.counts}
                isLoading={boardSummary.isLoading}
                isEmpty={boardSummary.isEmpty}
              />
            </div>
          )}
        </>
      ) : (
        /* ═══════════════════════════════════════════════════════
         * Mode A — No active work
         * ═══════════════════════════════════════════════════════ */
        <>
          {/* Agent Roster — prominent in Mode A */}
          {!specialistRoster.isLoading && specialistRoster.specialists.length > 0 && (
            <div className="dashboard-section">
              <DashboardAgentRoster
                specialists={specialistRoster.specialists}
                onChat={handleSpecialistChat}
              />
            </div>
          )}

          {/* Starter actions — with specialist attribution */}
          <div className="dashboard-section">
            <ActionCardGrid
              completedActions={completedActions}
              isLoading={isActionLoading}
              specialists={specialistRoster.specialists}
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
          <RecentOutputs
            agentId={agentId}
            client={client}
            onNavigate={handleOutputNavigate}
          />

          {/* Board summary — bottom, only if tasks exist */}
          {!boardSummary.isLoading && !boardSummary.isEmpty && (
            <div className="dashboard-section">
              <BoardSummary
                counts={boardSummary.counts}
                isLoading={boardSummary.isLoading}
                isEmpty={boardSummary.isEmpty}
              />
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
