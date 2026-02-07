import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import type { WorkbenchProject } from "@shared/workbench";
import { FolderPlus, MessageSquare, Plus, TerminalSquare } from "lucide-react";

interface ProjectsSidebarProps {
  projects: WorkbenchProject[];
  activeProjectId: string | null;
  activeSessionId: string | null;
  manualPath: string;
  busy: boolean;
  onManualPathChange: (value: string) => void;
  onAddProjectDialog: () => void;
  onAddProjectPath: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateSession: (projectId: string) => void;
  onSelectSession: (projectId: string, sessionId: string) => void;
}

export function ProjectsSidebar(props: ProjectsSidebarProps) {
  return (
    <aside className="border-r border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-heading text-lg tracking-wide">OpenGoat</p>
          <p className="text-xs text-[var(--muted-foreground)]">Projects + Sessions</p>
        </div>
        <TerminalSquare className="size-5 text-[var(--accent)]" />
      </div>

      <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-3">
        <Button
          className="w-full"
          onClick={props.onAddProjectDialog}
          disabled={props.busy}
        >
          <FolderPlus className="size-4" />
          Add Project
        </Button>
        <div className="flex gap-2">
          <Input
            value={props.manualPath}
            onChange={(event) => props.onManualPathChange(event.target.value)}
            placeholder="/path/to/project"
          />
          <Button
            variant="outline"
            onClick={props.onAddProjectPath}
            disabled={props.busy || !props.manualPath.trim()}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 max-h-[calc(100vh-220px)] space-y-3 overflow-y-auto pr-1">
        {props.projects.map((project) => {
          const isActiveProject = project.id === props.activeProjectId;
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
                onClick={() => props.onSelectProject(project.id)}
              >
                <p className="font-medium">{project.name}</p>
                <p className="truncate text-xs text-[var(--muted-foreground)]">{project.rootPath}</p>
              </button>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Sessions
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => props.onCreateSession(project.id)}
                  disabled={props.busy}
                >
                  <Plus className="size-4" />
                </Button>
              </div>

              <div className="mt-2 space-y-1">
                {project.sessions.length === 0 ? (
                  <p className="text-xs text-[var(--muted-foreground)]">No sessions yet.</p>
                ) : (
                  project.sessions.map((session) => {
                    const active =
                      props.activeProjectId === project.id &&
                      props.activeSessionId === session.id;
                    return (
                      <button
                        key={session.id}
                        type="button"
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                          active
                            ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                            : "hover:bg-[var(--surface-strong)]"
                        }`}
                        onClick={() => props.onSelectSession(project.id, session.id)}
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
  );
}
