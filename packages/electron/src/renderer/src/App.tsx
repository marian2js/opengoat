import { useEffect, useMemo, useState } from "react";
import { OnboardingPanel } from "@renderer/features/onboarding/onboarding-panel";
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
    addProjectByPath,
    createSession,
    renameSession,
    removeSession,
    selectProject,
    selectSession,
    submitOnboarding,
    runOnboardingGuidedAuth,
    setOnboardingDraftProvider,
    setOnboardingDraftField,
    setOnboardingDraftGateway,
    openOnboarding,
    closeOnboarding,
    sendMessage,
    clearError
  } = useWorkbenchStore();

  const [manualPath, setManualPath] = useState("");

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
        if (activeProjectId) {
          void createSession(activeProjectId);
        }
        return;
      }

      if (
        action === "open-provider-settings" ||
        action === "open-connection-settings"
      ) {
        void openOnboarding();
      }
    });
  }, [activeProjectId, addProjectFromDialog, createSession, openOnboarding]);

  const activeProject = useMemo(
    () => getActiveProject(projects, activeProjectId),
    [projects, activeProjectId]
  );
  const activeSession = useMemo(
    () => activeProject?.sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeProject, activeSessionId]
  );

  const onManualAdd = async () => {
    await addProjectByPath(manualPath);
    setManualPath("");
  };

  const onSaveOnboarding = async () => {
    if (!onboardingDraftProviderId) {
      return;
    }
    await submitOnboarding(
      onboardingDraftProviderId,
      onboardingDraftEnv,
      onboardingDraftGateway
    );
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
        onGatewayChange={setOnboardingDraftGateway}
        onboardingNotice={onboardingNotice}
        onRunGuidedAuth={(providerId) => void runOnboardingGuidedAuth(providerId)}
        onClose={closeOnboarding}
        onSubmit={() => void onSaveOnboarding()}
      />
    );
  }

  return (
    <div className="dark h-screen bg-transparent text-foreground">
      <div className="relative h-full overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_520px_at_-4%_-12%,hsl(163_82%_49%_/_0.22),transparent_56%),radial-gradient(860px_420px_at_108%_-8%,hsl(192_94%_54%_/_0.16),transparent_58%),linear-gradient(180deg,hsl(222_53%_6%),hsl(224_52%_4%))]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(hsl(215_24%_64%_/_0.28)_1px,transparent_1px),linear-gradient(90deg,hsl(215_24%_64%_/_0.28)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative grid h-full grid-cols-1 md:grid-cols-[350px_1fr]">
          <ProjectsSidebar
            projects={projects}
            activeProjectId={activeProjectId}
            activeSessionId={activeSessionId}
            manualPath={manualPath}
            busy={isBusy}
            onManualPathChange={setManualPath}
            onAddProjectDialog={() => void addProjectFromDialog()}
            onAddProjectPath={() => void onManualAdd()}
            onSelectProject={(projectId) => void selectProject(projectId)}
            onCreateSession={(projectId) => void createSession(projectId)}
            onRenameSession={(projectId, sessionId, title) =>
              void renameSession(projectId, sessionId, title)
            }
            onRemoveSession={(projectId, sessionId) =>
              void removeSession(projectId, sessionId)
            }
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
            onOpenOnboarding={() => void openOnboarding()}
            onDismissError={clearError}
          />
        </div>
      </div>
    </div>
  );
}
