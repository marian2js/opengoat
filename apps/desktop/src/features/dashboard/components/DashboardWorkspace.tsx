import { LayoutDashboardIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { AgentSession, ArtifactRecord, PlaybookManifest } from "@opengoat/contracts";
import type { SidecarClient } from "@/lib/sidecar/client";
import { resolveDomain, buildFaviconSources } from "@/lib/utils/favicon";
import { getActionMapping } from "@/lib/utils/action-map";
import { ActionCardGrid } from "@/features/dashboard/components/ActionCardGrid";
import { ActiveWorkSection } from "@/features/dashboard/components/ActiveWorkSection";
import { CompanyUnderstandingHero } from "@/features/dashboard/components/CompanyUnderstandingHero";
import { DashboardAgentRoster } from "@/features/dashboard/components/DashboardAgentRoster";
import { PlaybookInputForm } from "@/features/dashboard/components/PlaybookInputForm";
import { RecommendedJobs } from "@/features/dashboard/components/RecommendedJobs";
import { NowWorkingOn, NowWorkingOnSkeleton } from "@/features/dashboard/components/NowWorkingOn";
import { RecentOutputs } from "@/features/dashboard/components/RecentOutputs";
import { BoardSummary } from "@/features/dashboard/components/BoardSummary";
import { starterActions } from "@/features/dashboard/data/actions";
import { extractOpportunities } from "@/features/dashboard/data/opportunities";
import { buildRunPrompt } from "@/features/dashboard/lib/run-prompt-composer";
import { pickBestFirstMove } from "@/features/dashboard/lib/hero-recommendation";
import { useWorkspaceSummary } from "@/features/dashboard/hooks/useWorkspaceSummary";
import { useSuggestedActions } from "@/features/dashboard/hooks/useSuggestedActions";
import { useRecommendedJobs } from "@/features/dashboard/hooks/useRecommendedJobs";
import { useBoardSummary } from "@/features/dashboard/hooks/useBoardSummary";
import { useActiveObjective } from "@/features/dashboard/hooks/useActiveObjective";
import { useActionSessions } from "@/features/dashboard/hooks/useActionSessions";
import { useRuns } from "@/features/dashboard/hooks/useRuns";
import { useRecentArtifacts } from "@/features/dashboard/hooks/useRecentArtifacts";
import { useSpecialistRoster } from "@/features/dashboard/hooks/useSpecialistRoster";
import { truncateSessionLabel } from "@/lib/utils/session-label";
import { toast } from "sonner";

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
  onRunSessionCreated?: ((session: AgentSession, prompt: string, runId: string, objectiveId?: string) => void) | undefined;
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
  const recommendedJobs = useRecommendedJobs(suggestedActions, isSuggestedLoading, specialistRoster.specialists);

  // ── Hero data: opportunities + recommended first move ──
  const opportunities = useMemo(
    () => (files ? extractOpportunities(files) : []),
    [files],
  );
  const heroRecommendation = useMemo(
    () => pickBestFirstMove(opportunities, starterActions, specialistRoster.specialists),
    [opportunities, specialistRoster.specialists],
  );

  // ── Playbook launch state ──
  const [playbookFormOpen, setPlaybookFormOpen] = useState(false);
  const [pendingPlaybook, setPendingPlaybook] = useState<PlaybookManifest | null>(null);
  const [pendingActionLabel, setPendingActionLabel] = useState<string>("");
  const [isPlaybookStarting, setIsPlaybookStarting] = useState(false);

  /**
   * Full playbook launch: create objective → start playbook → create session → navigate
   */
  const launchPlaybook = useCallback(
    async (manifest: PlaybookManifest, inputs: Record<string, string>, actionLabel: string) => {
      if (!onRunSessionCreated) return;
      setIsPlaybookStarting(true);
      try {
        // Build objective title from inputs or playbook title
        const inputSummary = Object.values(inputs).filter(Boolean).join(" — ");
        const objectiveTitle = inputSummary
          ? `${manifest.title}: ${inputSummary.slice(0, 80)}`
          : manifest.title;

        // 1. Auto-create objective
        const objective = await client.createObjective({
          projectId: agentId,
          title: objectiveTitle,
          summary: `Auto-created from dashboard action: ${actionLabel}`,
        });

        const objectiveId = (objective as Record<string, unknown>).objectiveId as string;

        // 2. Start playbook via API (creates run)
        const run = await client.startPlaybook(manifest.playbookId, {
          projectId: agentId,
          objectiveId,
        });

        // 3. Create agent session (label truncated to avoid gateway 500)
        const session = await client.createSession({
          agentId,
          label: truncateSessionLabel(objectiveTitle),
        });

        // 4. Compose structured prompt with playbook + objective context
        const composedPrompt = buildRunPrompt({
          playbook: manifest,
          objective: { title: objectiveTitle, summary: inputSummary || undefined },
          phaseName: run.phase,
        });

        // Prepend user inputs to prompt for context
        let finalPrompt = composedPrompt;
        if (Object.keys(inputs).length > 0) {
          const inputBlock = Object.entries(inputs)
            .filter(([, v]) => v.trim())
            .map(([k, v]) => `- **${k}**: ${v}`)
            .join("\n");
          finalPrompt = `## User Inputs\n${inputBlock}\n\n${composedPrompt}`;
        }

        // 5. Callback — App.tsx handles state + navigation
        onRunSessionCreated(session, finalPrompt, run.runId, objectiveId);
        setPlaybookFormOpen(false);
      } catch (err) {
        console.error("Failed to launch playbook", err);
        toast.error("Failed to start playbook. Please try again.");
      } finally {
        setIsPlaybookStarting(false);
      }
    },
    [agentId, client, onRunSessionCreated],
  );

  /**
   * Intercepts action clicks: if the action has a playbookId, fetch manifest and show input form.
   * Otherwise, fall through to the normal action handler.
   */
  const handleActionOrPlaybookClick = useCallback(
    async (actionId: string, prompt: string, label: string) => {
      // Find the action card to check for playbookId
      const allActions = [...starterActions, ...suggestedActions];
      const card = allActions.find((a) => a.id === actionId);
      const playbookId = card?.playbookId;

      if (!playbookId || !onRunSessionCreated) {
        // No playbook — use existing generic action flow
        onActionClick?.(actionId, prompt, label);
        return;
      }

      try {
        const manifest = await client.getPlaybook(playbookId);
        const hasRequiredInputs = manifest.requiredInputs.length > 0;

        if (hasRequiredInputs) {
          // Show the input form
          setPendingPlaybook(manifest);
          setPendingActionLabel(label);
          setPlaybookFormOpen(true);
        } else {
          // No inputs needed — launch immediately
          await launchPlaybook(manifest, {}, label);
        }
      } catch (err) {
        console.error("Failed to fetch playbook manifest", err);
        // Fallback to generic action flow
        onActionClick?.(actionId, prompt, label);
      }
    },
    [client, suggestedActions, onActionClick, onRunSessionCreated, launchPlaybook],
  );

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

  // Free-text submit handler — routes to chat via onActionClick (bypasses playbook check)
  function handleFreeTextSubmit(text: string) {
    onActionClick?.("free-text", text, text.slice(0, 50));
  }

  // Playbook input form submit handler
  function handlePlaybookFormSubmit(inputs: Record<string, string>) {
    if (pendingPlaybook) {
      void launchPlaybook(pendingPlaybook, inputs, pendingActionLabel);
    }
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

    // Fallback: parse sessionId from contentRef (format: "session:{id}/message:{id}")
    const refSessionId = parseSessionFromContentRef(artifact.contentRef);
    if (refSessionId) {
      onResumeRun?.(refSessionId);
      return;
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
      {/* ── Hero area — company understanding + opportunities + CMO input ── */}
      <CompanyUnderstandingHero
        domain={domain}
        faviconSources={faviconSources}
        data={data}
        opportunities={opportunities}
        recommendation={heroRecommendation}
        isLoading={isLoading}
        error={error}
        onFreeTextSubmit={handleFreeTextSubmit}
        onActionClick={(actionId) => {
          const action = starterActions.find((a) => a.id === actionId);
          if (action) {
            void handleActionOrPlaybookClick(actionId, action.prompt, action.title);
          }
        }}
      />

      {/* Active work — always rendered, component self-manages visibility */}
      <ActiveWorkSection onContinueSession={onResumeRun} onViewResults={onViewResults} />

      {hasActiveWork ? (
        /* ═══════════════════════════════════════════════════════
         * Mode B — Active work exists
         * ═══════════════════════════════════════════════════════ */
        <>
          {/* Recommended jobs — lighter treatment in Mode B */}
          <div className="dashboard-section">
            <RecommendedJobs
              jobs={recommendedJobs.jobs}
              isLoading={recommendedJobs.isLoading}
              onActionClick={(id, prompt, label) => { void handleActionOrPlaybookClick(id, prompt, label); }}
            />
          </div>

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
            onSpecialistChat={handleSpecialistChat}
          />

          {/* Action cards — secondary in Mode B */}
          <div className="dashboard-section">
            <ActionCardGrid
              completedActions={completedActions}
              isLoading={isActionLoading}
              specialists={specialistRoster.specialists}
              onActionClick={(id, prompt, label) => { void handleActionOrPlaybookClick(id, prompt, label); }}
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
          {/* Recommended starting jobs — curated top 3-5 */}
          <div className="dashboard-section">
            <RecommendedJobs
              jobs={recommendedJobs.jobs}
              isLoading={recommendedJobs.isLoading}
              onActionClick={(id, prompt, label) => { void handleActionOrPlaybookClick(id, prompt, label); }}
            />
          </div>

          {/* Agent Roster — prominent in Mode A */}
          {!specialistRoster.isLoading && specialistRoster.specialists.length > 0 && (
            <div className="dashboard-section">
              <DashboardAgentRoster
                specialists={specialistRoster.specialists}
                onChat={handleSpecialistChat}
              />
            </div>
          )}

          {/* Starter actions — full list with specialist attribution */}
          <div className="dashboard-section">
            <ActionCardGrid
              completedActions={completedActions}
              isLoading={isActionLoading}
              specialists={specialistRoster.specialists}
              onActionClick={(id, prompt, label) => { void handleActionOrPlaybookClick(id, prompt, label); }}
              onViewResults={onViewResults}
            />
          </div>

          {/* Recent outputs — optional, only if outputs exist */}
          <RecentOutputs
            agentId={agentId}
            client={client}
            onNavigate={handleOutputNavigate}
            onSpecialistChat={handleSpecialistChat}
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

      {/* Playbook input form dialog */}
      {pendingPlaybook && (
        <PlaybookInputForm
          open={playbookFormOpen}
          onOpenChange={(open) => {
            setPlaybookFormOpen(open);
            if (!open) {
              setPendingPlaybook(null);
              setPendingActionLabel("");
            }
          }}
          playbookTitle={pendingPlaybook.title}
          requiredInputs={pendingPlaybook.requiredInputs}
          optionalInputs={pendingPlaybook.optionalInputs}
          isSubmitting={isPlaybookStarting}
          onSubmit={handlePlaybookFormSubmit}
        />
      )}
    </div>
  );
}
