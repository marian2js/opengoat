import { type AgentCatalog, type AgentSession, type AuthOverview, type PlaybookManifest } from "@opengoat/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/app/shell/AppHeader";
import { AppSidebar } from "@/app/shell/AppSidebar";
import { SpecialistTeamBrowser } from "@/features/agents/components/SpecialistTeamBrowser";
import { ChatWorkspace, evictChatSession, isActionSession, markActionSession } from "@/features/chat/components/ChatWorkspace";
import type { ChatScope } from "@/features/chat/lib/chat-scope";
import { ActionSessionView } from "@/features/action-session/components/ActionSessionView";
import {
  persistActionContext,
  clearPersistedActionContext,
} from "@/features/action-session/lib/action-session-persistence";
import { setActionSessionMeta } from "@/features/action-session/lib/action-session-state";
import { ConnectionsWorkspace } from "@/features/connections/components/ConnectionsWorkspace";
import { AddProjectDialog } from "@/features/onboarding/components/AddProjectDialog";
import { BootstrapProgress } from "@/features/onboarding/components/BootstrapProgress";
import { ConnectionCenter } from "@/features/onboarding/components/ConnectionCenter";
import { BrainWorkspace } from "@/features/brain/components/BrainWorkspace";
import { BoardWorkspace } from "@/features/board/components/BoardWorkspace";
import { DashboardWorkspace } from "@/features/dashboard/components/DashboardWorkspace";
import { ObjectiveWorkspace } from "@/features/objectives/components/ObjectiveWorkspace";
import { ProjectSettings } from "@/features/settings/components/ProjectSettings";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { initializeSidecarConnection } from "@/lib/runtime/connection";
import { SidecarClient } from "@/lib/sidecar/client";
import { toast } from "sonner";
import { deduplicateLabel } from "@/lib/utils/deduplicate-label";
import { getActionMapping, getCompletedActionIds, setActionMapping } from "@/lib/utils/action-map";
import {
  buildRefineContextPrompt,
  buildRefineContextLabel,
  buildRefineContextActionId,
} from "@/features/brain/lib/refine-context-prompt";
type AppView = "dashboard" | "connections" | "connections-add" | "chat" | "action-session" | "brain" | "agents" | "settings" | "board" | "objective";

const ACTIVE_AGENT_KEY = "opengoat:activeAgentId";

function resolveActiveAgentId(
  catalog: AgentCatalog | null,
  preferredId?: string,
): string | undefined {
  if (!catalog || catalog.agents.length === 0) {
    return undefined;
  }
  if (preferredId && catalog.agents.some((a) => a.id === preferredId)) {
    return preferredId;
  }
  const defaultAgent = catalog.agents.find((a) => a.isDefault);
  return defaultAgent?.id ?? catalog.agents[0]?.id;
}

