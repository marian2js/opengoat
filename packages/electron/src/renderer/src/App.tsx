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
    onboardingDraftProviderId,
    onboardingDraftEnv,
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
      <div className="flex h-screen items-center justify-center text-sm text-[var(--muted-foreground)]">
        Loading OpenGoat desktop...
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
        onSelectProvider={setOnboardingDraftProvider}
        onEnvChange={setOnboardingDraftField}
        onClose={closeOnboarding}
        onSubmit={() => void onSaveOnboarding()}
      />
    );
  }

  return (
    <div className="h-screen bg-[radial-gradient(1200px_500px_at_10%_-20%,_rgba(22,163,74,0.16),transparent_55%),radial-gradient(900px_450px_at_100%_0%,_rgba(245,158,11,0.15),transparent_55%),var(--background)] text-[var(--foreground)]">
      <div className="grid h-full grid-cols-[340px_1fr]">
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
  );
}
