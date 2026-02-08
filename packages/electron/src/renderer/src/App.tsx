import { useEffect, useMemo, useState } from "react";
import { OnboardingPanel } from "@renderer/features/onboarding/onboarding-panel";
import { RuntimeSettingsModal } from "@renderer/features/runtime/runtime-settings-modal";
import { ProjectsSidebar } from "@renderer/features/projects/projects-sidebar";
import { ChatPanel } from "@renderer/features/chat/chat-panel";
import { getActiveProject, useWorkbenchStore } from "@renderer/store/workbench-store";

export function App() {
  const {
    homeDir,
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
    isBootstrapping,
    isBusy,
    error,
    bootstrap,
    addProjectFromDialog,
    renameProject,
    removeProject,
    createSession,
    selectProject,
    selectSession,
    submitOnboarding,
    saveOnboardingGateway,
    runOnboardingGuidedAuth,
    setOnboardingDraftProvider,
    setOnboardingDraftField,
    setOnboardingDraftGateway,
    openOnboarding,
    closeOnboarding,
    sendMessage,
    clearError
  } = useWorkbenchStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showRuntimeSettings, setShowRuntimeSettings] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

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

  const activeProject = useMemo(
    () => getActiveProject(projects, activeProjectId),
    [projects, activeProjectId]
  );
  const activeSession = useMemo(
    () => activeProject?.sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeProject, activeSessionId]
  );

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
              projects={projects}
              activeProjectId={activeProjectId}
              activeSessionId={activeSessionId}
              busy={isBusy}
              collapsed={sidebarCollapsed}
              onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
              onAddProjectDialog={() => void addProjectFromDialog()}
              onRenameProject={(projectId, name) => void renameProject(projectId, name)}
              onRemoveProject={(projectId) => void removeProject(projectId)}
              onCreateSession={(projectId) => void createSession(projectId)}
              onSelectProject={(projectId) => void selectProject(projectId)}
              onSelectSession={(projectId, sessionId) => void selectSession(projectId, sessionId)}
            />
            <ChatPanel
              key={`${activeProjectId ?? "none"}:${activeSessionId ?? "none"}`}
              homeDir={homeDir}
              activeProject={activeProject}
              activeSession={activeSession}
              messages={activeMessages}
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