export function App() {
  const [authOverview, setAuthOverview] = useState<AuthOverview | null>(null);
  const [agentCatalog, setAgentCatalog] = useState<AgentCatalog | null>(null);
  const [client, setClient] = useState<SidecarClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [hashView, setHashView] = useState<AppView>(() => readViewFromHash());
  const [brainSection, setBrainSection] = useState<string>(() => readBrainSectionFromHash());
  const [objectiveId, setObjectiveId] = useState<string | undefined>(() => readObjectiveIdFromHash());
  const [objectiveTab, setObjectiveTab] = useState<string | undefined>(() => readObjectiveTabFromHash());
  const [retryToken, setRetryToken] = useState(0);
  const [createAgentToken, setCreateAgentToken] = useState(0);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(
    () => localStorage.getItem(ACTIVE_AGENT_KEY) ?? undefined,
  );
  const [bootstrapContext, setBootstrapContext] = useState<{
    agentId: string;
    projectUrl: string;
  } | null>(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [returnFromConnectionsHash, setReturnFromConnectionsHash] = useState("#chat");
  const [pendingActionPrompt, setPendingActionPrompt] = useState<string | null>(null);
  const [actionSessionId, setActionSessionId] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [completedActions, setCompletedActions] = useState<Set<string>>(() => getCompletedActionIds());
  const [pendingChatScope, setPendingChatScope] = useState<ChatScope | null>(null);
  const [pendingActionTitle, setPendingActionTitle] = useState<string | null>(null);

  const activeAgentId = resolveActiveAgentId(agentCatalog, selectedAgentId);
  const activeAgent = agentCatalog?.agents.find((a) => a.id === activeAgentId);

  // Persist active agent to localStorage
  useEffect(() => {
    if (activeAgentId) {
      localStorage.setItem(ACTIVE_AGENT_KEY, activeAgentId);
    }
  }, [activeAgentId]);

  // Track previous agent to detect switches
  const prevAgentIdRef = useRef(activeAgentId);
  useEffect(() => {
    const prevId = prevAgentIdRef.current;
    prevAgentIdRef.current = activeAgentId;

    if (prevId && activeAgentId && prevId !== activeAgentId && client) {
      // Agent switched — clear stale sessions and reload
      setSessions([]);
      setActiveSessionId(undefined);
      void client.listSessions(activeAgentId).then(
        (result) => setSessions(result.sessions),
        () => {},
      );
    }
  }, [activeAgentId, client]);

  useEffect(() => {
    let isMounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function hydrateFromSidecar(attempt = 0): Promise<void> {
      if (isMounted && attempt === 0) {
        setIsLoading(true);
        setRuntimeError(null);
      }

      try {
        const connection = await initializeSidecarConnection();
        const client = SidecarClient.fromConnection(connection);
        const [overview, catalog] = await Promise.all([
          client.authOverview(),
          client.agentCatalog(),
        ]);

        const agentId = resolveActiveAgentId(catalog, selectedAgentId);
        const sessionList = agentId
          ? await client.listSessions(agentId).catch(() => ({ sessions: [] }))
          : { sessions: [] };

        // Check whether the active agent's bootstrap files exist.
        // If any are missing the project setup never completed and we
        // must re-enter bootstrap instead of showing the chat workspace.
        let pendingBootstrap: { agentId: string; projectUrl: string } | null = null;
        if (agentId) {
          const agent = catalog.agents.find((a) => a.id === agentId);
          const projectUrl = agent?.description?.trim();
          if (projectUrl) {
            const requiredFiles = ["PRODUCT.md", "MARKET.md", "GROWTH.md"];
            const checks = await Promise.all(
              requiredFiles.map((file) =>
                client.checkWorkspaceFile(agentId, file).catch(() => ({ exists: false })),
              ),
            );
            if (checks.some((c) => !c.exists)) {
              pendingBootstrap = { agentId, projectUrl };
            }
          }
        }

        if (isMounted) {
          setAuthOverview(overview);
          setAgentCatalog(catalog);
          setClient(client);
          setSessions(sessionList.sessions);
          if (pendingBootstrap) {
            setBootstrapContext(pendingBootstrap);
          }
          setRuntimeError(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to initialize desktop runtime", error);
        const maxRetries = 5;
        if (isMounted && attempt < maxRetries) {
          const delay = Math.min(1000 * 2 ** attempt, 8000);
          retryTimer = setTimeout(() => void hydrateFromSidecar(attempt + 1), delay);
        } else if (isMounted) {
          setAuthOverview(null);
          setAgentCatalog(null);
          setClient(null);
          setRuntimeError(error instanceof Error ? error.message : "Load failed");
          setIsLoading(false);
        }
      }
    }

    void hydrateFromSidecar();

    return () => {
      isMounted = false;
      clearTimeout(retryTimer);
    };
  }, [retryToken, selectedAgentId]);

  const refreshSessions = useCallback(async () => {
    if (!client || !activeAgentId) {
      return;
    }
    try {
      const sessionList = await client.listSessions(activeAgentId);
      setSessions(sessionList.sessions);
    } catch {
      // Silently ignore — sessions will refresh on next hydration
    }
  }, [client, activeAgentId]);

  // Use refs to track bootstrapContext and refreshSessions inside the
  // hashchange listener so the closure always sees the latest values.
  const bootstrapContextRef = useRef(bootstrapContext);
  bootstrapContextRef.current = bootstrapContext;

  const refreshSessionsRef = useRef(refreshSessions);
  refreshSessionsRef.current = refreshSessions;

  useEffect(() => {
    const onHashChange = (): void => {
      const newView = readViewFromHash();
      setHashView(newView);
      setBrainSection(readBrainSectionFromHash());
      setObjectiveId(readObjectiveIdFromHash());
      setObjectiveTab(readObjectiveTabFromHash());

      // If the user explicitly navigates while bootstrap is showing,
      // clear the bootstrap context so they aren't trapped.
      if (bootstrapContextRef.current) {
        setBootstrapContext(null);
        void refreshSessionsRef.current();
      }
    };

    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  const handleNewChat = useCallback(async () => {
    if (!client || !activeAgentId) {
      return;
    }
    try {
      const session = await client.createSession({ agentId: activeAgentId });
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      window.location.hash = "#chat";
    } catch (error) {
      console.error("Failed to create new chat session", error);
      toast.error("Failed to create chat. Please try again.");
    }
  }, [client, activeAgentId]);

  const handleActionClick = useCallback(
    async (actionId: string, prompt: string, label: string) => {
      if (!client || !activeAgentId || isActionLoading) {
        return;
      }
      setIsActionLoading(true);
      try {
        const uniqueLabel = deduplicateLabel(label, sessions);
        const session = await client.createSession({ agentId: activeAgentId, label: uniqueLabel });
        markActionSession(session.id);
        setActionMapping(actionId, session.id);
        setCompletedActions(getCompletedActionIds());
        setSessions((prev) => [session, ...prev]);
        setActiveSessionId(session.id);
        setPendingActionPrompt(prompt);
        setActionSessionId(session.id);
        setPendingActionTitle(label);
        setActionSessionMeta(session.id, {
          actionId,
          actionTitle: label,
          state: "starting",
          savedToBoard: false,
          startedAt: Date.now(),
        });
        // Persist to sessionStorage so action survives HMR / page reload
        persistActionContext(prompt, session.id, label);
        window.location.hash = "#action-session";
      } catch (error) {
        console.error("Failed to create action session", error);
        toast.error("Something went wrong. Please try again.");
      } finally {
        setIsActionLoading(false);
      }
    },
    [client, activeAgentId, isActionLoading, sessions],
  );

  const handleRefineContext = useCallback(
    (sectionId: string) => {
      const actionId = buildRefineContextActionId(sectionId);
      const prompt = buildRefineContextPrompt(sectionId);
      const label = buildRefineContextLabel(sectionId);
      void handleActionClick(actionId, prompt, label);
    },
    [handleActionClick],
  );

  const handleRunSessionCreated = useCallback(
    (session: AgentSession, prompt: string, runId: string, objectiveId?: string) => {
      markActionSession(session.id);
      setActionMapping(runId, session.id);
      setCompletedActions(getCompletedActionIds());
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      setPendingActionPrompt(prompt);
      setActionSessionId(session.id);
      if (objectiveId) {
        setPendingChatScope({ type: "run", objectiveId, runId });
      }
      // Persist to sessionStorage so action survives HMR / page reload
      persistActionContext(prompt, session.id, session.label ?? "Action");
      window.location.hash = "#action-session";
    },
    [],
  );

  const handleViewResults = useCallback(
    (actionId: string) => {
      const sessionId = getActionMapping(actionId);
      if (sessionId) {
        setActiveSessionId(sessionId);
        if (isActionSession(sessionId)) {
          window.location.hash = "#action-session";
        } else {
          window.location.hash = "#chat";
        }
      }
    },
    [],
  );

  const handleResumeRun = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    if (isActionSession(sessionId)) {
      window.location.hash = "#action-session";
    } else {
      window.location.hash = "#chat";
    }
  }, []);

  const handleSessionSelect = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    window.location.hash = "#chat";
  }, []);

  const handleBootstrap = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  const handleSessionLabelUpdate = useCallback(
    (sessionId: string, label: string) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, label } : s)),
      );
    },
    [],
  );

  const handleSessionRename = useCallback(
    async (sessionId: string, label: string) => {
      if (!client) return;
      try {
        await client.updateSessionLabel(sessionId, label);
        handleSessionLabelUpdate(sessionId, label);
      } catch (error) {
        console.error("Failed to rename session", error);
        toast.error("Failed to rename session. Please try again.");
      }
    },
    [client, handleSessionLabelUpdate],
  );

  const handleSessionDelete = useCallback(
    async (sessionId: string) => {
      if (!client) return;
      try {
        await client.deleteSession(sessionId);
        evictChatSession(sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          setActiveSessionId(undefined);
        }
      } catch (error) {
        console.error("Failed to delete session", error);
        toast.error("Failed to delete session. Please try again.");
      }
    },
    [activeSessionId, client],
  );

  const handleProjectSwitch = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
    setBootstrapContext(null);
    setActiveSessionId(undefined);
    window.location.hash = "#chat";
  }, []);

  const handleProjectCreated = useCallback(
    (agent: { id: string }, projectUrl: string) => {
      setShowAddProject(false);
      setSelectedAgentId(agent.id);
      setRetryToken((current) => current + 1);
      setBootstrapContext({ agentId: agent.id, projectUrl });
      window.location.hash = "";
    },
    [],
  );

  // Show onboarding if no provider selected, no agents exist, or user navigated to add connection.
  // Skip if bootstrap is already in progress (agent was just created, hydration may still be running).
  const needsOnboarding = !bootstrapContext && (!authOverview?.selectedProviderId || !activeAgentId);
  if (needsOnboarding || hashView === "connections-add") {
    const isReusableConnectionFlow = Boolean(authOverview?.selectedProviderId) && Boolean(activeAgentId);

    return (
      <ConnectionCenter
        authOverview={authOverview}
        client={client}
        isLoading={isLoading}
        runtimeError={runtimeError}
        onAuthOverviewChange={setAuthOverview}
        onContinue={async (projectUrl) => {
          if (projectUrl && client) {
            try {
              const agent = await client.createProjectAgent(projectUrl);
              setRetryToken((current) => current + 1);
              setBootstrapContext({ agentId: agent.id, projectUrl });
              setSelectedAgentId(agent.id);
              window.location.hash = "";
              return;
            } catch (error) {
              console.error("Failed to create project agent", error);
            }
          }
          window.location.hash = "#chat";
        }}
        onRetry={() => {
          setRetryToken((current) => current + 1);
        }}
        {...(isReusableConnectionFlow
          ? {
              onClose: () => {
                window.location.hash = returnFromConnectionsHash;
                setReturnFromConnectionsHash("#chat");
              },
            }
          : {})}
      />
    );
  }

  const currentView: Exclude<AppView, "connections-add"> = hashView;

  return (
    <SidebarProvider defaultOpen={true} className="!min-h-0 h-svh overflow-hidden">
      <AppSidebar
        activeAgentId={activeAgentId}
        activeBrainSection={brainSection}
        activeSessionId={activeSessionId}
        activeView={currentView}
        agentCatalog={agentCatalog}
        isActionSession={isActionSession}
        onAddProject={() => setShowAddProject(true)}
        onNewChat={() => {
          void handleNewChat();
        }}
        onProjectSwitch={handleProjectSwitch}
        onSessionDelete={(id) => {
          void handleSessionDelete(id);
        }}
        onSessionRename={(id, label) => {
          void handleSessionRename(id, label);
        }}
        onSessionSelect={handleSessionSelect}
        sessions={sessions}
      />
      <SidebarInset className="min-h-0 bg-background">
        <AppHeader
          currentView={currentView}
          onAddConnection={() => {
            setReturnFromConnectionsHash(`#${currentView}`);
            window.location.hash = "#connections/add";
          }}
          onCreateAgent={() => {
            setCreateAgentToken((current) => current + 1);
          }}
        />
        <div className={`flex min-h-0 flex-1 flex-col ${currentView === "chat" || currentView === "action-session" || currentView === "brain" || currentView === "dashboard" || currentView === "board" || currentView === "objective" ? "" : "gap-4 overflow-y-auto p-4 lg:p-5"}`}>
          {currentView === "dashboard" ? (
            bootstrapContext && client ? (
              <BootstrapProgress
                agentId={bootstrapContext.agentId}
                client={client}
                projectUrl={bootstrapContext.projectUrl}
                onComplete={() => {
                  setBootstrapContext(null);
                  void refreshSessions();
                }}
              />
            ) : (
              <DashboardWorkspace
                agent={activeAgent}
                agentId={activeAgentId}
                client={client}
                completedActions={completedActions}
                isActionLoading={isActionLoading}
                onActionClick={(id, prompt, label) => {
                  void handleActionClick(id, prompt, label);
                }}
                onViewResults={handleViewResults}
                onRunSessionCreated={handleRunSessionCreated}
                onResumeRun={handleResumeRun}
              />
            )
          ) : currentView === "objective" ? (
            <ObjectiveWorkspace
              agentId={activeAgentId}
              client={client}
              objectiveId={objectiveId}
              objectiveTab={objectiveTab}
              onResumeRun={handleResumeRun}
            />
          ) : currentView === "board" ? (
            <BoardWorkspace
              agentId={activeAgentId}
              client={client}
            />
          ) : currentView === "action-session" ? (
              <ActionSessionView
                agentId={activeAgentId}
                client={client}
                pendingActionPrompt={activeSessionId === actionSessionId ? pendingActionPrompt : null}
                sessionId={activeSessionId}
                actionTitle={pendingActionTitle ?? undefined}
                onPendingPromptConsumed={() => {
                  setPendingActionPrompt(null);
                  setActionSessionId(null);
                  setPendingActionTitle(null);
                  clearPersistedActionContext();
                }}
                onViewChat={(sid) => {
                  setActiveSessionId(sid);
                  window.location.hash = "#chat";
                }}
                onBackToDashboard={() => {
                  clearPersistedActionContext();
                  window.location.hash = "#dashboard";
                }}
              />
          ) : currentView === "chat" ? (
              <ChatWorkspace
                agentId={activeAgentId}
                authOverview={authOverview}
                client={client}
                initialScope={pendingChatScope}
                onBootstrap={handleBootstrap}
                onInitialScopeConsumed={() => {
                  setPendingChatScope(null);
                }}
                onPendingPromptConsumed={() => {
                  setPendingActionPrompt(null);
                  setActionSessionId(null);
                  clearPersistedActionContext();
                }}
                onSessionLabelUpdate={handleSessionLabelUpdate}
                pendingActionPrompt={activeSessionId === actionSessionId ? pendingActionPrompt : null}
                sessionId={activeSessionId}
              />
          ) : currentView === "brain" ? (
            <BrainWorkspace
              agentId={activeAgentId}
              client={client}
              onRefineContext={handleRefineContext}
              sectionId={brainSection}
            />
          ) : currentView === "connections" ? (
            <ConnectionsWorkspace
              authOverview={authOverview}
              client={client}
              onAddConnection={() => {
                setReturnFromConnectionsHash("#connections");
                window.location.hash = "#connections/add";
              }}
              onAuthOverviewChange={setAuthOverview}
            />
          ) : currentView === "settings" && activeAgent && client ? (
            <ProjectSettings
              agent={activeAgent}
              authOverview={authOverview}
              client={client}
              onAddConnection={() => {
                setReturnFromConnectionsHash("#settings");
                window.location.hash = "#connections/add";
              }}
              onAgentUpdated={() => {
                setRetryToken((t) => t + 1);
              }}
              onProjectDeleted={() => {
                setSelectedAgentId(undefined);
                setRetryToken((t) => t + 1);
                window.location.hash = "#chat";
              }}
            />
          ) : (
            <SpecialistTeamBrowser
              client={client}
            />
          )}
        </div>
      </SidebarInset>

      {client ? (
        <AddProjectDialog
          client={client}
          open={showAddProject}
          onOpenChange={setShowAddProject}
          onProjectCreated={handleProjectCreated}
        />
      ) : null}
      <Toaster />
    </SidebarProvider>
  );
}

