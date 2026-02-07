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
    selectProject,
    selectSession,
    submitOnboarding,
    runOnboardingGuidedAuth,
    setOnboardingDraftProvider,
    setOnboardingDraftField,
    openOnboarding,
    closeOnboarding,
    sendMessage,
    clearError
  } = useWorkbenchStore();

  const [manualPath, setManualPath] = useState("");

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

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
    await submitOnboarding(onboardingDraftProviderId, onboardingDraftEnv);
  };

  if (isBootstrapping) {
    return (
      <div className="dark flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading OpenGoat Desktop...
      </div>
    );
  }

  if (showOnboarding && onboarding) {
    return (
      <OnboardingPanel
        onboarding={onboarding}
        providerId={onboardingDraftProviderId}
        env={onboardingDraftEnv}
        error={error}
        canClose={!onboarding.needsOnboarding}
        isSubmitting={onboardingState === "submitting"}
        isRunningGuidedAuth={onboardingGuidedAuthState === "running"}
        onSelectProvider={setOnboardingDraftProvider}
        onEnvChange={setOnboardingDraftField}
        onboardingNotice={onboardingNotice}
        onRunGuidedAuth={(providerId) => void runOnboardingGuidedAuth(providerId)}
        onClose={closeOnboarding}
        onSubmit={() => void onSaveOnboarding()}
      />
    );
  }

  return (
    <div className="dark h-screen bg-background text-foreground">
      <div className="relative h-full overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_460px_at_0%_0%,hsl(163_74%_45%_/_0.11),transparent_60%),radial-gradient(760px_360px_at_95%_8%,hsl(156_72%_25%_/_0.1),transparent_58%),linear-gradient(180deg,hsl(215_40%_8%),hsl(215_38%_6%))]" />
        <div className="relative grid h-full grid-cols-[340px_1fr]">
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
            onSelectSession={(projectId, sessionId) => void selectSession(projectId, sessionId)}
          />
          <ChatPanel
            key={`${activeProjectId ?? "none"}:${activeSessionId ?? "none"}`}
            homeDir={homeDir}
            activeProject={activeProject}
            activeSession={activeSession}
            messages={activeMessages}
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
