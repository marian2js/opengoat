import { useEffect, useMemo, useState } from "react";
import { OnboardingPanel } from "@renderer/features/onboarding/onboarding-panel";
import { RuntimeSettingsModal } from "@renderer/features/runtime/runtime-settings-modal";
import { ProjectsSidebar } from "@renderer/features/projects/projects-sidebar";
import { ChatPanel } from "@renderer/features/chat/chat-panel";
import { AgentsPanel } from "@renderer/features/agents/agents-panel";
import { getActiveProject, useWorkbenchStore } from "@renderer/store/workbench-store";
import { DESKTOP_IPC_CONTRACT_FEATURES } from "@shared/workbench-contract";

export function App() {
  const {
    homeDir,
    ipcContractVersion,
    projects,
    onboarding,
    showOnboarding,
    onboardingState,
    onboardingGuidedAuthState,
    gatewayState,
    onboardingDraftProviderId,
    onboardingDraftEnv,
    onboardingDraftGateway,
    onboardingNotice,
    activeProjectId,
    activeSessionId,
    activeMessages,
    runStatusEvents,
    agents,
    agentProviders,
    agentsState,
    agentsNotice,
    isBootstrapping,
    isBusy,
    error,
    bootstrap,
    addProjectFromDialog,
    renameProject,
    removeProject,
    createSession,
    renameSession,
    removeSession,
    selectProject,
    selectSession,
    loadAgents,
    createAgent,
    deleteAgent,
    clearAgentsNotice,
    submitOnboarding,
    saveOnboardingGateway,
    runOnboardingGuidedAuth,
    setOnboardingDraftProvider,
    setOnboardingDraftField,
    setOnboardingDraftGateway,
    openOnboarding,
    closeOnboarding,
    sendMessage,
    appendRunStatusEvent,
    clearError
  } = useWorkbenchStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showRuntimeSettings, setShowRuntimeSettings] = useState(false);
  const [activeView, setActiveView] = useState<"chat" | "agents">("chat");
  const [windowChrome, setWindowChrome] = useState<OpenGoatDesktopWindowChrome>({
    isMac: false,
    isMaximized: false,
    isFullScreen: false,
  });

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const supportsAgents =
    (ipcContractVersion ?? 0) >= DESKTOP_IPC_CONTRACT_FEATURES.agents;
  const supportsAgentProviderConfig =
    (ipcContractVersion ?? 0) >= DESKTOP_IPC_CONTRACT_FEATURES.agentProviderConfig;

  useEffect(() => {
    if (activeView === "agents" && supportsAgents) {
      void loadAgents();
    }
  }, [activeView, loadAgents, supportsAgents]);

  useEffect(() => {
    const desktopApi = window.opengoatDesktop;
    if (!desktopApi?.onMenuAction) {
      return;
    }

    return desktopApi.onMenuAction((action) => {
      if (action === "open-project") {
        void addProjectFromDialog();
        return;
      }

      if (action === "new-session") {
        const targetProjectId =
          activeProjectId ??
          projects.find((project) => project.name === "Home")?.id ??
          projects[0]?.id;
        if (targetProjectId) {
          void createSession(targetProjectId);
        }
        return;
      }

      if (
        action === "open-provider-settings" ||
        action === "open-connection-settings"
      ) {
        if (action === "open-provider-settings") {
          void openOnboarding();
          return;
        }
        setShowRuntimeSettings(true);
      }
    });
  }, [activeProjectId, addProjectFromDialog, createSession, openOnboarding, projects]);

  useEffect(() => {
    window.opengoatDesktop?.setWindowMode(
      showOnboarding ? "onboarding" : "workspace",
    );
  }, [showOnboarding]);

  useEffect(() => {
    const desktopApi = window.opengoatDesktop;
    if (!desktopApi?.onWindowChrome || !desktopApi.getWindowChrome) {
      return;
    }

    let disposed = false;
    void desktopApi
      .getWindowChrome()
      .then((state) => {
        if (!disposed) {
          setWindowChrome(state);
        }
      })
      .catch(() => undefined);

    const unsubscribe = desktopApi.onWindowChrome((state) => {
      setWindowChrome(state);
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const desktopApi = window.opengoatDesktop;
    if (!desktopApi?.onRunStatus) {
      return;
    }

    return desktopApi.onRunStatus((event) => {
      appendRunStatusEvent(event);
    });
  }, [appendRunStatusEvent]);

  const activeProject = useMemo(
    () => getActiveProject(projects, activeProjectId),
    [projects, activeProjectId]
  );
  const activeSession = useMemo(
    () => activeProject?.sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeProject, activeSessionId]
  );
  const isAgentsView = activeView === "agents";

  const onSaveOnboarding = async () => {
    if (!onboardingDraftProviderId) {
      return;
    }
    await submitOnboarding(
      onboardingDraftProviderId,
      onboardingDraftEnv
    );
  };

  const onSaveGateway = async () => {
    await saveOnboardingGateway(onboardingDraftGateway);
  };

  if (isBootstrapping) {
    return (
      <div className="dark flex h-screen items-center justify-center bg-transparent text-sm text-muted-foreground">
        Loading OpenGoat...
      </div>
    );
  }

  if (showOnboarding && onboarding) {
    return (
      <>
        <OnboardingPanel
          onboarding={onboarding}
          providerId={onboardingDraftProviderId}
          env={onboardingDraftEnv}
          gateway={onboardingDraftGateway}
          error={error}
          canClose={!onboarding.needsOnboarding}
          isSubmitting={onboardingState === "submitting"}
          isRunningGuidedAuth={onboardingGuidedAuthState === "running"}
          onSelectProvider={setOnboardingDraftProvider}
          onEnvChange={setOnboardingDraftField}
          onOpenRuntimeSettings={() => setShowRuntimeSettings(true)}
          onboardingNotice={onboardingNotice}
          onRunGuidedAuth={(providerId) => void runOnboardingGuidedAuth(providerId)}
          onClose={() => void closeOnboarding()}
          onSubmit={() => void onSaveOnboarding()}
        />
        <RuntimeSettingsModal
          open={showRuntimeSettings}
          gateway={onboardingDraftGateway}
          error={error}
          disabled={isBusy || onboardingState === "submitting"}
          isSaving={gatewayState === "saving"}
          onOpenChange={setShowRuntimeSettings}
          onGatewayChange={setOnboardingDraftGateway}
          onSave={() => void onSaveGateway()}
        />
      </>
    );
  }

  return (
    <>
      <div className="dark h-screen bg-transparent text-foreground">
        <div className="relative h-full overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_520px_at_-4%_-12%,hsl(163_82%_49%_/_0.22),transparent_56%),radial-gradient(860px_420px_at_108%_-8%,hsl(192_94%_54%_/_0.16),transparent_58%),linear-gradient(180deg,hsl(222_53%_6%),hsl(224_52%_4%))]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(hsl(215_24%_64%_/_0.28)_1px,transparent_1px),linear-gradient(90deg,hsl(215_24%_64%_/_0.28)_1px,transparent_1px)] [background-size:22px_22px]" />
          <div
            className={`relative grid h-full grid-cols-1 ${sidebarCollapsed ? "md:grid-cols-[74px_1fr]" : "md:grid-cols-[280px_1fr]"}`}
          >
            <ProjectsSidebar
              showTrafficLightInset={
                windowChrome.isMac &&
                !windowChrome.isMaximized &&
                !windowChrome.isFullScreen &&
                !sidebarCollapsed
              }
              projects={projects}
              activeProjectId={activeProjectId}
              activeSessionId={activeSessionId}
              busy={isBusy}
              collapsed={sidebarCollapsed}
              agentsActive={isAgentsView}
              onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
              onAddProjectDialog={() => void addProjectFromDialog()}
              onOpenAgents={() => setActiveView("agents")}
              onRenameProject={(projectId, name) => void renameProject(projectId, name)}
              onRemoveProject={(projectId) => void removeProject(projectId)}
              onCreateSession={(projectId) => {
                setActiveView("chat");
                void createSession(projectId);
              }}
              onRenameSession={(projectId, sessionId, title) =>
                void renameSession(projectId, sessionId, title)
              }
              onRemoveSession={(projectId, sessionId) =>
                void removeSession(projectId, sessionId)
              }
              onSelectProject={(projectId) => {
                setActiveView("chat");
                void selectProject(projectId);
              }}
              onSelectSession={(projectId, sessionId) => {
                setActiveView("chat");
                void selectSession(projectId, sessionId);
              }}
            />
            {isAgentsView ? (
              supportsAgents ? (
                <AgentsPanel
                  agents={agents}
                  providers={agentProviders}
                  loading={agentsState === "loading"}
                  busy={isBusy || agentsState === "saving"}
                  error={error}
                  notice={agentsNotice}
                  onRefresh={() => void loadAgents()}
                  onCreate={(input) => void createAgent(input)}
                  onDelete={(input) => void deleteAgent(input)}
                  providerConfigAvailable={supportsAgentProviderConfig}
                  onDismissNotice={clearAgentsNotice}
                  onDismissError={clearError}
                />
              ) : (
                <main className="flex h-full min-h-0 min-w-0 flex-col bg-transparent">
                  <header className="titlebar-drag-region sticky top-0 z-30 border-0 bg-[#1F1F1F] px-4 shadow-[0_10px_24px_rgba(0,0,0,0.42)] md:px-5">
                    <div className="flex h-12 items-center justify-between gap-3">
                      <div className="min-w-0 truncate text-base leading-none tracking-tight">
                        <span className="truncate font-heading font-semibold text-foreground">
                          Agents
                        </span>
                      </div>
                    </div>
                  </header>
                  <section className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
                    <div className="mx-auto w-full max-w-3xl rounded-xl border border-[#2E2F31] bg-[#141416] px-4 py-6 text-sm text-muted-foreground">
                      Agents require Desktop IPC contract v{DESKTOP_IPC_CONTRACT_FEATURES.agents} or
                      newer. Restart OpenGoat after updating the desktop runtime.
                    </div>
                  </section>
                </main>
              )
            ) : (
              <ChatPanel
                key={`${activeProjectId ?? "none"}:${activeSessionId ?? "none"}`}
                homeDir={homeDir}
                activeProject={activeProject}
                activeSession={activeSession}
                messages={activeMessages}
                runStatusEvents={runStatusEvents}
                gateway={onboarding?.gateway}
                error={error}
                busy={isBusy}
                onSubmitMessage={(message) =>
                  sendMessage(message, {
                    rethrow: true
                  })
                }
                onOpenRuntimeSettings={() => setShowRuntimeSettings(true)}
                onOpenOnboarding={() => void openOnboarding()}
                onDismissError={clearError}
              />
            )}
          </div>
        </div>
      </div>
      <RuntimeSettingsModal
        open={showRuntimeSettings}
        gateway={onboardingDraftGateway}
        error={error}
        disabled={isBusy}
        isSaving={gatewayState === "saving"}
        onOpenChange={setShowRuntimeSettings}
        onGatewayChange={setOnboardingDraftGateway}
        onSave={() => void onSaveGateway()}
      />
    </>
  );
}