function readViewFromHash(): AppView {
  if (window.location.hash === "#connections/add") {
    return "connections-add";
  }

  if (window.location.hash === "#connections") {
    return "connections";
  }

  if (window.location.hash.startsWith("#brain")) {
    return "brain";
  }

  if (window.location.hash === "#agents") {
    return "agents";
  }

  if (window.location.hash === "#settings") {
    return "settings";
  }

  if (window.location.hash.startsWith("#action-session")) {
    return "action-session";
  }

  if (window.location.hash.startsWith("#chat")) {
    return "chat";
  }

  if (window.location.hash.startsWith("#board")) {
    return "board";
  }

  if (window.location.hash.startsWith("#objective/")) {
    return "objective";
  }

  return "dashboard";
}

function readBrainSectionFromHash(): string {
  const hash = window.location.hash;
  if (hash.startsWith("#brain/")) {
    return hash.slice("#brain/".length);
  }
  return "product";
}

function readObjectiveIdFromHash(): string | undefined {
  const hash = window.location.hash;
  if (!hash.startsWith("#objective/")) return undefined;
  const parts = hash.slice("#objective/".length).split("/");
  return parts[0] || undefined;
}

function readObjectiveTabFromHash(): string | undefined {
  const hash = window.location.hash;
  if (!hash.startsWith("#objective/")) return undefined;
  const parts = hash.slice("#objective/".length).split("/");
  return parts[1] || undefined;
}
