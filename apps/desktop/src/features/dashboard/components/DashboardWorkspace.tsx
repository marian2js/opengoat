import { useState } from "react";
import { LayoutDashboardIcon } from "lucide-react";
import type { AgentSession, PlaybookManifest } from "@opengoat/contracts";
import type { SidecarClient } from "@/lib/sidecar/client";
import { useStartPlaybookRun } from "@/features/dashboard/hooks/useStartPlaybookRun";
import { resolveDomain, buildFaviconSources } from "@/lib/utils/favicon";
import { ActionCardGrid } from "@/features/dashboard/components/ActionCardGrid";
import { CompanySummary } from "@/features/dashboard/components/CompanySummary";
import { OpportunitySection } from "@/features/dashboard/components/OpportunitySection";
import { PlaybookLibrary } from "@/features/dashboard/components/PlaybookLibrary";
import { SuggestedActionGrid } from "@/features/dashboard/components/SuggestedActionGrid";
import { ActiveObjectiveSection } from "@/features/dashboard/components/ActiveObjectiveSection";
import { ObjectiveComposerPrompt } from "@/features/dashboard/components/ObjectiveComposerPrompt";
import { ObjectiveCreationSheet } from "@/features/dashboard/components/ObjectiveCreationSheet";
import { useWorkspaceSummary } from "@/features/dashboard/hooks/useWorkspaceSummary";
import { useSuggestedActions } from "@/features/dashboard/hooks/useSuggestedActions";
import { useBoardSummary } from "@/features/dashboard/hooks/useBoardSummary";
import { useActiveObjective } from "@/features/dashboard/hooks/useActiveObjective";
import { usePlaybooks } from "@/features/dashboard/hooks/usePlaybooks";
import { useRuns } from "@/features/dashboard/hooks/useRuns";
import { BoardSummary } from "@/features/dashboard/components/BoardSummary";
import { WorkInProgress } from "@/features/dashboard/components/WorkInProgress";

export interface DashboardWorkspaceProps {
  agent?: { id: string; name: string; description?: string | undefined } | undefined;
  agentId?: string | undefined;
  client: SidecarClient | null;
  completedActions?: Set<string> | undefined;
  isActionLoading?: boolean | undefined;
  onActionClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
  onViewResults?: ((actionId: string) => void) | undefined;
  onRunSessionCreated?: (session: AgentSession, prompt: string, runId: string) => void;
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
  onRunSessionCreated,
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
      onRunSessionCreated={onRunSessionCreated}
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
  onRunSessionCreated,
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
  onRunSessionCreated?: ((session: AgentSession, prompt: string, runId: string) => void) | undefined;
  onResumeRun?: ((sessionId: string) => void) | undefined;
}) {
  const { data, files, isLoading, error } = useWorkspaceSummary(agentId, client);
  const workspaceReady = !isLoading && files !== null;
  const { suggestedActions, isLoading: isSuggestedLoading } = useSuggestedActions(agentId, client, workspaceReady);
  const boardSummary = useBoardSummary(agentId, client);
  const activeObjective = useActiveObjective(agentId, client);
  const { playbooks, isLoading: isPlaybooksLoading } = usePlaybooks(client);
  const runsResult = useRuns(agentId, client);

  // Playbook run creation
  const noopSessionCreated = (_s: AgentSession, _p: string, _r: string) => {};
  const { startRun, isStarting: isStartingPlaybook } = useStartPlaybookRun({
    client,
    activeAgentId: agentId,
    activeObjectiveId: activeObjective.objective?.objectiveId,
    projectId: agentId,
    onSessionCreated: onRunSessionCreated ?? noopSessionCreated,
  });

  // Sheet open state and prefill
  const [isCreationOpen, setIsCreationOpen] = useState(false);
  const [prefillTitle, setPrefillTitle] = useState<string | undefined>(undefined);

  function handleCreateObjective(title?: string): void {
    setPrefillTitle(title);
    setIsCreationOpen(true);
  }

  function handleObjectiveCreated(): void {
    activeObjective.refetch();
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-5 lg:p-6">
      {/* ── Header area: Objective + Company context ── */}
      <div className="mb-8">
        {activeObjective.isLoading ? (
          <ActiveObjectiveSection
            objective={{
              objectiveId: "",
              projectId: agentId,
              title: "",
              status: "draft",
              createdFrom: "dashboard",
              createdAt: "",
              updatedAt: "",
            }}
            isLoading
            openTaskCount={0}
          />
        ) : activeObjective.objective ? (
          <ActiveObjectiveSection
            objective={activeObjective.objective}
            isLoading={false}
            openTaskCount={boardSummary.counts.open}
            onOpenObjective={() => {
              // Placeholder — objective detail page (task 0006)
            }}
            onSwitchObjective={() => handleCreateObjective()}
          />
        ) : (
          <ObjectiveComposerPrompt
            onCreateObjective={handleCreateObjective}
          />
        )}
      </div>

      <div className="mb-8 border-b border-border/20 pb-5">
        <CompanySummary
          data={data}
          domain={domain}
          faviconSources={faviconSources}
          isLoading={isLoading}
          error={error}
        />
      </div>

      {/* ── Playbook Library ── */}
      <div className="mb-2">
        <PlaybookLibrary
          playbooks={playbooks}
          isLoading={isPlaybooksLoading}
          onStartPlaybook={activeObjective.objective ? startRun : undefined}
          isStartingPlaybook={isStartingPlaybook}
        />
      </div>

      {/* ── Quick Actions — section divider ── */}
      <div className="dashboard-section">
        <ActionCardGrid
          completedActions={completedActions}
          isLoading={isActionLoading}
          onActionClick={onActionClick}
          onViewResults={onViewResults}
        />
      </div>

      {/* ── Suggested Actions — section divider (hidden when empty) ── */}
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

      {/* ── Work in Progress — active runs ── */}
      {(!runsResult.isEmpty || runsResult.isLoading) && (
        <div className="dashboard-section">
          <WorkInProgress
            runs={runsResult.runs}
            isLoading={runsResult.isLoading}
            isEmpty={runsResult.isEmpty}
            onResumeRun={onResumeRun}
          />
        </div>
      )}

      {/* ── Board summary — section divider ── */}
      <div className="dashboard-section">
        <BoardSummary
          counts={boardSummary.counts}
          isLoading={boardSummary.isLoading}
          isEmpty={boardSummary.isEmpty}
        />
      </div>

      {/* ── Insights — section divider + background tint ── */}
      <div className="dashboard-section">
        <OpportunitySection
          completedActions={completedActions}
          files={files}
          isLoading={isLoading}
          onActionClick={onActionClick}
          onViewResults={onViewResults}
        />
      </div>

      {/* Objective Creation Sheet — portaled */}
      <ObjectiveCreationSheet
        open={isCreationOpen}
        onOpenChange={setIsCreationOpen}
        agentId={agentId}
        client={client}
        prefillTitle={prefillTitle}
        onObjectiveCreated={handleObjectiveCreated}
      />
    </div>
  );
}
