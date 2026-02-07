import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Textarea } from "@renderer/components/ui/textarea";
import type { WorkbenchOnboarding } from "@shared/workbench";
import {
  getActiveProject,
  useWorkbenchStore,
} from "@renderer/store/workbench-store";
import {
  FolderPlus,
  MessageSquare,
  Plus,
  Send,
  TerminalSquare,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function App() {
  const {
    homeDir,
    projects,
    onboarding,
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
    sendMessage,
    clearError,
  } = useWorkbenchStore();

  const [manualPath, setManualPath] = useState("");
  const [draft, setDraft] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [onboardingEnv, setOnboardingEnv] = useState<Record<string, string>>({});

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const activeProject = useMemo(
    () => getActiveProject(projects, activeProjectId),
    [projects, activeProjectId],
  );
  const activeSession = useMemo(
    () =>
      activeProject?.sessions.find(
        (session) => session.id === activeSessionId,
      ) ?? null,
    [activeProject, activeSessionId],
  );

  const canSend = Boolean(
    activeProject && activeSession && draft.trim().length > 0 && !isBusy,
  );
  const selectedOnboardingProvider = useMemo(
    () => resolveSelectedOnboardingProvider(onboarding, selectedProviderId),
    [onboarding, selectedProviderId],
  );

  useEffect(() => {
    if (!onboarding) {
      return;
    }
    const nextProviderId = onboarding.activeProviderId || onboarding.providers[0]?.id || "";
    if (nextProviderId && nextProviderId !== selectedProviderId) {
      setSelectedProviderId(nextProviderId);
      setOnboardingEnv({});
    }
  }, [onboarding, selectedProviderId]);

  const onManualAdd = async () => {
    await addProjectByPath(manualPath);
    setManualPath("");
  };

  const onSend = async () => {
    const message = draft;
    setDraft("");
    await sendMessage(message);
  };

  const onSaveOnboarding = async () => {
    if (!selectedProviderId) {
      return;
    }
    await submitOnboarding(selectedProviderId, onboardingEnv);
    setOnboardingEnv({});
  };

  if (isBootstrapping) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-[var(--muted-foreground)]">
        Loading OpenGoat desktop...
      </div>
    );
  }

  if (onboarding?.needsOnboarding) {
    return (
      <div className="flex h-screen items-center justify-center bg-[radial-gradient(1200px_500px_at_10%_-20%,_rgba(22,163,74,0.16),transparent_55%),radial-gradient(900px_450px_at_100%_0%,_rgba(245,158,11,0.15),transparent_55%),var(--background)] px-6 text-[var(--foreground)]">
        <div className="w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="font-heading text-2xl">Finish Provider Setup</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Configure the orchestrator provider directly in the desktop app.
          </p>

          <div className="mt-5 space-y-3">
            <label className="block text-sm text-[var(--muted-foreground)]" htmlFor="provider-select">
              Provider
            </label>
            <select
              id="provider-select"
              value={selectedProviderId}
              onChange={(event) => {
                setSelectedProviderId(event.target.value);
                setOnboardingEnv({});
              }}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-sm"
              disabled={isBusy}
            >
              {onboarding.providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.displayName} ({provider.id})
                </option>
              ))}
            </select>
          </div>

          {selectedOnboardingProvider ? (
            <div className="mt-5 space-y-3">
              {selectedOnboardingProvider.envFields.length === 0 ? (
                <p className="rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                  This provider has no environment fields. Click Continue to save selection.
                </p>
              ) : (
                selectedOnboardingProvider.envFields.map((field) => {
                  const value = onboardingEnv[field.key] ?? "";
                  const isConfigured = selectedOnboardingProvider.configuredEnvKeys.includes(field.key);
                  return (
                    <div key={field.key} className="space-y-1">
                      <p className="text-sm font-medium">
                        {field.key}
                        {field.required ? " *" : ""}
                      </p>
                      <Input
                        type={field.secret ? "password" : "text"}
                        value={value}
                        onChange={(event) => {
                          const next = event.target.value;
                          setOnboardingEnv((current) => ({
                            ...current,
                            [field.key]: next
                          }));
                        }}
                        placeholder={field.description}
                        disabled={isBusy}
                      />
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {field.description}
                        {isConfigured && !value ? " (currently configured)" : ""}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <Button
              onClick={() => void onSaveOnboarding()}
              disabled={isBusy || !selectedProviderId}
            >
              {isBusy ? "Saving..." : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[radial-gradient(1200px_500px_at_10%_-20%,_rgba(22,163,74,0.16),transparent_55%),radial-gradient(900px_450px_at_100%_0%,_rgba(245,158,11,0.15),transparent_55%),var(--background)] text-[var(--foreground)]">
      <div className="grid h-full grid-cols-[340px_1fr]">
        <aside className="border-r border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-heading text-lg tracking-wide">OpenGoat</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Projects + Sessions
              </p>
            </div>
            <TerminalSquare className="size-5 text-[var(--accent)]" />
          </div>

          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-3">
            <Button
              className="w-full"
              onClick={() => void addProjectFromDialog()}
              disabled={isBusy}
            >
              <FolderPlus className="size-4" />
              Add Project
            </Button>
            <div className="flex gap-2">
              <Input
                value={manualPath}
                onChange={(event) => setManualPath(event.target.value)}
                placeholder="/path/to/project"
              />
              <Button
                variant="outline"
                onClick={() => void onManualAdd()}
                disabled={isBusy || !manualPath.trim()}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 max-h-[calc(100vh-220px)] space-y-3 overflow-y-auto pr-1">
            {projects.map((project) => {
              const isActiveProject = project.id === activeProjectId;
              return (
                <div
                  key={project.id}
                  className={`rounded-lg border p-3 ${
                    isActiveProject
                      ? "border-[var(--accent)] bg-[var(--surface-strong)]"
                      : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => void selectProject(project.id)}
                  >
                    <p className="font-medium">{project.name}</p>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      {project.rootPath}
                    </p>
                  </button>

                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                      Sessions
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void createSession(project.id)}
                      disabled={isBusy}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>

                  <div className="mt-2 space-y-1">
                    {project.sessions.length === 0 ? (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        No sessions yet.
                      </p>
                    ) : (
                      project.sessions.map((session) => {
                        const active =
                          activeProjectId === project.id &&
                          activeSessionId === session.id;
                        return (
                          <button
                            key={session.id}
                            type="button"
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                              active
                                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                                : "hover:bg-[var(--surface-strong)]"
                            }`}
                            onClick={() =>
                              void selectSession(project.id, session.id)
                            }
                          >
                            <MessageSquare className="size-3.5" />
                            <span className="truncate">{session.title}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="flex min-w-0 flex-col">
          <header className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4">
            <p className="font-heading text-lg">
              {activeProject?.name ?? "No project selected"}
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">
              {activeSession
                ? `Session: ${activeSession.title}`
                : "Create a session to start chatting"}
            </p>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {activeMessages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted-foreground)]">
                Messages will appear here. OpenGoat always talks to the
                orchestrator internally.
              </div>
            ) : (
              <div className="space-y-3">
                {activeMessages.map((message) => (
                  <article
                    key={message.id}
                    className={`max-w-3xl rounded-lg border px-4 py-3 ${
                      message.role === "user"
                        ? "ml-auto border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]"
                        : "border-[var(--border)] bg-[var(--surface)]"
                    }`}
                  >
                    <p className="mb-1 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                      {message.role === "user" ? "You" : "OpenGoat"}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-6">
                      {message.content}
                    </p>
                    {message.tracePath ? (
                      <p className="mt-2 truncate text-xs text-[var(--muted-foreground)]">
                        Trace: {message.tracePath}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>

          <footer className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">
            {error ? (
              <div className="mb-3 flex items-center justify-between rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                <span>{error}</span>
                <Button size="sm" variant="ghost" onClick={clearError}>
                  Dismiss
                </Button>
              </div>
            ) : null}

            <div className="flex gap-3">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={
                  activeSession
                    ? "Describe what you want OpenGoat to do..."
                    : "Create a session first, then send a message"
                }
                disabled={!activeSession || isBusy}
                className="min-h-[88px]"
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault();
                    if (canSend) {
                      void onSend();
                    }
                  }
                }}
              />
              <div className="flex w-40 flex-col justify-between">
                <Button onClick={() => void onSend()} disabled={!canSend}>
                  <Send className="size-4" />
                  Send
                </Button>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {homeDir}
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

function resolveSelectedOnboardingProvider(
  onboarding: WorkbenchOnboarding | null,
  selectedProviderId: string,
) {
  if (!onboarding) {
    return null;
  }
  if (!selectedProviderId) {
    return onboarding.providers[0] ?? null;
  }
  return (
    onboarding.providers.find((provider) => provider.id === selectedProviderId) ??
    onboarding.providers[0] ??
    null
  );
}
