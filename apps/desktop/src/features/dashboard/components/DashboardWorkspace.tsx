import { LayoutDashboardIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { AgentSession, ArtifactRecord } from "@opengoat/contracts";
import type { SidecarClient } from "@/lib/sidecar/client";
import { resolveDomain, buildFaviconSources } from "@/lib/utils/favicon";
import { getActionMapping } from "@/lib/utils/action-map";
import { useProjectMaturity } from "@/features/dashboard/hooks/useProjectMaturity";
import { usePlaybookLauncher } from "@/features/dashboard/hooks/usePlaybookLauncher";
import { useIntakeForm } from "@/features/dashboard/hooks/useIntakeForm";
import { ContinueWhereYouLeftOff } from "@/features/dashboard/components/ContinueWhereYouLeftOff";
import { CompanyUnderstandingHero } from "@/features/dashboard/components/CompanyUnderstandingHero";
import { DashboardAgentRoster } from "@/features/dashboard/components/DashboardAgentRoster";
import { PlaybookInputForm } from "@/features/dashboard/components/PlaybookInputForm";
import { IntakeFormDialog } from "@/features/dashboard/components/IntakeFormDialog";
import { RecommendedJobs } from "@/features/dashboard/components/RecommendedJobs";
import { JobOrientedInput } from "@/features/dashboard/components/JobOrientedInput";
import { useMeaningfulWork } from "@/features/dashboard/hooks/useMeaningfulWork";
import { RecentOutputs } from "@/features/dashboard/components/RecentOutputs";
import { BoardSummary } from "@/features/dashboard/components/BoardSummary";
import { starterActions } from "@/features/dashboard/data/actions";
import { extractOpportunities } from "@/features/dashboard/data/opportunities";
import { pickBestFirstMove } from "@/features/dashboard/lib/hero-recommendation";
import { useWorkspaceSummary } from "@/features/dashboard/hooks/useWorkspaceSummary";
import { useSuggestedActions } from "@/features/dashboard/hooks/useSuggestedActions";
import { useRecommendedJobs } from "@/features/dashboard/hooks/useRecommendedJobs";
import { useBoardSummary } from "@/features/dashboard/hooks/useBoardSummary";
import { useActionSessions } from "@/features/dashboard/hooks/useActionSessions";
import { useRuns } from "@/features/dashboard/hooks/useRuns";
import { useSpecialistRoster } from "@/features/dashboard/hooks/useSpecialistRoster";

/** Extract sessionId from a contentRef like "session:{id}/message:{id}" */
function parseSessionFromContentRef(ref: string | undefined): string | null {
  if (!ref) return null;
  const match = ref.match(/^session:([^/]+)/);
  return match ? match[1] : null;
}

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
      domain={domain}
      faviconSources={faviconSources}
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
  domain,
  faviconSources,
  onActionClick,
  onViewResults,
  onRunSessionCreated,
  onResumeRun,
}: {
  agentId: string;
  client: SidecarClient;
  domain?: string | undefined;
  faviconSources?: string[] | undefined;
  onActionClick?: ((actionId: string, prompt: string, label: string) => void) | undefined;
  onViewResults?: ((actionId: string) => void) | undefined;
  onRunSessionCreated?: ((session: AgentSession, prompt: string, runId: string, objectiveId?: string) => void) | undefined;
  onResumeRun?: ((sessionId: string) => void) | undefined;
}) {
  const { data, files, isLoading, error } = useWorkspaceSummary(agentId, client);
  const workspaceReady = !isLoading && files !== null;
  const { suggestedActions, isLoading: isSuggestedLoading } = useSuggestedActions(agentId, client, workspaceReady);
  const boardSummary = useBoardSummary(agentId, client);
  const actionSessions = useActionSessions();
  const runsResult = useRuns(agentId, client);
  const specialistRoster = useSpecialistRoster(client);
  const recommendedJobs = useRecommendedJobs(suggestedActions, isSuggestedLoading, specialistRoster.specialists);
  const meaningfulWork = useMeaningfulWork(runsResult.runs, runsResult.isLoading, actionSessions);

  // ── Hero data: opportunities + recommended first move ──
  const opportunities = useMemo(
    () => (files ? extractOpportunities(files) : []),
    [files],
  );
  const heroRecommendation = useMemo(
    () => pickBestFirstMove(opportunities, starterActions, specialistRoster.specialists),
    [opportunities, specialistRoster.specialists],
  );

  // ── Playbook launcher ──
  const playbook = usePlaybookLauncher({
    agentId,
    client,
    starterActions,
    suggestedActions,
    onActionClick,
    onRunSessionCreated,
  });

  // ── Maturity detection: controls section visibility ──
  const maturity = useProjectMaturity(meaningfulWork, runsResult, boardSummary, actionSessions);

  // ── Intake form — intercepts clicks for actions with structured intake fields ──
  const onSubmitAction = useCallback(
    (actionId: string, prompt: string, label: string) => playbook.handleActionOrPlaybookClick(actionId, prompt, label),
    [playbook],
  );
  const intake = useIntakeForm({ suggestedActions, onSubmitAction });

  function handleFreeTextSubmit(text: string) {
    onActionClick?.("free-text", text, text.slice(0, 50));
  }

  function handleSpecialistChat(specialistId: string) {
    window.location.hash = `#chat?specialist=${specialistId}`;
  }

  function handleOutputNavigate(artifact: ArtifactRecord) {
    if (artifact.runId) {
      const sessionId = getActionMapping(artifact.runId);
      if (sessionId) { onResumeRun?.(sessionId); return; }
    }
    const refSessionId = parseSessionFromContentRef(artifact.contentRef);
    if (refSessionId) { onResumeRun?.(refSessionId); return; }
    if (artifact.createdBy) {
      window.location.hash = `#chat?specialist=${encodeURIComponent(artifact.createdBy)}`;
      return;
    }
    window.location.hash = "#chat";
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-5 lg:p-6">
      <div className="mx-auto w-full max-w-[1000px]">
      {/* 1. Company Understanding Strip */}
      <CompanyUnderstandingHero
        domain={domain}
        faviconSources={faviconSources}
        data={data}
        isLoading={isLoading}
        error={error}
      />

      {/* 2. Recommended starting jobs */}
      <div className="dashboard-section">
        <RecommendedJobs
          jobs={recommendedJobs.jobs}
          isLoading={recommendedJobs.isLoading}
          onActionClick={intake.handleJobCardClick}
        />
      </div>

      {/* 2.5 Job-oriented free input */}
      <div className="dashboard-section">
        <JobOrientedInput onSubmit={handleFreeTextSubmit} />
      </div>

      {/* 3. Specialist roster */}
      {!specialistRoster.isLoading && specialistRoster.specialists.length > 0 && (
        <div className="dashboard-section">
          <DashboardAgentRoster
            specialists={specialistRoster.specialists}
            onChat={handleSpecialistChat}
          />
        </div>
      )}

      {/* 4. Recent outputs — self-manages empty state with gallery */}
      <RecentOutputs
        agentId={agentId}
        client={client}
        onNavigate={handleOutputNavigate}
        onSpecialistChat={handleSpecialistChat}
      />

      {/* 5. Continue where you left off — demoted, hides when empty */}
      <ContinueWhereYouLeftOff
        items={meaningfulWork.items}
        maturity={maturity}
        onContinue={onResumeRun}
        onViewResults={onViewResults}
      />

      {/* 6. Board summary — hidden for new projects */}
      {maturity !== "new" && !boardSummary.isLoading && !boardSummary.isEmpty && (
        <div className="dashboard-section">
          <BoardSummary
            counts={boardSummary.counts}
            isLoading={boardSummary.isLoading}
            isEmpty={boardSummary.isEmpty}
          />
        </div>
      )}
      </div>

      {/* Playbook input form dialog */}
      {playbook.pendingPlaybook && (
        <PlaybookInputForm
          open={playbook.playbookFormOpen}
          onOpenChange={(open) => {
            if (!open) playbook.closePlaybookForm();
          }}
          playbookTitle={playbook.pendingPlaybook.title}
          requiredInputs={playbook.pendingPlaybook.requiredInputs}
          optionalInputs={playbook.pendingPlaybook.optionalInputs}
          isSubmitting={playbook.isPlaybookStarting}
          onSubmit={playbook.handlePlaybookFormSubmit}
        />
      )}

      {/* Structured intake form dialog */}
      {intake.pendingIntakeFields && intake.pendingIntakeAction && (
        <IntakeFormDialog
          open={intake.intakeFormOpen}
          onOpenChange={(open) => { if (!open) intake.closeIntakeForm(); }}
          actionTitle={intake.pendingIntakeAction.title}
          outputType={intake.pendingIntakeAction.outputType}
          specialistName={intake.pendingIntakeAction.specialistId}
          fields={intake.pendingIntakeFields}
          companyData={data}
          onSubmit={intake.handleIntakeFormSubmit}
        />
      )}
    </div>
  );
}
