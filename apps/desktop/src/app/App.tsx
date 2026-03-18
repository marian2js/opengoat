import { type AgentCatalog, type AgentSession, type AuthOverview } from "@opengoat/contracts";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/app/shell/AppHeader";
import { AppSidebar } from "@/app/shell/AppSidebar";
import { AgentsWorkspace } from "@/features/agents/components/AgentsWorkspace";
import { ChatWorkspace, evictChatSession } from "@/features/chat/components/ChatWorkspace";
import { ConnectionsWorkspace } from "@/features/connections/components/ConnectionsWorkspace";
import { BootstrapProgress } from "@/features/onboarding/components/BootstrapProgress";
import { ConnectionCenter } from "@/features/onboarding/components/ConnectionCenter";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { initializeSidecarConnection } from "@/lib/runtime/connection";
import { SidecarClient } from "@/lib/sidecar/client";
type AppView = "connections" | "connections-add" | "chat" | "agents";

function resolveActiveAgentId(catalog: AgentCatalog | null): string | undefined {
  if (!catalog || catalog.agents.length === 0) {
    return undefined;
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
  const [hashView, setHashView] = useState<AppView>(readViewFromHash());
  const [retryToken, setRetryToken] = useState(0);
  const [createAgentToken, setCreateAgentToken] = useState(0);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [bootstrapContext, setBootstrapContext] = useState<{
    agentId: string;
    projectUrl: string;
  } | null>(null);

  const activeAgentId = resolveActiveAgentId(agentCatalog);

  useEffect(() => {
    let isMounted = true;

    async function hydrateFromSidecar(): Promise<void> {
      if (isMounted) {
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

        const agentId = resolveActiveAgentId(catalog);
        const sessionList = agentId
          ? await client.listSessions(agentId).catch(() => ({ sessions: [] }))
          : { sessions: [] };

        if (isMounted) {
          setAuthOverview(overview);
          setAgentCatalog(catalog);
          setClient(client);
          setSessions(sessionList.sessions);
          setRuntimeError(null);
        }
      } catch (error) {
        console.error("Failed to initialize desktop runtime", error);
        if (isMounted) {
          setAuthOverview(null);
          setAgentCatalog(null);
          setClient(null);
          setRuntimeError(error instanceof Error ? error.message : "Load failed");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void hydrateFromSidecar();

    return () => {
      isMounted = false;
    };
  }, [retryToken]);

  useEffect(() => {
    const onHashChange = (): void => {
      setHashView(readViewFromHash());
    };

    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

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
    }
  }, [client, activeAgentId]);

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
      }
    },
    [activeSessionId, client],
  );

  // Show onboarding if no provider selected, no agents exist, or user navigated to add connection
  const needsOnboarding = !authOverview?.selectedProviderId || !activeAgentId;
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
              // Re-hydrate to pick up the new agent
              setRetryToken((current) => current + 1);
              // Start bootstrap in the main app layout
              setBootstrapContext({ agentId: agent.id, projectUrl });
              window.location.hash = "#chat";
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
                window.location.hash = "#connections";
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
        activeSessionId={activeSessionId}
        activeView={currentView}
        authOverview={authOverview}
        onNewChat={() => {
          void handleNewChat();
        }}
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
            window.location.hash = "#connections/add";
          }}
          onCreateAgent={() => {
            setCreateAgentToken((current) => current + 1);
          }}
        />
        <div className={`flex min-h-0 flex-1 flex-col ${currentView === "chat" ? "" : "gap-4 p-4 lg:p-5"}`}>
          {currentView === "chat" ? (
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
              <ChatWorkspace
                agentId={activeAgentId}
                authOverview={authOverview}
                client={client}
                onBootstrap={handleBootstrap}
                onSessionLabelUpdate={handleSessionLabelUpdate}
                sessionId={activeSessionId}
              />
            )
          ) : currentView === "connections" ? (
            <ConnectionsWorkspace
              authOverview={authOverview}
              client={client}
              onAuthOverviewChange={setAuthOverview}
            />
          ) : (
            <AgentsWorkspace
              authOverview={authOverview}
              client={client}
              createRequestToken={createAgentToken}
            />
          )}
        </div>
      </SidebarInset>
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

  if (window.location.hash === "#agents") {
    return "agents";
  }

  return "chat";
}
